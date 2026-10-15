import { FileText } from 'lucide-react';

export function UploadProgress({ fileName, phase }: { fileName: string; phase: 'uploading' | 'extracting' }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-default bg-primary p-4" aria-live="polite">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 shrink-0 text-brand" aria-hidden />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-body-lg">{fileName}</span>
          <span className="text-body-sm text-secondary">
            {phase === 'uploading' ? `Uploading ${fileName}…` : 'Extracting text…'}
          </span>
        </div>
      </div>
      <div className="h-1 overflow-hidden rounded-sm bg-subtle" role="progressbar" aria-label="Upload progress">
        <div className="h-full w-1/3 animate-[ci-indeterminate_1.2s_ease-in-out_infinite] rounded-sm bg-brand" />
      </div>
    </div>
  );
}
