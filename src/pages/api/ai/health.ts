import type { NextApiRequest, NextApiResponse } from "next";
import { getProvider, getProviderName, type HealthCheckResult } from "@/lib/ai/providers";

/**
 * AI Provider health check response
 */
interface AIHealthResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  provider: {
    name: string;
    configured: string;
    healthy: boolean;
    latencyMs: number;
    error?: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Error response
 */
interface ErrorResponse {
  error: string;
  details?: string;
}

/**
 * GET /api/ai/health
 * Health check endpoint for the configured AI provider
 *
 * Returns the health status of the active AI provider (Ollama or Gemini)
 * based on the AI_PROVIDER environment variable.
 *
 * @example
 * // Response when healthy:
 * {
 *   "status": "healthy",
 *   "timestamp": "2025-12-08T10:30:00.000Z",
 *   "provider": {
 *     "name": "ollama",
 *     "configured": "ollama",
 *     "healthy": true,
 *     "latencyMs": 45,
 *     "details": { "host": "http://localhost:11434", "defaultModel": "deepseek-r1:1.5b" }
 *   }
 * }
 *
 * @example
 * // Response when unhealthy:
 * {
 *   "status": "unhealthy",
 *   "timestamp": "2025-12-08T10:30:00.000Z",
 *   "provider": {
 *     "name": "gemini",
 *     "configured": "gemini",
 *     "healthy": false,
 *     "latencyMs": 1500,
 *     "error": "Invalid or missing Gemini API key"
 *   }
 * }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AIHealthResponse | ErrorResponse>
) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
      details: "Use GET to check AI provider health",
    });
  }

  const timestamp = new Date().toISOString();
  const configuredProvider = getProviderName();

  try {
    const provider = getProvider();
    const healthResult: HealthCheckResult = await provider.healthCheck();

    const response: AIHealthResponse = {
      status: healthResult.healthy ? "healthy" : "unhealthy",
      timestamp,
      provider: {
        name: healthResult.provider,
        configured: configuredProvider,
        healthy: healthResult.healthy,
        latencyMs: healthResult.latencyMs,
        ...(healthResult.error && { error: healthResult.error }),
        ...(healthResult.details && { details: healthResult.details }),
      },
    };

    return res.status(healthResult.healthy ? 200 : 503).json(response);
  } catch (error) {
    console.error("[AI Health Check] Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    const response: AIHealthResponse = {
      status: "unhealthy",
      timestamp,
      provider: {
        name: configuredProvider,
        configured: configuredProvider,
        healthy: false,
        latencyMs: 0,
        error: errorMessage,
      },
    };

    return res.status(503).json(response);
  }
}
