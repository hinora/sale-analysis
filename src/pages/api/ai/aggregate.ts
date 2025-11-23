import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/ai/session-manager";
import {
  computeAggregations,
  formatAggregationForAI,
  type AggregationSpec,
} from "@/lib/ai/aggregation-engine";

/**
 * Aggregation response
 */
interface AggregationResponse {
  success: boolean;
  results?: Array<{
    spec: AggregationSpec;
    formatted: string;
    executionTimeMs: number;
    totalRecords: number;
  }>;
  message?: string;
}

/**
 * POST /api/ai/aggregate
 * Compute aggregations on session transaction data
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AggregationResponse>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const { sessionId, aggregations } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    if (!aggregations || !Array.isArray(aggregations)) {
      return res.status(400).json({
        success: false,
        message: "Aggregations array is required",
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

    // Validate aggregation specs
    for (const agg of aggregations) {
      if (!agg.field || !agg.operation) {
        return res.status(400).json({
          success: false,
          message: "Each aggregation must have 'field' and 'operation'",
        });
      }

      if (!["count", "sum", "average", "min", "max"].includes(agg.operation)) {
        return res.status(400).json({
          success: false,
          message: `Invalid operation: ${agg.operation}. Must be one of: count, sum, average, min, max`,
        });
      }
    }

    // Compute aggregations
    const results = computeAggregations(
      session.transactionData as Array<Record<string, unknown>>,
      aggregations as AggregationSpec[],
    );

    // Format results
    const formattedResults = results.map((result) => ({
      spec: result.spec,
      formatted: formatAggregationForAI(result),
      executionTimeMs: result.executionTimeMs,
      totalRecords: result.totalRecords,
    }));

    return res.status(200).json({
      success: true,
      results: formattedResults,
    });
  } catch (error) {
    // Log detailed error information
    console.error("[AI Aggregate] Error computing aggregations:", {
      sessionId: req.body.sessionId,
      aggregationCount: req.body.aggregations?.length,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Return user-friendly error message
    const errorMessage =
      error instanceof Error
        ? error.message.includes("Invalid operation")
          ? error.message
          : "Failed to compute aggregations. Please check your aggregation specifications."
        : "Failed to compute aggregations";

    return res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}
