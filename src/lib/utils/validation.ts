import { z } from "zod";

/**
 * Zod validation schemas for API requests
 * Ensures type safety and data validation at runtime
 */

// Date range validation
const baseDateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const DateRangeSchema = baseDateRangeSchema.refine(
  (data) => {
    if (data.from && data.to) {
      return new Date(data.from) <= new Date(data.to);
    }
    return true;
  },
  {
    message: "From date must be before or equal to To date",
  },
);

// Pagination schema
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Sort schema
export const SortSchema = z.object({
  field: z.string(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// Transaction filter schema
export const TransactionFilterSchema = z.object({
  company: z.string().optional(),
  goods: z.string().optional(),
  category: z.string().optional(),
  hsCode: z.string().optional(),
  customsOffice: z.string().optional(),
  exportCountry: z.string().optional(),
  importCountry: z.string().optional(),
  minValue: z.coerce.number().min(0).optional(),
  maxValue: z.coerce.number().min(0).optional(),
  dateRange: DateRangeSchema.optional(),
});

// Company filter schema
export const CompanyFilterSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  dateRange: DateRangeSchema.optional(),
});

// Goods filter schema
export const GoodsFilterSchema = z.object({
  rawName: z.string().optional(),
  shortName: z.string().optional(),
  category: z.string().optional(),
  hsCode: z.string().optional(),
  dateRange: DateRangeSchema.optional(),
});

// AI session creation schema
export const AISessionCreateSchema = z.object({
  filterCriteria: z.object({
    companies: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    goods: z.array(z.string()).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  }),
  ollamaModel: z
    .string()
    .optional()
    .default(process.env.AI_MODEL || "deepseek-r1:1.5b"),
});

// AI message schema
export const AIMessageSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(1000),
});

// CSV upload schema
export const CSVUploadSchema = z.object({
  filename: z.string().min(1),
  size: z
    .number()
    .min(1)
    .max(50 * 1024 * 1024), // 50MB max
  mimeType: z.string().regex(/^text\/(csv|plain)$/),
});

// Export types
export type DateRange = z.infer<typeof DateRangeSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type Sort = z.infer<typeof SortSchema>;
export type TransactionFilter = z.infer<typeof TransactionFilterSchema>;
export type CompanyFilter = z.infer<typeof CompanyFilterSchema>;
export type GoodsFilter = z.infer<typeof GoodsFilterSchema>;
export type AISessionCreate = z.infer<typeof AISessionCreateSchema>;
export type AIMessage = z.infer<typeof AIMessageSchema>;
export type CSVUpload = z.infer<typeof CSVUploadSchema>;

// ============================================================================
// Multi-Stage Adaptive Query System Schemas (Feature 002)
// ============================================================================

// Filter expression schema
export const FilterExpressionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum([
    "equals",
    "contains",
    "startsWith",
    "greaterThan",
    "lessThan",
    "between",
    "in",
  ]),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
  matchStrategy: z
    .enum(["exact", "fuzzy", "case-insensitive", "normalized"])
    .optional(),
  fuzzyThreshold: z.number().min(0).max(5).optional(),
  logicalOperator: z.enum(["AND", "OR"]).optional(),
});

// Query intent schema
export const QueryIntentSchema = z.object({
  type: z.enum([
    "aggregation",
    "detail",
    "trend",
    "comparison",
    "recommendation",
    "ranking",
  ]),
  filters: z.array(FilterExpressionSchema),
  aggregations: z
    .array(
      z.object({
        field: z.string(),
        operation: z.enum(["count", "sum", "average", "min", "max"]),
        groupBy: z.string().optional(),
      }),
    )
    .optional(),
  limit: z.number().int().positive().optional(),
  orderBy: z
    .object({
      field: z.string(),
      direction: z.enum(["asc", "desc"]),
    })
    .optional(),
  confidence: z.number().min(0).max(1),
});

// Aggregation spec schema
export const AggregationSpecSchema = z.object({
  field: z.string().min(1),
  operation: z.enum(["count", "sum", "average", "min", "max"]),
  groupBy: z.string().optional(),
});

// Filter options schema
export const FilterOptionsSchema = z.object({
  removeDiacritics: z.boolean().optional(),
  synonyms: z.record(z.string(), z.array(z.string())).optional(),
  logExecution: z.boolean().optional(),
});

// Zod schemas for Iterative AI Query System entities

export const DataValidationResultSchema = z.object({
  isSufficient: z.boolean(),
  isComplete: z.boolean(),
  isValid: z.boolean(),
  recordCount: z.number().int().nonnegative(),
  missingFields: z.array(z.string()),
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const DataRequestLogSchema = z.object({
  requestId: z.string(),
  timestamp: z.date(),
  queryIntent: QueryIntentSchema,
  response: z.object({
    answer: z.string(),
    citations: z.array(z.string()),
    confidence: z.enum(["high", "medium", "low"]),
    processingTime: z.number(),
  }),
  validationResult: DataValidationResultSchema,
  reasoning: z.string(),
  processingTimeMs: z.number().nonnegative(),
  error: z.string().optional(),
});

export const IterativeQuerySessionSchema = z.object({
  sessionId: z.string(),
  userQuestion: z.string(),
  startTime: z.date(),
  endTime: z.date().nullable(),
  iterationCount: z.number().int().nonnegative(),
  maxIterations: z.number().int().positive(),
  requestLog: z.array(DataRequestLogSchema),
  status: z.enum(["active", "completed", "failed", "timeout"]),
  result: z.string().optional(),
  completionReason: z.string().optional(),
  totalProcessingTimeMs: z.number().nonnegative(),
});

export const IterationConfigurationSchema = z.object({
  maxIterations: z.number().int().positive(),
  maxSessionTimeMs: z.number().int().positive(),
  enableLoopDetection: z.boolean(),
  minValidationConfidence: z.number().min(0).max(1),
  enableRequestLogging: z.boolean(),
  enableDataValidation: z.boolean(),
  minRecordThreshold: z.number().int().nonnegative(),
  allowEmptyResults: z.boolean(),
});

// Export types for multi-stage query system
export type FilterExpression = z.infer<typeof FilterExpressionSchema>;
export type QueryIntent = z.infer<typeof QueryIntentSchema>;
export type AggregationSpec = z.infer<typeof AggregationSpecSchema>;
export type FilterOptions = z.infer<typeof FilterOptionsSchema>;

// Export types for iterative AI query system
export type DataValidationResult = z.infer<typeof DataValidationResultSchema>;
export type DataRequestLog = z.infer<typeof DataRequestLogSchema>;
export type IterativeQuerySession = z.infer<typeof IterativeQuerySessionSchema>;
export type IterationConfiguration = z.infer<
  typeof IterationConfigurationSchema
>;
