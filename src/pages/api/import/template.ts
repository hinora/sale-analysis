import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs/promises";
import path from "path";

/**
 * Serve CSV template for download
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    // Path to template file
    const templatePath = path.join(
      process.cwd(),
      "public",
      "templates",
      "export-data-template.csv",
    );

    // Check if file exists
    try {
      await fs.access(templatePath);
    } catch {
      return res.status(404).json({
        success: false,
        message: "Template file not found",
      });
    }

    // Read file
    const fileContent = await fs.readFile(templatePath, "utf-8");

    // Set headers for download
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=export-data-template.csv",
    );
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour

    // Send file
    return res.status(200).send(fileContent);
  } catch (error) {
    console.error("[Template] Error serving template:", error);
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to serve template",
    });
  }
}
