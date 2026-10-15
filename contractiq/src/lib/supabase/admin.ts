import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { env } from '@/lib/env';

// Service-role client: bypasses RLS. Use ONLY after verifying ownership with the
// user-scoped client (docs/specs/api-conventions.md §2).
let admin: ReturnType<typeof createClient<Database>> | undefined;

export function createAdminClient() {
  admin ??= createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

export type AdminSupabase = ReturnType<typeof createAdminClient>;
