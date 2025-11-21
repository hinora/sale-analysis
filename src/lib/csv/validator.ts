import type { CSVRow } from './parser';

/**
 * Validation error
 */
export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Required CSV columns (in actual order from file)
 */
const REQUIRED_COLUMNS = [
  'Năm',
  'Tháng',
  'Ngày',
  'Tên Cty nhập khẩu',
  // 'Địa chỉ Cty nhập khẩu', // Optional - many records don't have it
  'HS code',
  'Tên hàng',
  'Thuế suất XNK',
  'Đơn vị tính',
  'Số Lượng',
  'Đơn giá Nguyên tệ',
  'Đơn giá khai báo(USD)',
  'Trị giá USD',
  'Nguyên tệ',
  'Tỷ giá nguyên tệ',
  'Tỷ giá USD',
  'Mã phương thức thanh toán',
  'Điều kiện giao hàng',
  'Phương tiện vận chuyển',
  'Tên nuớc xuất khẩu',
  // 'Tên nước nhập khẩu', // Optional - some records have it empty
  'Chi cục hải quan',
  'Loại hình',
  'Số tờ khai',
];

/**
 * CSV validator to check required columns and data types
 */
export class CSVValidator {
  /**
   * Validate CSV headers
   */
  validateHeaders(headers: string[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Check for missing required columns
    for (const required of REQUIRED_COLUMNS) {
      if (!headers.includes(required)) {
        errors.push({
          row: 0,
          field: required,
          message: `Thiếu cột bắt buộc: ${required}`,
        });
      }
    }

    // Check for extra columns (warnings only)
    for (const header of headers) {
      if (!REQUIRED_COLUMNS.includes(header) && header.trim() !== '') {
        warnings.push({
          row: 0,
          field: header,
          message: `Cột không xác định: ${header}`,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a single CSV row
   */
  validateRow(row: CSVRow, rowIndex: number): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate required fields are not empty
    for (const field of REQUIRED_COLUMNS) {
      const value = row[field];
      if (!value || value.trim() === '') {
        errors.push({
          row: rowIndex,
          field,
          message: `Trường bắt buộc trống: ${field}`,
          value: value || '',
        });
      }
    }

    // Validate date fields
    const year = Number.parseInt(row['Năm'], 10);
    const month = Number.parseInt(row['Tháng'], 10);
    const day = Number.parseInt(row['Ngày'], 10);

    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      errors.push({
        row: rowIndex,
        field: 'Năm',
        message: `Năm không hợp lệ: ${row['Năm']}`,
        value: row['Năm'],
      });
    }

    if (Number.isNaN(month) || month < 1 || month > 12) {
      errors.push({
        row: rowIndex,
        field: 'Tháng',
        message: `Tháng không hợp lệ: ${row['Tháng']}`,
        value: row['Tháng'],
      });
    }

    if (Number.isNaN(day) || day < 1 || day > 31) {
      errors.push({
        row: rowIndex,
        field: 'Ngày',
        message: `Ngày không hợp lệ: ${row['Ngày']}`,
        value: row['Ngày'],
      });
    }

    // Validate numeric fields
    const numericFields = [
      'Số Lượng',
      'Đơn giá Nguyên tệ',
      'Đơn giá khai báo(USD)',
      'Trị giá USD',
      'Tỷ giá nguyên tệ',
      'Tỷ giá USD',
      'Thuế suất XNK',
    ];

    for (const field of numericFields) {
      const value = row[field];
      if (value && value.trim() !== '') {
        const trimmed = value.trim();
        
        // Skip dash/hyphen values (represent empty/zero)
        if (trimmed === '-' || trimmed === '—') {
          continue;
        }
        
        // Handle European number format: 24.410,00 → 24410.00
        // Remove periods (thousands separator), replace comma with period (decimal)
        const normalizedValue = trimmed.replace(/\./g, '').replace(/,/g, '.');
        const numValue = Number.parseFloat(normalizedValue);
        
        if (Number.isNaN(numValue)) {
          errors.push({
            row: rowIndex,
            field,
            message: `Giá trị số không hợp lệ: ${field}`,
            value,
          });
        } else if (numValue < 0) {
          errors.push({
            row: rowIndex,
            field,
            message: `Giá trị không thể âm: ${field}`,
            value,
          });
        }
      }
    }

    // Validate delivery terms enum (C&F is legacy term for CFR)
    const validDeliveryTerms = ['FOB', 'CFR', 'C&F', 'CIF', 'DAF', 'DAP', 'EXW', 'FCA', 'CPT', 'CIP', 'DDP', 'DDU', 'OTHER'];
    const deliveryTerms = row['Điều kiện giao hàng']?.toUpperCase();
    if (deliveryTerms && !validDeliveryTerms.includes(deliveryTerms)) {
      errors.push({
        row: rowIndex,
        field: 'Điều kiện giao hàng',
        message: `Điều kiện giao hàng không hợp lệ: ${deliveryTerms}`,
        value: row['Điều kiện giao hàng'],
      });
    }

    return errors;
  }

  /**
   * Validate multiple rows
   */
  validateRows(rows: CSVRow[]): ValidationResult {
    const allErrors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const errors = this.validateRow(rows[i], i + 1);
      allErrors.push(...errors);
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings,
    };
  }

  /**
   * Validate entire CSV data including headers and rows
   */
  validate(headers: string[], rows: CSVRow[]): ValidationResult {
    const headerValidation = this.validateHeaders(headers);
    const rowValidation = this.validateRows(rows);

    return {
      valid: headerValidation.valid && rowValidation.valid,
      errors: [...headerValidation.errors, ...rowValidation.errors],
      warnings: [...headerValidation.warnings, ...rowValidation.warnings],
    };
  }
}

/**
 * Export singleton instance
 */
export const csvValidator = new CSVValidator();
