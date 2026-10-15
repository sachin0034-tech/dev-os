// Browser-safe environment values (NEXT_PUBLIC_* are inlined at build time).
export const clientEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? '',
};
