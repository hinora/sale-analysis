import type { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/db/connection";
import { Transaction } from "@/lib/db/models/Transaction";
import { Company } from "@/lib/db/models/Company";
import { Types } from "mongoose";

/**
 * Company detail response with transactions
 */
interface CompanyDetailResponse {
  success: boolean;
  company: {
    _id: string;
    name: string;
    address: string;
    totalTransactions: number;
    totalImportValue: number;
    totalQuantity: number;
    uniqueGoodsCount: number;
    firstTransactionDate: string;
    lastTransactionDate: string;
  };
  transactions: Array<{
    _id: string;
    declarationNumber: string;
    date: string;
    goodsName: string;
    goodsShortName: string;
    category: string;
    hsCode: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalValue: number;
  }>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    CompanyDetailResponse | { success: boolean; message: string }
  >,
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    await connectToDatabase();

    const { id } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    // Validate ObjectId
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid company ID format",
      });
    }

    // Fetch company
    const company = await Company.findById(id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // Fetch transactions for this company
    const transactions = await Transaction.find({ company: id })
      .populate("goods", "rawName shortName category hsCode")
      .sort({ date: -1 })
      .limit(1000) // Limit to last 1000 transactions
      .lean();

    // Calculate aggregated statistics
    const stats = await Transaction.aggregate([
      { $match: { company: new Types.ObjectId(id) } },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalImportValue: { $sum: { $toDouble: "$totalValueUSD" } },
          totalQuantity: { $sum: { $toDouble: "$quantity" } },
          uniqueGoods: { $addToSet: "$goods" },
          firstTransaction: { $min: "$date" },
          lastTransaction: { $max: "$date" },
        },
      },
    ]);

    const aggregatedStats = stats[0] || {
      totalTransactions: 0,
      totalImportValue: 0,
      totalQuantity: 0,
      uniqueGoods: [],
      firstTransaction: new Date(),
      lastTransaction: new Date(),
    };

    // Convert Decimal128 to number
    const convertDecimal = (value: unknown): number => {
      if (!value) return 0;
      if (typeof value === "number") return value;
      if (
        typeof value === "object" &&
        value !== null &&
        "$numberDecimal" in value
      ) {
        return Number.parseFloat(
          (value as { $numberDecimal: string }).$numberDecimal,
        );
      }
      if (
        typeof value === "object" &&
        value !== null &&
        "toString" in value &&
        typeof value.toString === "function"
      ) {
        return Number.parseFloat(value.toString());
      }
      return 0;
    };

    // Format transactions
    const formattedTransactions = transactions.map((tx) => {
      const goodsDoc = tx.goods as {
        rawName?: string;
        shortName?: string;
        category?: { name?: string };
        hsCode?: string;
      } | null;
      const categoryDoc = goodsDoc?.category as { name?: string } | null;

      return {
        _id: tx._id.toString(),
        declarationNumber: tx.declarationNumber,
        date: tx.date.toISOString(),
        goodsName: goodsDoc?.rawName || "",
        goodsShortName: goodsDoc?.shortName || "",
        category: categoryDoc?.name || "",
        hsCode: goodsDoc?.hsCode || tx.hsCode || "",
        quantity: convertDecimal(tx.quantity),
        unit: tx.unit || "",
        unitPrice: convertDecimal(tx.unitPriceUSD),
        totalValue: convertDecimal(tx.totalValueUSD),
      };
    });

    return res.status(200).json({
      success: true,
      company: {
        _id: company._id.toString(),
        name: company.name,
        address: company.address,
        totalTransactions: aggregatedStats.totalTransactions,
        totalImportValue:
          Math.round(aggregatedStats.totalImportValue * 100) / 100,
        totalQuantity: Math.round(aggregatedStats.totalQuantity * 100) / 100,
        uniqueGoodsCount: aggregatedStats.uniqueGoods.length,
        firstTransactionDate: aggregatedStats.firstTransaction.toISOString(),
        lastTransactionDate: aggregatedStats.lastTransaction.toISOString(),
      },
      transactions: formattedTransactions,
    });
  } catch (error) {
    console.error("[Company Detail] Error:", error);
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch company detail",
    });
  }
}
