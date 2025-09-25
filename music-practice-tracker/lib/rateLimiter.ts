import logger from "@/lib/logger";

// Lazy import rate-limiter-flexible and ioredis to keep cold starts lighter
let RateLimiterRedis: any;
let RateLimiterMemory: any;
let Redis: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ({ RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible'));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Redis = require('ioredis');
} catch {
  // No deps installed; we'll only be able to use a minimal in-memory limiter below
}

// Create Redis client if URL available and dependencies are present
function createRedisClient() {
  try {
    if (!Redis) return null;
    const url = process.env.REDIS_URL;
    if (!url) return null;
    const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
    return client;
  } catch (e) {
    logger.warn('rate_limiter_redis_init_failed', { error: (e as Error)?.message });
    return null;
  }
}

const redis = createRedisClient();

// Helper to build a limiter either backed by Redis or in-memory fallback
function buildLimiter(opts: { keyPrefix: string; points: number; duration: number; blockDuration?: number }) {
  if (redis && RateLimiterRedis) {
    return new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: opts.keyPrefix,
      points: opts.points,
      duration: opts.duration,
      blockDuration: opts.blockDuration ?? 0,
      insuranceLimiter: RateLimiterMemory ? new RateLimiterMemory({ points: opts.points, duration: opts.duration }) : undefined,
    });
  }
  // In-memory per-instance fallback (not truly global on serverless)
  if (RateLimiterMemory) {
    return new RateLimiterMemory({ points: opts.points, duration: opts.duration, keyPrefix: opts.keyPrefix });
  }
  // Last resort: noop limiter
  return {
    async consume() { return; }
  } as any;
}

// Per-user generic limit: 60 req/min
const userLimiter = buildLimiter({ keyPrefix: 'rl_user', points: 60, duration: 60, blockDuration: 60 });

// AI endpoint limit per-user: 10 req/min
const aiLimiter = buildLimiter({ keyPrefix: 'rl_ai', points: 10, duration: 60, blockDuration: 300 });

// Global limiter (all users, all endpoints): e.g., 300 req/min
const globalLimiter = buildLimiter({ keyPrefix: 'rl_global', points: 300, duration: 60 });

export async function checkRateLimit(userId: string, endpoint: string): Promise<void> {
  try {
    // Global limit first to shed load early
    await (globalLimiter as any).consume('global');

    // Per-user generic
    await (userLimiter as any).consume(userId || 'anon');

    // Per-endpoint (AI only)
    if (["parseEntry", "weeklyInsights", "dailyTip"].includes(endpoint)) {
      await (aiLimiter as any).consume(`${userId || 'anon'}:${endpoint}`);
    }
  } catch (rej: any) {
    const ms = Math.max(0, Math.round((rej?.msBeforeNext ?? 0) / 1000));
    const key = 'rate_limit_exceeded';
    logger.warn(key, { endpoint, userId, retryAfterSec: ms });
    const err: any = new Error(`Rate limit exceeded. Try again in ${ms} seconds.`);
    err.retryAfter = ms;
    throw err;
  }
}


