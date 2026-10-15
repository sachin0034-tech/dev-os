'use client';

import { FileUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { FieldError } from '@/components/ui/field-error';
import { validateFileUpload } from '@/lib/security/inputValidator';
import { cn } from '@/lib/utils/cn';

export function PdfDropzone({
  disabled,
  disabledHint,
  onFile,
}: {
  disabled?: boolean;
  disabledHint?: string;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();

  const accept = (file: File | undefined) => {
    if (!file || disabled) return;
    const check = validateFileUpload({ name: file.name, type: file.type, size: file.size });
    if (!check.ok) return setError(check.message);
    setError(undefined);
    onFile(file);
  };

  const open = () => !disabled && inputRef.current?.click();

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-describedby="dropzone-hint"
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files[0]);
        }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border border-dashed border-strong bg-surface p-12 text-center transition-colors duration-micro',
          dragging && 'border-brand bg-brand-tint',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-subtle',
        )}
      >
        <FileUp className="h-6 w-6 text-brand" aria-hidden />
        <p className="text-body-lg">
          <span className="text-brand">Choose a PDF</span> or drag it here
        </p>
        <p id="dropzone-hint" className="text-body-sm text-secondary">
          {disabled && disabledHint ? disabledHint : 'PDF up to 10 MB · 20 pages · text-based (not scanned)'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <FieldError message={error} />
    </div>
  );
}
