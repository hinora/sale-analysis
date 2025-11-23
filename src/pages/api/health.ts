import type { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/db/connection";

/**
 * Health check response
 */
interface HealthResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  services: {
    database: "connected" | "disconnected" | "error";
    api: "operational";
  };
  version: string;
}

/**
 * GET /api/health
 * Health check endpoint for monitoring system status
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>,
) {
  const timestamp = new Date().toISOString();
  let dbStatus: "connected" | "disconnected" | "error" = "disconnected";

  try {
    // Test database connection
    await connectToDatabase();
    dbStatus = "connected";
  } catch (error) {
    console.error("[Health Check] Database error:", error);
    dbStatus = "error";
  }

  const isHealthy = dbStatus === "connected";

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp,
    services: {
      database: dbStatus,
      api: "operational",
    },
    version: process.env.npm_package_version || "0.1.0",
  });
}
