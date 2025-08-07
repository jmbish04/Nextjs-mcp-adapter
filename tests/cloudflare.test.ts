import { describe, it, expect, vi } from 'vitest';
import { createCloudflareHandler, isCloudflareWorkers, KVStorage, MemoryStorage } from '../src/cloudflare';

describe('Cloudflare Workers Compatibility', () => {
  it('should detect Cloudflare Workers environment', () => {
    // Mock Cloudflare Workers environment
    (globalThis as any).EdgeRuntime = {};
    expect(isCloudflareWorkers()).toBe(true);
    delete (globalThis as any).EdgeRuntime;
  });

  it('should create a Cloudflare handler', () => {
    const handler = createCloudflareHandler(
      (server) => {
        server.tool('test', 'Test tool', {}, async () => ({
          content: [{ type: 'text', text: 'Hello from Cloudflare!' }]
        }));
      },
      {
        serverInfo: {
          name: 'test-server',
          version: '1.0.0',
        },
      },
      {
        verboseLogs: false,
      }
    );

    expect(typeof handler).toBe('function');
  });

  it('should work with memory storage', async () => {
    const storage = new MemoryStorage();
    
    await storage.set('test-key', 'test-value');
    const value = await storage.get('test-key');
    expect(value).toBe('test-value');

    await storage.delete('test-key');
    const deletedValue = await storage.get('test-key');
    expect(deletedValue).toBeNull();
  });

  it('should work with TTL in memory storage', async () => {
    const storage = new MemoryStorage();
    
    await storage.set('ttl-key', 'ttl-value', { ttl: 1 }); // 1 second TTL
    const value = await storage.get('ttl-key');
    expect(value).toBe('ttl-value');

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 1100));
    const expiredValue = await storage.get('ttl-key');
    expect(expiredValue).toBeNull();
  });

  it('should list keys with prefix', async () => {
    const storage = new MemoryStorage();
    
    await storage.set('prefix:key1', 'value1');
    await storage.set('prefix:key2', 'value2');
    await storage.set('other:key3', 'value3');

    const prefixedKeys = await storage.list('prefix:');
    expect(prefixedKeys).toHaveLength(2);
    expect(prefixedKeys).toContain('prefix:key1');
    expect(prefixedKeys).toContain('prefix:key2');

    const allKeys = await storage.list();
    expect(allKeys).toHaveLength(3);
  });

  it('should handle basic MCP request structure', async () => {
    const handler = createCloudflareHandler(
      (server) => {
        server.tool('echo', 'Echo tool', {}, async () => ({
          content: [{ type: 'text', text: 'echo response' }]
        }));
      },
      {
        serverInfo: {
          name: 'test-server',
          version: '1.0.0',
        },
      },
      {
        verboseLogs: false,
      }
    );

    const request = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      }),
    });

    const response = await handler(request, {});
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('jsonrpc');
    expect(data).toHaveProperty('result');
  });
});