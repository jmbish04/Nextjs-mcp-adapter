/**
 * Cloudflare Workers runtime compatibility layer
 * This module provides Web Standards-based implementations to replace Node.js APIs
 */

// Environment detection
export function isCloudflareWorkers(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    'EdgeRuntime' in globalThis ||
    typeof (globalThis as any).EdgeRuntime !== 'undefined' ||
    typeof navigator !== 'undefined' && navigator.userAgent?.includes('Cloudflare-Workers')
  );
}

// Web-compatible EventEmitter replacement
export class WebEventEmitter {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, listener: Function): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return false;
    
    eventListeners.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
    return true;
  }

  removeListener(event: string, listener: Function): this {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
    return this;
  }
}

// Headers compatibility
export function getHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

// Environment variable access
export function getEnv(key: string): string | undefined {
  if (isCloudflareWorkers()) {
    // In Cloudflare Workers, env is passed to fetch handler
    // This will be set up in the request context
    return (globalThis as any).__CLOUDFLARE_ENV__?.[key];
  }
  return process.env[key];
}

// Storage interface for Redis replacement
export interface CloudflareStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ttl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

// KV storage implementation
export class KVStorage implements CloudflareStorage {
  constructor(private kv: any) {} // KVNamespace type

  async get(key: string): Promise<string | null> {
    return await this.kv.get(key);
  }

  async set(key: string, value: string, options?: { ttl?: number }): Promise<void> {
    const kvOptions = options?.ttl ? { expirationTtl: options.ttl } : undefined;
    await this.kv.put(key, value, kvOptions);
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const options = prefix ? { prefix } : undefined;
    const keys = await this.kv.list(options);
    return keys.keys.map((k: any) => k.name);
  }
}

// Memory storage fallback
export class MemoryStorage implements CloudflareStorage {
  private data: Map<string, { value: string; expires?: number }> = new Map();

  async get(key: string): Promise<string | null> {
    const item = this.data.get(key);
    if (!item) return null;
    
    if (item.expires && Date.now() > item.expires) {
      this.data.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: string, options?: { ttl?: number }): Promise<void> {
    const expires = options?.ttl ? Date.now() + (options.ttl * 1000) : undefined;
    this.data.set(key, { value, expires });
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.data.keys());
    return prefix ? keys.filter(k => k.startsWith(prefix)) : keys;
  }
}