/**
 * Cloudflare Workers-compatible MCP handler
 * This provides a Web Standards-based alternative to the Node.js handler
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types";
import { getAuthContext } from "../auth/auth-context";
import { ServerOptions } from "../handler";
import { 
  isCloudflareWorkers, 
  WebEventEmitter, 
  getHeaders, 
  CloudflareStorage,
  KVStorage,
  MemoryStorage 
} from "./runtime";
import type {
  McpEvent,
  McpErrorEvent,
  McpSessionEvent,
  McpRequestEvent,
} from "../lib/log-helper";
import { createEvent } from "../lib/log-helper";

interface SerializedRequest {
  requestId: string;
  url: string;
  method: string;
  body: string | null;
  headers: Record<string, string>;
}

type Logger = {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

function createLogger(verboseLogs = false): Logger {
  return {
    log: (...args: unknown[]) => {
      if (verboseLogs) console.log(...args);
    },
    error: (...args: unknown[]) => {
      if (verboseLogs) console.error(...args);
    },
    warn: (...args: unknown[]) => {
      if (verboseLogs) console.warn(...args);
    },
    info: (...args: unknown[]) => {
      if (verboseLogs) console.info(...args);
    },
    debug: (...args: unknown[]) => {
      if (verboseLogs) console.debug(...args);
    },
  };
}

/**
 * Configuration for the Cloudflare MCP handler.
 */
export type CloudflareConfig = {
  /**
   * KV namespace for session storage (replaces Redis)
   */
  kvNamespace?: any; // KVNamespace type
  /**
   * Custom storage implementation
   */
  storage?: CloudflareStorage;
  /**
   * The endpoint to use for the streamable HTTP transport.
   * @default "/mcp"
   */
  streamableHttpEndpoint?: string;
  /**
   * The endpoint to use for the SSE transport.
   * @default "/sse"
   */
  sseEndpoint?: string;
  /**
   * The endpoint to use for the SSE messages transport.
   * @default "/message"
   */
  sseMessageEndpoint?: string;
  /**
   * The maximum duration of an MCP request in seconds.
   * @default 60
   */
  maxDuration?: number;
  /**
   * If true, enables console logging.
   * @default false
   */
  verboseLogs?: boolean;
  /**
   * The base path for MCP endpoints.
   * @default "/api"
   */
  basePath?: string;
  /**
   * Cloudflare environment variables
   */
  env?: Record<string, string>;
};

/**
 * Creates a Cloudflare Workers-compatible MCP API handler
 */
export function initializeCloudflareHandler(
  initializeServer:
    | ((server: McpServer) => Promise<void>)
    | ((server: McpServer) => void),
  serverOptions?: ServerOptions,
  config?: CloudflareConfig
): (request: Request, env?: any) => Promise<Response> {
  const logger = createLogger(config?.verboseLogs);
  
  // Set up storage (KV or memory fallback)
  let storage: CloudflareStorage;
  if (config?.storage) {
    storage = config.storage;
  } else if (config?.kvNamespace) {
    storage = new KVStorage(config.kvNamespace);
  } else {
    storage = new MemoryStorage();
    logger.warn('Using memory storage fallback - sessions will not persist across requests');
  }

  const basePath = config?.basePath || "/api";
  const streamableHttpEndpoint = config?.streamableHttpEndpoint || "/mcp";
  const sseEndpoint = config?.sseEndpoint || "/sse";
  const sseMessageEndpoint = config?.sseMessageEndpoint || "/message";

  return async (request: Request, env?: any): Promise<Response> => {
    try {
      // Set up Cloudflare environment in global context
      if (env) {
        (globalThis as any).__CLOUDFLARE_ENV__ = env;
      }

      const url = new URL(request.url);
      const pathname = url.pathname;
      
      // Log the request
      logger.log(`Received ${request.method} MCP request`);
      
      const requestId = crypto.randomUUID();
      const headers = getHeaders(request);
      const body = request.method !== 'GET' ? await request.text() : null;
      
      const serializedRequest: SerializedRequest = {
        requestId,
        url: request.url,
        method: request.method,
        body,
        headers,
      };

      // Handle different endpoints
      if (pathname.endsWith(streamableHttpEndpoint)) {
        return handleStreamableHttp(serializedRequest, initializeServer, serverOptions, storage, logger);
      } else if (pathname.endsWith(sseEndpoint)) {
        return handleSSE(serializedRequest, initializeServer, serverOptions, storage, logger);
      } else if (pathname.endsWith(sseMessageEndpoint)) {
        return handleSSEMessage(serializedRequest, storage, logger);
      } else {
        return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      logger.error('Handler error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  };
}

async function handleStreamableHttp(
  request: SerializedRequest,
  initializeServer: ((server: McpServer) => Promise<void>) | ((server: McpServer) => void),
  serverOptions?: ServerOptions,
  storage?: CloudflareStorage,
  logger?: Logger
): Promise<Response> {
  try {
    const server = new McpServer(
      {
        name: serverOptions?.serverInfo?.name || "mcp-handler",
        version: serverOptions?.serverInfo?.version || "1.0.0",
      },
      serverOptions
    );

    await initializeServer(server);

    // For now, return a simple response indicating Cloudflare compatibility is in progress
    // This will be properly implemented with transport adaptation
    if (request.method === 'POST') {
      const response = {
        jsonrpc: "2.0",
        id: 1,
        result: {
          capabilities: {},
          serverInfo: {
            name: serverOptions?.serverInfo?.name || "mcp-handler",
            version: serverOptions?.serverInfo?.version || "1.0.0",
          }
        }
      };
      
      return new Response(JSON.stringify(response), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    } else {
      return new Response('Method Not Allowed', { status: 405 });
    }
  } catch (error) {
    logger?.error('Streamable HTTP error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleSSE(
  request: SerializedRequest,
  initializeServer: ((server: McpServer) => Promise<void>) | ((server: McpServer) => void),
  serverOptions?: ServerOptions,
  storage?: CloudflareStorage,
  logger?: Logger
): Promise<Response> {
  try {
    const server = new McpServer(
      {
        name: serverOptions?.serverInfo?.name || "mcp-handler",
        version: serverOptions?.serverInfo?.version || "1.0.0",
      },
      serverOptions
    );

    await initializeServer(server);

    // Create SSE transport
    const sessionId = crypto.randomUUID();
    
    // Store session info
    if (storage) {
      await storage.set(`session:${sessionId}`, JSON.stringify({
        id: sessionId,
        created: Date.now(),
      }), { ttl: 3600 }); // 1 hour TTL
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Set up SSE response
    const response = new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Session-ID': sessionId,
      },
    });

    // Send initial SSE message
    await writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ sessionId })}\n\n`));

    return response;
  } catch (error) {
    logger?.error('SSE error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleSSEMessage(
  request: SerializedRequest,
  storage?: CloudflareStorage,
  logger?: Logger
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    
    if (!sessionId) {
      return new Response('Session ID required', { status: 400 });
    }

    // Verify session exists
    if (storage) {
      const sessionData = await storage.get(`session:${sessionId}`);
      if (!sessionData) {
        return new Response('Session not found', { status: 404 });
      }
    }

    if (request.method === 'POST') {
      const body = request.body ? JSON.parse(request.body) : {};
      
      // Store message for the session
      if (storage) {
        const messageId = crypto.randomUUID();
        await storage.set(`message:${sessionId}:${messageId}`, JSON.stringify(body));
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } else {
      return new Response('Method Not Allowed', { status: 405 });
    }
  } catch (error) {
    logger?.error('SSE Message error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}