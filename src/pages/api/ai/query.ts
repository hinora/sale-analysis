import type { NextApiRequest, NextApiResponse } from "next";
import {
  getSession,
  addMessage,
  updateSessionStatus,
} from "@/lib/ai/session-manager";
import { queryHandler, type QueryResult } from "@/lib/ai/query-handler";
import { initializeServer } from "@/lib/server-init";

// Initialize server on first import (pre-warm embedding model)
initializeServer().catch((error) => {
  console.error("[Server Init] Failed to initialize server:", error);
});

/**
 * Query response
 */
interface QueryResponse {
  success: boolean;
  answer?: string;
  citations?: string[];
  confidence?: "high" | "medium" | "low";
  processingTime?: number;
  message?: string;
  performance?: {
    queryTimeMs: number;
    memoryUsageMB: number;
    retrievalCount?: number;
    useRAG?: boolean;
  };
  retrievalMetadata?: {
    retrievedCount: number;
    totalAvailable: number;
    avgSimilarityScore?: number;
    threshold?: number;
  };
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

    // Performance tracking
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

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

    // Process query - use RAG if enabled, otherwise use traditional approach
    let result: QueryResult;
    let retrievalCount: number | undefined;

    if (session.useRAG && session.vectorIndex?.status === "ready") {
      console.log(`[AI Query] Using RAG retrieval for session ${sessionId}`);
      result = await queryHandler.processQueryWithRetrieval(session, question);
      // Track retrieval count for performance metrics
      retrievalCount = session.vectorIndex.transactionCount;

      // T048: Validate citations against retrieved transactions
      if (result.citations && result.citations.length > 0) {
        const validCitations: string[] = [];
        const invalidCitations: string[] = [];

        // Get transaction ID range from retrieved transactions
        const retrievedTransactionIds = new Set(
          session.transactionData.map((txn) => txn.id),
        );

        for (const citation of result.citations) {
          // Extract transaction number from citation format "[Giao dịch #123]"
          const match = citation.match(/#(\d+)/);
          if (match) {
            const txnId = Number.parseInt(match[1], 10);
            if (retrievedTransactionIds.has(txnId)) {
              validCitations.push(citation);
            } else {
              invalidCitations.push(citation);
              console.warn(
                `[AI Query] Invalid citation detected: ${citation} - transaction #${txnId} not in retrieved set`,
              );
            }
          } else {
            // Keep citations without transaction numbers
            validCitations.push(citation);
          }
        }

        // Replace citations with only valid ones
        result.citations = validCitations;

        if (invalidCitations.length > 0) {
          console.log(
            `[AI Query] Filtered out ${invalidCitations.length} invalid citation(s)`,
          );
        }
      }
    } else {
      console.log(
        `[AI Query] Using traditional full-data approach for session ${sessionId}`,
      );
      result = await queryHandler.processQuery(session, question);
    }

    // Add assistant response to history
    addMessage(sessionId, "assistant", result.answer);

    // Update status to ready
    updateSessionStatus(sessionId, "ready");

    // Calculate performance metrics
    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;
    const queryTimeMs = endTime - startTime;
    const memoryUsageMB = (endMemory - startMemory) / (1024 * 1024);

    console.log(
      `[AI Query] Performance: ${queryTimeMs}ms, ${memoryUsageMB.toFixed(2)}MB, RAG: ${!!session.useRAG}`,
    );

    return res.status(200).json({
      success: true,
      answer: result.answer,
      citations: result.citations,
      confidence: result.confidence,
      processingTime: result.processingTime,
      performance: {
        queryTimeMs,
        memoryUsageMB: Number.parseFloat(memoryUsageMB.toFixed(2)),
        retrievalCount,
        useRAG: session.useRAG,
      },
      retrievalMetadata: result.retrievalMetadata,
    });
  } catch (error) {
    console.error("[AI Query] Error:", error);
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to process query",
    });
  }
}
