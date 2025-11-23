import type { NextApiRequest, NextApiResponse } from "next";
import {
  getSession,
  addMessage,
  updateSessionStatus,
} from "@/lib/ai/session-manager";
import { queryHandler } from "@/lib/ai/query-handler";
import type { FilterLog, QueryIntent } from "@/lib/ai/query-handler";

/**
 * Query response
 */
interface QueryResponse {
  success: boolean;
  answer?: string;
  citations?: string[];
  confidence?: "high" | "medium" | "low";
  processingTime?: number;
  filterLogs?: FilterLog[];
  queryIntent?: QueryIntent;
  message?: string;
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
    const { sessionId, question } = req.body;

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

    // Process query
    const result = await queryHandler.processQuery(session, question);

    // Add assistant response to history
    addMessage(sessionId, "assistant", result.answer);

    // Update status to ready
    updateSessionStatus(sessionId, "ready");

    return res.status(200).json({
      success: true,
      answer: result.answer,
      citations: result.citations,
      confidence: result.confidence,
      processingTime: result.processingTime,
      filterLogs: result.filterLogs,
      queryIntent: result.queryIntent,
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
    const errorMessage = error instanceof Error 
      ? error.message.includes('timeout') 
        ? 'Query processing timed out. Please try with a simpler question or smaller dataset.'
        : error.message.includes('Ollama')
        ? 'AI service is currently unavailable. Please try again later.'
        : error.message
      : "Failed to process query";

    return res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}
