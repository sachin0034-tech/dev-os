import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

// Request-scoped current user (validated with Supabase). null when signed out.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? '' };
});

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, email, plan, trial_ends_at, onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle();
  return data;
});
