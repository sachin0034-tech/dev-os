'use client';

import { create } from 'zustand';
import { ApiError, apiFetch } from '@/lib/api/client';
import { MAX_CUSTOM_TERMS } from '@/lib/constants/limits';
import { createBrowserClient } from '@/lib/supabase/client';
import type { ContractDetail, ContractType, CustomTerm } from '@/types/api';

// Upload wizard state — docs/specs/contract-upload-and-extraction.md §6, custom-key-terms.md §7.

export type UploadStep = 'select' | 'uploading' | 'extracting' | 'preview' | 'processing' | 'error';

export interface CustomTermDraft {
  tempId: string;
  id?: string;
  termName: string;
  status: 'queued' | 'saving' | 'saved' | 'error';
  error?: string;
  pendingRemoval?: boolean;
}

export interface UploadError {
  code: string;
  message: string;
}

interface InitResponse {
  contractId: string;
  storagePath: string;
  uploadToken: string | null;
  maxDirectUploadBytes: number;
}

interface ExtractResponse {
  contract: ContractDetail;
}

interface UploadState {
  step: UploadStep;
  contractType: ContractType | null;
  fileName: string | null;
  contractId: string | null;
  contract: ContractDetail | null;
  error: UploadError | null;
  drafts: CustomTermDraft[];
  setContractType: (t: ContractType) => void;
  startUpload: (file: File) => Promise<void>;
  addTerm: (termName: string) => void;
  removeTerm: (tempId: string) => Promise<void>;
  retryTerm: (tempId: string) => void;
  setStep: (step: UploadStep) => void;
  setError: (error: UploadError | null) => void;
  resume: (contract: ContractDetail, customTerms: CustomTerm[]) => void;
  reset: () => void;
}

const toUploadError = (err: unknown): UploadError =>
  err instanceof ApiError
    ? { code: err.code, message: err.message }
    : { code: 'INTERNAL', message: 'Something went wrong. Please try again.' };

const initialState = {
  step: 'select' as UploadStep,
  contractType: null,
  fileName: null,
  contractId: null,
  contract: null,
  error: null,
  drafts: [] as CustomTermDraft[],
};

export const useUploadStore = create<UploadState>()((set, get) => {
  const updateDraft = (tempId: string, patch: Partial<CustomTermDraft>) =>
    set((s) => ({ drafts: s.drafts.map((d) => (d.tempId === tempId ? { ...d, ...patch } : d)) }));

  const saveDraft = async (tempId: string) => {
    const { contractId, drafts } = get();
    const draft = drafts.find((d) => d.tempId === tempId);
    if (!contractId || !draft) return;
    updateDraft(tempId, { status: 'saving', error: undefined });
    try {
      const saved = await apiFetch<CustomTerm>(`/api/contracts/${contractId}/custom-terms`, {
        method: 'POST',
        body: JSON.stringify({ termName: draft.termName }),
      });
      const current = get().drafts.find((d) => d.tempId === tempId);
      if (current?.pendingRemoval) {
        set((s) => ({ drafts: s.drafts.filter((d) => d.tempId !== tempId) }));
        await apiFetch(`/api/contracts/${contractId}/custom-terms/${saved.id}`, { method: 'DELETE' }).catch(
          () => undefined,
        );
        return;
      }
      updateDraft(tempId, { status: 'saved', id: saved.id });
    } catch (err) {
      updateDraft(tempId, { status: 'error', error: toUploadError(err).message });
    }
  };

  const flushQueued = async () => {
    for (const d of get().drafts.filter((x) => x.status === 'queued')) {
      // Sequential: keeps the 5-term limit deterministic.
      await saveDraft(d.tempId);
    }
  };

  const extract = async (contractId: string, body: BodyInit, isJson: boolean) =>
    apiFetch<ExtractResponse>(`/api/contracts/${contractId}/extract`, {
      method: 'POST',
      body,
      headers: isJson ? { 'content-type': 'application/json' } : undefined,
    });

  return {
    ...initialState,

    setContractType: (contractType) => set({ contractType }),
    setStep: (step) => set({ step }),
    setError: (error) => set({ error, step: error ? 'error' : get().step }),

    startUpload: async (file) => {
      const { contractType, step } = get();
      if (!contractType || step === 'uploading' || step === 'extracting') return;
      set({ step: 'uploading', fileName: file.name, error: null });

      try {
        const init = await apiFetch<InitResponse>('/api/contracts/init', {
          method: 'POST',
          body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type, contractType }),
        });
        set({ contractId: init.contractId });
        void flushQueued();

        let uploaded = false;
        if (init.uploadToken) {
          const { error } = await createBrowserClient()
            .storage.from('contracts')
            .uploadToSignedUrl(init.storagePath, init.uploadToken, file, { contentType: 'application/pdf' });
          uploaded = !error;
        }

        set({ step: 'extracting' });
        let result: ExtractResponse;
        if (uploaded) {
          result = await extract(init.contractId, JSON.stringify({ mode: 'storage' }), true);
        } else if (file.size <= init.maxDirectUploadBytes) {
          const form = new FormData();
          form.append('file', file);
          result = await extract(init.contractId, form, false);
        } else {
          throw new ApiError('UPLOAD_MISSING', 424, "Upload didn't complete. Please try again.");
        }

        set({ contract: result.contract, step: 'preview' });
      } catch (err) {
        const e = toUploadError(err);
        // Rejected files delete their contract row server-side; start the next upload fresh.
        set({ step: 'error', error: e, contractId: null, contract: null });
      }
    },

    addTerm: (termName) => {
      const { drafts } = get();
      if (drafts.length >= MAX_CUSTOM_TERMS) return;
      const tempId = crypto.randomUUID();
      set({ drafts: [...drafts, { tempId, termName, status: 'queued' }] });
      // Before the contract exists the draft stays queued and is flushed after init.
      if (get().contractId) void saveDraft(tempId);
    },

    removeTerm: async (tempId) => {
      const { drafts, contractId } = get();
      const draft = drafts.find((d) => d.tempId === tempId);
      if (!draft) return;
      if (draft.status === 'saving') {
        updateDraft(tempId, { pendingRemoval: true });
        return;
      }
      set({ drafts: drafts.filter((d) => d.tempId !== tempId) });
      if (draft.status === 'saved' && draft.id && contractId) {
        try {
          await apiFetch(`/api/contracts/${contractId}/custom-terms/${draft.id}`, { method: 'DELETE' });
        } catch (err) {
          // Restore on failure so the UI matches the server.
          set((s) => ({ drafts: [...s.drafts, { ...draft, error: toUploadError(err).message }] }));
          throw err;
        }
      }
    },

    retryTerm: (tempId) => {
      if (get().contractId) void saveDraft(tempId);
      else updateDraft(tempId, { status: 'queued', error: undefined });
    },

    resume: (contract, customTerms) =>
      set({
        ...initialState,
        step: 'preview',
        contractType: contract.contractType,
        fileName: contract.fileName,
        contractId: contract.id,
        contract,
        drafts: customTerms.map((t) => ({ tempId: t.id, id: t.id, termName: t.termName, status: 'saved' })),
      }),

    reset: () => set({ ...initialState }),
  };
});
