import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

// Browser client — only for Storage signed uploads and auth state. RLS applies.
let client: ReturnType<typeof createSupabaseBrowserClient<Database>> | undefined;

export function createBrowserClient() {
  client ??= createSupabaseBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
