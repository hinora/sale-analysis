# Data Model: Export Goods Analysis Application

**Phase**: Phase 1 - Design  
**Created**: 2025-11-20  
**Status**: Complete

## Overview

This document defines the database schemas, entity relationships, indexes, and data validation rules for the Export Goods Analysis Application. All schemas are designed to support the requirements defined in [spec.md](./spec.md) and align with the constitution principles.

---

## Entity Relationship Diagram

```text
┌──────────────┐
│   Category   │
└──────┬───────┘
       │
       │ 1:N
       │
┌──────▼───────┐         ┌─────────────┐
│    Goods     │◄────────┤ Transaction │
└──────────────┘   N:1   └──────┬──────┘
                                 │
                                 │ N:1
                                 │
                          ┌──────▼──────┐
                          │   Company   │
                          └─────────────┘

┌──────────────────┐
│   AISession      │  (Independent entity for session management)
└──────────────────┘
```

**Key Relationships:**
- Each **Transaction** belongs to one **Company** and one **Goods** item
- Each **Goods** item belongs to one **Category**
- **AISession** references **Transactions** indirectly through filter criteria (not a foreign key relationship)

---

## 1. Transaction Schema

**Purpose**: Represents a single export declaration record from the CSV file. This is the primary data entity containing all import/export transaction details.

### Mongoose Schema

```typescript
import { Schema, model, Document } from 'mongoose';

interface ITransaction extends Document {
  // Unique identifier (from CSV)
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
  rawData: object; // Complete CSV row as JSON
  
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
      trim: true
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    day: {
      type: Number,
      required: true,
      min: 1,
      max: 31
    },
    company: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    goods: {
      type: Schema.Types.ObjectId,
      ref: 'Goods',
      required: true,
      index: true
    },
    hsCode: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    goodsRawName: {
      type: String,
      required: true,
      index: 'text' // Full-text search
    },
    quantity: {
      type: Schema.Types.Decimal128,
      required: true,
      get: (v: Schema.Types.Decimal128) => parseFloat(v.toString())
    },
    unit: {
      type: String,
      required: true,
      trim: true
    },
    unitPriceOriginal: {
      type: Schema.Types.Decimal128,
      required: true,
      get: (v: Schema.Types.Decimal128) => parseFloat(v.toString())
    },
    unitPriceUSD: {
      type: Schema.Types.Decimal128,
      required: true,
      get: (v: Schema.Types.Decimal128) => parseFloat(v.toString())
    },
    totalValueUSD: {
      type: Schema.Types.Decimal128,
      required: true,
      index: true, // For sorting by value
      get: (v: Schema.Types.Decimal128) => parseFloat(v.toString())
    },
    originalCurrency: {
      type: String,
      required: true,
      trim: true
    },
    originalCurrencyRate: {
      type: Schema.Types.Decimal128,
      required: true,
      get: (v: Schema.Types.Decimal128) => parseFloat(v.toString())
    },
    usdRate: {
      type: Schema.Types.Decimal128,
      required: true,
      get: (v: Schema.Types.Decimal128) => parseFloat(v.toString())
    },
    paymentMethod: {
      type: String,
      required: true,
      trim: true
    },
    deliveryTerms: {
      type: String,
      required: true,
      trim: true
    },
    transportMode: {
      type: String,
      required: true,
      trim: true
    },
    exportCountry: {
      type: String,
      required: true,
      trim: true
    },
    importCountry: {
      type: String,
      required: false,
      default: '',
      trim: true
    },
    customsOffice: {
      type: String,
      required: true,
      trim: true
    },
    exportType: {
      type: String,
      required: true,
      trim: true
    },
    taxRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    rawData: {
      type: Object,
      required: true
    }
  },
  {
    timestamps: true,
    toJSON: { getters: true }, // Enable getter transformations
    toObject: { getters: true }
  }
);

// Compound indexes for common query patterns (constitution: performance)
TransactionSchema.index({ company: 1, date: -1 });
TransactionSchema.index({ goods: 1, date: -1 });
TransactionSchema.index({ date: -1, totalValueUSD: -1 });
TransactionSchema.index({ hsCode: 1, date: -1 });
TransactionSchema.index({ customsOffice: 1, date: -1 });

export const Transaction = model<ITransaction>('Transaction', TransactionSchema);
```

### Validation Rules

- `declarationNumber`: Indexed for query performance (Note: Not unique - one declaration can have multiple line items with different HS codes)
- `date`: Must be valid date between 2000-2100
- `quantity`, `unitPriceOriginal`, `unitPriceUSD`, `totalValueUSD`: Must be positive numbers
- `deliveryTerms`: Accepts any string value (no enum restriction for flexibility with real-world data)
- `importCountry`: Optional field, defaults to empty string
- `rawData`: Must be preserved exactly as imported (constitution requirement)

---

## 2. Company Schema

**Purpose**: Represents an importing company. Aggregated from transactions with computed statistics.

### Mongoose Schema

```typescript
interface ICompany extends Document {
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

const CompanySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: 'text' // Full-text search
    },
    address: {
      type: String,
      required: false,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Create compound unique index on name + address to prevent exact duplicates
CompanySchema.index({ name: 1, address: 1 }, { unique: true });

// Virtuals for aggregated statistics (computed when accessed)
CompanySchema.virtual('totalTransactions').get(async function() {
  const count = await Transaction.countDocuments({ company: this._id });
  return count;
});

CompanySchema.virtual('totalImportValue').get(async function() {
  const result = await Transaction.aggregate([
    { $match: { company: this._id } },
    { $group: { _id: null, total: { $sum: { $toDouble: '$totalValueUSD' } } } }
  ]);
  return result[0]?.total || 0;
});

CompanySchema.virtual('uniqueGoodsCount').get(async function() {
  const result = await Transaction.distinct('goods', { company: this._id });
  return result.length;
});

// Static method for efficient aggregated queries (avoids N+1 problem)
CompanySchema.statics.withAggregates = async function(filter = {}, dateRange?: { from?: Date, to?: Date }) {
  const matchStage: any = {};
  
  if (dateRange?.from || dateRange?.to) {
    matchStage.date = {};
    if (dateRange.from) matchStage.date.$gte = dateRange.from;
    if (dateRange.to) matchStage.date.$lte = dateRange.to;
  }
  
  return await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$company',
        totalTransactions: { $sum: 1 },
        totalImportValue: { $sum: { $toDouble: '$totalValueUSD' } },
        totalQuantity: { $sum: { $toDouble: '$quantity' } },
        uniqueGoods: { $addToSet: '$goods' },
        firstTransaction: { $min: '$date' },
        lastTransaction: { $max: '$date' }
      }
    },
    {
      $lookup: {
        from: 'companies',
        localField: '_id',
        foreignField: '_id',
        as: 'company'
      }
    },
    { $unwind: '$company' },
    {
      $project: {
        _id: '$company._id',
        name: '$company.name',
        address: '$company.address',
        totalTransactions: 1,
        totalImportValue: 1,
        totalQuantity: 1,
        uniqueGoodsCount: { $size: '$uniqueGoods' },
        firstTransactionDate: '$firstTransaction',
        lastTransactionDate: '$lastTransaction'
      }
    }
  ]);
};

export const Company = model<ICompany>('Company', CompanySchema);
```

### Validation Rules

- `name`: Required, full-text searchable
- `address`: Optional, defaults to empty string (many CSV records have empty addresses)
- Unique constraint on `name + address` combination

---

## 3. Goods Schema

**Purpose**: Represents a unique product/commodity being exported. Includes AI-generated classifications.

### Mongoose Schema

```typescript
interface IGoods extends Document {
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

const GoodsSchema = new Schema<IGoods>(
  {
    rawName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: 'text' // Full-text search
    },
    shortName: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true
    },
    hsCode: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    classifiedBy: {
      type: String,
      required: true,
      trim: true
    },
    classifiedAt: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Static method for efficient aggregated queries
GoodsSchema.statics.withAggregates = async function(filter = {}, dateRange?: { from?: Date, to?: Date }) {
  const matchStage: any = {};
  
  if (dateRange?.from || dateRange?.to) {
    matchStage.date = {};
    if (dateRange.from) matchStage.date.$gte = dateRange.from;
    if (dateRange.to) matchStage.date.$lte = dateRange.to;
  }
  
  return await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$goods',
        totalQuantity: { $sum: { $toDouble: '$quantity' } },
        totalValue: { $sum: { $toDouble: '$totalValueUSD' } },
        transactionCount: { $sum: 1 },
        avgPrice: { $avg: { $toDouble: '$unitPriceUSD' } },
        firstExport: { $min: '$date' },
        lastExport: { $max: '$date' }
      }
    },
    {
      $lookup: {
        from: 'goods',
        localField: '_id',
        foreignField: '_id',
        as: 'goods'
      }
    },
    { $unwind: '$goods' },
    {
      $lookup: {
        from: 'categories',
        localField: 'goods.category',
        foreignField: '_id',
        as: 'category'
      }
    },
    { $unwind: '$category' },
    {
      $project: {
        _id: '$goods._id',
        rawName: '$goods.rawName',
        shortName: '$goods.shortName',
        hsCode: '$goods.hsCode',
        categoryId: '$category._id',
        categoryName: '$category.name',
        totalQuantityExported: '$totalQuantity',
        totalValueExported: '$totalValue',
        transactionCount: 1,
        averageUnitPrice: '$avgPrice',
        firstExportDate: '$firstExport',
        lastExportDate: '$lastExport'
      }
    }
  ]);
};

export const Goods = model<IGoods>('Goods', GoodsSchema);
```

### Validation Rules

- `rawName`: Must be unique (identifies the same goods across imports)
- `shortName`: Maximum 100 characters (constitution requirement)
- `category`: Must reference valid Category
- AI classification fields (`classifiedBy`, `classifiedAt`) are immutable after first classification

---

## 4. Category Schema

**Purpose**: Represents AI-generated taxonomy of goods types.

### Mongoose Schema

```typescript
interface ICategory extends Document {
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
      index: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

CategorySchema.virtual('goodsCount').get(async function() {
  const count = await Goods.countDocuments({ category: this._id });
  return count;
});

CategorySchema.virtual('totalExportValue').get(async function() {
  const goodsIds = await Goods.find({ category: this._id }).distinct('_id');
  const result = await Transaction.aggregate([
    { $match: { goods: { $in: goodsIds } } },
    { $group: { _id: null, total: { $sum: { $toDouble: '$totalValueUSD' } } } }
  ]);
  return result[0]?.total || 0;
});

export const Category = model<ICategory>('Category', CategorySchema);
```

### Validation Rules

- `name`: Must be unique across categories
- Categories are created on-demand during AI classification

---

## 5. AISession Schema

**Purpose**: Manages AI training sessions and conversation state.

### Mongoose Schema

```typescript
interface IAISession extends Document {
  sessionId: string; // UUID
  userId: string; // Future: user identifier (for multi-user support)
  
  // Training data selection
  filterCriteria: {
    companies?: string[];
    categories?: string[];
    goods?: string[];
    dateFrom?: Date;
    dateTo?: Date;
  };
  trainingDataCount: number; // Number of transactions fed to AI
  
  // Ollama context
  ollamaModel: string; // e.g., 'llama3.1', 'mistral'
  ollamaContext: string; // Conversation token for maintaining context
  
  // Conversation history
  messages: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }[];
  
  // Status
  status: 'pending' | 'loading' | 'ready' | 'error';
  errorMessage?: string;
  
  // Expiration
  expiresAt: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const AISessionSchema = new Schema<IAISession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true,
      default: 'anonymous' // MVP: single user
    },
    filterCriteria: {
      companies: [String],
      categories: [String],
      goods: [String],
      dateFrom: Date,
      dateTo: Date
    },
    trainingDataCount: {
      type: Number,
      required: true,
      min: 0,
      max: 10000 // Constitution limit
    },
    ollamaModel: {
      type: String,
      required: true,
      enum: ['llama3.1', 'llama2', 'mistral', 'codellama'],
      default: 'llama3.1'
    },
    ollamaContext: {
      type: String,
      default: ''
    },
    messages: [
      {
        role: {
          type: String,
          enum: ['user', 'assistant'],
          required: true
        },
        content: {
          type: String,
          required: true
        },
        timestamp: {
          type: Date,
          default: Date.now
        }
      }
    ],
    status: {
      type: String,
      enum: ['pending', 'loading', 'ready', 'error'],
      required: true,
      default: 'pending'
    },
    errorMessage: {
      type: String
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// TTL index for automatic cleanup of expired sessions
AISessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AISession = model<IAISession>('AISession', AISessionSchema);
```

### Validation Rules

- `trainingDataCount`: Maximum 10,000 transactions (constitution limit)
- `ollamaModel`: Must be one of supported models
- `expiresAt`: Sessions automatically deleted after expiration (MongoDB TTL index)

---

## Index Strategy

### Primary Indexes (for duplicate detection and unique constraints)
- `Transaction.declarationNumber` - non-unique index (one declaration = multiple line items)
- `Goods.rawName` - unique index
- `Category.name` - unique index
- `Company.name + Company.address` - compound unique index
- `AISession.sessionId` - unique index

### Query Optimization Indexes (for filtering and sorting)
- `Transaction.date` - range queries
- `Transaction.company` - filter by company
- `Transaction.goods` - filter by goods
- `Transaction.hsCode` - filter by HS code
- `Transaction.totalValueUSD` - sorting by value
- `Goods.category` - filter by category
- `Company.name` (text index) - full-text search
- `Goods.rawName` (text index) - full-text search
- `Transaction.goodsRawName` (text index) - full-text search

### Compound Indexes (for common multi-field queries)
- `{ company: 1, date: -1 }` - company transactions by date
- `{ goods: 1, date: -1 }` - goods transactions by date
- `{ date: -1, totalValueUSD: -1 }` - sorted by date and value
- `{ hsCode: 1, date: -1 }` - HS code transactions by date

### TTL Index (for automatic cleanup)
- `AISession.expiresAt` - auto-delete expired sessions

---

## Data Integrity Rules

### Constitution Compliance

1. **Duplicate Detection** (Principle I):
   - Composite key duplicate detection using 8 columns: `declarationNumber + hsCode + goodsName + companyName + totalValueUSD + usdRate + paymentMethod + deliveryTerms` (one declaration can have 20+ line items with same goods but different values/terms)
   - Application logic detects within-file duplicates before insertion using 8-column composite keys
   - No unique constraint on declarationNumber alone (would incorrectly prevent valid multi-item declarations)
   - The 8-column key provides precise duplicate detection accounting for variations in pricing, payment terms, and delivery conditions

2. **Raw Data Preservation** (Principle I):
   - `Transaction.rawData` field stores entire CSV row as JSON
   - Never modified after initial import

3. **AI Consistency** (Principle I):
   - `Goods.rawName` unique constraint ensures same goods → same classification
   - `Goods.classifiedBy` and `classifiedAt` track AI classification metadata

4. **Type Safety** (Principle II):
   - Mongoose schema validation enforces types at runtime
   - Decimal128 for currency fields prevents floating-point errors
   - Enum types for fixed-value fields (deliveryTerms, transportMode, etc.)

5. **Performance** (Principle III):
   - Strategic indexes on filter fields (company, date, category)
   - Compound indexes for common query patterns
   - Aggregation pipelines for computed fields (avoid N+1 queries)

---

## Migration Notes

### Initial Setup
1. Create MongoDB database: `sale_analysis`
2. Run Mongoose schema creation (automatic on first connection)
3. Verify indexes are created correctly:
   ```javascript
   await Transaction.collection.getIndexes();
   await Company.collection.getIndexes();
   await Goods.collection.getIndexes();
   await Category.collection.getIndexes();
   await AISession.collection.getIndexes();
   ```

### Data Seeding (Optional)
1. Import sample data from `data-example/sale-raw-data-small.csv`
2. Verify duplicate detection works correctly
3. Test AI classification on sample goods

---

## Performance Considerations

### Expected Data Volumes
- Transactions: 1M+ records (target capacity)
- Companies: 10K-50K unique companies
- Goods: 50K-100K unique goods
- Categories: 20-50 categories
- AI Sessions: 100-500 active sessions (30-minute TTL)

### Query Performance Targets (Constitution SC-004)
- Transaction queries with filters: <2 seconds
- Company/Goods aggregated queries: <3 seconds
- AI session data loading: <10 seconds for 10K transactions

### Index Maintenance
- Monitor index size and query performance
- Consider archiving old transactions (>2 years) if database grows beyond capacity
- Regularly clean up expired AI sessions (TTL index handles automatically)

---

## Future Enhancements

1. **Partitioning**: Shard transactions by year if volume exceeds 10M records
2. **Caching**: Add Redis caching for frequently accessed aggregations
3. **Read Replicas**: Separate read/write workloads for scaling
4. **Audit Trail**: Add change tracking for Company/Goods modifications
5. **Soft Deletes**: Implement soft delete pattern instead of hard deletes
