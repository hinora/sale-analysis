/**
 * Integration tests for query-handler.ts
 * Tests query intent classification with 8 real-world questions
 */

import { QueryHandler } from "@/lib/ai/query-handler";

// Mock session data
const mockSession = {
  id: "test-session",
  transactionData: [
    {
      importCompanyName: "ABC Corporation",
      importCountry: "United States",
      categoryName: "Electronics",
      totalValueUSD: 50000,
      quantity: 100,
      unit: "units",
      unitPriceUSD: 500,
      date: "2024-01-15",
    },
    {
      importCompanyName: "XYZ Import Ltd",
      importCountry: "Vietnam",
      categoryName: "Machinery",
      totalValueUSD: 75000,
      quantity: 50,
      unit: "units",
      unitPriceUSD: 1500,
      date: "2024-02-20",
    },
    {
      importCompanyName: "Global Trading Co",
      importCountry: "China",
      categoryName: "Electronics",
      totalValueUSD: 120000,
      quantity: 200,
      unit: "units",
      unitPriceUSD: 600,
      date: "2024-03-10",
    },
  ],
  conversationHistory: [],
  status: "ready" as const,
  createdAt: new Date(),
  lastAccessedAt: new Date(),
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  metadata: {
    transactionCount: 3,
    dataSize: 1000,
  },
};

describe("QueryHandler - Intent Classification", () => {
  let queryHandler: QueryHandler;

  beforeEach(() => {
    queryHandler = new QueryHandler("test-model");
  });

  describe("Real-world question mapping", () => {
    test('Question 1: "Which company imports the most?" → aggregation', async () => {
      const intent = await queryHandler.classifyQueryIntent(
        "Which company imports the most?",
      );

      expect(intent.type).toBe("aggregation");
      expect(intent.confidence).toBeGreaterThanOrEqual(0.7);
      expect(intent.aggregations).toBeDefined();
    });

    test('Question 2: "Show me top 5 transactions" → detail', async () => {
      const intent = await queryHandler.classifyQueryIntent(
        "Show me top 5 transactions",
      );

      expect(intent.type).toBe("detail");
      expect(intent.limit).toBe(5);
      expect(intent.confidence).toBeGreaterThanOrEqual(0.6);
    });

    test('Question 3: "What is the import trend over time?" → trend', async () => {
      const intent = await queryHandler.classifyQueryIntent(
        "What is the import trend over time?",
      );

      expect(intent.type).toBe("trend");
      expect(intent.confidence).toBeGreaterThanOrEqual(0.7);
    });

    test('Question 4: "Compare US and China imports" → comparison', async () => {
      const intent = await queryHandler.classifyQueryIntent(
        "Compare US and China imports",
      );

      expect(intent.type).toBe("comparison");
      expect(intent.confidence).toBeGreaterThanOrEqual(0.7);
    });

    test('Question 5: "Which companies should I export to in the US?" → recommendation', async () => {
      const intent = await queryHandler.classifyQueryIntent(
        "Which companies should I export to in the US?",
      );

      expect(intent.type).toBe("recommendation");
      expect(intent.confidence).toBeGreaterThanOrEqual(0.6);
    });

    test('Question 6: "Top 10 companies by import value" → ranking', async () => {
      const intent = await queryHandler.classifyQueryIntent(
        "Top 10 companies by import value",
      );

      expect(intent.type).toBe("ranking");
      expect(intent.limit).toBe(10);
      expect(intent.confidence).toBeGreaterThanOrEqual(0.7);
    });

    test('Question 7: "Tổng giá trị nhập khẩu là bao nhiêu?" → aggregation (Vietnamese)', async () => {
      const intent = await queryHandler.classifyQueryIntent(
        "Tổng giá trị nhập khẩu là bao nhiêu?",
      );

      expect(intent.type).toBe("aggregation");
      expect(intent.confidence).toBeGreaterThanOrEqual(0.7);
    });

    test('Question 8: "List all electronics imports" → detail', async () => {
      const intent = await queryHandler.classifyQueryIntent(
        "List all electronics imports",
      );

      expect(intent.type).toBe("detail");
      expect(intent.confidence).toBeGreaterThanOrEqual(0.6);
    });
  });

  describe("Aggregation spec extraction", () => {
    test('Extracts count operation from "How many"', async () => {
      const specs = await queryHandler.extractAggregationSpecs(
        "How many companies are there?",
      );

      expect(specs).toHaveLength(1);
      expect(specs[0].operation).toBe("count");
      expect(specs[0].field).toBe("importCompanyName");
    });

    test('Extracts sum operation from "Total value"', async () => {
      const specs = await queryHandler.extractAggregationSpecs(
        "What is the total value of imports?",
      );

      expect(specs).toHaveLength(1);
      expect(specs[0].operation).toBe("sum");
      expect(specs[0].field).toBe("totalValueUSD");
    });

    test('Extracts average operation from "Average price"', async () => {
      const specs = await queryHandler.extractAggregationSpecs(
        "What is the average price?",
      );

      expect(specs).toHaveLength(1);
      expect(specs[0].operation).toBe("average");
    });

    test('Extracts groupBy from "by company"', async () => {
      const specs = await queryHandler.extractAggregationSpecs(
        "Total imports by company",
      );

      expect(specs).toHaveLength(1);
      expect(specs[0].groupBy).toBe("importCompanyName");
    });

    test('Extracts groupBy from "by category"', async () => {
      const specs =
        await queryHandler.extractAggregationSpecs("Sum by category");

      expect(specs).toHaveLength(1);
      expect(specs[0].groupBy).toBe("categoryName");
    });
  });

  describe("Filter extraction", () => {
    test("Extracts country filter from question", async () => {
      const intent = await queryHandler.classifyQueryIntent(
        "Show me US companies",
      );

      expect(intent.filters.length).toBeGreaterThan(0);
      const countryFilter = intent.filters.find(
        (f) => f.field === "importCountry",
      );
      expect(countryFilter).toBeDefined();
    });

    test("Extracts category filter from question", async () => {
      const intent = await queryHandler.classifyQueryIntent(
        "List electronics imports",
      );

      expect(intent.filters.length).toBeGreaterThan(0);
      const categoryFilter = intent.filters.find(
        (f) => f.field === "categoryName",
      );
      expect(categoryFilter).toBeDefined();
    });
  });

  describe("Order by and limit extraction", () => {
    test('Extracts limit from "top 5"', async () => {
      const intent = await queryHandler.classifyQueryIntent(
        "Show top 5 companies",
      );

      expect(intent.limit).toBe(5);
    });

    test('Extracts limit from "10 companies"', async () => {
      const intent =
        await queryHandler.classifyQueryIntent("List 10 companies");

      expect(intent.limit).toBe(10);
    });

    test('Extracts descending order from "most"', async () => {
      const intent = await queryHandler.classifyQueryIntent(
        "Which imports the most?",
      );

      expect(intent.orderBy).toBe("desc");
    });

    test('Extracts ascending order from "least"', async () => {
      const intent = await queryHandler.classifyQueryIntent(
        "Which imports the least?",
      );

      expect(intent.orderBy).toBe("asc");
    });
  });
});
