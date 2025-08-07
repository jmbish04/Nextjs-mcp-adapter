# Cloudflare Workers MCP Examples

This directory contains examples of using the MCP handler with Cloudflare Workers.

## Examples

### 1. Basic Worker (`worker.ts`)

A simple Cloudflare Worker demonstrating basic MCP tool registration:
- Echo tool
- Current time tool
- Environment info tool

### 2. Next.js Edge Route (`nextjs-route.ts`)

Shows how to use the MCP handler in a Next.js app deployed to Cloudflare Pages with edge runtime.

### 3. Advanced Worker (`advanced-worker.ts`)

A comprehensive example featuring:
- Multiple KV storage operations
- Persistent counters
- Note storage with TTL
- API key authentication
- CORS handling
- Error handling
- Environment configuration

## Setup

### Prerequisites

1. [Cloudflare account](https://cloudflare.com)
2. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
3. Node.js 18+

### Installation

```bash
# Install Wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create KV namespaces (for advanced example)
wrangler kv:namespace create "MCP_SESSIONS"
wrangler kv:namespace create "COUNTER_KV"
```

### Configuration

1. Copy the namespace IDs from the previous commands into `wrangler.toml`
2. Set any required secrets:

```bash
# Set API key for protected operations
wrangler secret put API_KEY
```

### Development

```bash
# Run locally
wrangler dev

# Or with specific file
wrangler dev advanced-worker.ts
```

### Deployment

```bash
# Deploy to Cloudflare Workers
wrangler deploy

# Or deploy specific worker
wrangler deploy --name advanced-mcp-handler advanced-worker.ts
```

## Testing Your MCP Server

Once deployed, you can test your MCP server using the mcp-remote proxy:

```bash
# Install mcp-remote
npm install -g mcp-remote

# Test your deployed worker
npx mcp-remote https://your-worker.your-subdomain.workers.dev/api/mcp
```

### Using with Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "cloudflare-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote", 
        "https://your-worker.your-subdomain.workers.dev/api/mcp"
      ]
    }
  }
}
```

## Environment Variables

### Basic Example
- None required

### Advanced Example
- `API_KEY`: Optional API key for protected operations
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins

### KV Namespaces
- `MCP_SESSIONS`: Required for session storage
- `COUNTER_KV`: Required for advanced example counter operations

## Features Demonstrated

- ✅ Basic tool registration
- ✅ KV storage operations
- ✅ Persistent data with TTL
- ✅ Authentication and authorization
- ✅ CORS handling
- ✅ Error handling
- ✅ Environment detection
- ✅ Multiple namespace usage

## Limitations

- WebSocket connections not supported in this implementation
- Some Node.js APIs replaced with Web Standards
- KV storage has different characteristics than Redis
- Cold starts may affect performance

## Next Steps

1. Customize the tools for your use case
2. Add more sophisticated authentication
3. Integrate with external APIs
4. Add monitoring and logging
5. Set up custom domains and routing