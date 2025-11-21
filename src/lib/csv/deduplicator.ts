import type { CSVRow } from "./parser";

/**
 * Deduplication result
 */
export interface DeduplicationResult {
  uniqueRows: CSVRow[];
  duplicates: Array<{
    row: CSVRow;
    declarationNumber: string;
    duplicateCount: number;
  }>;
  stats: {
    totalRows: number;
    uniqueRows: number;
    duplicateRows: number;
  };
}

/**
 * Deduplicator logic using composite key for duplicate detection
 * Identifies duplicates based on: declaration number + HS code + goods name
 * (A single declaration can have multiple line items with different goods)
 */
export class CSVDeduplicator {
  /**
   * Create composite key for uniqueness check
   * Declaration number alone is not enough - one declaration can have multiple line items
   */
  private createCompositeKey(row: CSVRow): string {
    const declarationNumber = row["Số tờ khai"]?.trim() || "";
    const hsCode = row["HS code"]?.trim() || "";
    const goodsName = row["Tên hàng"]?.trim() || "";

    return `${declarationNumber}|${hsCode}|${goodsName}`;
  }

  /**
   * Deduplicate rows based on composite key (declaration + HS code + goods)
   * Keeps first occurrence, marks subsequent ones as duplicates
   */
  deduplicate(rows: CSVRow[]): DeduplicationResult {
    const seen = new Set<string>();
    const uniqueRows: CSVRow[] = [];
    const duplicates: Array<{
      row: CSVRow;
      declarationNumber: string;
      duplicateCount: number;
    }> = [];

    const keyCounts = new Map<string, number>();

    // First pass: count occurrences
    for (const row of rows) {
      const key = this.createCompositeKey(row);
      if (key) {
        keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
      }
    }

    // Second pass: identify unique and duplicates
    for (const row of rows) {
      const key = this.createCompositeKey(row);
      const declarationNumber = row["Số tờ khai"]?.trim();

      if (!key || !declarationNumber) {
        // Skip rows without required fields
        continue;
      }

      if (seen.has(key)) {
        // Duplicate found
        duplicates.push({
          row,
          declarationNumber,
          duplicateCount: keyCounts.get(key) || 0,
        });
      } else {
        // First occurrence
        seen.add(key);
        uniqueRows.push(row);
      }
    }

    return {
      uniqueRows,
      duplicates,
      stats: {
        totalRows: rows.length,
        uniqueRows: uniqueRows.length,
        duplicateRows: duplicates.length,
      },
    };
  }

  /**
   * Check if a declaration number already exists in database
   * This should be called by the import service with database query
   */
  async checkDatabaseDuplicates(
    declarationNumbers: string[],
    checkFn: (numbers: string[]) => Promise<string[]>,
  ): Promise<Set<string>> {
    const existingNumbers = await checkFn(declarationNumbers);
    return new Set(existingNumbers);
  }

  /**
   * Filter out rows that exist in database
   * Uses composite key (declaration number + HS code + goods name)
   */
  filterDatabaseDuplicates(
    rows: CSVRow[],
    existingDeclarationNumbers: Set<string>,
  ): {
    newRows: CSVRow[];
    existingRows: CSVRow[];
  } {
    const newRows: CSVRow[] = [];
    const existingRows: CSVRow[] = [];

    for (const row of rows) {
      const declarationNumber = row["Số tờ khai"]?.trim();
      const compositeKey = this.createCompositeKey(row);

      // Check if this specific line item exists (not just the declaration)
      if (declarationNumber && existingDeclarationNumbers.has(compositeKey)) {
        existingRows.push(row);
      } else {
        newRows.push(row);
      }
    }

    return { newRows, existingRows };
  }

  /**
   * Get summary of duplicate detection
   */
  getSummary(result: DeduplicationResult): string {
    const { stats } = result;
    return `
Tổng số dòng: ${stats.totalRows}
Dòng duy nhất: ${stats.uniqueRows}
Dòng trùng lặp: ${stats.duplicateRows}
Tỷ lệ trùng: ${((stats.duplicateRows / stats.totalRows) * 100).toFixed(2)}%
    `.trim();
  }
}

/**
 * Export singleton instance
 */
export const csvDeduplicator = new CSVDeduplicator();
