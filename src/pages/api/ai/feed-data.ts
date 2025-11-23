import type { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/db/connection";
import { Transaction } from "@/lib/db/models/Transaction";
import { addTransactionData, getSession, updateSessionStatus } from "@/lib/ai/session-manager";

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
    const { sessionId, filters } = req.body;

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
        (query.date as Record<string, unknown>).$gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        (query.date as Record<string, unknown>).$lte = new Date(filters.dateTo);
      }
    }

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
      .limit(MAX_TRANSACTIONS)
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
      companyName: (tx.company as unknown as { name: string })?.name || "Unknown",
      companyAddress: (tx.company as unknown as { address: string })?.address || "",
      importCountry: tx.importCountry || "N/A",
      goodsName: (tx.goods as unknown as { rawName: string })?.rawName || "Unknown",
      goodsShortName: (tx.goods as unknown as { shortName: string })?.shortName || "",
      categoryName:
        (tx.goods as unknown as { category: { name: string } })?.category?.name || "Other",
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
