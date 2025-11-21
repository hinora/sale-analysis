import type { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/db/connection";
import { CSVParser, type CSVRow } from "@/lib/csv/parser";
import { CSVValidator } from "@/lib/csv/validator";
import { CSVDeduplicator } from "@/lib/csv/deduplicator";
import { aiNameShortener } from "@/lib/ai/name-shortener";
import { Transaction } from "@/lib/db/models/Transaction";
import { Company } from "@/lib/db/models/Company";
import { Goods } from "@/lib/db/models/Goods";
import { Category } from "@/lib/db/models/Category";

/**
 * Upload response
 */
interface UploadResponse {
  success: boolean;
  message: string;
  stats?: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicatesInFile: number;
    duplicatesInDB: number;
    importedRows: number;
    newCompanies: number;
    newGoods: number;
    errors: string[];
  };
}

/**
 * Enable larger body size for CSV uploads (100MB)
 */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "100mb",
    },
  },
};

/**
 * Parse European number format to float
 * Handles: 24.410,00 → 24410.00, dash → 0, empty → 0
 */
function parseNumber(value: string | undefined): number {
  if (!value) return 0;

  const trimmed = value.trim();

  // Handle dash/hyphen values (represent empty/zero)
  if (trimmed === "" || trimmed === "-" || trimmed === "—") {
    return 0;
  }

  // Handle European number format: 24.410,00 → 24410.00
  // Remove periods (thousands separator), replace comma with period (decimal)
  const normalized = trimmed.replace(/\./g, "").replace(/,/g, ".");
  const num = Number.parseFloat(normalized);

  return Number.isNaN(num) ? 0 : num;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    // Connect to database
    await connectToDatabase();

    // Get CSV content from request body
    const csvContent = req.body.csvContent;
    if (!csvContent || typeof csvContent !== "string") {
      return res.status(400).json({
        success: false,
        message: "No CSV content provided",
      });
    }

    // Parse CSV
    const parser = new CSVParser();
    const parseResult = await parser.parseString(csvContent);

    // Extract headers from first row
    const headers = Object.keys(parseResult.data[0] || {});

    // Validate CSV
    const validator = new CSVValidator();
    const validation = validator.validate(headers, parseResult.data);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "CSV validation failed",
        stats: {
          totalRows: parseResult.data.length,
          validRows: 0,
          invalidRows: parseResult.data.length,
          duplicatesInFile: 0,
          duplicatesInDB: 0,
          importedRows: 0,
          newCompanies: 0,
          newGoods: 0,
          errors: validation.errors.map(
            (e) => `Row ${e.row}: ${e.field} - ${e.message}`,
          ),
        },
      });
    }

    // Deduplicate within file
    const deduplicator = new CSVDeduplicator();
    const fileDedupeResult = deduplicator.deduplicate(parseResult.data);

    // Check for duplicates in database using composite keys
    // Query for existing transactions by declaration number, then check HS code + goods
    const uniqueDeclarationNumbers = Array.from(
      new Set(
        fileDedupeResult.uniqueRows.map((row: CSVRow) => row["Số tờ khai"]),
      ),
    );

    const existingTransactions = await Transaction.find({
      declarationNumber: { $in: uniqueDeclarationNumbers },
    }).select("declarationNumber hsCode goodsRawName");

    // Build composite key set from existing transactions
    const existingCompositeKeys = new Set(
      existingTransactions.map(
        (t) => `${t.declarationNumber}|${t.hsCode}|${t.goodsRawName}`,
      ),
    );

    const dbDedupeResult = deduplicator.filterDatabaseDuplicates(
      fileDedupeResult.uniqueRows,
      existingCompositeKeys,
    );

    // Process unique rows
    const stats = {
      totalRows: parseResult.data.length,
      validRows: parseResult.data.length - validation.errors.length,
      invalidRows: validation.errors.length,
      duplicatesInFile: fileDedupeResult.duplicates.length,
      duplicatesInDB: dbDedupeResult.existingRows.length,
      importedRows: 0,
      newCompanies: 0,
      newGoods: 0,
      errors: [] as string[],
    };

    // Disable AI for faster import (AI classification too slow)
    console.log(
      "[Import] AI disabled for performance - using fallback classification",
    );

    // Import rows
    for (const row of dbDedupeResult.newRows) {
      try {
        // Process company
        const company = await processCompany(row);
        if (company.isNew) stats.newCompanies++;

        // Process goods
        const goods = await processGoods(row);
        if (goods.isNew) stats.newGoods++;

        // Create transaction
        const yearVal = parseInt(row["Năm"]) || 0;
        const monthVal = parseInt(row["Tháng"]) || 0;
        const dayVal = parseInt(row["Ngày"]) || 0;
        const transactionDate = new Date(yearVal, monthVal - 1, dayVal);

        await Transaction.create({
          declarationNumber: row["Số tờ khai"],
          date: transactionDate,
          year: yearVal,
          month: monthVal,
          day: dayVal,
          company: company.id,
          goods: goods.id,
          hsCode: row["HS code"] || "",
          goodsRawName: row["Tên hàng"] || "",
          quantity: parseNumber(row["Số Lượng"]),
          unit: row["Đơn vị tính"] || "",
          unitPriceOriginal: parseNumber(row["Đơn giá Nguyên tệ"]),
          unitPriceUSD: parseNumber(row["Đơn giá khai báo(USD)"]),
          totalValueUSD: parseNumber(row["Trị giá USD"]),
          originalCurrency: row["Nguyên tệ"] || "",
          originalCurrencyRate: parseNumber(row["Tỷ giá nguyên tệ"]),
          usdRate: parseNumber(row["Tỷ giá USD"]),
          paymentMethod: row["Mã phương thức thanh toán"] || "",
          deliveryTerms: row["Điều kiện giao hàng"] || "",
          transportMode: row["Phương tiện vận chuyển"] || "",
          exportCountry: row["Tên nuớc xuất khẩu"] || "",
          importCountry: row["Tên nước nhập khẩu"] || "",
          customsOffice: row["Chi cục hải quan"] || "",
          exportType: row["Loại hình"] || "",
          taxRate: parseNumber(row["Thuế suất XNK"]),
          rawData: row,
        });

        stats.importedRows++;
      } catch (error) {
        console.error("[Import] Row processing error:", error);
        stats.errors.push(
          `Failed to import row with declaration ${row["Số tờ khai"]}`,
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: `Imported ${stats.importedRows} transactions successfully`,
      stats,
    });
  } catch (error) {
    console.error("[Import] Upload error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Upload failed",
    });
  }
}

/**
 * Process company from row
 */
async function processCompany(
  row: CSVRow,
): Promise<{ id: string; isNew: boolean }> {
  const companyName = row["Tên Cty nhập khẩu"] || "";
  const companyAddress = row["Địa chỉ Cty nhập khẩu"] || "";

  let company = await Company.findOne({
    name: companyName,
    address: companyAddress,
  });

  let isNew = false;
  if (!company) {
    company = await Company.create({
      name: companyName,
      address: companyAddress,
      taxCode: "", // Not available in CSV
    });
    isNew = true;
  }

  return { id: company._id.toString(), isNew };
}

/**
 * Process goods from row
 */
async function processGoods(
  row: CSVRow,
): Promise<{ id: string; isNew: boolean }> {
  const rawName = row["Tên hàng"] || "";
  const hsCode = row["HS code"] || "";

  // Query by rawName (unique identifier for goods)
  let goods = await Goods.findOne({ rawName });

  let isNew = false;
  if (!goods) {
    // Use fallback classification (AI disabled for performance)
    const defaultCategory = await Category.findOneAndUpdate(
      { name: "Other" },
      { name: "Other", description: "Uncategorized products" },
      { upsert: true, new: true },
    );
    const categoryId = defaultCategory._id.toString();
    const shortName = aiNameShortener.simpleShortenName(rawName);

    goods = await Goods.create({
      rawName,
      shortName,
      category: categoryId,
      hsCode: hsCode,
      classifiedBy: "fallback",
      classifiedAt: new Date(),
    });
    isNew = true;
  }

  return { id: goods._id.toString(), isNew };
}
