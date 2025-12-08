import type { NextApiRequest, NextApiResponse } from "next";
import {
  getSession,
  addMessage,
  updateSessionStatus,
} from "@/lib/ai/session-manager";
import { queryHandler } from "@/lib/ai/query-handler";

import type { IterativeQueryResponse } from '@/types/iterative-ai';

/**
 * Query response
 */
interface QueryResponse {
  success: boolean;
  answer?: string;
  processingTime?: number;
  message?: string;
  iterativeResult?: IterativeQueryResponse;
}

/**
 * POST /api/ai/query
 * Process a natural language query against session data
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<QueryResponse>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const { sessionId, question, iterativeConfig } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    if (!question) {
      return res.status(400).json({
        success: false,
        message: "Question is required",
      });
    }

    // Validate question
    const validation = queryHandler.validateQuery(question);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    // Get session
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found or expired",
      });
    }

    // Check if session has data
    if (session.transactionData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Session has no data. Please feed data first.",
      });
    }

    // Update status to querying
    updateSessionStatus(sessionId, "querying");

    // Add user message to history
    addMessage(sessionId, "user", question);

    // Process iterative query
    console.log(`[AI Query] Processing iterative query for session ${sessionId}`);
    const iterativeResult = await queryHandler.processIterativeQuery(
      session,
      question,
      iterativeConfig
    );

    // Add final answer to conversation history if available
    if (iterativeResult.answer) {
      addMessage(sessionId, "assistant", iterativeResult.answer);
    }

    // Update status to ready
    updateSessionStatus(sessionId, "ready");

    return res.status(200).json({
      success: true,
      answer: iterativeResult.answer || "Quá trình xử lý đã hoàn tất nhưng chưa có câu trả lời cuối cùng",
      processingTime: iterativeResult.session.totalProcessingTimeMs,
      iterativeResult,
    });
  } catch (error) {
    // Update status to error
    if (req.body.sessionId) {
      updateSessionStatus(req.body.sessionId, "error");
    }

    // Log detailed error information
    console.error("[AI Query] Error processing query:", {
      sessionId: req.body.sessionId,
      question: req.body.question?.substring(0, 100),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Return user-friendly error message
    const errorMessage =
      error instanceof Error
        ? error.message.includes("timeout")
          ? "Query processing timed out. Please try with a simpler question or smaller dataset."
          : error.message.includes("Ollama")
            ? "AI service is currently unavailable. Please try again later."
            : error.message
        : "Failed to process query";

    return res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}
