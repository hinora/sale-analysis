/**
 * Unit tests for aggregation-engine.ts
 * Tests group-by, sum, count, top-N, time-series, and cache performance
 */

import {
  computeAggregations,
  computeAggregation,
  groupBy,
  getTopN,
  computeTotal,
  buildAggregationCache,
  queryCacheTopN,
  formatAggregationForAI,
  type AggregationSpec,
  type AggregationDataPoint,
} from "@/lib/ai/aggregation-engine";

describe("Aggregation Engine", () => {
  // Sample transaction data
  const sampleTransactions = [
    {
      companyName: "ABC Corp",
      categoryName: "Electronics",
      importCountry: "United States",
      totalValueUSD: 50000,
      quantity: 100,
      date: "2024-01-15",
    },
    {
      companyName: "XYZ Ltd",
      categoryName: "Machinery",
      importCountry: "Vietnam",
      totalValueUSD: 75000,
      quantity: 50,
      date: "2024-01-20",
    },
    {
      companyName: "ABC Corp",
      categoryName: "Electronics",
      importCountry: "China",
      totalValueUSD: 30000,
      quantity: 60,
      date: "2024-02-10",
    },
    {
      companyName: "Global Inc",
      categoryName: "Textiles",
      importCountry: "United States",
      totalValueUSD: 40000,
      quantity: 200,
      date: "2024-02-15",
    },
    {
      companyName: "XYZ Ltd",
      categoryName: "Machinery",
      importCountry: "Japan",
      totalValueUSD: 90000,
      quantity: 30,
      date: "2024-03-05",
    },
  ];

  describe("groupBy", () => {
    test("groups by company and computes sum", () => {
      const result = groupBy(
        sampleTransactions,
        "companyName",
        "totalValueUSD",
        "sum",
      );

      expect(result).toHaveLength(3);

      const abcCorp = result.find((r) => r.key === "ABC Corp");
      expect(abcCorp?.value).toBe(80000); // 50000 + 30000
      expect(abcCorp?.count).toBe(2);

      const xyzLtd = result.find((r) => r.key === "XYZ Ltd");
      expect(xyzLtd?.value).toBe(165000); // 75000 + 90000
      expect(xyzLtd?.count).toBe(2);
    });

    test("groups by category and computes count", () => {
      const result = groupBy(
        sampleTransactions,
        "categoryName",
        "totalValueUSD",
        "count",
      );

      expect(result).toHaveLength(3);

      const electronics = result.find((r) => r.key === "Electronics");
      expect(electronics?.value).toBe(2);
      expect(electronics?.count).toBe(2);
    });

    test("groups by country and computes average", () => {
      const result = groupBy(
        sampleTransactions,
        "importCountry",
        "totalValueUSD",
        "average",
      );

      const usa = result.find((r) => r.key === "United States");
      expect(usa?.value).toBe(45000); // (50000 + 40000) / 2
    });

    test("computes min value by group", () => {
      const result = groupBy(
        sampleTransactions,
        "companyName",
        "totalValueUSD",
        "min",
      );

      const abcCorp = result.find((r) => r.key === "ABC Corp");
      expect(abcCorp?.value).toBe(30000);
    });

    test("computes max value by group", () => {
      const result = groupBy(
        sampleTransactions,
        "companyName",
        "totalValueUSD",
        "max",
      );

      const xyzLtd = result.find((r) => r.key === "XYZ Ltd");
      expect(xyzLtd?.value).toBe(90000);
    });

    test("sorts results by value descending", () => {
      const result = groupBy(
        sampleTransactions,
        "companyName",
        "totalValueUSD",
        "sum",
      );

      // XYZ Ltd (165000) should be first
      expect(result[0].key).toBe("XYZ Ltd");
      expect(result[0].value).toBe(165000);
    });
  });

  describe("getTopN", () => {
    test("returns top 2 results", () => {
      const dataPoints: AggregationDataPoint[] = [
        { key: "A", value: 100, count: 10 },
        { key: "B", value: 80, count: 8 },
        { key: "C", value: 60, count: 6 },
        { key: "D", value: 40, count: 4 },
      ];

      const top2 = getTopN(dataPoints, 2);

      expect(top2).toHaveLength(2);
      expect(top2[0].key).toBe("A");
      expect(top2[1].key).toBe("B");
    });

    test("returns all results if N is larger than array", () => {
      const dataPoints: AggregationDataPoint[] = [
        { key: "A", value: 100, count: 10 },
        { key: "B", value: 80, count: 8 },
      ];

      const top10 = getTopN(dataPoints, 10);

      expect(top10).toHaveLength(2);
    });
  });

  describe("computeTotal", () => {
    test("computes total count", () => {
      const result = computeTotal(sampleTransactions, "totalValueUSD", "count");

      expect(result.key).toBe("Total");
      expect(result.value).toBe(5);
      expect(result.count).toBe(5);
    });

    test("computes total sum", () => {
      const result = computeTotal(sampleTransactions, "totalValueUSD", "sum");

      expect(result.value).toBe(285000); // 50000+75000+30000+40000+90000
    });

    test("computes total average", () => {
      const result = computeTotal(
        sampleTransactions,
        "totalValueUSD",
        "average",
      );

      expect(result.value).toBe(57000); // 285000 / 5
    });

    test("computes min value", () => {
      const result = computeTotal(sampleTransactions, "totalValueUSD", "min");

      expect(result.value).toBe(30000);
    });

    test("computes max value", () => {
      const result = computeTotal(sampleTransactions, "totalValueUSD", "max");

      expect(result.value).toBe(90000);
    });
  });

  describe("computeAggregation", () => {
    test("computes aggregation with groupBy", () => {
      const spec: AggregationSpec = {
        field: "totalValueUSD",
        operation: "sum",
        groupBy: "companyName",
      };

      const result = computeAggregation(sampleTransactions, spec);

      expect(result.spec).toEqual(spec);
      expect(result.dataPoints).toHaveLength(3);
      expect(result.totalRecords).toBe(5);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    test("computes aggregation without groupBy", () => {
      const spec: AggregationSpec = {
        field: "totalValueUSD",
        operation: "sum",
      };

      const result = computeAggregation(sampleTransactions, spec);

      expect(result.dataPoints).toHaveLength(1);
      expect(result.dataPoints[0].key).toBe("Total");
      expect(result.dataPoints[0].value).toBe(285000);
    });
  });

  describe("computeAggregations", () => {
    test("computes multiple aggregations", () => {
      const specs: AggregationSpec[] = [
        { field: "totalValueUSD", operation: "sum", groupBy: "companyName" },
        { field: "quantity", operation: "count", groupBy: "categoryName" },
      ];

      const results = computeAggregations(sampleTransactions, specs);

      expect(results).toHaveLength(2);
      expect(results[0].spec.operation).toBe("sum");
      expect(results[1].spec.operation).toBe("count");
    });
  });

  describe("buildAggregationCache", () => {
    test("builds cache with company aggregations", () => {
      const cache = buildAggregationCache(sampleTransactions);

      expect(cache.byCompany.size).toBe(3);
      expect(cache.byCompany.get("XYZ Ltd")?.value).toBe(165000);
    });

    test("builds cache with category aggregations", () => {
      const cache = buildAggregationCache(sampleTransactions);

      expect(cache.byCategory.size).toBe(3);
      expect(cache.byCategory.get("Electronics")?.value).toBe(80000);
    });

    test("builds cache with country aggregations", () => {
      const cache = buildAggregationCache(sampleTransactions);

      expect(cache.byCountry.size).toBe(4);
      expect(cache.byCountry.get("United States")?.value).toBe(90000);
    });

    test("builds cache with monthly aggregations", () => {
      const cache = buildAggregationCache(sampleTransactions);

      expect(cache.byMonth.size).toBeGreaterThan(0);
      expect(cache.byMonth.get("2024-01")?.value).toBe(125000); // Jan: 50000+75000
    });

    test("includes lastUpdated timestamp", () => {
      const cache = buildAggregationCache(sampleTransactions);

      expect(cache.lastUpdated).toBeInstanceOf(Date);
      expect(cache.lastUpdated.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("queryCacheTopN", () => {
    let cache: ReturnType<typeof buildAggregationCache>;

    beforeEach(() => {
      cache = buildAggregationCache(sampleTransactions);
    });

    test("returns top 2 companies", () => {
      const top2 = queryCacheTopN(cache, "company", 2);

      expect(top2).toHaveLength(2);
      expect(top2[0].key).toBe("XYZ Ltd");
      expect(top2[0].value).toBe(165000);
    });

    test("returns top 2 categories", () => {
      const top2 = queryCacheTopN(cache, "category", 2);

      expect(top2).toHaveLength(2);
    });

    test("returns top countries", () => {
      const top3 = queryCacheTopN(cache, "country", 3);

      expect(top3).toHaveLength(3);
    });

    test("returns top months", () => {
      const top2 = queryCacheTopN(cache, "month", 2);

      expect(top2).toHaveLength(2);
    });
  });

  describe("formatAggregationForAI", () => {
    test("formats aggregation result with token-optimized output", () => {
      const spec: AggregationSpec = {
        field: "totalValueUSD",
        operation: "sum",
        groupBy: "companyName",
      };

      const result = computeAggregation(sampleTransactions, spec);
      const formatted = formatAggregationForAI(result);

      expect(formatted).toContain("Total by companyName");
      expect(formatted).toContain("XYZ Ltd");
      expect(formatted).toContain("$165,000");
      expect(formatted).toContain("Total records: 5");
    });

    test("formats count operation correctly", () => {
      const spec: AggregationSpec = {
        field: "companyName",
        operation: "count",
        groupBy: "categoryName",
      };

      const result = computeAggregation(sampleTransactions, spec);
      const formatted = formatAggregationForAI(result);

      expect(formatted).toContain("Count by categoryName");
    });

    test("limits output to top 20 results", () => {
      // Create 25 transactions
      const manyTransactions = Array.from({ length: 25 }, (_, i) => ({
        companyName: `Company ${i}`,
        totalValueUSD: (i + 1) * 1000,
        date: "2024-01-01",
      }));

      const spec: AggregationSpec = {
        field: "totalValueUSD",
        operation: "sum",
        groupBy: "companyName",
      };

      const result = computeAggregation(manyTransactions, spec);
      const formatted = formatAggregationForAI(result);

      expect(formatted).toContain("showing top 20 of 25");
    });
  });

  describe("Performance", () => {
    test("processes 10K transactions in under 100ms", () => {
      // Generate 10,000 transactions
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        companyName: `Company ${i % 100}`, // 100 unique companies
        categoryName: `Category ${i % 20}`, // 20 categories
        totalValueUSD: Math.floor(Math.random() * 100000),
        quantity: Math.floor(Math.random() * 1000),
        date: `2024-${String((i % 12) + 1).padStart(2, "0")}-01`,
      }));

      const startTime = Date.now();

      const spec: AggregationSpec = {
        field: "totalValueUSD",
        operation: "sum",
        groupBy: "companyName",
      };

      const result = computeAggregation(largeDataset, spec);

      const duration = Date.now() - startTime;

      expect(result.totalRecords).toBe(10000);
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    test("cache build completes quickly for 10K transactions", () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        companyName: `Company ${i % 100}`,
        categoryName: `Category ${i % 20}`,
        importCountry: `Country ${i % 10}`,
        totalValueUSD: Math.floor(Math.random() * 100000),
        date: `2024-${String((i % 12) + 1).padStart(2, "0")}-15`,
      }));

      const startTime = Date.now();
      const cache = buildAggregationCache(largeDataset);
      const duration = Date.now() - startTime;

      expect(cache.byCompany.size).toBe(100);
      expect(duration).toBeLessThan(100); // Cache build under 100ms
    });
  });
});
