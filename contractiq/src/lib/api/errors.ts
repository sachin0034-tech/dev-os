import { NextResponse } from 'next/server';

// Error catalog — docs/specs/api-conventions.md §4
export const ERROR_CATALOG = {
  VALIDATION_ERROR: { status: 422, message: 'Some fields are invalid.' },
  PROMPT_INJECTION: {
    status: 400,
    message:
      "Your message looks like an attempt to change the assistant's instructions, so it wasn't sent. Please rephrase your question about the contract.",
  },
  INVALID_CREDENTIALS: { status: 401, message: 'Email or password is incorrect.' },
  EMAIL_NOT_CONFIRMED: { status: 403, message: 'Please verify your email first. We can resend the link.' },
  FORBIDDEN_ORIGIN: { status: 403, message: 'Request blocked.' },
  UNAUTHENTICATED: { status: 401, message: 'Please sign in to continue.' },
  UNAUTHORIZED_CRON: { status: 401, message: 'Unauthorized.' },
  QUOTA_EXCEEDED: { status: 402, message: "You've used all analyses in your free trial." },
  NOT_FOUND: { status: 404, message: "We couldn't find that contract." },
  INVALID_STATE: { status: 409, message: "This action isn't available right now." },
  ALREADY_PROCESSING: { status: 409, message: 'This contract is already being analysed.' },
  CHAT_NOT_READY: { status: 409, message: 'Chat is available once the analysis finishes.' },
  CUSTOM_TERM_DUPLICATE: { status: 409, message: 'That term is already in the list.' },
  PDF_UNAVAILABLE: { status: 410, message: 'PDF preview unavailable — showing extracted text.' },
  FILE_TOO_LARGE: { status: 413, message: 'PDF must be 10 MB or smaller.' },
  NOT_A_PDF: { status: 415, message: 'Only PDF files are supported.' },
  TOO_MANY_PAGES: { status: 422, message: 'Contracts must be 20 pages or fewer.' },
  SCANNED_PDF: { status: 422, message: 'Scanned PDFs are not supported yet.' },
  CONTRACT_TOO_LONG: {
    status: 422,
    message:
      'This contract is too long for now (max ~15,000 tokens). Longer contract support is coming.',
  },
  PDF_UNREADABLE: {
    status: 422,
    message: "We couldn't read this PDF. It may be corrupted or password-protected.",
  },
  CUSTOM_TERM_LIMIT: { status: 422, message: 'You can add up to 5 custom terms.' },
  UPLOAD_MISSING: { status: 424, message: "Upload didn't complete. Please try again." },
  RATE_LIMITED: { status: 429, message: "You're doing that too often. Try again in a minute." },
  INTERNAL: { status: 500, message: 'Something went wrong. Please try again.' },
  AI_UNAVAILABLE: {
    status: 502,
    message: "We couldn't analyse this contract. Try again in a few minutes.",
  },
  AI_INVALID_OUTPUT: {
    status: 502,
    message: "We couldn't analyse this contract. Try again in a few minutes.",
  },
  STORAGE_UNAVAILABLE: { status: 503, message: 'File storage is temporarily unavailable.' },
  AI_TIMEOUT: { status: 504, message: 'Analysis took too long. Try again in a few minutes.' },
  STALE_PROCESSING: { status: 409, message: 'Analysis was interrupted. Try again.' },
} as const satisfies Record<string, { status: number; message: string }>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly meta?: {
      retryAfterSeconds?: number;
      fieldErrors?: Record<string, string[]>;
      reason?: string;
      detail?: string; // real provider error text (Azure), surfaced for diagnosis
    },
    options?: { cause?: unknown },
  ) {
    super(code, options);
    this.name = 'AppError';
  }

  get status(): number {
    return ERROR_CATALOG[this.code].status;
  }

  get userMessage(): string {
    return ERROR_CATALOG[this.code].message;
  }
}

export function toErrorResponse(err: AppError, requestId: string) {
  const headers: Record<string, string> = { 'x-request-id': requestId };
  if (err.meta?.retryAfterSeconds !== undefined) {
    headers['Retry-After'] = String(Math.max(1, Math.ceil(err.meta.retryAfterSeconds)));
  }
  return NextResponse.json(
    {
      error: {
        code: err.code,
        message: err.userMessage,
        requestId,
        ...(err.meta?.fieldErrors ? { fieldErrors: err.meta.fieldErrors } : {}),
        ...(err.meta?.reason ? { reason: err.meta.reason } : {}),
        ...(err.meta?.detail ? { detail: err.meta.detail } : {}),
      },
    },
    { status: err.status, headers },
  );
}

type PgLikeError = { code?: string; message?: string; details?: string | null } | null | undefined;

// Postgres → AppError mapping — docs/specs/api-conventions.md §4
export function mapPgError(err: PgLikeError): AppError {
  const code = err?.code;
  const message = `${err?.message ?? ''} ${err?.details ?? ''}`;
  if (code === '23505' && message.includes('custom_key_terms_contract_name_unique')) {
    return new AppError('CUSTOM_TERM_DUPLICATE');
  }
  if (code === 'P0001' && message.includes('CUSTOM_TERM_LIMIT')) {
    return new AppError('CUSTOM_TERM_LIMIT');
  }
  if (code === 'P0002' || code === '23503' || code === '42501') return new AppError('NOT_FOUND');
  if (code === '22P02') return new AppError('VALIDATION_ERROR');
  return new AppError('INTERNAL', undefined, { cause: err });
}
