import { supaServer } from "@/lib/supabaseServer";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rateLimiter";

export class RateLimitError extends Error {
  constructor(message = "rate limit exceeded") {
    super(message);
    this.name = "RateLimitError";
  }
}

export class QuotaExceededError extends Error {
  constructor(message = "token quota exceeded") {
    super(message);
    this.name = "QuotaExceededError";
  }
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

// Default limits (override via env)
const DEFAULT_REQUESTS_PER_MINUTE = envInt("AI_MAX_REQUESTS_PER_MINUTE", 10);
const DEFAULT_REQUESTS_PER_DAY = envInt("AI_MAX_REQUESTS_PER_DAY", 200);
const DEFAULT_TOKENS_PER_MONTH = envInt("AI_MAX_TOKENS_PER_MONTH", 200_000);

export type AiEndpoint = "parseEntry" | "weeklyInsights" | "dailyTip";

export interface EnforceOptions {
  endpoint: AiEndpoint;
  model: string;
  // Optional pre-call estimate for conservative blocking
  estimatedTotalTokens?: number;
}

export interface RecordUsageParams {
  userId: string;
  endpoint: AiEndpoint;
  model: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
}

export async function enforceAiLimits(userId: string, opts: EnforceOptions): Promise<void> {
  const sb = supaServer();

  // Read per-user overrides if exist
  const { data: limits } = await sb
    .from("ai_limits")
    .select("requests_per_minute, requests_per_day, tokens_per_month")
    .eq("user_id", userId)
    .single();

  const reqPerMinute = limits?.requests_per_minute ?? DEFAULT_REQUESTS_PER_MINUTE;
  const reqPerDay = limits?.requests_per_day ?? DEFAULT_REQUESTS_PER_DAY;
  const tokensPerMonth = limits?.tokens_per_month ?? DEFAULT_TOKENS_PER_MONTH;

  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const todayStart = midnight.toISOString();

  // Count recent requests for rate limiting
  const { count: minuteCount } = await sb
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneMinuteAgo);

  if ((minuteCount ?? 0) >= reqPerMinute) {
    throw new RateLimitError("Too many AI requests per minute");
  }

  const { count: dayCount } = await sb
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", todayStart);

  if ((dayCount ?? 0) >= reqPerDay) {
    throw new RateLimitError("Daily AI request limit reached");
  }

  // Monthly tokens quota
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data: monthAgg } = await sb
    .from("ai_usage")
    .select("total_tokens")
    .eq("user_id", userId)
    .gte("created_at", firstOfMonth);

  const usedThisMonth = (monthAgg || []).reduce((sum, row: any) => sum + (row.total_tokens || 0), 0);
  const projected = usedThisMonth + (opts.estimatedTotalTokens || 0);
  if (projected > tokensPerMonth) {
    throw new QuotaExceededError("Monthly AI token quota reached");
  }

  // Distributed/global rate limit (Redis if available, memory fallback otherwise)
  try {
    await checkRateLimit(userId, opts.endpoint);
  } catch (e: any) {
    throw new RateLimitError(e?.message || "Rate limit exceeded");
  }
}

export async function recordAiUsage(params: RecordUsageParams): Promise<void> {
  const sb = supaServer();
  const totalTokens = (params.totalTokens ?? ((params.promptTokens ?? 0) + (params.completionTokens ?? 0))) ?? null;
  const costUsd = totalTokens != null ? calculateCost(params.model, totalTokens) : null;
  try {
    await sb.from("ai_usage").insert({
      user_id: params.userId,
      endpoint: params.endpoint,
      model: params.model,
      prompt_tokens: params.promptTokens ?? null,
      completion_tokens: params.completionTokens ?? null,
      total_tokens: totalTokens,
      cost_usd: costUsd,
      status: 'completed',
      created_at: new Date().toISOString()
    });
  } catch (error: any) {
    // Do not fail main request on telemetry error
    logger.error('ai_usage_tracking_failed', {
      userId: params.userId,
      endpoint: params.endpoint,
      model: params.model,
      error: error?.message
    });
  }
}

function calculateCost(model: string, tokens: number): number | null {
  if (!Number.isFinite(tokens)) return null;
  // Approximate rates per 1K tokens (USD). Adjust as needed.
  const per1k: Record<string, number> = {
    'gpt-4o-mini': 0.15 / 1000, // $0.15 / 1K
    'gpt-4': 0.03 / 1000
  };
  const rate = per1k[model] ?? (0.15 / 1000);
  return Math.round(tokens * rate * 1e6) / 1e6; // round to 6 decimals
}


