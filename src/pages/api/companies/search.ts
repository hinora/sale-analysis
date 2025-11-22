import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/db/connection';
import { Company } from '@/lib/db/models/Company';

/**
 * Company search response
 */
interface CompanySearchResponse {
  companies: Array<{
    _id: string;
    name: string;
    address: string;
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
 * GET /api/companies/search
 * 
 * Search for companies by name (partial match, case-insensitive).
 * Returns up to 20 matching companies with name and address.
 * 
 * Query parameters:
 * - q: Search query (minimum 2 characters)
 * 
 * @example
 * GET /api/companies/search?q=Cape
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CompanySearchResponse | ErrorResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const query = req.query.q as string;

    if (!query || query.length < 2) {
      return res.status(200).json({ companies: [] });
    }

    await connectToDatabase();

    // Search companies by name (case-insensitive partial match)
    const companies = await Company.find({
      name: { $regex: query, $options: 'i' },
    })
      .select('name address')
      .limit(20)
      .lean();

    const formattedCompanies = companies.map((company: any) => ({
      _id: company._id.toString(),
      name: company.name,
      address: company.address || '',
    }));

    return res.status(200).json({ companies: formattedCompanies });
  } catch (error) {
    console.error('[API] Error searching companies:', error);
    return res.status(500).json({
      error: 'Failed to search companies',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
