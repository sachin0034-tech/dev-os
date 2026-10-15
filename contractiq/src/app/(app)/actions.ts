'use server';

import { getCurrentUser } from '@/lib/auth/get-user';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

// Marks the first-run tour as seen (docs/specs/landing-and-onboarding.md §5).
export async function completeOnboarding(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) logger.warn('onboarding.update_failed', { userId: user.id, code: error.code });
}
