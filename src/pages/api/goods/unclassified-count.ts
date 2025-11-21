import type { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/db/connection";
import { Goods } from "@/lib/db/models/Goods";

/**
 * Response interface
 */
interface UnclassifiedCountResponse {
  count: number;
}

interface ErrorResponse {
  error: string;
  message?: string;
}

/**
 * GET /api/goods/unclassified-count
 *
 * Returns the count of goods with fallback classification.
 * Used by frontend to optimize background job triggering - skip trigger if count is zero.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UnclassifiedCountResponse | ErrorResponse>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await connectToDatabase();

    // Count goods with fallback classification
    const count = await Goods.countDocuments({
      classifiedBy: "fallback",
    });

    return res.status(200).json({ count });
  } catch (error) {
    console.error("[API] Failed to count unclassified goods:", error);
    return res.status(500).json({
      error: "Failed to count unclassified goods",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
