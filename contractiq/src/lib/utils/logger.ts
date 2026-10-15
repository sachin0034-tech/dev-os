// Structured JSON logger with recursive redaction of sensitive fields.
// docs/specs/api-conventions.md §6
type Level = 'info' | 'warn' | 'error';

const REDACT = new Set([
  'contracttext',
  'contract_text',
  'content',
  'message',
  'sourcesentence',
  'source_sentence',
  'value',
  'password',
  'newpassword',
  'authorization',
  'cookie',
  'token',
  'access_token',
  'refresh_token',
  'apikey',
  'api_key',
  'secret',
  'email',
]);

function redact(input: unknown, depth = 0): unknown {
  if (depth > 6 || input === null || typeof input !== 'object') return input;
  if (input instanceof Error) return { name: input.name, message: input.message, stack: input.stack };
  if (Array.isArray(input)) return input.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = REDACT.has(k.toLowerCase()) ? '[redacted]' : redact(v, depth + 1);
  }
  return out;
}

function write(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...(redact(fields) as object) });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, fields?: Record<string, unknown>) => write('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write('error', event, fields),
};
