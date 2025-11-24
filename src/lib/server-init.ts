/**
 * Server initialization module
 * Runs once when the Next.js server starts
 * Handles pre-warming and other startup tasks
 */

import { prewarmEmbedder } from "./ai/retrieval/embedder";

let isInitialized = false;

/**
 * Initialize server resources
 * This should be called once when the server starts
 */
export async function initializeServer(): Promise<void> {
  if (isInitialized) {
    return;
  }

  console.log("[Server Init] Starting server initialization...");
  const startTime = Date.now();

  try {
    // Pre-warm the embedding model to eliminate first-query delay
    await prewarmEmbedder();

    isInitialized = true;
    const duration = Date.now() - startTime;
    console.log(
      `[Server Init] Server initialization completed in ${duration}ms`,
    );
  } catch (error) {
    console.error("[Server Init] Server initialization failed:", error);
    // Don't block server startup - let it continue with lazy loading
  }
}

/**
 * Check if server is initialized
 */
export function isServerInitialized(): boolean {
  return isInitialized;
}
