import logger from "@/lib/logger";

// Simple in-memory rate limiter without Redis dependencies
class SimpleRateLimiter {
  private counters: Map<string, { count: number; resetTime: number }> = new Map();
  
  constructor(
    private points: number,
    private duration: number,
    private blockDuration: number = 0
  ) {}

  async consume(key: string): Promise<void> {
    const now = Date.now();
    const resetTime = now + (this.duration * 1000);
    
    const existing = this.counters.get(key);
    
    if (existing) {
      if (now < existing.resetTime) {
        // Still within the time window
        if (existing.count >= this.points) {
          const msBeforeNext = existing.resetTime - now;
          const error: any = new Error(`Rate limit exceeded. Try again in ${Math.ceil(msBeforeNext / 1000)} seconds.`);
          error.msBeforeNext = msBeforeNext;
          throw error;
        }
        existing.count++;
      } else {
        // Time window expired, reset counter
        this.counters.set(key, { count: 1, resetTime });
      }
    } else {
      // First request for this key
      this.counters.set(key, { count: 1, resetTime });
    }
  }
}

// Helper to build a simple in-memory limiter
function buildLimiter(opts: { keyPrefix: string; points: number; duration: number; blockDuration?: number }) {
  return new SimpleRateLimiter(opts.points, opts.duration, opts.blockDuration ?? 0);
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
    await globalLimiter.consume('global');

    // Per-user generic
    await userLimiter.consume(userId || 'anon');

    // Per-endpoint (AI only)
    if (["parseEntry", "weeklyInsights", "dailyTip"].includes(endpoint)) {
      await aiLimiter.consume(`${userId || 'anon'}:${endpoint}`);
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


