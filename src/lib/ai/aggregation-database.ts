import { Transaction } from "../db/models/Transaction";
import type { PipelineStage } from "mongoose";

/**
 * Supported aggregation operations for numeric fields
 */
export enum AggregationType {
  SUM = "sum",
  AVG = "avg",
  MIN = "min",
  MAX = "max",
  COUNT = "count",
}

/**
 * Supported fields for aggregation operations
 */
export const NUMERIC_FIELDS = [
  "quantity",
  "unitPriceOriginal",
  "unitPriceUSD",
  "totalValueUSD",
  "originalCurrencyRate",
  "usdRate",
  "taxRate",
  "year",
  "month",
  "day",
] as const;

export const DATE_FIELDS = ["date", "createdAt", "updatedAt"] as const;

export const GROUPABLE_FIELDS = [
  "importCompanyRawName",
  "goodsRawName",
  "hsCode",
  "unit",
  "originalCurrency",
  "paymentMethod",
  "deliveryTerms",
  "transportMode",
  "exportCountry",
  "importCountry",
  "customsOffice",
  "exportType",
  "year",
  "month",
  "day",
] as const;

export type NumericField = (typeof NUMERIC_FIELDS)[number];
export type DateField = (typeof DATE_FIELDS)[number];
export type GroupableField = (typeof GROUPABLE_FIELDS)[number];

/**
 * Validation error for unsupported field operations
 */
export class AggregationValidationError extends Error {
  constructor(
    public field: string,
    public operation: string,
    public reason: string,
  ) {
    super(`Invalid aggregation: ${operation} on field '${field}' - ${reason}`);
    this.name = "AggregationValidationError";
  }
}

/**
 * Validates if a field supports numeric aggregation operations
 */
export function validateNumericField(field: string): void {
  if (!NUMERIC_FIELDS.includes(field as NumericField)) {
    throw new AggregationValidationError(
      field,
      "numeric aggregation",
      `Field must be one of: ${NUMERIC_FIELDS.join(", ")}`,
    );
  }
}

/**
 * Validates if a field can be used for grouping
 */
export function validateGroupableField(field: string): void {
  if (!GROUPABLE_FIELDS.includes(field as GroupableField)) {
    throw new AggregationValidationError(
      field,
      "grouping",
      `Field must be one of: ${GROUPABLE_FIELDS.join(", ")}`,
    );
  }
}

/**
 * Validates if a field is a date field
 */
export function validateDateField(field: string): void {
  if (!DATE_FIELDS.includes(field as DateField)) {
    throw new AggregationValidationError(
      field,
      "date operation",
      `Field must be one of: ${DATE_FIELDS.join(", ")}`,
    );
  }
}

/**
 * Configuration for a single aggregation operation
 */
export interface AggregationConfig {
  field: string;
  operation: AggregationType;
  alias?: string; // Optional output field name
}

/**
 * Options for transaction aggregation
 */
export interface TransactionAggregationOptions {
  // Aggregation operations to perform
  aggregations: AggregationConfig[];

  // Group by fields
  groupBy?: string[];

  // Match filters (MongoDB query)
  match?: Record<string, unknown>;

  // Sort options
  sort?: Record<string, 1 | -1>;

  // Limit results
  limit?: number;

  // Skip results (pagination)
  skip?: number;

  // Include raw Decimal128 values (default: false, converts to numbers)
  includeRawDecimals?: boolean;
}

/**
 * Result of an aggregation operation
 */
export interface AggregationResult {
  _id: Record<string, unknown> | null;
  [key: string]: unknown;
}

/**
 * Builds the $group stage for aggregation pipeline
 */
function buildGroupStage(
  groupBy: string[] | undefined,
  aggregations: AggregationConfig[],
): PipelineStage.Group {
  const groupStage: PipelineStage.Group = {
    $group: {
      _id: groupBy?.length
        ? groupBy.reduce(
            (acc, field) => {
              validateGroupableField(field);
              acc[field] = `$${field}`;
              return acc;
            },
            {} as Record<string, string>,
          )
        : null,
    },
  };

  // Add aggregation operations
  for (const agg of aggregations) {
    validateNumericField(agg.field);

    const outputField = agg.alias || `${agg.operation}_${agg.field}`;
    const groupObj = groupStage.$group as Record<string, unknown>;

    switch (agg.operation) {
      case AggregationType.SUM:
        groupObj[outputField] = { $sum: `$${agg.field}` };
        break;
      case AggregationType.AVG:
        groupObj[outputField] = { $avg: `$${agg.field}` };
        break;
      case AggregationType.MIN:
        groupObj[outputField] = { $min: `$${agg.field}` };
        break;
      case AggregationType.MAX:
        groupObj[outputField] = { $max: `$${agg.field}` };
        break;
      case AggregationType.COUNT:
        groupObj[outputField] = { $sum: 1 };
        break;
      default:
        throw new AggregationValidationError(
          agg.field,
          agg.operation,
          "Unsupported aggregation type",
        );
    }
  }

  return groupStage;
}

/**
 * Converts Decimal128 fields to numbers in aggregation results
 */
function convertDecimalFields(result: AggregationResult): AggregationResult {
  const converted = { ...result };

  for (const [key, value] of Object.entries(converted)) {
    // Check for Decimal128 with $numberDecimal property
    if (value && typeof value === "object" && "$numberDecimal" in value) {
      converted[key] = Number.parseFloat(
        (value as { $numberDecimal: string }).$numberDecimal,
      );
    }
    // Check for Decimal128 with bytes property (native format)
    else if (value && typeof value === "object" && "bytes" in value) {
      // Convert Decimal128 bytes to string then to number
      const decimal128 = value as { toString: () => string };
      converted[key] = Number.parseFloat(decimal128.toString());
    }
    // Recursively convert nested objects
    else if (value && typeof value === "object" && !Array.isArray(value)) {
      converted[key] = convertDecimalFields(value as AggregationResult);
    }
  }

  return converted;
}

/**
 * Performs aggregation on Transaction collection with validation
 *
 * @example
 * // Sum total value by company
 * const result = await aggregateTransactions({
 *   aggregations: [
 *     { field: 'totalValueUSD', operation: AggregationType.SUM }
 *   ],
 *   groupBy: ['importCompanyRawName'],
 *   sort: { sum_totalValueUSD: -1 },
 *   limit: 10
 * });
 *
 * @example
 * // Average unit price by goods with filtering
 * const result = await aggregateTransactions({
 *   aggregations: [
 *     { field: 'unitPriceUSD', operation: AggregationType.AVG, alias: 'avgPrice' },
 *     { field: 'quantity', operation: AggregationType.SUM, alias: 'totalQty' }
 *   ],
 *   groupBy: ['goodsRawName', 'unit'],
 *   match: { year: 2024, exportCountry: 'China' },
 *   sort: { avgPrice: -1 }
 * });
 */
export async function aggregateTransactions(
  options: TransactionAggregationOptions,
): Promise<AggregationResult[]> {
  const {
    aggregations,
    groupBy,
    match,
    sort,
    limit,
    skip,
    includeRawDecimals = false,
  } = options;

  // Validation
  if (!aggregations || aggregations.length === 0) {
    throw new AggregationValidationError(
      "aggregations",
      "pipeline",
      "At least one aggregation operation is required",
    );
  }

  // Build pipeline
  const pipeline: PipelineStage[] = [];

  // 1. Match stage (filtering)
  if (match && Object.keys(match).length > 0) {
    pipeline.push({ $match: match });
  }

  // 2. Group stage (aggregation)
  pipeline.push(buildGroupStage(groupBy, aggregations));

  // 3. Sort stage
  if (sort && Object.keys(sort).length > 0) {
    pipeline.push({ $sort: sort });
  }

  // 4. Skip stage (pagination)
  if (skip !== undefined && skip > 0) {
    pipeline.push({ $skip: skip });
  }

  // 5. Limit stage
  if (limit !== undefined && limit > 0) {
    pipeline.push({ $limit: limit });
  }

  // Execute aggregation
  const results = await Transaction.aggregate<AggregationResult>(pipeline);

  // Convert Decimal128 to numbers unless raw decimals requested
  if (!includeRawDecimals) {
    return results.map((result) => convertDecimalFields(result));
  }

  return results;
}

/**
 * Helper function to get sum of a numeric field
 */
export async function sumField(options: {
  field: NumericField;
  match?: Record<string, unknown>;
}): Promise<number> {
  validateNumericField(options.field);

  const results = await aggregateTransactions({
    aggregations: [{ field: options.field, operation: AggregationType.SUM }],
    match: options.match,
  });

  return (results[0]?.[`sum_${options.field}`] as number) || 0;
}

/**
 * Helper function to get average of a numeric field
 */
export async function avgField(options: {
  field: NumericField;
  match?: Record<string, unknown>;
}): Promise<number> {
  validateNumericField(options.field);

  const results = await aggregateTransactions({
    aggregations: [{ field: options.field, operation: AggregationType.AVG }],
    match: options.match,
  });

  return (results[0]?.[`avg_${options.field}`] as number) || 0;
}

/**
 * Helper function to count transactions
 */
export async function countTransactions(options?: {
  match?: Record<string, unknown>;
}): Promise<number> {
  const results = await aggregateTransactions({
    aggregations: [
      { field: "quantity", operation: AggregationType.COUNT, alias: "count" },
    ],
    match: options?.match,
  });

  return (results[0]?.count as number) || 0;
}

/**
 * Helper function to get top N by aggregated field
 */
export async function getTopByField(options: {
  field: NumericField;
  groupBy: GroupableField[];
  operation?: AggregationType;
  limit?: number;
  match?: Record<string, unknown>;
}): Promise<AggregationResult[]> {
  const {
    field,
    groupBy,
    operation = AggregationType.SUM,
    limit = 10,
    match,
  } = options;

  validateNumericField(field);
  for (const f of groupBy) {
    validateGroupableField(f);
  }

  const alias = `${operation}_${field}`;

  return aggregateTransactions({
    aggregations: [{ field, operation, alias }],
    groupBy: [...groupBy],
    match,
    sort: { [alias]: -1 },
    limit,
  });
}

/**
 * Returns OpenAI function calling tool definitions for all aggregation functions
 */
export function getTools() {
  return [
    {
      type: "function",
      function: {
        name: "aggregateTransactions",
        description:
          "Performs flexible aggregation on transaction data with support for grouping, filtering, sorting, and multiple aggregation operations (sum, avg, min, max, count). Use this for complex queries requiring custom aggregations or multiple operations at once.",
        parameters: {
          type: "object",
          properties: {
            aggregations: {
              type: "array",
              description:
                "Array of aggregation operations to perform on numeric fields",
              items: {
                type: "object",
                properties: {
                  field: {
                    type: "string",
                    enum: [
                      "quantity",
                      "unitPriceOriginal",
                      "unitPriceUSD",
                      "totalValueUSD",
                      "originalCurrencyRate",
                      "usdRate",
                      "taxRate",
                      "year",
                      "month",
                      "day",
                    ],
                    description: "The numeric field to aggregate",
                  },
                  operation: {
                    type: "string",
                    enum: ["sum", "avg", "min", "max", "count"],
                    description: "The aggregation operation to perform",
                  },
                  alias: {
                    type: "string",
                    description:
                      "Optional custom name for the output field. Defaults to '{operation}_{field}'",
                  },
                },
                required: ["field", "operation"],
              },
            },
            groupBy: {
              type: "array",
              description:
                "Optional array of fields to group results by. When omitted, aggregates across all records.",
              items: {
                type: "string",
                enum: [
                  "importCompanyRawName",
                  "goodsRawName",
                  "hsCode",
                  "unit",
                  "originalCurrency",
                  "paymentMethod",
                  "deliveryTerms",
                  "transportMode",
                  "exportCountry",
                  "importCountry",
                  "customsOffice",
                  "exportType",
                  "year",
                  "month",
                  "day",
                ],
              },
            },
            match: {
              type: "object",
              description:
                "Optional MongoDB query filter to apply before aggregation. Example: {year: 2024, exportCountry: 'China'}",
            },
            sort: {
              type: "object",
              description:
                "Optional sort order for results. Keys are field names, values are 1 (ascending) or -1 (descending). Example: {sum_totalValueUSD: -1}",
            },
            limit: {
              type: "number",
              description: "Optional maximum number of results to return",
            },
            skip: {
              type: "number",
              description:
                "Optional number of results to skip (for pagination)",
            },
          },
          required: ["aggregations"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "sumField",
        description:
          "Calculates the sum of a numeric field across all transactions. Accepts a single options object with field and optional match criteria. Use this for simple total calculations like total revenue, total quantity, etc.",
        parameters: {
          type: "object",
          properties: {
            field: {
              type: "string",
              enum: [
                "quantity",
                "unitPriceOriginal",
                "unitPriceUSD",
                "totalValueUSD",
                "originalCurrencyRate",
                "usdRate",
                "taxRate",
                "year",
                "month",
                "day",
              ],
              description: "The numeric field to sum",
            },
            match: {
              type: "object",
              description:
                "Optional MongoDB query filter. Example: {year: 2024, exportCountry: 'China'}",
            },
          },
          required: ["field"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "avgField",
        description:
          "Calculates the average (mean) of a numeric field across all transactions. Accepts a single options object with field and optional match criteria. Use this for average price, average quantity, average tax rate, etc.",
        parameters: {
          type: "object",
          properties: {
            field: {
              type: "string",
              enum: [
                "quantity",
                "unitPriceOriginal",
                "unitPriceUSD",
                "totalValueUSD",
                "originalCurrencyRate",
                "usdRate",
                "taxRate",
                "year",
                "month",
                "day",
              ],
              description: "The numeric field to average",
            },
            match: {
              type: "object",
              description:
                "Optional MongoDB query filter. Example: {year: 2024, exportCountry: 'China'}",
            },
          },
          required: ["field"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "countTransactions",
        description:
          "Counts the number of transactions matching the filter criteria. Accepts a single optional options object with match filter. Use this for questions like 'how many transactions', 'number of imports', etc.",
        parameters: {
          type: "object",
          properties: {
            match: {
              type: "object",
              description:
                "Optional MongoDB query filter. Example: {year: 2024, importCountry: 'Vietnam'}",
            },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getTopByField",
        description:
          "Gets the top N results grouped by specified fields and ordered by an aggregated value. Accepts a single options object with all parameters. Use this for rankings like 'top companies by revenue', 'top products by quantity', 'biggest importers', etc.",
        parameters: {
          type: "object",
          properties: {
            field: {
              type: "string",
              enum: [
                "quantity",
                "unitPriceOriginal",
                "unitPriceUSD",
                "totalValueUSD",
                "originalCurrencyRate",
                "usdRate",
                "taxRate",
                "year",
                "month",
                "day",
              ],
              description:
                "The numeric field to aggregate for ranking (e.g., totalValueUSD for revenue ranking)",
            },
            groupBy: {
              type: "array",
              description:
                "Fields to group by for ranking (e.g., ['importCompanyRawName'] for top companies, ['goodsRawName'] for top products)",
              items: {
                type: "string",
                enum: [
                  "importCompanyRawName",
                  "goodsRawName",
                  "hsCode",
                  "unit",
                  "originalCurrency",
                  "paymentMethod",
                  "deliveryTerms",
                  "transportMode",
                  "exportCountry",
                  "importCountry",
                  "customsOffice",
                  "exportType",
                  "year",
                  "month",
                  "day",
                ],
              },
            },
            operation: {
              type: "string",
              enum: ["sum", "avg", "min", "max", "count"],
              description:
                "Optional aggregation operation for ranking. Defaults to 'sum'",
            },
            limit: {
              type: "number",
              description:
                "Optional number of top results to return. Defaults to 10",
            },
            match: {
              type: "object",
              description:
                "Optional MongoDB query filter to apply before grouping. Example: {year: 2024}",
            },
          },
          required: ["field", "groupBy"],
        },
      },
    },
  ];
}

export function toolMapper() {
  return {
    aggregateTransactions,
    sumField,
    avgField,
    countTransactions,
    getTopByField,
  };
}
