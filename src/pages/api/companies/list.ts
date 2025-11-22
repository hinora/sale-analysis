import type { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/db/connection";
import { Transaction } from "@/lib/db/models/Transaction";

/**
 * Company list response with aggregated statistics
 */
interface CompanyListResponse {
  success: boolean;
  companies: Array<{
    _id: string;
    name: string;
    address: string;
    totalTransactions: number;
    totalImportValue: number;
    totalQuantity: number;
    uniqueGoodsCount: number;
    firstTransactionDate: string;
    lastTransactionDate: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CompanyListResponse | { success: boolean; message: string }>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    await connectToDatabase();

    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const sortBy = (req.query.sortBy as string) || "totalImportValue";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    // Filters
    const categoryFilter = req.query.category as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const searchQuery = req.query.search as string;

    // Build aggregation pipeline
    // biome-ignore lint/suspicious/noExplicitAny: Mongoose aggregation pipeline requires flexible typing
    const pipeline: any[] = [];

    // Stage 1: Match transactions with filters
    const transactionFilters: Record<string, unknown> = {};

    if (dateFrom || dateTo) {
      transactionFilters.date = {};
      if (dateFrom) {
        (transactionFilters.date as Record<string, unknown>).$gte = new Date(dateFrom);
      }
      if (dateTo) {
        (transactionFilters.date as Record<string, unknown>).$lte = new Date(dateTo);
      }
    }

    if (Object.keys(transactionFilters).length > 0) {
      pipeline.push({ $match: transactionFilters });
    }

    // Stage 2: Lookup goods to filter by category if needed
    if (categoryFilter) {
      pipeline.push(
        {
          $lookup: {
            from: "goods",
            localField: "goods",
            foreignField: "_id",
            as: "goodsData",
          },
        },
        { $unwind: "$goodsData" },
        {
          $lookup: {
            from: "categories",
            localField: "goodsData.category",
            foreignField: "_id",
            as: "categoryData",
          },
        },
        { $unwind: "$categoryData" },
        {
          $match: {
            "categoryData.name": categoryFilter,
          },
        },
      );
    }

    // Stage 3: Group by company and calculate aggregations
    pipeline.push({
      $group: {
        _id: "$company",
        totalTransactions: { $sum: 1 },
        totalImportValue: { $sum: { $toDouble: "$totalValueUSD" } },
        totalQuantity: { $sum: { $toDouble: "$quantity" } },
        uniqueGoods: { $addToSet: "$goods" },
        firstTransaction: { $min: "$date" },
        lastTransaction: { $max: "$date" },
      },
    });

    // Stage 4: Lookup company details
    pipeline.push(
      {
        $lookup: {
          from: "companies",
          localField: "_id",
          foreignField: "_id",
          as: "company",
        },
      },
      { $unwind: "$company" },
    );

    // Stage 5: Apply search filter on company name
    if (searchQuery) {
      pipeline.push({
        $match: {
          "company.name": { $regex: searchQuery, $options: "i" },
        },
      });
    }

    // Stage 6: Project final shape
    pipeline.push({
      $project: {
        _id: "$company._id",
        name: "$company.name",
        address: "$company.address",
        totalTransactions: 1,
        totalImportValue: 1,
        totalQuantity: 1,
        uniqueGoodsCount: { $size: "$uniqueGoods" },
        firstTransactionDate: "$firstTransaction",
        lastTransactionDate: "$lastTransaction",
      },
    });

    // Stage 7: Sort
    const sortField = sortBy === "totalImportValue" ? "totalImportValue"
      : sortBy === "totalQuantity" ? "totalQuantity"
      : sortBy === "totalTransactions" ? "totalTransactions"
      : sortBy === "uniqueGoodsCount" ? "uniqueGoodsCount"
      : sortBy === "lastTransactionDate" ? "lastTransactionDate"
      : "totalImportValue";

    pipeline.push({ $sort: { [sortField]: sortOrder } });

    // Get total count before pagination
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await Transaction.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Stage 8: Pagination
    pipeline.push({ $skip: (page - 1) * pageSize }, { $limit: pageSize });

    // Execute aggregation
    const companies = await Transaction.aggregate(pipeline);

    // Format response
    const formattedCompanies = companies.map((company) => ({
      _id: company._id.toString(),
      name: company.name,
      address: company.address,
      totalTransactions: company.totalTransactions,
      totalImportValue: Math.round(company.totalImportValue * 100) / 100,
      totalQuantity: Math.round(company.totalQuantity * 100) / 100,
      uniqueGoodsCount: company.uniqueGoodsCount,
      firstTransactionDate: company.firstTransactionDate.toISOString(),
      lastTransactionDate: company.lastTransactionDate.toISOString(),
    }));

    return res.status(200).json({
      success: true,
      companies: formattedCompanies,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("[Companies List] Error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch companies",
    });
  }
}
