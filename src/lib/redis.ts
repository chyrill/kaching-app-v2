/**
 * Redis Client with Environment-Based Configuration
 * 
 * Supports three configurations:
 * 1. Production: Upstash Redis REST API (serverless-friendly)
 * 2. Development: Local Redis via ioredis (Docker container)
 * 3. Fallback: Mock client with console warnings (no Redis available)
 */

import { Redis as UpstashRedis } from "@upstash/redis";
import Redis from "ioredis";
import { env } from "~/env";

// Redis client interface for unified usage
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expirationSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  expire(key: string, seconds: number): Promise<void>;
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
}

// Mock Redis client for when Redis is unavailable
class MockRedis implements RedisClient {
  async get(key: string): Promise<string | null> {
    console.warn(`⚠️  MockRedis: GET ${key} (Redis unavailable)`);
    return null;
  }

  async set(key: string, _value: string): Promise<void> {
    console.warn(`⚠️  MockRedis: SET ${key} (Redis unavailable)`);
  }

  async del(key: string): Promise<void> {
    console.warn(`⚠️  MockRedis: DEL ${key} (Redis unavailable)`);
  }

  async expire(key: string, seconds: number): Promise<void> {
    console.warn(`⚠️  MockRedis: EXPIRE ${key} ${seconds} (Redis unavailable)`);
  }

  async incr(key: string): Promise<number> {
    console.warn(`⚠️  MockRedis: INCR ${key} (Redis unavailable)`);
    return 0;
  }

  async decr(key: string): Promise<number> {
    console.warn(`⚠️  MockRedis: DECR ${key} (Redis unavailable)`);
    return 0;
  }
}

// Upstash Redis adapter (for production)
class UpstashRedisAdapter implements RedisClient {
  constructor(private client: UpstashRedis) {}

  async get(key: string): Promise<string | null> {
    const result = await this.client.get<string>(key);
    return result;
  }

  async set(key: string, value: string, expirationSeconds?: number): Promise<void> {
    if (expirationSeconds) {
      await this.client.setex(key, expirationSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async decr(key: string): Promise<number> {
    return await this.client.decr(key);
  }
}

// IORedis adapter (for local development)
class IORedisAdapter implements RedisClient {
  constructor(private client: Redis) {}

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async set(key: string, value: string, expirationSeconds?: number): Promise<void> {
    if (expirationSeconds) {
      await this.client.setex(key, expirationSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async decr(key: string): Promise<number> {
    return await this.client.decr(key);
  }
}

// Create Redis client based on environment
function createRedisClient(): RedisClient {
  // Production: Use Upstash Redis REST API
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    console.log("✅ Using Upstash Redis (production)");
    const upstashClient = new UpstashRedis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
    return new UpstashRedisAdapter(upstashClient);
  }

  // Development: Use local Redis via ioredis
  if (env.REDIS_URL) {
    console.log("✅ Using local Redis (development)");
    const ioredisClient = new Redis(env.REDIS_URL);
    return new IORedisAdapter(ioredisClient);
  }

  // Fallback: Mock client (Redis unavailable)
  console.warn("⚠️  Redis unavailable - using mock client");
  return new MockRedis();
}

// Export singleton Redis client
export const redis = createRedisClient();

// Export types
export type { RedisClient };
