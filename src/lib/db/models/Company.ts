import { Schema, model, type Document } from "mongoose";

/**
 * Company interface representing an importing company
 * Aggregated from transactions with computed statistics
 */
export interface ICompany extends Document {
  name: string; // Tên Cty nhập khẩu
  address: string; // Địa chỉ Cty nhập khẩu

  // Metadata
  createdAt: Date;
  updatedAt: Date;

  // Virtual fields (computed on-the-fly)
  totalTransactions?: number;
  totalImportValue?: number;
  totalQuantityImported?: number;
  uniqueGoodsCount?: number;
  mostFrequentCategory?: string;
  firstTransactionDate?: Date;
  lastTransactionDate?: Date;
}

/**
 * Interface for aggregated company statistics
 */
export interface ICompanyWithAggregates {
  _id: Schema.Types.ObjectId;
  name: string;
  address: string;
  totalTransactions: number;
  totalImportValue: number;
  totalQuantity: number;
  uniqueGoodsCount: number;
  firstTransactionDate: Date;
  lastTransactionDate: Date;
}

/**
 * Interface for withAggregates static method
 */
export interface ICompanyModel extends Model<ICompany> {
  withAggregates(
    filter?: Record<string, unknown>,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<ICompanyWithAggregates[]>;
}

const CompanySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: "text", // Full-text search
    },
    address: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Create compound unique index on name + address to prevent exact duplicates
CompanySchema.index({ name: 1, address: 1 }, { unique: true });

// Static method for efficient aggregated queries (avoids N+1 problem)
CompanySchema.statics.withAggregates = async function (
  filter: Record<string, unknown> = {},
  dateRange?: { from?: Date; to?: Date },
): Promise<ICompanyWithAggregates[]> {
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
        _id: "$company",
        totalTransactions: { $sum: 1 },
        totalImportValue: { $sum: { $toDouble: "$totalValueUSD" } },
        totalQuantity: { $sum: { $toDouble: "$quantity" } },
        uniqueGoods: { $addToSet: "$goods" },
        firstTransaction: { $min: "$date" },
        lastTransaction: { $max: "$date" },
      },
    },
    {
      $lookup: {
        from: "companies",
        localField: "_id",
        foreignField: "_id",
        as: "company",
      },
    },
    { $unwind: "$company" },
    {
      $project: {
        _id: "$company._id",
        name: "$company.name",
        address: "$company.address",
        totalTransactions: 1,
        totalImportValue: 1,
        totalQuantity: 1,
        uniqueGoodsCount: { $size: "$uniqueGoods" },
        firstTransactionDate: "$firstTransaction",
        lastTransactionDate: "$lastTransaction",
      },
    },
  ]);
};

// Import Model type for static method
import type { Model } from "mongoose";

export const Company = model<ICompany, ICompanyModel>("Company", CompanySchema);
