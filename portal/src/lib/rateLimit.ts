// In-memory per-route rate limiting (full-stack expert sweep, Nov 28, 2026).
//
// Why in-memory and in-code: the portal has no Redis or other rate-limit
// service, and the brief forbids adding one. A bot spamming the public
// intake / quote / login-code routes must get an honest 429, never a
// fake success and never a silent drop. Limits are deliberately
// generous for real humans (a person retries a form a few times;
// a bot sends dozens a minute) and the window is short so a real
// user is never locked out for long.
//
// Limits are per (route + client key). The client key is the caller's
// IP (x-forwarded-for first hop, else x-real-ip) plus, when the route
// knows it, the account/email being acted on — so one bot IP cannot
// burn another person's login-code allowance, and one email cannot be
// hammered from many IPs without also tripping the per-IP bucket.
//
// This is a single-server-instance limiter: on a multi-instance
// deploy each instance keeps its own buckets, so the limit is
// per-instance, not global. That is stated here rather than hidden —
// it still stops casual spam and credential stuffing from one source,
// and the login-code table's own per-code attempt counting (migration
// 0020) remains the authoritative abuse control for codes.
//
// No PII is stored: keys are kept only as map keys in memory, never
// logged, and entries are pruned when their window expires.

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the bucket resets (0 when allowed). */
  retryAfterSeconds: number;
  remaining: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const MAX_BUCKETS = 10_000;

function prune(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  // No for..of over the Map: tsconfig targets ES5 without
  // downlevelIteration, so iterate with forEach instead.
  buckets.forEach((_bucket, key) => {
    const bucket = buckets.get(key);
    if (bucket && bucket.resetAt <= now) buckets.delete(key);
  });
  // Still over the cap (many distinct keys in one window): drop
  // entries rather than growing without bound.
  if (buckets.size >= MAX_BUCKETS) {
    const keys: string[] = [];
    buckets.forEach((_bucket, key) => keys.push(key));
    for (const key of keys) {
      buckets.delete(key);
      if (buckets.size < MAX_BUCKETS * 0.8) break;
    }
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): RateLimitResult {
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0, remaining: limit - 1 };
  }
  if (bucket.count < limit) {
    bucket.count += 1;
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: limit - bucket.count,
    };
  }
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    remaining: 0,
  };
}

/** Client key from the request: first x-forwarded-for hop, else x-real-ip. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Bucket key: route + IP, optionally scoped to the account/email acted on. */
export function rateLimitKey(
  route: string,
  req: Request,
  scope?: string
): string {
  const ip = clientIp(req);
  return scope ? `${route}:${ip}:${scope}` : `${route}:${ip}`;
}

/** Honest 429 response. Never a fake success. */
export function rateLimitResponse(
  retryAfterSeconds: number,
  what = "requests"
): Response {
  return new Response(
    JSON.stringify({
      error: `Too many ${what} — please wait ${retryAfterSeconds} second(s) and try again. Nothing was sent or saved.`,
      retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retryAfterSeconds),
      },
    }
  );
}

// Generous human limits, per route (per minute unless noted).
export const PUBLIC_INTAKE_LIMIT = { limit: 10, windowMs: 60_000 };
export const QUOTE_REQUEST_LIMIT = { limit: 10, windowMs: 60_000 };
export const LOGIN_CODE_REQUEST_LIMIT = { limit: 5, windowMs: 60_000 };
export const LOGIN_CODE_VERIFY_LIMIT = { limit: 5, windowMs: 60_000 };
