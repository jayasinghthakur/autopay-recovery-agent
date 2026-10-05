import { Redis } from "@upstash/redis";

/**
 * Tiny key-value layer. Uses Upstash Redis when configured (needed on Vercel, where
 * serverless instances don't share memory) and falls back to process memory for local dev.
 */
export interface KV {
  readonly kind: "redis" | "memory";
  get<T>(key: string): Promise<T | null>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  /** Set only if absent. Returns true when the value was written. */
  setnx(key: string, value: unknown, ttlSeconds: number): Promise<boolean>;
  del(keys: string[]): Promise<void>;
  incr(key: string, ttlSeconds?: number): Promise<number>;
  lpush(key: string, value: unknown, maxLen: number): Promise<void>;
  lrange<T>(key: string, count: number): Promise<T[]>;
  keys(pattern: string): Promise<string[]>;
}

function redisKV(url: string, token: string): KV {
  const redis = new Redis({ url, token });
  return {
    kind: "redis",
    get: (key) => redis.get(key),
    mget: async <T>(keys: string[]) => (keys.length ? await redis.mget<(T | null)[]>(...keys) : []),
    set: async (key, value, ttl) => {
      if (ttl) await redis.set(key, value, { ex: ttl });
      else await redis.set(key, value);
    },
    setnx: async (key, value, ttl) => (await redis.set(key, value, { nx: true, ex: ttl })) === "OK",
    del: async (keys) => {
      if (keys.length) await redis.del(...keys);
    },
    incr: async (key, ttl) => {
      const n = await redis.incr(key);
      if (ttl && n === 1) await redis.expire(key, ttl);
      return n;
    },
    lpush: async (key, value, maxLen) => {
      await redis.lpush(key, value);
      await redis.ltrim(key, 0, maxLen - 1);
    },
    lrange: (key, count) => redis.lrange(key, 0, count - 1),
    keys: (pattern) => redis.keys(pattern),
  };
}

type Entry = { value: unknown; expires?: number };

function memoryKV(): KV {
  const g = globalThis as unknown as { __avrMemory?: Map<string, Entry> };
  const map = (g.__avrMemory ??= new Map<string, Entry>());
  const read = (key: string) => {
    const e = map.get(key);
    if (!e) return null;
    if (e.expires && e.expires < Date.now()) {
      map.delete(key);
      return null;
    }
    return e.value;
  };
  const write = (key: string, value: unknown, ttl?: number) =>
    map.set(key, { value: structuredClone(value), expires: ttl ? Date.now() + ttl * 1000 : undefined });
  return {
    kind: "memory",
    get: async <T>(key: string) => structuredClone(read(key)) as T | null,
    mget: async <T>(keys: string[]) => keys.map((k) => structuredClone(read(k)) as T | null),
    set: async (key, value, ttl) => {
      write(key, value, ttl);
    },
    setnx: async (key, value, ttl) => {
      if (read(key) !== null) return false;
      write(key, value, ttl);
      return true;
    },
    del: async (keys) => {
      keys.forEach((k) => map.delete(k));
    },
    incr: async (key, ttl) => {
      const n = Number(read(key) ?? 0) + 1;
      const existing = map.get(key);
      map.set(key, { value: n, expires: existing?.expires ?? (ttl ? Date.now() + ttl * 1000 : undefined) });
      return n;
    },
    lpush: async (key, value, maxLen) => {
      const list = ((read(key) as unknown[]) ?? []).slice();
      list.unshift(structuredClone(value));
      map.set(key, { value: list.slice(0, maxLen) });
    },
    lrange: async <T>(key: string, count: number) => structuredClone(((read(key) as T[]) ?? []).slice(0, count)),
    keys: async (pattern) => {
      const prefix = pattern.replace(/\*$/, "");
      return [...map.keys()].filter((k) => k.startsWith(prefix));
    },
  };
}

let instance: KV | undefined;

export function kv(): KV {
  if (instance) return instance;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  instance = url && token ? redisKV(url, token) : memoryKV();
  return instance;
}
