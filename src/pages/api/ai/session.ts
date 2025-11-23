import type { NextApiRequest, NextApiResponse } from "next";
import { createSession } from "@/lib/ai/session-manager";

/**
 * Session creation response
 */
interface SessionResponse {
  success: boolean;
  sessionId?: string;
  expiresAt?: string;
  message?: string;
}

/**
 * POST /api/ai/session
 * Create a new AI analysis session
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SessionResponse>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    // Create new session
    const session = createSession();

    return res.status(201).json({
      success: true,
      sessionId: session.id,
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[AI Session] Error creating session:", error);
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create session",
    });
  }
}
