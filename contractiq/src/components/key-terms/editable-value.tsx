'use client';

import { Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MAX_TERM_VALUE_CHARS } from '@/lib/constants/limits';
import { cn } from '@/lib/utils/cn';

const COUNTER_FROM = 1800;
const CLAMP_FROM = 280;

// Inline value editor — docs/specs/key-term-editing.md §6.
export function EditableValue({
  termName,
  value,
  onSave,
}: {
  termName: string;
  value: string | null;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!editing || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 8 * 24 + 16)}px`;
  };

  const close = () => {
    setEditing(false);
    requestAnimationFrame(() => editButtonRef.current?.focus());
  };

  const save = () => {
    if (draft.trim() !== (value ?? '')) onSave(draft);
    close();
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          aria-label={`Edit ${termName}`}
          value={draft}
          maxLength={MAX_TERM_VALUE_CHARS}
          rows={2}
          onChange={(e) => {
            setDraft(e.target.value);
            autoGrow(e.target);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              save();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(value ?? '');
              close();
            }
          }}
          className="w-full resize-none rounded-md border border-default bg-primary px-3 py-2 text-body-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-body-sm text-secondary">
            {draft.length > COUNTER_FROM ? `${draft.length}/${MAX_TERM_VALUE_CHARS}` : 'Enter to save · Esc to cancel'}
          </span>
          <span className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => { setDraft(value ?? ''); close(); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              Save
            </Button>
          </span>
        </div>
      </div>
    );
  }

  const long = (value?.length ?? 0) > CLAMP_FROM;
  return (
    <div className="group flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            'w-full whitespace-pre-wrap break-words text-left text-body-lg',
            value === null ? 'text-secondary' : 'text-primary',
            long && !expanded && 'line-clamp-6',
          )}
          aria-label={`${termName}: ${value ?? 'Not found in document'}. Click to edit.`}
        >
          {value ?? 'Not found in document'}
        </button>
        {long && (
          <button type="button" onClick={() => setExpanded((e) => !e)} className="text-body-sm text-brand hover:underline">
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
      <Button
        ref={editButtonRef}
        variant="ghost"
        size="icon"
        aria-label={`Edit ${termName}`}
        onClick={() => setEditing(true)}
        className="shrink-0 text-secondary"
      >
        <Pencil className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
