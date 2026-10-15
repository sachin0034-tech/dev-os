'use client';

import { SendHorizontal, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MAX_CHAT_MESSAGE_CHARS } from '@/lib/constants/limits';

export function ChatComposer({
  onSend,
  onStop,
  streaming,
  disabledFor,
  prefill,
}: {
  onSend: (message: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabledFor?: number; // seconds (rate limited)
  prefill?: { text: string; nonce: number };
}) {
  const [value, setValue] = useState('');
  const [wait, setWait] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (disabledFor) setWait(disabledFor);
  }, [disabledFor]);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  useEffect(() => {
    if (prefill) {
      setValue(prefill.text);
      ref.current?.focus();
    }
  }, [prefill]);

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 6 * 24 + 16)}px`;
  };

  const submit = () => {
    const text = value.trim();
    if (!text || streaming || wait > 0) return;
    onSend(text);
    setValue('');
    requestAnimationFrame(grow);
  };

  return (
    <div className="flex flex-col gap-1 border-t border-default bg-primary p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={MAX_CHAT_MESSAGE_CHARS}
          placeholder="Ask about this contract…"
          aria-label="Ask about this contract"
          onChange={(e) => {
            setValue(e.target.value);
            grow();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-40 min-h-10 flex-1 resize-none rounded-md border border-default bg-primary px-3 py-2 text-body-lg placeholder:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />
        {streaming ? (
          <Button variant="secondary" size="icon" className="h-10 w-10" aria-label="Stop generating" onClick={onStop}>
            <Square className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button size="icon" className="h-10 w-10" aria-label="Send" onClick={submit} disabled={!value.trim() || wait > 0}>
            <SendHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
      <span className="text-body-sm text-secondary">
        {wait > 0
          ? `Too many questions — try again in ${wait}s.`
          : value.length > 1800
            ? `${value.length}/${MAX_CHAT_MESSAGE_CHARS}`
            : 'Enter to send · Shift+Enter for a new line'}
      </span>
    </div>
  );
}
