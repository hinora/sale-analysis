/** biome-ignore-all lint/suspicious/noThenProperty: <explanation> */
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/db/connection';
import { Goods } from '@/lib/db/models/Goods';
import '@/lib/db/models/Transaction';
import '@/lib/db/models/Company';
import '@/lib/db/models/Category';

/**
 * Goods list response with aggregated metrics
 */
interface GoodsListResponse {
  goods: Array<{
    _id: string;
    rawName: string;
    shortName: string;
    category: string;
    hsCode: string;
    totalQuantityExported: number;
    totalValueExported: number;
    transactionCount: number;
    averagePrice: number;
    lastExportDate: string;
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
 * GET /api/goods/list
 * 
 * Retrieve goods with aggregated export statistics.
 * Supports filtering by company, date range, and category.
 * Supports sorting by any field including aggregated metrics.
 * Returns paginated results with goods details and calculated statistics.
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 50, max: 100)
 * - sortBy: Field to sort by (default: totalValueExported)
 * - sortOrder: asc or desc (default: desc)
 * - company: Company name filter (partial match, case-insensitive)
 * - dateFrom: Start date (ISO 8601 format)
 * - dateTo: End date (ISO 8601 format)
 * - category: Category name filter (exact match)
 * - search: Search in goods name (partial match, case-insensitive)
 * 
 * @example
 * GET /api/goods/list?page=1&pageSize=50&sortBy=totalValueExported&sortOrder=desc
 * GET /api/goods/list?category=Fresh%20Seafood&dateFrom=2024-01-01&dateTo=2024-12-31
 * GET /api/goods/list?company=Nike&sortBy=transactionCount&sortOrder=desc
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GoodsListResponse | ErrorResponse>
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
    const sortBy = (req.query.sortBy as string) || 'totalValueExported';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 1 : -1;

    // Build aggregation pipeline
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipeline: any[] = [];

    // Start with goods collection
    pipeline.push({
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryData',
      },
    });
    pipeline.push({ $unwind: { path: '$categoryData', preserveNullAndEmptyArrays: true } });

    // Lookup transactions for each goods
    pipeline.push({
      $lookup: {
        from: 'transactions',
        localField: '_id',
        foreignField: 'goods',
        as: 'transactions',
      },
    });

    // Build match filters for transactions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transactionFilters: any = {};

    // Date range filter
    if (req.query.dateFrom || req.query.dateTo) {
      transactionFilters['transactions.date'] = {};
      if (req.query.dateFrom) {
        transactionFilters['transactions.date'].$gte = new Date(req.query.dateFrom as string);
      }
      if (req.query.dateTo) {
        transactionFilters['transactions.date'].$lte = new Date(req.query.dateTo as string);
      }
    }

    // If we have transaction filters or company filter, we need to filter transactions
    if (req.query.company || Object.keys(transactionFilters).length > 0) {
      // Lookup companies for filtering
      pipeline.push({
        $lookup: {
          from: 'companies',
          localField: 'transactions.company',
          foreignField: '_id',
          as: 'companiesData',
        },
      });

      // Build company filter
      if (req.query.company) {
        pipeline.push({
          $addFields: {
            transactions: {
              $filter: {
                input: '$transactions',
                as: 'tx',
                cond: {
                  $in: [
                    '$$tx.company',
                    {
                      $map: {
                        input: {
                          $filter: {
                            input: '$companiesData',
                            as: 'comp',
                            cond: {
                              $regexMatch: {
                                input: '$$comp.name',
                                regex: req.query.company as string,
                                options: 'i',
                              },
                            },
                          },
                        },
                        as: 'comp',
                        in: '$$comp._id',
                      },
                    },
                  ],
                },
              },
            },
          },
        });
      }

      // Date range filter on transactions
      if (req.query.dateFrom || req.query.dateTo) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dateFilter: any = {};
        if (req.query.dateFrom) {
          dateFilter.$gte = new Date(req.query.dateFrom as string);
        }
        if (req.query.dateTo) {
          dateFilter.$lte = new Date(req.query.dateTo as string);
        }

        pipeline.push({
          $addFields: {
            transactions: {
              $filter: {
                input: '$transactions',
                as: 'tx',
                cond: {
                  $and: [
                    dateFilter.$gte ? { $gte: ['$$tx.date', dateFilter.$gte] } : true,
                    dateFilter.$lte ? { $lte: ['$$tx.date', dateFilter.$lte] } : true,
                  ],
                },
              },
            },
          },
        });
      }
    }

    // Calculate aggregated metrics
    pipeline.push({
      $addFields: {
        totalQuantityExported: {
          $sum: {
            $map: {
              input: '$transactions',
              as: 'tx',
              in: { $toDouble: '$$tx.quantity' },
            },
          },
        },
        totalValueExported: {
          $sum: {
            $map: {
              input: '$transactions',
              as: 'tx',
              in: { $toDouble: '$$tx.totalValueUSD' },
            },
          },
        },
        transactionCount: { $size: '$transactions' },
        lastExportDate: { $max: '$transactions.date' },
      },
    });

    // Calculate average price
    pipeline.push({
      $addFields: {
        averagePrice: {
          $cond: {
            if: { $gt: ['$totalQuantityExported', 0] },
            then: { $divide: ['$totalValueExported', '$totalQuantityExported'] },
            else: 0,
          },
        },
      },
    });

    // Build goods-level filters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const goodsFilters: any = {};

    // Category filter
    if (req.query.category) {
      goodsFilters['categoryData.name'] = req.query.category as string;
    }

    // Search filter on goods name
    if (req.query.search) {
      goodsFilters.$or = [
        { rawName: { $regex: req.query.search as string, $options: 'i' } },
        { shortName: { $regex: req.query.search as string, $options: 'i' } },
      ];
    }

    // Only include goods with at least one transaction (after filtering)
    goodsFilters.transactionCount = { $gt: 0 };

    // Apply goods-level match
    if (Object.keys(goodsFilters).length > 0) {
      pipeline.push({ $match: goodsFilters });
    }

    console.log('[API] Goods list query:', {
      page,
      pageSize,
      sortBy,
      sortOrder,
      filters: {
        company: req.query.company,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        category: req.query.category,
        search: req.query.search,
      },
    });

    // Count total matching documents
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Goods.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Calculate pagination
    const skip = (page - 1) * pageSize;
    const totalPages = Math.ceil(total / pageSize);

    // Add sorting and pagination
    pipeline.push(
      { $sort: { [sortBy]: sortOrder } },
      { $skip: skip },
      { $limit: pageSize }
    );

    // Project final fields
    pipeline.push({
      $project: {
        _id: 1,
        rawName: 1,
        shortName: 1,
        category: '$categoryData.name',
        hsCode: 1,
        totalQuantityExported: 1,
        totalValueExported: 1,
        transactionCount: 1,
        averagePrice: 1,
        lastExportDate: 1,
      },
    });

    // Execute aggregation
    const goods = await Goods.aggregate(pipeline);

    // Format response
    const formattedGoods = goods.map((g) => ({
      _id: g._id.toString(),
      rawName: g.rawName || '',
      shortName: g.shortName || '',
      category: g.category || '',
      hsCode: g.hsCode || '',
      totalQuantityExported: g.totalQuantityExported || 0,
      totalValueExported: g.totalValueExported || 0,
      transactionCount: g.transactionCount || 0,
      averagePrice: g.averagePrice || 0,
      lastExportDate: g.lastExportDate ? new Date(g.lastExportDate).toISOString() : '',
    }));

    console.log(`[API] Returning ${formattedGoods.length} goods (total: ${total})`);

    return res.status(200).json({
      goods: formattedGoods,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error('[API] Error fetching goods:', error);
    return res.status(500).json({
      error: 'Failed to fetch goods',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
