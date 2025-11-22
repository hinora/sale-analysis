import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/db/connection';
import { Category } from '@/lib/db/models/Category';

/**
 * Categories list response
 */
interface CategoriesListResponse {
  categories: string[];
}

/**
 * Error response
 */
interface ErrorResponse {
  error: string;
  details?: string;
}

/**
 * GET /api/categories/list
 * 
 * Get list of distinct category names.
 * Returns all category names from the Category collection.
 * 
 * @example
 * GET /api/categories/list
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CategoriesListResponse | ErrorResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectToDatabase();

    // Get all categories
    const categoryDocs = await Category.find({}).select('name').lean();
    const categories = categoryDocs.map((cat: any) => cat.name).filter(Boolean);

    // Sort alphabetically
    categories.sort();

    return res.status(200).json({ categories });
  } catch (error) {
    console.error('[API] Error fetching categories:', error);
    return res.status(500).json({
      error: 'Failed to fetch categories',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
