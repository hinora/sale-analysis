import Papa from "papaparse";

/**
 * CSV row interface matching the expected format
 */
export interface CSVRow {
  Năm: string;
  Tháng: string;
  Ngày: string;
  "Tên Cty nhập khẩu": string;
  "Địa chỉ Cty nhập khẩu": string;
  "HS code": string;
  "Tên hàng": string;
  "Thuế suất XNK": string;
  "Đơn vị tính": string;
  "Số Lượng": string;
  "Đơn giá Nguyên tệ": string;
  "Đơn giá khai báo(USD)": string;
  "Trị giá USD": string;
  "Nguyên tệ": string;
  "Tỷ giá nguyên tệ": string;
  "Tỷ giá USD": string;
  "Mã phương thức thanh toán": string;
  "Điều kiện giao hàng": string;
  "Phương tiện vận chuyển": string;
  "Tên nuớc xuất khẩu": string;
  "Tên nước nhập khẩu": string;
  "Chi cục hải quan": string;
  "Loại hình": string;
  "Số tờ khai": string;
  [key: string]: string; // Allow additional fields
}

/**
 * Parsed CSV result
 */
export interface ParsedCSVResult {
  data: CSVRow[];
  errors: Array<{
    row: number;
    message: string;
  }>;
  meta: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
}

/**
 * CSV streaming parser using papaparse with chunked processing
 * Processes large files in 1000-row chunks for memory efficiency
 */
export class CSVParser {
  private chunkSize: number;

  constructor(chunkSize = 1000) {
    this.chunkSize = chunkSize;
  }

  /**
   * Parse CSV file with streaming
   */
  async parseFile(file: File): Promise<ParsedCSVResult> {
    return new Promise((resolve, reject) => {
      const data: CSVRow[] = [];
      const errors: Array<{ row: number; message: string }> = [];
      let rowCount = 0;

      Papa.parse<CSVRow>(file, {
        header: true,
        skipEmptyLines: true,
        chunk: (results, parser) => {
          rowCount += results.data.length;

          // Process chunk
          for (const row of results.data) {
            data.push(row);
          }

          // Log progress
          if (rowCount % this.chunkSize === 0) {
            console.log(`[CSVParser] Processed ${rowCount} rows...`);
          }
        },
        complete: () => {
          console.log(`[CSVParser] Parsing complete. Total rows: ${rowCount}`);
          resolve({
            data,
            errors,
            meta: {
              totalRows: rowCount,
              validRows: data.length,
              invalidRows: errors.length,
            },
          });
        },
        error: (error) => {
          console.error("[CSVParser] Parse error:", error);
          reject(new Error(`CSV parse error: ${error.message}`));
        },
      });
    });
  }

  /**
   * Parse CSV from string content
   */
  parseString(content: string): ParsedCSVResult {
    const result = Papa.parse<CSVRow>(content, {
      header: true,
      skipEmptyLines: true,
    });

    const errors = result.errors.map((err) => ({
      row: err.row || 0,
      message: err.message,
    }));

    return {
      data: result.data,
      errors,
      meta: {
        totalRows: result.data.length + errors.length,
        validRows: result.data.length,
        invalidRows: errors.length,
      },
    };
  }

  /**
   * Stream process CSV with callback for each chunk
   */
  async streamProcess(
    file: File,
    onChunk: (chunk: CSVRow[], progress: number) => Promise<void>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let rowCount = 0;
      const totalSize = file.size;
      let processedSize = 0;

      Papa.parse<CSVRow>(file, {
        header: true,
        skipEmptyLines: true,
        chunk: async (results, parser) => {
          rowCount += results.data.length;
          processedSize += results.data.reduce(
            (sum, row) => sum + JSON.stringify(row).length,
            0,
          );

          const progress = Math.min((processedSize / totalSize) * 100, 99);

          // Pause parsing while processing chunk
          parser.pause();

          try {
            await onChunk(results.data, progress);
            parser.resume();
          } catch (error) {
            parser.abort();
            reject(error);
          }
        },
        complete: () => {
          console.log(
            `[CSVParser] Stream processing complete. Total rows: ${rowCount}`,
          );
          resolve();
        },
        error: (error) => {
          console.error("[CSVParser] Stream error:", error);
          reject(new Error(`CSV stream error: ${error.message}`));
        },
      });
    });
  }
}

/**
 * Export singleton instance
 */
export const csvParser = new CSVParser();
