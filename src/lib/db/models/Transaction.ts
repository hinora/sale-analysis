import { Schema, model, models, type Document, type Model } from "mongoose";

/**
 * Transaction interface representing a single export declaration record
 * Corresponds to one row in the CSV file
 */
export interface ITransaction extends Document {
  // Unique identifier
  declarationNumber: string; // Số tờ khai

  // Date information
  date: Date; // Parsed from Năm/Tháng/Ngày columns
  year: number;
  month: number;
  day: number;

  // References
  importCompanyRawName: string; // Tên doanh nghiệp nhập khẩu (denormalized for reference)
  importCompany: Schema.Types.ObjectId; // Reference to Company (importer)
  goods: Schema.Types.ObjectId; // Reference to Goods

  // Product identification
  hsCode: string; // HS code
  goodsRawName: string; // Tên hàng (denormalized for search)

  // Financial data (using Decimal128 for precision)
  quantity: Schema.Types.Decimal128; // Số Lượng
  unit: string; // Đơn vị tính
  unitPriceOriginal: Schema.Types.Decimal128; // Đơn giá Nguyên tệ
  unitPriceUSD: Schema.Types.Decimal128; // Đơn giá khai báo(USD)
  totalValueUSD: Schema.Types.Decimal128; // Trị giá USD
  originalCurrency: string; // Nguyên tệ

  // Exchange rates
  originalCurrencyRate: Schema.Types.Decimal128; // Tỷ giá nguyên tệ
  usdRate: Schema.Types.Decimal128; // Tỷ giá USD

  // Logistics
  paymentMethod: string; // Mã phương thức thanh toán
  deliveryTerms: string; // Điều kiện giao hàng (FOB, CFR, CIF, etc.)
  transportMode: string; // Phương tiện vận chuyển

  // Regulatory
  exportCountry: string; // Tên nuớc xuất khẩu
  importCountry: string; // Tên nước nhập khẩu
  customsOffice: string; // Chi cục hải quan
  exportType: string; // Loại hình
  taxRate: number; // Thuế suất XNK

  // Raw data preservation (constitution requirement)
  rawData: Record<string, unknown>; // Complete CSV row as JSON

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    declarationNumber: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    day: {
      type: Number,
      required: true,
      min: 1,
      max: 31,
    },
    importCompanyRawName: {
      type: String,
      required: true,
      index: "text", // Full-text search
    },
    importCompany: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    goods: {
      type: Schema.Types.ObjectId,
      ref: "Goods",
      required: true,
      index: true,
    },
    hsCode: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    goodsRawName: {
      type: String,
      required: true,
      index: "text", // Full-text search
    },
    quantity: {
      type: Schema.Types.Decimal128,
      required: true,
      get: (v: Schema.Types.Decimal128) => Number.parseFloat(v.toString()),
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    unitPriceOriginal: {
      type: Schema.Types.Decimal128,
      required: true,
      get: (v: Schema.Types.Decimal128) => Number.parseFloat(v.toString()),
    },
    unitPriceUSD: {
      type: Schema.Types.Decimal128,
      required: true,
      get: (v: Schema.Types.Decimal128) => Number.parseFloat(v.toString()),
    },
    totalValueUSD: {
      type: Schema.Types.Decimal128,
      required: true,
      index: true, // For sorting by value
      get: (v: Schema.Types.Decimal128) => Number.parseFloat(v.toString()),
    },
    originalCurrency: {
      type: String,
      required: true,
      trim: true,
    },
    originalCurrencyRate: {
      type: Schema.Types.Decimal128,
      required: true,
      get: (v: Schema.Types.Decimal128) => Number.parseFloat(v.toString()),
    },
    usdRate: {
      type: Schema.Types.Decimal128,
      required: true,
      get: (v: Schema.Types.Decimal128) => Number.parseFloat(v.toString()),
    },
    paymentMethod: {
      type: String,
      required: true,
      trim: true,
    },
    deliveryTerms: {
      type: String,
      required: true,
      trim: true,
    },
    transportMode: {
      type: String,
      required: true,
      trim: true,
    },
    exportCountry: {
      type: String,
      required: true,
      trim: true,
    },
    importCountry: {
      type: String,
      required: false,
      default: "",
      trim: true,
    },
    customsOffice: {
      type: String,
      required: true,
      trim: true,
    },
    exportType: {
      type: String,
      required: true,
      trim: true,
    },
    taxRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    rawData: {
      type: Object,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true }, // Enable getter transformations
    toObject: { getters: true },
  },
);

// Export model
export const Transaction =
  (models.Transaction as Model<ITransaction>) ||
  model<ITransaction>("Transaction", TransactionSchema);

/**
 * Returns explanations for each Transaction field/column
 * Useful for AI models to understand the meaning and usage of each field
 */
export function transactionColumnExplanations(): Record<string, string> {
  return {
    // Identifier
    declarationNumber: "Unique customs declaration number (Số tờ khai) that identifies this specific export transaction",

    // Date fields
    date: "The full date of the transaction as a Date object, parsed from year/month/day columns",
    year: "The year when the transaction occurred (2000-2100)",
    month: "The month when the transaction occurred (1-12)",
    day: "The day of month when the transaction occurred (1-31)",

    // Company information
    importCompanyRawName: "The original company name as written in Vietnamese (Tên doanh nghiệp nhập khẩu), denormalized for search and display purposes",

    // Product identification
    hsCode: "Harmonized System code - international standardized system of names and numbers to classify traded products",
    goodsRawName: "The original product name as written in Vietnamese (Tên hàng), stored for search and reference purposes",

    // Financial data (Decimal128 for precision)
    quantity: "The quantity/amount of goods in this transaction (Số Lượng). Stored as Decimal128 for precision, converted to number on retrieval",
    unit: "Unit of measurement for the quantity (Đơn vị tính), e.g., KG, PIECE, LITER, TON",
    unitPriceOriginal: "Price per unit in the original currency (Đơn giá Nguyên tệ). Decimal128 for financial precision",
    unitPriceUSD: "Price per unit converted to USD (Đơn giá khai báo USD). Decimal128 for financial precision",
    totalValueUSD: "Total transaction value in USD (Trị giá USD). This is the main value field for aggregations. Decimal128 for precision",
    originalCurrency: "The original currency code used in the transaction (Nguyên tệ), e.g., VND, CNY, EUR, JPY",

    // Exchange rates
    originalCurrencyRate: "Exchange rate between the original currency and VND (Tỷ giá nguyên tệ). Decimal128 for precision",
    usdRate: "Exchange rate between USD and VND at the time of transaction (Tỷ giá USD). Decimal128 for precision",

    // Logistics
    paymentMethod: "Code representing the payment method used for this transaction (Mã phương thức thanh toán)",
    deliveryTerms: "International Commercial Terms (Incoterms) like FOB, CFR, CIF that define delivery responsibilities and costs",
    transportMode: "The mode of transportation used (Phương tiện vận chuyển), e.g., sea freight, air freight, land transport",

    // Regulatory
    importCountry: "Name of the country where goods are imported to (Tên nước nhập khẩu). May be empty for some records",
    customsOffice: "The specific customs office/branch that processed this declaration (Chi cục hải quan)",
    exportType: "Type or category of export (Loại hình), indicating the nature of the trade operation",
    taxRate: "Import/export tax rate percentage (Thuế suất XNK) applied to this transaction, typically 0-100",

    // Raw data
    rawData: "Complete original CSV row data stored as JSON object. Preserves all original information for auditing and reference",

    // Metadata
    createdAt: "Timestamp when this record was created in the database (auto-generated by Mongoose)",
    updatedAt: "Timestamp when this record was last updated (auto-generated by Mongoose)",

    // Aggregated/Computed usage notes
    _aggregation_notes: "For aggregations: numeric fields (quantity, prices, rates, tax) support sum/avg/min/max/count. Reference fields (importCompany, goods) and categorical fields (hsCode, unit, countries, etc.) can be used for groupBy operations",
  };
}