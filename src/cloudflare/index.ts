/**
 * Cloudflare Workers MCP Adapter
 * 
 * This module provides Cloudflare Workers-compatible versions of the MCP handler
 * using Web Standards instead of Node.js APIs.
 */

import { initializeCloudflareHandler } from './handler';

export { initializeCloudflareHandler } from './handler';
export type { CloudflareConfig } from './handler';
export { 
  isCloudflareWorkers, 
  WebEventEmitter, 
  getHeaders,
  type CloudflareStorage,
  KVStorage,
  MemoryStorage 
} from './runtime';

// Re-export common types and auth
export { withMcpAuth } from '../auth/auth-wrapper';
export {
  protectedResourceHandler,
  generateProtectedResourceMetadata,
  metadataCorsOptionsRequestHandler,
} from '../auth/auth-metadata';
export type { ServerOptions } from '../handler';

/**
 * Creates a Cloudflare Workers-compatible MCP handler
 * 
 * @example
 * ```typescript
 * import { createCloudflareHandler } from 'mcp-handler/cloudflare';
 * 
 * export default {
 *   async fetch(request: Request, env: any): Promise<Response> {
 *     const handler = createCloudflareHandler(
 *       (server) => {
 *         server.tool('echo', 'Echo a message', {}, async () => ({
 *           content: [{ type: 'text', text: 'Hello from Cloudflare!' }]
 *         }));
 *       },
 *       {}, // server options
 *       {
 *         kvNamespace: env.MCP_SESSIONS,
 *         verboseLogs: true,
 *         basePath: '/api'
 *       }
 *     );
 *     
 *     return handler(request, env);
 *   }
 * };
 * ```
 */
export function createCloudflareHandler(
  initializeServer: ((server: any) => Promise<void>) | ((server: any) => void),
  serverOptions?: any,
  config?: any
) {
  return initializeCloudflareHandler(initializeServer, serverOptions, config);
}