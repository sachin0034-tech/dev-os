import 'server-only';
import { PDF_RETENTION_DAYS } from '@/lib/constants/limits';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';
import { contractPdfPath, removePdfs } from './storage.service';

const BATCH = 100;
const TIME_BUDGET_MS = 50_000;
const DAY_MS = 86_400_000;

export interface RetentionResult {
  pdfsDeleted: number;
  abandonedUploads: number;
  staleReset: number;
  rateLimitRowsPruned: number;
  spend24hUsd: number;
}

// Daily maintenance — docs/specs/retention-and-deletion.md §4. Each job is isolated and idempotent.
export async function runRetention(): Promise<RetentionResult> {
  const admin = createAdminClient();
  const started = Date.now();
  const inBudget = () => Date.now() - started < TIME_BUDGET_MS;
  const result: RetentionResult = { pdfsDeleted: 0, abandonedUploads: 0, staleReset: 0, rateLimitRowsPruned: 0, spend24hUsd: 0 };
  const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

  // 1. PDFs not viewed for 90 days (extracted text is kept).
  try {
    while (inBudget()) {
      const { data, error } = await admin
        .from('contracts')
        .select('id, file_path')
        .not('file_path', 'is', null)
        .lt('last_accessed_at', iso(PDF_RETENTION_DAYS * DAY_MS))
        .limit(BATCH);
      if (error) throw error;
      if (!data?.length) break;
      await removePdfs(data.map((r) => r.file_path!));
      const { error: upErr } = await admin
        .from('contracts')
        .update({ file_path: null, pdf_deleted_at: new Date().toISOString() })
        .in('id', data.map((r) => r.id));
      if (upErr) throw upErr;
      result.pdfsDeleted += data.length;
      if (data.length < BATCH) break;
    }
  } catch (err) {
    logger.error('retention.pdf_expiry_failed', { err });
  }

  // 2. Abandoned uploads older than 24 h.
  try {
    while (inBudget()) {
      const { data, error } = await admin
        .from('contracts')
        .select('id, user_id')
        .eq('status', 'uploading')
        .lt('created_at', iso(DAY_MS))
        .limit(BATCH);
      if (error) throw error;
      if (!data?.length) break;
      await removePdfs(data.map((r) => contractPdfPath(r.user_id, r.id)));
      const { error: delErr } = await admin.from('contracts').delete().in('id', data.map((r) => r.id));
      if (delErr) throw delErr;
      result.abandonedUploads += data.length;
      if (data.length < BATCH) break;
    }
  } catch (err) {
    logger.error('retention.abandoned_failed', { err });
  }

  // 3. Processing stuck for more than 10 minutes → retryable error.
  try {
    const { data, error } = await admin
      .from('contracts')
      .update({ status: 'error', error_code: 'STALE_PROCESSING', error_message: 'Analysis was interrupted. Try again.' })
      .eq('status', 'processing')
      .lt('processing_started_at', iso(10 * 60_000))
      .select('id');
    if (error) throw error;
    result.staleReset = data?.length ?? 0;
  } catch (err) {
    logger.error('retention.stale_failed', { err });
  }

  // 4. Old rate-limit windows.
  try {
    // Longest window is 24 h, so older events can never affect a decision.
    const { data, error } = await admin
      .from('rate_limit_events')
      .delete()
      .lt('created_at', iso(DAY_MS + 60_000))
      .select('id');
    if (error) throw error;
    result.rateLimitRowsPruned = data?.length ?? 0;
  } catch (err) {
    logger.error('retention.rate_limits_failed', { err });
  }

  // 5. Daily cost check.
  try {
    const { data, error } = await admin
      .from('usage_events')
      .select('cost_usd, event_type, success')
      .gte('created_at', iso(DAY_MS));
    if (error) throw error;
    const rows = data ?? [];
    result.spend24hUsd = Number(rows.reduce((s, r) => s + Number(r.cost_usd), 0).toFixed(4));
    const analyses = rows.filter((r) => r.event_type === 'extraction' && r.success).map((r) => Number(r.cost_usd)).sort((a, b) => a - b);
    const p95 = analyses.length ? analyses[Math.min(analyses.length - 1, Math.floor(analyses.length * 0.95))] : 0;
    logger.info('cost.daily', { spend24h: result.spend24hUsd, analyses24h: analyses.length, p95CostPerAnalysis: p95 });
    if (result.spend24hUsd > env.COST_ALERT_DAILY_USD) {
      logger.error('cost.alert', { spend24h: result.spend24hUsd, threshold: env.COST_ALERT_DAILY_USD });
    }
  } catch (err) {
    logger.error('retention.cost_check_failed', { err });
  }

  logger.info('retention.run', { ...result, durationMs: Date.now() - started });
  return result;
}
