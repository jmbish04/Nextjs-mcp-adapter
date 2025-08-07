/**
 * Example Next.js API route for Cloudflare Pages
 * 
 * This shows how to use the MCP adapter in a Next.js app deployed to Cloudflare Pages
 */

import { createCloudflareHandler } from 'mcp-handler/cloudflare';
import { z } from 'zod';

export const runtime = 'edge';

export interface CloudflareEnv {
  MCP_SESSIONS: KVNamespace;
}

export default async function handler(request: Request): Promise<Response> {
  // Get environment from the edge runtime context
  const env = (process.env as any) as CloudflareEnv;

  const mcpHandler = createCloudflareHandler(
    (server) => {
      server.tool(
        'page_info',
        'Get information about this page',
        {},
        async () => {
          return {
            content: [
              {
                type: 'text',
                text: 'This is a Next.js API route running on Cloudflare Pages with MCP support!',
              },
            ],
          };
        }
      );

      server.tool(
        'echo',
        'Echo a message',
        {
          message: z.string(),
        },
        async ({ message }) => {
          return {
            content: [
              {
                type: 'text',
                text: `Echo from Cloudflare Pages: ${message}`,
              },
            ],
          };
        }
      );
    },
    {
      serverInfo: {
        name: 'nextjs-cloudflare-mcp',
        version: '1.0.0',
      },
    },
    {
      kvNamespace: env?.MCP_SESSIONS,
      verboseLogs: process.env.NODE_ENV === 'development',
      basePath: '/api',
    }
  );

  return mcpHandler(request, env);
}