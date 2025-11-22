import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/ai/session-manager";

/**
 * Session detail response
 */
interface SessionDetailResponse {
  success: boolean;
  session?: {
    id: string;
    status: string;
    transactionCount: number;
    dataSize: number;
    conversationLength: number;
    createdAt: string;
    lastAccessedAt: string;
    expiresAt: string;
    filters?: Record<string, unknown>;
  };
  message?: string;
}

/**
 * GET /api/ai/session/[id]
 * Retrieve AI session state and metadata
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SessionDetailResponse>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    // Get session
    const session = getSession(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found or expired",
      });
    }

    // Return session metadata (without full data to reduce payload)
    return res.status(200).json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        transactionCount: session.metadata.transactionCount,
        dataSize: session.metadata.dataSize,
        conversationLength: session.conversationHistory.length,
        createdAt: session.createdAt.toISOString(),
        lastAccessedAt: session.lastAccessedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        filters: session.metadata.filters,
      },
    });
  } catch (error) {
    console.error("[AI Session Detail] Error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to retrieve session",
    });
  }
}
