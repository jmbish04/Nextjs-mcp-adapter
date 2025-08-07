// Re-export the Next.js adapter
export { default as createMcpHandler } from "./handler";

/**
 * @deprecated Use withMcpAuth instead
 */
export { withMcpAuth as experimental_withMcpAuth } from "./auth/auth-wrapper";

export { withMcpAuth } from "./auth/auth-wrapper";

export {
  protectedResourceHandler,
  generateProtectedResourceMetadata,
  metadataCorsOptionsRequestHandler,
} from "./auth/auth-metadata";

// Export Cloudflare-compatible handlers
export { createCloudflareHandler } from "./cloudflare";
export type { CloudflareConfig } from "./cloudflare/handler";
export { isCloudflareWorkers } from "./cloudflare/runtime";
