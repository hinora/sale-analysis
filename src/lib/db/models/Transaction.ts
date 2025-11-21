import { Schema, model, type Document } from "mongoose";

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
  company: Schema.Types.ObjectId; // Reference to Company
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
    company: {
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
export const Transaction = model<ITransaction>(
  "Transaction",
  TransactionSchema,
);
