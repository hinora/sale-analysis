/**
 * API Contract: Aggregation Engine
 *
 * Provides in-memory aggregation functions (count, sum, average, top-N, group-by)
 * for efficient statistical queries on loaded transactions.
 */

// Note: Transaction type will be imported from actual model in implementation
type Transaction = Record<string, unknown>;

// ============================================================================
// Request/Response Types
// ============================================================================

export interface AggregateRequest {
  sessionId: string;
  aggregations: AggregationSpec[];
  filters?: FilterExpression[]; // Optional: pre-filter before aggregation
}

export interface AggregationSpec {
  field: string; // Field to aggregate (e.g., 'totalValueUSD', 'quantity')
  operation: "count" | "sum" | "average" | "min" | "max";
  groupBy?: string; // Group dimension (e.g., 'companyName', 'month', 'categoryName')
}

export interface FilterExpression {
  field: string;
  operator:
    | "equals"
    | "contains"
    | "startsWith"
    | "greaterThan"
    | "lessThan"
    | "between"
    | "in";
  value: string | number | string[];
  matchStrategy?: "exact" | "fuzzy" | "case-insensitive" | "normalized";
  fuzzyThreshold?: number;
  logicalOperator?: "AND" | "OR";
}

export interface AggregateResponse {
  success: boolean;
  sessionId: string;
  results: AggregationResult[];
  error?: string;
}

export interface AggregationResult {
  type: "groupBy" | "topN" | "timeSeries" | "total";
  field: string; // Aggregated field
  groupByField?: string; // Grouping dimension
  data: AggregationDataPoint[];
  totalCount: number; // Total transactions included
  computedAt: string; // ISO 8601 timestamp
  executionTimeMs: number;
}

export interface AggregationDataPoint {
  key: string; // Group key (e.g., company name, month, category)
  count: number; // Number of transactions in group
  sum?: number; // Sum of field values
  average?: number; // Average of field values
  min?: number; // Minimum field value
  max?: number; // Maximum field value
}

// ============================================================================
// Aggregation Cache (Internal Optimization)
// ============================================================================

export interface AggregationCache {
  byCompany: Map<string, AggregationCacheEntry>;
  byGoodsName: Map<string, AggregationCacheEntry>;
  byCategory: Map<string, AggregationCacheEntry>;
  byMonth: Map<string, AggregationCacheEntry>;
  totalValue: number;
  totalCount: number;
  lastUpdated: number; // Unix timestamp
}

export interface AggregationCacheEntry {
  count: number;
  totalValue: number;
}

// ============================================================================
// API Endpoints (Next.js API Routes)
// ============================================================================

/**
 * POST /api/ai/aggregate
 *
 * Compute aggregations on loaded transactions in session.
 *
 * Request Body: AggregateRequest
 * Response: AggregateResponse (200) or Error (400/404/500)
 *
 * Example: "Which company imports the most?"
 * ```
 * POST /api/ai/aggregate
 * {
 *   "sessionId": "a1b2c3d4-...",
 *   "aggregations": [
 *     {
 *       "field": "totalValueUSD",
 *       "operation": "sum",
 *       "groupBy": "companyName"
 *     }
 *   ]
 * }
 * ```
 *
 * Response:
 * ```
 * {
 *   "success": true,
 *   "sessionId": "a1b2c3d4-...",
 *   "results": [
 *     {
 *       "type": "groupBy",
 *       "field": "totalValueUSD",
 *       "groupByField": "companyName",
 *       "data": [
 *         { "key": "CÔNG TY ABC", "count": 450, "sum": 2500000 },
 *         { "key": "XYZ Corporation", "count": 380, "sum": 1800000 },
 *         { "key": "DEF Import Ltd", "count": 320, "sum": 1200000 }
 *       ],
 *       "totalCount": 5247,
 *       "computedAt": "2024-11-23T12:45:00.000Z",
 *       "executionTimeMs": 45
 *     }
 *   ]
 * }
 * ```
 *
 * Example: "What is the import trend over time?"
 * ```
 * POST /api/ai/aggregate
 * {
 *   "sessionId": "a1b2c3d4-...",
 *   "aggregations": [
 *     {
 *       "field": "totalValueUSD",
 *       "operation": "sum",
 *       "groupBy": "month"
 *     }
 *   ]
 * }
 * ```
 *
 * Response:
 * ```
 * {
 *   "success": true,
 *   "results": [
 *     {
 *       "type": "timeSeries",
 *       "field": "totalValueUSD",
 *       "groupByField": "month",
 *       "data": [
 *         { "key": "2024-01", "count": 450, "sum": 500000 },
 *         { "key": "2024-02", "count": 480, "sum": 650000 },
 *         { "key": "2024-03", "count": 520, "sum": 720000 }
 *       ],
 *       "totalCount": 1450,
 *       "executionTimeMs": 38
 *     }
 *   ]
 * }
 * ```
 */

// ============================================================================
// Aggregation Functions (lib/ai/aggregation-engine.ts)
// ============================================================================

/**
 * Compute aggregations on transaction array.
 *
 * @param transactions - Array to aggregate
 * @param specs - Array of aggregation specifications
 * @returns Array of aggregation results
 */
export declare function computeAggregations(
  transactions: Array<Record<string, unknown>>,
  specs: AggregationSpec[],
): AggregationResult[];

/**
 * Compute single aggregation.
 *
 * @param transactions - Array to aggregate
 * @param spec - Aggregation specification
 * @returns Aggregation result
 */
export declare function computeAggregation(
  transactions: Transaction[],
  spec: AggregationSpec,
): AggregationResult;

/**
 * Group transactions by field and compute stats.
 *
 * @param transactions - Array to group
 * @param groupByField - Field name to group by
 * @param aggregateField - Field name to aggregate
 * @param operation - Aggregation operation
 * @returns Map of group key → aggregated value
 */
export declare function groupBy(
  transactions: Transaction[],
  groupByField: string,
  aggregateField: string,
  operation: "count" | "sum" | "average" | "min" | "max",
): Map<string, AggregationDataPoint>;

/**
 * Get top N groups by aggregated value.
 *
 * @param groupedData - Map from groupBy function
 * @param n - Number of top results
 * @param sortBy - Field to sort by ('count', 'sum', 'average', etc.)
 * @returns Top N data points, sorted descending
 */
export declare function getTopN(
  groupedData: Map<string, AggregationDataPoint>,
  n: number,
  sortBy: "count" | "sum" | "average" | "min" | "max",
): AggregationDataPoint[];

/**
 * Compute simple total aggregation (no grouping).
 *
 * @param transactions - Array to aggregate
 * @param field - Field to aggregate
 * @param operation - Aggregation operation
 * @returns Single aggregation result
 */
export declare function computeTotal(
  transactions: Transaction[],
  field: string,
  operation: "count" | "sum" | "average" | "min" | "max",
): AggregationResult;

/**
 * Build aggregation cache for fast repeated queries.
 *
 * @param transactions - Transaction array
 * @returns Precomputed aggregation cache
 */
export declare function buildAggregationCache(
  transactions: Transaction[],
): AggregationCache;

/**
 * Update aggregation cache after filter operation.
 *
 * @param cache - Existing cache
 * @param filteredTransactions - Filtered transaction subset
 * @returns Updated cache for filtered data
 */
export declare function updateCache(
  cache: AggregationCache,
  filteredTransactions: Transaction[],
): AggregationCache;

/**
 * Query precomputed cache for fast results.
 *
 * @param cache - Aggregation cache
 * @param groupBy - Group dimension ('company', 'goods', 'category', 'month')
 * @param topN - Number of top results
 * @param sortBy - Sort by 'count' or 'totalValue'
 * @returns Top N results from cache
 */
export declare function queryCacheTopN(
  cache: AggregationCache,
  groupBy: "company" | "goods" | "category" | "month",
  topN: number,
  sortBy: "count" | "totalValue",
): AggregationDataPoint[];

// ============================================================================
// AI Context Formatting
// ============================================================================

/**
 * Format aggregation result for AI context (token-optimized).
 *
 * @param result - Aggregation result
 * @returns Compact text representation
 *
 * Example output for company rankings:
 * ```
 * Aggregation: Company Rankings by Total Value
 * - CÔNG TY ABC: 450 transactions, $2.5M total
 * - XYZ Corporation: 380 transactions, $1.8M total
 * - DEF Import Ltd: 320 transactions, $1.2M total
 * (Total: 5,247 transactions, $12.5M, computed in 45ms)
 * ```
 */
export declare function formatAggregationForAI(
  result: AggregationResult,
): string;

/**
 * Format multiple aggregation results.
 *
 * @param results - Array of aggregation results
 * @returns Compact text representation
 */
export declare function formatAggregationsForAI(
  results: AggregationResult[],
): string;

// ============================================================================
// Real-World Query Examples (from spec)
// ============================================================================

/**
 * Example aggregations for 8 real-world user questions:
 *
 * 1. "Which company imports the most?"
 *    → groupBy: companyName, field: totalValueUSD, operation: sum, topN: 10
 *
 * 2. "Which company has the most transactions?"
 *    → groupBy: companyName, field: *, operation: count, topN: 10
 *
 * 3. "Which item is sold the most?"
 *    → groupBy: goodsName, field: *, operation: count, topN: 10
 *
 * 4. "Which item is the most valuable?"
 *    → groupBy: goodsName, field: totalValueUSD, operation: sum, topN: 10
 *
 * 5. "Which item has the most transactions?"
 *    → groupBy: goodsName, field: *, operation: count, topN: 10
 *
 * 6. "What is the total export value?"
 *    → field: totalValueUSD, operation: sum (no groupBy)
 *
 * 7. "What is the import trend over time?"
 *    → groupBy: month, field: totalValueUSD, operation: sum, timeSeries
 *
 * 8. "I want to export to the US, suggest companies"
 *    → filter: importCountry='US', groupBy: companyName, field: totalValueUSD, operation: sum
 */

// ============================================================================
// Error Types
// ============================================================================

export class AggregationError extends Error {
  constructor(
    message: string,
    public code:
      | "INVALID_SPEC"
      | "FIELD_NOT_FOUND"
      | "SESSION_NOT_FOUND"
      | "NO_DATA"
      | "COMPUTATION_FAILED",
    public details?: unknown,
  ) {
    super(message);
    this.name = "AggregationError";
  }
}

// ============================================================================
// Performance Targets
// ============================================================================

/**
 * Performance Requirements (from spec):
 * - Aggregation computation: <100ms for 10,000 transactions
 * - Cache build: ~20ms for 10,000 transactions (one-time)
 * - Cache query: <1ms for top-N from cache
 * - Filtered re-aggregation: <5ms for 500 transactions
 *
 * Success Criteria:
 * - SC-002: <100ms aggregations, pass only 50-500 bytes to AI
 * - SC-006: 80% token reduction (aggregations vs full transaction details)
 * - SC-005: Handle 10,000+ transactions without degradation
 *
 * Token Savings Example:
 * - Full transaction details: 5,000 transactions × 100 bytes = 500KB
 * - Aggregation summary: Top 10 companies × 20 bytes = 200 bytes
 * - Reduction: 99.96% (500KB → 200 bytes)
 */
