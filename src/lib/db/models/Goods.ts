import { Schema, model, type Document, type Model } from "mongoose";

/**
 * Goods interface representing a unique product/commodity being exported
 * Includes AI-generated classifications
 */
export interface IGoods extends Document {
  rawName: string; // Original Tên hàng from CSV
  shortName: string; // AI-generated concise version
  category: Schema.Types.ObjectId; // Reference to Category
  hsCode: string; // Primary HS code (most common)

  // AI classification metadata
  classifiedBy: string; // Model used (e.g., 'llama3.1')
  classifiedAt: Date;

  // Metadata
  createdAt: Date;
  updatedAt: Date;

  // Virtual fields
  totalQuantityExported?: number;
  totalValueExported?: number;
  transactionCount?: number;
  averageUnitPrice?: number;
  firstExportDate?: Date;
  lastExportDate?: Date;
}

/**
 * Interface for aggregated goods statistics
 */
export interface IGoodsWithAggregates {
  _id: Schema.Types.ObjectId;
  rawName: string;
  shortName: string;
  hsCode: string;
  categoryId: Schema.Types.ObjectId;
  categoryName: string;
  totalQuantityExported: number;
  totalValueExported: number;
  transactionCount: number;
  averageUnitPrice: number;
  firstExportDate: Date;
  lastExportDate: Date;
}

/**
 * Interface for withAggregates static method
 */
export interface IGoodsModel extends Model<IGoods> {
  withAggregates(
    filter?: Record<string, unknown>,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<IGoodsWithAggregates[]>;
}

const GoodsSchema = new Schema<IGoods>(
  {
    rawName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: "text", // Full-text search
    },
    shortName: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    hsCode: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    classifiedBy: {
      type: String,
      required: true,
      trim: true,
    },
    classifiedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Static method for efficient aggregated queries
GoodsSchema.statics.withAggregates = async function (
  filter: Record<string, unknown> = {},
  dateRange?: { from?: Date; to?: Date },
): Promise<IGoodsWithAggregates[]> {
  const matchStage: Record<string, unknown> = {};

  if (dateRange?.from || dateRange?.to) {
    matchStage.date = {};
    if (dateRange.from)
      (matchStage.date as Record<string, unknown>).$gte = dateRange.from;
    if (dateRange.to)
      (matchStage.date as Record<string, unknown>).$lte = dateRange.to;
  }

  const { Transaction } = await import("./Transaction");

  return await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$goods",
        totalQuantity: { $sum: { $toDouble: "$quantity" } },
        totalValue: { $sum: { $toDouble: "$totalValueUSD" } },
        transactionCount: { $sum: 1 },
        avgPrice: { $avg: { $toDouble: "$unitPriceUSD" } },
        firstExport: { $min: "$date" },
        lastExport: { $max: "$date" },
      },
    },
    {
      $lookup: {
        from: "goods",
        localField: "_id",
        foreignField: "_id",
        as: "goods",
      },
    },
    { $unwind: "$goods" },
    {
      $lookup: {
        from: "categories",
        localField: "goods.category",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: "$category" },
    {
      $project: {
        _id: "$goods._id",
        rawName: "$goods.rawName",
        shortName: "$goods.shortName",
        hsCode: "$goods.hsCode",
        categoryId: "$category._id",
        categoryName: "$category.name",
        totalQuantityExported: "$totalQuantity",
        totalValueExported: "$totalValue",
        transactionCount: 1,
        averageUnitPrice: "$avgPrice",
        firstExportDate: "$firstExport",
        lastExportDate: "$lastExport",
      },
    },
  ]);
};

export const Goods = model<IGoods, IGoodsModel>("Goods", GoodsSchema);
