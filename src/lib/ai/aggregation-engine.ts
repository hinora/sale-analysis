/**
 * Aggregation Engine
 *
 * Computes in-memory aggregations (count, sum, average, min, max, top-N, group-by)
 * from loaded transactions to achieve 80% token reduction by passing only
 * summary statistics to AI instead of full transaction lists.
 */

/**
 * Aggregation specification
 */
export interface AggregationSpec {
  field: string;
  operation: 'count' | 'sum' | 'average' | 'min' | 'max';
  groupBy?: string;
}

/**
 * Single aggregation data point
 */
export interface AggregationDataPoint {
  key: string;
  value: number;
  count?: number;
}

/**
 * Aggregation result
 */
export interface AggregationResult {
  spec: AggregationSpec;
  dataPoints: AggregationDataPoint[];
  executionTimeMs: number;
  totalRecords: number;
}

/**
 * Aggregation cache for fast retrieval
 */
export interface AggregationCache {
  byCompany: Map<string, AggregationDataPoint>;
  byCategory: Map<string, AggregationDataPoint>;
  byCountry: Map<string, AggregationDataPoint>;
  byMonth: Map<string, AggregationDataPoint>;
  lastUpdated: Date;
}

/**
 * Compute multiple aggregations
 */
export function computeAggregations(
  transactions: Array<Record<string, unknown>>,
  specs: AggregationSpec[],
): AggregationResult[] {
  return specs.map((spec) => computeAggregation(transactions, spec));
}

/**
 * Compute single aggregation with optional groupBy
 */
export function computeAggregation(
  transactions: Array<Record<string, unknown>>,
  spec: AggregationSpec,
): AggregationResult {
  const startTime = Date.now();

  let dataPoints: AggregationDataPoint[];

  if (spec.groupBy) {
    // Grouped aggregation
    dataPoints = groupBy(transactions, spec.groupBy, spec.field, spec.operation);
  } else {
    // Simple total aggregation
    dataPoints = [computeTotal(transactions, spec.field, spec.operation)];
  }

  const executionTimeMs = Date.now() - startTime;

  return {
    spec,
    dataPoints,
    executionTimeMs,
    totalRecords: transactions.length,
  };
}

/**
 * Group transactions by field and compute aggregation
 */
export function groupBy(
  transactions: Array<Record<string, unknown>>,
  groupByField: string,
  valueField: string,
  operation: 'count' | 'sum' | 'average' | 'min' | 'max',
): AggregationDataPoint[] {
  // Group transactions
  const groups = new Map<string, Array<Record<string, unknown>>>();

  for (const tx of transactions) {
    const key = String(tx[groupByField] || 'Unknown');
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    const group = groups.get(key);
    if (group) {
      group.push(tx);
    }
  }

  // Compute aggregation for each group
  const dataPoints: AggregationDataPoint[] = [];

  for (const [key, groupTransactions] of groups.entries()) {
    const values = groupTransactions
      .map((tx) => Number(tx[valueField]) || 0)
      .filter((v) => !Number.isNaN(v));

    let value: number;

    switch (operation) {
      case 'count':
        value = groupTransactions.length;
        break;
      case 'sum':
        value = values.reduce((sum, v) => sum + v, 0);
        break;
      case 'average':
        value = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
        break;
      case 'min':
        value = values.length > 0 ? Math.min(...values) : 0;
        break;
      case 'max':
        value = values.length > 0 ? Math.max(...values) : 0;
        break;
    }

    dataPoints.push({
      key,
      value,
      count: groupTransactions.length,
    });
  }

  // Sort by value descending
  return dataPoints.sort((a, b) => b.value - a.value);
}

/**
 * Get top N results from aggregation
 */
export function getTopN(dataPoints: AggregationDataPoint[], n: number): AggregationDataPoint[] {
  return dataPoints.slice(0, n);
}

/**
 * Compute total aggregation (no grouping)
 */
export function computeTotal(
  transactions: Array<Record<string, unknown>>,
  field: string,
  operation: 'count' | 'sum' | 'average' | 'min' | 'max',
): AggregationDataPoint {
  const values = transactions
    .map((tx) => Number(tx[field]) || 0)
    .filter((v) => !Number.isNaN(v));

  let value: number;

  switch (operation) {
    case 'count':
      value = transactions.length;
      break;
    case 'sum':
      value = values.reduce((sum, v) => sum + v, 0);
      break;
    case 'average':
      value = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
      break;
    case 'min':
      value = values.length > 0 ? Math.min(...values) : 0;
      break;
    case 'max':
      value = values.length > 0 ? Math.max(...values) : 0;
      break;
  }

  return {
    key: 'Total',
    value,
    count: transactions.length,
  };
}

/**
 * Build aggregation cache for fast retrieval
 */
export function buildAggregationCache(
  transactions: Array<Record<string, unknown>>,
): AggregationCache {
  // Precompute common aggregations
  const byCompany = new Map<string, AggregationDataPoint>();
  const byCategory = new Map<string, AggregationDataPoint>();
  const byCountry = new Map<string, AggregationDataPoint>();
  const byMonth = new Map<string, AggregationDataPoint>();

  // Group by company
  const companyData = groupBy(transactions, 'companyName', 'totalValueUSD', 'sum');
  for (const dp of companyData) {
    byCompany.set(dp.key, dp);
  }

  // Group by category
  const categoryData = groupBy(transactions, 'categoryName', 'totalValueUSD', 'sum');
  for (const dp of categoryData) {
    byCategory.set(dp.key, dp);
  }

  // Group by country
  const countryData = groupBy(transactions, 'importCountry', 'totalValueUSD', 'sum');
  for (const dp of countryData) {
    byCountry.set(dp.key, dp);
  }

  // Group by month (requires date parsing)
  const monthlyGroups = new Map<string, Array<Record<string, unknown>>>();
  for (const tx of transactions) {
    const date = tx.date ? new Date(String(tx.date)) : null;
    if (date && !Number.isNaN(date.getTime())) {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyGroups.has(monthKey)) {
        monthlyGroups.set(monthKey, []);
      }
      const monthGroup = monthlyGroups.get(monthKey);
      if (monthGroup) {
        monthGroup.push(tx);
      }
    }
  }

  // Compute monthly aggregations
  for (const [monthKey, monthTransactions] of monthlyGroups.entries()) {
    const totalValue = monthTransactions.reduce(
      (sum, tx) => sum + (Number(tx.totalValueUSD) || 0),
      0
    );
    byMonth.set(monthKey, {
      key: monthKey,
      value: totalValue,
      count: monthTransactions.length,
    });
  }

  return {
    byCompany,
    byCategory,
    byCountry,
    byMonth,
    lastUpdated: new Date(),
  };
}

/**
 * Query cache for top N results
 */
export function queryCacheTopN(
  cache: AggregationCache,
  groupBy: 'company' | 'category' | 'country' | 'month',
  n: number,
): AggregationDataPoint[] {
  let cacheMap: Map<string, AggregationDataPoint>;

  switch (groupBy) {
    case 'company':
      cacheMap = cache.byCompany;
      break;
    case 'category':
      cacheMap = cache.byCategory;
      break;
    case 'country':
      cacheMap = cache.byCountry;
      break;
    case 'month':
      cacheMap = cache.byMonth;
      break;
  }

  // Convert map to array and sort by value
  const dataPoints = Array.from(cacheMap.values()).sort((a, b) => b.value - a.value);

  return getTopN(dataPoints, n);
}

/**
 * Format aggregation result for AI (token-optimized)
 * Example: "Top companies: CompanyA $500K (120 txns), CompanyB $300K (80 txns)"
 */
export function formatAggregationForAI(result: AggregationResult): string {
  const { spec, dataPoints, totalRecords } = result;

  // Header
  const operation = spec.operation === 'count' ? 'Count' : spec.operation === 'sum' ? 'Total' : spec.operation === 'average' ? 'Average' : spec.operation === 'min' ? 'Min' : 'Max';
  const groupBy = spec.groupBy || 'Overall';
  const header = `${operation} by ${groupBy}`;

  // Data points (token-optimized format)
  const lines: string[] = [];

  for (const dp of dataPoints.slice(0, 20)) {
    // Limit to top 20
    const valueFormatted =
      spec.field === 'totalValueUSD' || spec.operation === 'sum'
        ? `$${dp.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
        : dp.value.toFixed(2);

    const countInfo = dp.count ? ` (${dp.count} txns)` : '';
    lines.push(`  ${dp.key}: ${valueFormatted}${countInfo}`);
  }

  // Summary
  const summary = `Total records: ${totalRecords}${dataPoints.length > 20 ? `, showing top 20 of ${dataPoints.length}` : ''}`;

  return `${header}\n${lines.join('\n')}\n${summary}`;
}
