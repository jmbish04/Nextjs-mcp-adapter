/**
 * Advanced Cloudflare Worker Example with Real MCP Tools
 * 
 * This example demonstrates:
 * - Multiple tools with different purposes
 * - KV storage for persistent data
 * - Environment variable usage
 * - Error handling
 * - CORS support
 */

import { createCloudflareHandler } from 'mcp-handler/cloudflare';
import { z } from 'zod';

export interface Env {
  MCP_SESSIONS: KVNamespace;
  COUNTER_KV: KVNamespace;
  API_KEY?: string;
  ALLOWED_ORIGINS?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // CORS handling
    const origin = request.headers.get('Origin');
    const allowedOrigins = env.ALLOWED_ORIGINS?.split(',') || ['*'];
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin || '') ? origin! : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API key validation for protected tools
    const validateApiKey = (required: boolean = false) => {
      if (!required) return true;
      const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
      return apiKey === env.API_KEY;
    };

    const handler = createCloudflareHandler(
      (server) => {
        // Tool 1: Counter with persistence
        server.tool(
          'increment_counter',
          'Increment a named counter stored in KV',
          {
            name: z.string().describe('Name of the counter'),
            increment: z.number().default(1).describe('Amount to increment by'),
          },
          async ({ name, increment = 1 }) => {
            if (!validateApiKey(false)) {
              throw new Error('API key required for counter operations');
            }

            const key = `counter:${name}`;
            const currentValue = await env.COUNTER_KV.get(key);
            const newValue = (parseInt(currentValue || '0', 10) + increment).toString();
            
            await env.COUNTER_KV.put(key, newValue);
            
            return {
              content: [
                {
                  type: 'text',
                  text: `Counter "${name}" incremented by ${increment}. New value: ${newValue}`,
                },
              ],
            };
          }
        );

        // Tool 2: Get counter value
        server.tool(
          'get_counter',
          'Get the current value of a counter',
          {
            name: z.string().describe('Name of the counter'),
          },
          async ({ name }) => {
            const key = `counter:${name}`;
            const value = await env.COUNTER_KV.get(key);
            
            return {
              content: [
                {
                  type: 'text',
                  text: `Counter "${name}" current value: ${value || '0'}`,
                },
              ],
            };
          }
        );

        // Tool 3: List all counters
        server.tool(
          'list_counters',
          'List all available counters',
          {},
          async () => {
            const { keys } = await env.COUNTER_KV.list({ prefix: 'counter:' });
            const counters = await Promise.all(
              keys.map(async (key) => {
                const value = await env.COUNTER_KV.get(key.name);
                return {
                  name: key.name.replace('counter:', ''),
                  value: value || '0',
                };
              })
            );

            return {
              content: [
                {
                  type: 'text',
                  text: `Available counters:\n${counters
                    .map(c => `• ${c.name}: ${c.value}`)
                    .join('\n') || 'No counters found'}`,
                },
              ],
            };
          }
        );

        // Tool 4: Current time with timezone support
        server.tool(
          'current_time',
          'Get current time in various formats and timezones',
          {
            timezone: z.string().optional().describe('Timezone (e.g., "America/New_York", "UTC")'),
            format: z.enum(['iso', 'human', 'unix']).default('iso').describe('Output format'),
          },
          async ({ timezone = 'UTC', format = 'iso' }) => {
            const now = new Date();
            let timeString: string;

            try {
              switch (format) {
                case 'unix':
                  timeString = Math.floor(now.getTime() / 1000).toString();
                  break;
                case 'human':
                  timeString = now.toLocaleString('en-US', {
                    timeZone: timezone,
                    dateStyle: 'full',
                    timeStyle: 'long',
                  });
                  break;
                case 'iso':
                default:
                  timeString = now.toLocaleString('sv-SE', {
                    timeZone: timezone,
                  }).replace(' ', 'T') + 'Z';
                  break;
              }

              return {
                content: [
                  {
                    type: 'text',
                    text: `Current time (${timezone}, ${format}): ${timeString}`,
                  },
                ],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error getting time: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
              };
            }
          }
        );

        // Tool 5: Store and retrieve notes
        server.tool(
          'store_note',
          'Store a note with optional expiration',
          {
            id: z.string().describe('Unique identifier for the note'),
            content: z.string().describe('Content of the note'),
            ttl: z.number().optional().describe('Time to live in seconds'),
          },
          async ({ id, content, ttl }) => {
            if (!validateApiKey(true)) {
              throw new Error('API key required for note storage');
            }

            const key = `note:${id}`;
            const options = ttl ? { expirationTtl: ttl } : undefined;
            
            await env.COUNTER_KV.put(key, content, options);
            
            return {
              content: [
                {
                  type: 'text',
                  text: `Note "${id}" stored successfully${ttl ? ` with ${ttl}s TTL` : ''}`,
                },
              ],
            };
          }
        );

        // Tool 6: Retrieve note
        server.tool(
          'get_note',
          'Retrieve a stored note',
          {
            id: z.string().describe('Unique identifier for the note'),
          },
          async ({ id }) => {
            const key = `note:${id}`;
            const content = await env.COUNTER_KV.get(key);
            
            if (!content) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Note "${id}" not found or has expired`,
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `Note "${id}": ${content}`,
                },
              ],
            };
          }
        );

        // Tool 7: Environment info
        server.tool(
          'environment_info',
          'Get information about the Cloudflare Workers environment',
          {},
          async () => {
            const info = {
              runtime: 'Cloudflare Workers',
              timestamp: new Date().toISOString(),
              hasApiKey: !!env.API_KEY,
              allowedOrigins: env.ALLOWED_ORIGINS || 'Not configured',
              kvNamespaces: {
                sessions: !!env.MCP_SESSIONS,
                counter: !!env.COUNTER_KV,
              },
            };

            return {
              content: [
                {
                  type: 'text',
                  text: `Environment Information:\n${JSON.stringify(info, null, 2)}`,
                },
              ],
            };
          }
        );
      },
      {
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'advanced-cloudflare-mcp',
          version: '1.0.0',
        },
      },
      {
        kvNamespace: env.MCP_SESSIONS,
        verboseLogs: true,
        basePath: '/api',
        env: {
          API_KEY: env.API_KEY,
          ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
        },
      }
    );

    try {
      const response = await handler(request, env);
      
      // Add CORS headers to response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.error('Handler error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
  },
};