import type { NextApiRequest, NextApiResponse } from "next";
import { createSession, updateSessionStatus } from "@/lib/ai/session-manager";
import { connectToDatabase } from "@/lib/db/connection";
import { Transaction } from "@/lib/db/models/Transaction";
import { Company } from "@/lib/db/models/Company";
import { Goods } from "@/lib/db/models/Goods";
import { Category } from "@/lib/db/models/Category";

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
    // Connect to database to verify connection
    await connectToDatabase();

    // Ensure models are registered
    void Company;
    void Goods;
    void Category;
    void Transaction;

    // Create new session
    const session = createSession();

    // Set session status to ready immediately
    updateSessionStatus(session.id, "ready");

    return res.status(201).json({
      success: true,
      sessionId: session.id,
      expiresAt: session.expiresAt.toISOString(),
      message: "Session is ready. AI will query database directly.",
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
