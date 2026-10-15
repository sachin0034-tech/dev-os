import 'server-only';
import { z } from 'zod';

// Server environment — parsed once, on first use; throws if anything is missing.
// docs/specs/project-setup-and-conventions.md §6
const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  // Azure AI Foundry agent (skills/azure-ai-foundry)
  AZURE_API_KEY: z.string().min(20),
  AZURE_AGENT_ENDPOINT: z.string().url().refine((u) => u.includes('services.ai.azure.com'), {
    message: 'Use the AI Foundry project/agent endpoint (services.ai.azure.com), not an openai.azure.com URL',
  }),
  AZURE_AGENT_NAME: z.string().min(1),
  // Cost logging (defaults: gpt-4.1-mini list price per 1M tokens)
  AI_PRICE_INPUT_PER_1M: z.coerce.number().positive().default(0.4),
  AI_PRICE_OUTPUT_PER_1M: z.coerce.number().positive().default(1.6),
  COST_ALERT_DAILY_USD: z.coerce.number().positive().default(15),
  CRON_SECRET: z.string().min(32),
  MAX_CHAT_HISTORY: z.coerce.number().int().min(1).max(1000).default(100),
  AI_MOCK_MODE: z
    .enum(['true', 'false', ''])
    .optional()
    .transform((v) => v === 'true'),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;
let cached: ServerEnv | undefined;

function load(): ServerEnv {
  if (cached) return cached;
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const names = Object.keys(result.error.flatten().fieldErrors).join(', ');
    throw new Error(`Invalid or missing environment variables: ${names}. See .env.example.`);
  }
  if (result.data.AI_MOCK_MODE && process.env.VERCEL_ENV === 'production') {
    throw new Error('AI_MOCK_MODE must not be enabled in production');
  }
  cached = result.data;
  return cached;
}

// Validated on first access (not at import) so `next build` doesn't need runtime secrets.
// The error names the offending variables but never their values.
export const env = new Proxy({} as ServerEnv, {
  get: (_target, key: string) => load()[key as keyof ServerEnv],
});
