import { Schema, model, models, type Document, type Model } from "mongoose";

/**
 * Category interface representing AI-generated taxonomy of goods types
 */
export interface ICategory extends Document {
  name: string; // Category name (e.g., 'Frozen Seafood', 'Agricultural Products')
  description: string; // Optional description

  // Metadata
  createdAt: Date;
  updatedAt: Date;

  // Virtual fields
  goodsCount?: number;
  totalExportValue?: number;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
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

export const Category =
  (models.Category as Model<ICategory>) ||
  model<ICategory>("Category", CategorySchema);
