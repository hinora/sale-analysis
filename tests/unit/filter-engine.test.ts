/**
 * Unit tests for filter-engine
 * Tests in-memory filtering with smart matching
 */

import { executeFilters, applyFilter } from "@/lib/ai/filter-engine";
import type { FilterExpression } from "@/lib/utils/validation";

// Sample transaction data for testing
const sampleTransactions = [
  {
    id: "1",
    importCompanyName: "CÔNG TY ABC",
    importCountry: "United States",
    categoryName: "Electronics",
    totalValueUSD: 50000,
    date: "2024-01-15",
  },
  {
    id: "2",
    importCompanyName: "XYZ Corporation",
    importCountry: "USA",
    categoryName: "electronic devices",
    totalValueUSD: 75000,
    date: "2024-02-20",
  },
  {
    id: "3",
    importCompanyName: "DEF Import Ltd",
    importCountry: "Vietnam",
    categoryName: "Machinery",
    totalValueUSD: 30000,
    date: "2024-03-10",
  },
  {
    id: "4",
    importCompanyName: "Cty ABC",
    importCountry: "Hoa Kỳ",
    categoryName: "điện tử",
    totalValueUSD: 45000,
    date: "2024-01-25",
  },
];

describe("filter-engine", () => {
  describe("applyFilter - case-insensitive matching", () => {
    it("should match case-insensitively with contains operator", () => {
      const filter: FilterExpression = {
        field: "importCompanyName",
        operator: "contains",
        value: "abc",
      };

      const result = applyFilter(sampleTransactions, filter);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("1");
      expect(result[1].id).toBe("4");
    });

    it("should match company name variations", () => {
      const filter: FilterExpression = {
        field: "importCompanyName",
        operator: "contains",
        value: "XYZ",
      };

      const result = applyFilter(sampleTransactions, filter);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("2");
    });
  });

  describe("applyFilter - contains matching", () => {
    it("should match substring in category", () => {
      const filter: FilterExpression = {
        field: "categoryName",
        operator: "contains",
        value: "electr",
      };

      const result = applyFilter(sampleTransactions, filter);
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toContain("1");
      expect(result.map((r) => r.id)).toContain("2");
    });
  });

  describe("applyFilter - synonym matching", () => {
    it("should match US/USA/United States synonyms", () => {
      const filter: FilterExpression = {
        field: "importCountry",
        operator: "equals",
        value: "US",
      };

      const result = applyFilter(sampleTransactions, filter);
      expect(result.length).toBeGreaterThan(0);

      // Should match United States, USA, Hoa Kỳ
      const countries = result.map((r) => r.importCountry);
      expect(countries).toContain("United States");
      expect(countries).toContain("USA");
      expect(countries).toContain("Hoa Kỳ");
    });

    it("should match company synonyms (CÔNG TY / Cty)", () => {
      const filter: FilterExpression = {
        field: "importCompanyName",
        operator: "contains",
        value: "CÔNG TY",
      };

      const result = applyFilter(sampleTransactions, filter);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("applyFilter - Vietnamese text filtering", () => {
    it("should match Vietnamese text with diacritics", () => {
      const filter: FilterExpression = {
        field: "categoryName",
        operator: "contains",
        value: "điện",
      };

      const result = applyFilter(sampleTransactions, filter);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("4");
    });

    it("should match Vietnamese text without diacritics when option enabled", () => {
      const filter: FilterExpression = {
        field: "categoryName",
        operator: "contains",
        value: "dien",
      };

      const result = applyFilter(sampleTransactions, filter, {
        removeDiacritics: true,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("4");
    });
  });

  describe("applyFilter - fuzzy matching", () => {
    it("should match with typos using fuzzy strategy", () => {
      const filter: FilterExpression = {
        field: "categoryName",
        operator: "contains",
        value: "electonic", // typo: missing 'r'
        matchStrategy: "fuzzy",
        fuzzyThreshold: 2,
      };

      const result = applyFilter(sampleTransactions, filter);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("applyFilter - numeric operators", () => {
    it("should filter with greaterThan operator", () => {
      const filter: FilterExpression = {
        field: "totalValueUSD",
        operator: "greaterThan",
        value: 50000,
      };

      const result = applyFilter(sampleTransactions, filter);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("2");
    });

    it("should filter with lessThan operator", () => {
      const filter: FilterExpression = {
        field: "totalValueUSD",
        operator: "lessThan",
        value: 40000,
      };

      const result = applyFilter(sampleTransactions, filter);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("3");
    });

    it("should filter with between operator", () => {
      const filter: FilterExpression = {
        field: "totalValueUSD",
        operator: "between",
        value: ["40000", "60000"],
      };

      const result = applyFilter(sampleTransactions, filter);
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toContain("1");
      expect(result.map((r) => r.id)).toContain("4");
    });
  });

  describe("applyFilter - in operator", () => {
    it("should match values in array", () => {
      const filter: FilterExpression = {
        field: "categoryName",
        operator: "in",
        value: ["Electronics", "Machinery"],
      };

      const result = applyFilter(sampleTransactions, filter);
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toContain("1");
      expect(result.map((r) => r.id)).toContain("3");
    });
  });

  describe("executeFilters - multiple filters with AND logic", () => {
    it("should combine multiple filters with AND", () => {
      const filters: FilterExpression[] = [
        {
          field: "importCountry",
          operator: "contains",
          value: "US",
        },
        {
          field: "categoryName",
          operator: "contains",
          value: "electron",
          logicalOperator: "AND",
        },
      ];

      const result = executeFilters(sampleTransactions, filters);
      expect(result.length).toBeGreaterThan(0);

      // All results should match both criteria
      for (const transaction of result) {
        expect(["United States", "USA", "Hoa Kỳ"]).toContain(
          transaction.importCountry,
        );
        expect(transaction.categoryName.toLowerCase()).toMatch(/electron/);
      }
    });

    it("should handle complex AND combinations", () => {
      const filters: FilterExpression[] = [
        {
          field: "totalValueUSD",
          operator: "greaterThan",
          value: 40000,
        },
        {
          field: "categoryName",
          operator: "contains",
          value: "electron",
          logicalOperator: "AND",
        },
      ];

      const result = executeFilters(sampleTransactions, filters);
      expect(result.length).toBeGreaterThan(0);

      for (const transaction of result) {
        expect(transaction.totalValueUSD).toBeGreaterThan(40000);
        expect(transaction.categoryName.toLowerCase()).toMatch(/electron/);
      }
    });
  });

  describe("executeFilters - multiple filters with OR logic", () => {
    it("should combine filters with OR", () => {
      const filters: FilterExpression[] = [
        {
          field: "categoryName",
          operator: "contains",
          value: "Electronics",
        },
        {
          field: "categoryName",
          operator: "contains",
          value: "Machinery",
          logicalOperator: "OR",
        },
      ];

      const result = executeFilters(sampleTransactions, filters);
      expect(result).toHaveLength(2);
    });
  });

  describe("executeFilters - empty filters", () => {
    it("should return all transactions when no filters", () => {
      const result = executeFilters(sampleTransactions, []);
      expect(result).toHaveLength(sampleTransactions.length);
    });
  });

  describe("applyFilter - edge cases", () => {
    it("should handle null/undefined field values", () => {
      const transactionsWithNull = [
        { id: "1", importCompanyName: null },
        { id: "2", importCompanyName: "ABC" },
      ];

      const filter: FilterExpression = {
        field: "importCompanyName",
        operator: "contains",
        value: "ABC",
      };

      const result = applyFilter(transactionsWithNull, filter);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("2");
    });

    it("should handle non-existent fields", () => {
      const filter: FilterExpression = {
        field: "nonExistentField",
        operator: "contains",
        value: "test",
      };

      const result = applyFilter(sampleTransactions, filter);
      expect(result).toHaveLength(0);
    });
  });
});
