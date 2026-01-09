import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

/**
 * Rate limiter for login attempts
 * Limits to 5 attempts per 15 minutes per IP address
 */
export const loginRateLimiter = new Ratelimit({
  redis: redis as any,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  prefix: "ratelimit:login",
  analytics: true,
});

/**
 * Check if an IP address has exceeded login rate limit
 * @param ip - IP address to check
 * @returns Object with success boolean and remaining attempts
 */
export async function checkLoginRateLimit(ip: string) {
  try {
    const { success, limit, remaining, reset } = await loginRateLimiter.limit(
      `login:${ip}`,
    );

    return {
      success,
      limit,
      remaining,
      reset,
    };
  } catch (error) {
    // If rate limiting fails (e.g., Redis down), allow the request
    console.warn("Rate limiting check failed:", error);
    return {
      success: true,
      limit: 5,
      remaining: 5,
      reset: Date.now() + 15 * 60 * 1000,
    };
  }
}
