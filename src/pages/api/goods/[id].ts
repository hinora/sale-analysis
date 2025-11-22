import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/db/connection';
import { Goods } from '@/lib/db/models/Goods';
import { Transaction } from '@/lib/db/models/Transaction';
import '@/lib/db/models/Company';
import '@/lib/db/models/Category';
import mongoose from 'mongoose';

/**
 * Goods detail response
 */
interface GoodsDetailResponse {
  goods: {
    _id: string;
    rawName: string;
    shortName: string;
    category: string;
    hsCode: string;
    classifiedBy: string;
    classifiedAt: string;
    totalQuantityExported: number;
    totalValueExported: number;
    transactionCount: number;
    averagePrice: number;
  };
  transactions: Array<{
    _id: string;
    declarationNumber: string;
    date: string;
    company: {
      _id: string;
      name: string;
      address: string;
    };
    quantity: number;
    unit: string;
    unitPrice: number;
    totalValue: number;
    hsCode: string;
  }>;
}

/**
 * Error response
 */
interface ErrorResponse {
  error: string;
  details?: string;
}

/**
 * GET /api/goods/[id]
 * 
 * Retrieve detailed information about a specific goods item.
 * Includes aggregated statistics and all related transactions.
 * 
 * Path parameters:
 * - id: Goods document ID
 * 
 * Query parameters:
 * - page: Page number for transactions (default: 1)
 * - pageSize: Transactions per page (default: 50, max: 100)
 * - sortBy: Field to sort transactions by (default: date)
 * - sortOrder: asc or desc (default: desc)
 * 
 * @example
 * GET /api/goods/507f1f77bcf86cd799439011
 * GET /api/goods/507f1f77bcf86cd799439011?page=1&pageSize=25&sortBy=totalValue&sortOrder=desc
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GoodsDetailResponse | ErrorResponse>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Connect to database
    await connectToDatabase();

    const { id } = req.query;

    // Validate ID
    if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid goods ID' });
    }

    // Parse query parameters for transactions pagination
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));
    const sortBy = (req.query.sortBy as string) || 'date';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 1 : -1;

    // Fetch goods details
    const goods = await Goods.findById(id).populate('category', 'name').lean();

    if (!goods) {
      return res.status(404).json({ error: 'Goods not found' });
    }

    // Fetch transactions for this goods
    const skip = (page - 1) * pageSize;
    const transactions = await Transaction.find({ goods: id })
      .populate('company', 'name address')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(pageSize)
      .lean();

    // Calculate aggregated metrics
    const stats = await Transaction.aggregate([
      { $match: { goods: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: null,
          totalQuantity: {
            $sum: { $toDouble: '$quantity' },
          },
          totalValue: {
            $sum: { $toDouble: '$totalValueUSD' },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalQuantityExported = stats.length > 0 ? stats[0].totalQuantity : 0;
    const totalValueExported = stats.length > 0 ? stats[0].totalValue : 0;
    const transactionCount = stats.length > 0 ? stats[0].count : 0;
    const averagePrice =
      totalQuantityExported > 0 ? totalValueExported / totalQuantityExported : 0;

    // Format response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedTransactions = transactions.map((tx: any) => {
      // Convert Decimal128 to number - handle both lean() and populated formats
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const convertDecimal = (value: any): number => {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        if (value.$numberDecimal) return parseFloat(value.$numberDecimal);
        if (value.toString) return parseFloat(value.toString());
        return 0;
      };

      return {
        _id: tx._id.toString(),
        declarationNumber: tx.declarationNumber || '',
        date: tx.date ? new Date(tx.date).toISOString() : '',
        company: {
          _id: tx.company?._id?.toString() || '',
          name: tx.company?.name || '',
          address: tx.company?.address || '',
        },
        quantity: convertDecimal(tx.quantity),
        unit: tx.unit || '',
        unitPrice: convertDecimal(tx.unitPriceUSD),
        totalValue: convertDecimal(tx.totalValueUSD),
        hsCode: tx.hsCode || '',
      };
    });

    console.log(`[API] Returning goods detail for ${id} with ${formattedTransactions.length} transactions`);

    return res.status(200).json({
      goods: {
        _id: goods._id.toString(),
        rawName: goods.rawName || '',
        shortName: goods.shortName || '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        category: (goods.category as any)?.name || '',
        hsCode: goods.hsCode || '',
        classifiedBy: goods.classifiedBy || '',
        classifiedAt: goods.classifiedAt ? goods.classifiedAt.toISOString() : '',
        totalQuantityExported,
        totalValueExported,
        transactionCount,
        averagePrice,
      },
      transactions: formattedTransactions,
    });
  } catch (error) {
    console.error('[API] Error fetching goods detail:', error);
    return res.status(500).json({
      error: 'Failed to fetch goods detail',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
