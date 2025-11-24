import type { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/db/connection";
import { Transaction } from "@/lib/db/models/Transaction";
import {
  addTransactionData,
  getSession,
  updateSessionStatus,
  updateSession,
} from "@/lib/ai/session-manager";
import { generateBatchEmbeddings } from "@/lib/ai/retrieval/embedder";
import { buildIndex } from "@/lib/ai/retrieval/index";
import type { TransactionEmbedding } from "@/lib/ai/retrieval/types";
import { initializeServer } from "@/lib/server-init";

// Initialize server on first import (pre-warm embedding model)
initializeServer().catch((error) => {
  console.error("[Server Init] Failed to initialize server:", error);
});

/**
 * Feed data response
 */
interface FeedDataResponse {
  success: boolean;
  transactionCount?: number;
  dataSize?: number;
  message?: string;
}

/**
 * Maximum transactions allowed per session
 */
const MAX_TRANSACTIONS = 10000;

/**
 * POST /api/ai/feed-data
 * Load transaction data into an AI session based on filters
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FeedDataResponse>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const { sessionId, filters, limit, useRAG } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    // Verify session exists
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found or expired",
      });
    }

    // Update useRAG flag if provided
    if (typeof useRAG === "boolean") {
      updateSession(sessionId, { useRAG });
    }

    // Update status to feeding
    updateSessionStatus(sessionId, "feeding");

    // Connect to database
    await connectToDatabase();

    // Build query based on filters
    const query: Record<string, unknown> = {};

    if (filters?.company) {
      query.company = filters.company;
    }

    if (filters?.category) {
      // Need to lookup category ID
      query.category = filters.category;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      query.date = {};
      if (filters.dateFrom) {
        (query.date as Record<string, unknown>).$gte = new Date(
          filters.dateFrom,
        );
      }
      if (filters.dateTo) {
        (query.date as Record<string, unknown>).$lte = new Date(filters.dateTo);
      }
    }

    // Use limit from request or default to MAX_TRANSACTIONS, but never exceed MAX_TRANSACTIONS
    const effectiveLimit = Math.min(
      Math.max(1, parseInt(limit) || MAX_TRANSACTIONS),
      MAX_TRANSACTIONS,
    );

    // Fetch transactions with limit
    const transactions = await Transaction.find(query)
      .populate("company", "name address")
      .populate("goods", "rawName shortName category")
      .populate({
        path: "goods",
        populate: {
          path: "category",
          select: "name",
        },
      })
      .limit(effectiveLimit)
      .sort({ date: -1 })
      .lean();

    if (transactions.length === 0) {
      updateSessionStatus(sessionId, "error");
      return res.status(400).json({
        success: false,
        message: "No transactions found matching the filters",
      });
    }

    // Format transactions for AI context
    const formattedTransactions = transactions.map((tx) => ({
      declarationNumber: tx.declarationNumber,
      date: tx.date,
      companyName:
        (tx.company as unknown as { name: string })?.name || "Unknown",
      companyAddress:
        (tx.company as unknown as { address: string })?.address || "",
      importCountry: tx.importCountry || "N/A",
      goodsName:
        (tx.goods as unknown as { rawName: string })?.rawName || "Unknown",
      goodsShortName:
        (tx.goods as unknown as { shortName: string })?.shortName || "",
      categoryName:
        (tx.goods as unknown as { category: { name: string } })?.category
          ?.name || "Other",
      quantity: tx.quantity,
      unit: tx.unit,
      unitPriceUSD: tx.unitPriceUSD,
      totalValueUSD: tx.totalValueUSD,
    }));

    // Add data to session
    const updatedSession = addTransactionData(
      sessionId,
      formattedTransactions,
      filters,
    );

    if (!updatedSession) {
      return res.status(500).json({
        success: false,
        message: "Failed to update session with data",
      });
    }

    // If RAG is enabled, build vector index
    if (updatedSession.useRAG) {
      try {
        console.log(
          `[Feed Data] Building RAG index for session ${sessionId} with ${formattedTransactions.length} transactions`,
        );

        // Update status to indexing
        updateSessionStatus(sessionId, "indexing");

        // Generate embeddings for all transactions
        const embeddings: TransactionEmbedding[] =
          await generateBatchEmbeddings(formattedTransactions, 100);

        console.log(`[Feed Data] Generated ${embeddings.length} embeddings`);

        // Build vector index
        const indexResult = await buildIndex(sessionId, embeddings);

        if (indexResult.error) {
          console.error(`[Feed Data] Indexing failed: ${indexResult.error}`);
          updateSessionStatus(sessionId, "index-failed");
          updateSession(sessionId, {
            vectorIndex: {
              sessionId,
              status: "failed",
              transactionCount: formattedTransactions.length,
              embeddingDimensions: 384,
              indexedAt: new Date(),
            },
          });
        } else {
          console.log(
            `[Feed Data] Successfully built index with ${indexResult.transactionCount} items`,
          );
          updateSessionStatus(sessionId, "ready");
          updateSession(sessionId, {
            vectorIndex: {
              sessionId,
              status: "ready",
              transactionCount: indexResult.transactionCount,
              embeddingDimensions: indexResult.embeddingDimensions,
              indexedAt: indexResult.indexedAt,
            },
          });
        }
      } catch (indexError) {
        console.error("[Feed Data] Error building index:", indexError);
        updateSessionStatus(sessionId, "index-failed");
        updateSession(sessionId, {
          vectorIndex: {
            sessionId,
            status: "failed",
            transactionCount: formattedTransactions.length,
            embeddingDimensions: 384,
            indexedAt: new Date(),
          },
        });
      }
    }

    return res.status(200).json({
      success: true,
      transactionCount: updatedSession.metadata.transactionCount,
      dataSize: updatedSession.metadata.dataSize,
    });
  } catch (error) {
    console.error("[AI Feed Data] Error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to feed data",
    });
  }
}
