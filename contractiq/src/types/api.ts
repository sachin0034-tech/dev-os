// API response shapes (camelCase). DB rows are mapped in lib/services/mappers.ts.
// docs/specs/results-page-and-key-terms.md §3

export type ContractType = 'NDA' | 'MSA';
export type ContractStatus = 'uploading' | 'ready' | 'processing' | 'completed' | 'error';
export type ConfidenceBand = 'high' | 'medium' | 'low';

export interface ContractSummary {
  id: string;
  fileName: string;
  contractType: ContractType;
  status: ContractStatus;
  pageCount: number | null;
  createdAt: string;
  processingCompletedAt: string | null;
  lowConfidenceCount: number;
}

export interface ContractDetail extends ContractSummary {
  hasPdf: boolean;
  pdfDeletedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  promptVersion: string | null;
  wordCount: number | null;
  tokenCount: number | null;
}

export interface KeyTerm {
  id: string;
  termKey: string;
  termName: string;
  value: string | null;
  originalValue: string | null;
  pageNumber: number | null;
  confidenceScore: number;
  confidenceBand: ConfidenceBand;
  sourceSentence: string | null;
  isCustom: boolean;
  isEdited: boolean;
  editedAt: string | null;
  flags: string[];
}

export interface CustomTerm {
  id: string;
  termName: string;
  termKey: string;
}

export interface FeedbackValue {
  rating: 1 | -1;
  comment: string | null;
}

export interface ContractDetailResponse {
  contract: ContractDetail;
  keyTerms: KeyTerm[];
  customTerms: CustomTerm[];
  feedback: FeedbackValue | null;
  contractText?: string;
}

export interface ContractListResponse {
  items: ContractSummary[];
  total: number;
  page: number;
  pageSize: number;
  summary: { total: number; nda: number; msa: number };
}

export type ChatSource = 'contract' | 'history' | 'both';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  queryType: ChatSource | null;
  citedPages: number[];
  missingCitation: boolean;
  isPartial: boolean;
  createdAt: string;
}

export type Plan = 'trial' | 'starter' | 'growth' | 'pro';
export type QuotaReason = 'TRIAL_EXHAUSTED' | 'TRIAL_EXPIRED' | 'PLAN_LIMIT';

export interface Usage {
  plan: Plan;
  periodStart: string;
  periodEnd: string;
  analysesUsed: number;
  analysesLimit: number | null;
  canAnalyse: boolean;
  reason: QuotaReason | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    fieldErrors?: Record<string, string[]>;
    reason?: string;
    detail?: string;
  };
}
