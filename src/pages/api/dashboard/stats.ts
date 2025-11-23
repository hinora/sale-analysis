import type { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/db/connection";
import { Transaction } from "@/lib/db/models/Transaction";
import { Company } from "@/lib/db/models/Company";
import { Goods } from "@/lib/db/models/Goods";

/**
 * Dashboard statistics response
 */
interface DashboardStatsResponse {
  totalTransactions: number;
  totalCompanies: number;
  totalGoods: number;
  totalValueUSD: number;
  lastImportDate: string | null;
}

/**
 * GET /api/dashboard/stats
 * Returns overall system statistics for the dashboard
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DashboardStatsResponse | { error: string }>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await connectToDatabase();

    // Get total counts
    const [
      totalTransactions,
      totalCompanies,
      totalGoods,
      valueAggregation,
      lastTransaction,
    ] = await Promise.all([
      Transaction.countDocuments(),
      Company.countDocuments(),
      Goods.countDocuments(),
      Transaction.aggregate([
        {
          $group: {
            _id: null,
            totalValue: { $sum: { $toDouble: "$totalValueUSD" } },
          },
        },
      ]),
      Transaction.findOne().sort({ createdAt: -1 }).lean(),
    ]);

    const totalValueUSD = valueAggregation[0]?.totalValue || 0;
    const lastImportDate = lastTransaction?.createdAt
      ? lastTransaction.createdAt.toISOString()
      : null;

    return res.status(200).json({
      totalTransactions,
      totalCompanies,
      totalGoods,
      totalValueUSD,
      lastImportDate,
    });
  } catch (error) {
    console.error("[Dashboard Stats] Error:", error);
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to fetch statistics",
    });
  }
}
