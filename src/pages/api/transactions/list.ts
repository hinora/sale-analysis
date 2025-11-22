import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/db/connection';
import { Transaction } from '@/lib/db/models/Transaction';
// Import Company and Goods models to ensure they're registered for populate()
import '@/lib/db/models/Company';
import '@/lib/db/models/Goods';

/**
 * Transaction list response
 */
interface TransactionListResponse {
  transactions: Array<{
    _id: string;
    declarationNumber: string;
    date: string;
    company: {
      _id: string;
      name: string;
      address: string;
    };
    goods: {
      _id: string;
      rawName: string;
      shortName: string;
      category: string;
    };
    quantity: number;
    unit: string;
    unitPrice: number;
    totalValue: number;
    currency: string;
    hsCode?: string;
    rawCsvData: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Error response
 */
interface ErrorResponse {
  error: string;
  details?: string;
}

/**
 * GET /api/transactions/list
 * 
 * Retrieve transactions with flexible filtering, sorting, and pagination.
 * Supports filters: company name, date range, goods category, goods name.
 * Supports sorting by any field with ascending/descending order.
 * Returns paginated results with transaction details and populated references.
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 50, max: 100)
 * - sortBy: Field to sort by (default: date)
 * - sortOrder: asc or desc (default: desc)
 * - company: Company name (partial match, case-insensitive)
 * - dateFrom: Start date (ISO 8601 format)
 * - dateTo: End date (ISO 8601 format)
 * - category: Goods category (exact match)
 * - goods: Goods name (partial match, case-insensitive)
 * 
 * @example
 * GET /api/transactions/list?page=1&pageSize=50&sortBy=date&sortOrder=desc
 * GET /api/transactions/list?company=Nike&dateFrom=2023-01-01&dateTo=2023-12-31
 * GET /api/transactions/list?category=Electronics&sortBy=totalValue&sortOrder=desc
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TransactionListResponse | ErrorResponse>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Connect to database
    await connectToDatabase();

    // Parse query parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));
    const sortBy = (req.query.sortBy as string) || 'date';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 1 : -1;

    // Build aggregation pipeline for filtering on populated fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipeline: any[] = [];

    // Lookup company and goods first
    pipeline.push(
      {
        $lookup: {
          from: 'companies',
          localField: 'company',
          foreignField: '_id',
          as: 'companyData',
        },
      },
      { $unwind: { path: '$companyData', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'goods',
          localField: 'goods',
          foreignField: '_id',
          as: 'goodsData',
        },
      },
      { $unwind: { path: '$goodsData', preserveNullAndEmptyArrays: true } },
      // Lookup category from goods
      {
        $lookup: {
          from: 'categories',
          localField: 'goodsData.category',
          foreignField: '_id',
          as: 'categoryData',
        },
      },
      { $unwind: { path: '$categoryData', preserveNullAndEmptyArrays: true } }
    );

    // Build match filters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchFilters: any = {};

    // Company name filter
    if (req.query.company) {
      matchFilters['companyData.name'] = { $regex: req.query.company as string, $options: 'i' };
    }

    // Date range filter
    if (req.query.dateFrom || req.query.dateTo) {
      matchFilters.date = {};
      if (req.query.dateFrom) {
        matchFilters.date.$gte = new Date(req.query.dateFrom as string);
      }
      if (req.query.dateTo) {
        matchFilters.date.$lte = new Date(req.query.dateTo as string);
      }
    }

    // Category filter
    if (req.query.category) {
      matchFilters['categoryData.name'] = req.query.category as string;
    }

    // Goods name filter
    if (req.query.goods) {
      matchFilters['goodsData.shortName'] = { $regex: req.query.goods as string, $options: 'i' };
    }

    // Apply match stage if there are filters
    if (Object.keys(matchFilters).length > 0) {
      pipeline.push({ $match: matchFilters });
    }

    console.log('[API] Transaction list query:', {
      page,
      pageSize,
      sortBy,
      sortOrder,
      filters: matchFilters,
    });

    // Count total matching documents
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Transaction.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Calculate pagination
    const skip = (page - 1) * pageSize;
    const totalPages = Math.ceil(total / pageSize);

    // Add sorting and pagination to main pipeline
    pipeline.push(
      { $sort: { [sortBy]: sortOrder } },
      { $skip: skip },
      { $limit: pageSize },
      // Convert Decimal128 to numbers for easier frontend handling
      {
        $addFields: {
          quantityNum: { $toDouble: '$quantity' },
          unitPriceNum: { $toDouble: '$unitPriceUSD' },
          totalValueNum: { $toDouble: '$totalValueUSD' },
        },
      }
    );

    // Execute aggregation
    const transactions = await Transaction.aggregate(pipeline);

    // Format response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedTransactions = transactions.map((tx: any) => ({
      _id: tx._id.toString(),
      declarationNumber: tx.declarationNumber || '',
      date: tx.date ? new Date(tx.date).toISOString() : '',
      company: {
        _id: tx.companyData?._id?.toString() || '',
        name: tx.companyData?.name || '',
        address: tx.companyData?.address || '',
      },
      goods: {
        _id: tx.goodsData?._id?.toString() || '',
        rawName: tx.goodsData?.rawName || '',
        shortName: tx.goodsData?.shortName || '',
        category: tx.categoryData?.name || '',
      },
      quantity: tx.quantityNum || 0,
      unit: tx.unit || '',
      unitPrice: tx.unitPriceNum || 0,
      totalValue: tx.totalValueNum || 0,
      currency: 'USD',
      hsCode: tx.hsCode,
      rawCsvData: tx.rawData ? JSON.stringify(tx.rawData) : '',
    }));

    console.log(`[API] Returning ${formattedTransactions.length} transactions (total: ${total})`);

    return res.status(200).json({
      transactions: formattedTransactions,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error('[API] Error fetching transactions:', error);
    return res.status(500).json({
      error: 'Failed to fetch transactions',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
