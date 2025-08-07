/**
 * Example Cloudflare Worker using the MCP adapter
 * 
 * This demonstrates how to use the MCP handler in a Cloudflare Worker environment
 */

import { createCloudflareHandler } from 'mcp-handler/cloudflare';
import { z } from 'zod';

export interface Env {
  MCP_SESSIONS: KVNamespace;
  // Add other environment variables as needed
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Create the MCP handler
    const handler = createCloudflareHandler(
      (server) => {
        // Example tool: Echo
        server.tool(
          'echo',
          'Echo a message back',
          {
            message: z.string().describe('The message to echo'),
          },
          async ({ message }) => {
            return {
              content: [
                {
                  type: 'text',
                  text: `Echo from Cloudflare Workers: ${message}`,
                },
              ],
            };
          }
        );

        // Example tool: Get current time
        server.tool(
          'current_time',
          'Get the current time',
          {},
          async () => {
            return {
              content: [
                {
                  type: 'text',
                  text: `Current time: ${new Date().toISOString()}`,
                },
              ],
            };
          }
        );

        // Example tool: Environment info
        server.tool(
          'env_info',
          'Get environment information',
          {},
          async () => {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Running on Cloudflare Workers',
                },
              ],
            };
          }
        );
      },
      {
        // Server options
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'cloudflare-mcp-example',
          version: '1.0.0',
        },
      },
      {
        // Cloudflare-specific configuration
        kvNamespace: env.MCP_SESSIONS,
        verboseLogs: true,
        basePath: '/api',
      }
    );

    // Handle the request
    return handler(request, env);
  },
};