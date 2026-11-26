export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Production serverless note:
 * In multi-instance or ephemeral serverless deployments (e.g., Vercel Functions),
 * in-memory state is scoped per warm runtime instance and resets on cold starts.
 * For distributed production traffic, back this interface with a shared store
 * such as Upstash Redis or Vercel KV.
 */
export class SlidingWindowRateLimiter {
  private readonly store = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxKeys: number;

  constructor(options: {
    windowMs: number;
    maxRequests: number;
    maxKeys?: number;
  }) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.maxKeys = options.maxKeys ?? 500;
  }

  consume(clientKey: string, nowMs = Date.now()): RateLimitResult {
    const windowStart = nowMs - this.windowMs;
    const existing = this.store.get(clientKey) ?? [];
    const recent = existing.filter((ts) => ts > windowStart);

    if (recent.length >= this.maxRequests) {
      this.store.set(clientKey, recent);
      const oldest = recent[0] ?? nowMs;
      const retryAfterMs = Math.max(1000, oldest + this.windowMs - nowMs);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    recent.push(nowMs);
    this.store.set(clientKey, recent);

    if (this.store.size > this.maxKeys) {
      for (const [key, timestamps] of this.store.entries()) {
        if (timestamps.every((ts) => ts <= windowStart)) {
          this.store.delete(key);
        }
      }
    }

    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - recent.length),
      retryAfterSeconds: 0,
    };
  }
}

export function extractClientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return headers.get("x-real-ip")?.trim() || "local";
}
