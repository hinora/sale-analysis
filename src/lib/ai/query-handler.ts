/**
 * AI Query Handler
 *
 * Formats prompts and processes natural language queries against transaction data
 * using Ollama LLM with grounded, citation-based responses
 */

import { OllamaClient } from "./ollama-client";
import type { AISession } from "./session-manager";
import { updateFilterView, addFilterLog } from "./session-manager";
import { executeFilters, type FilterExpression } from "./filter-engine";
import { FilterExpressionSchema } from "../utils/validation";
import {
  computeAggregations,
  formatAggregationForAI,
  type AggregationSpec,
} from "./aggregation-engine";

/**
 * Query result with response and citations
 */
export interface QueryResult {
  answer: string;
  citations: string[];
  confidence: "high" | "medium" | "low";
  processingTime: number;
}

/**
 * Filter execution log for debugging and performance tracking
 */
export interface FilterLog {
  timestamp: string;
  filterExpression: FilterExpression;
  matchedCount: number;
  executionTimeMs: number;
}

/**
 * Query intent classification
 */
export interface QueryIntent {
  type:
    | "aggregation"
    | "detail"
    | "trend"
    | "comparison"
    | "recommendation"
    | "ranking";
  filters: FilterExpression[];
  aggregations?: Array<{
    field: string;
    operation: "count" | "sum" | "average" | "min" | "max";
    groupBy?: string;
  }>;
  limit?: number;
  orderBy?: string;
  confidence: number; // 0-1
}

/**
 * Format transaction data for AI context
 * Note: Transactions are already limited to 10,000 in feed-data endpoint
 * Uses compact CSV format to fit more data within model context window
 */
function formatTransactionDataForContext(
  transactions: Array<Record<string, unknown>>,
): string {
  // Calculate aggregated statistics for context
  const stats = {
    totalTransactions: transactions.length,
    totalValue: transactions.reduce(
      (sum, tx) => sum + (Number(tx.totalValueUSD) || 0),
      0,
    ),
    companies: new Set(
      transactions.map((tx) => tx.companyName).filter(Boolean),
    ),
    categories: new Set(
      transactions.map((tx) => tx.categoryName).filter(Boolean),
    ),
    countries: new Set(
      transactions.map((tx) => tx.importCountry).filter(Boolean),
    ),
    dateRange: {
      earliest: transactions.reduce(
        (min, tx) => {
          const date = new Date(tx.date as string);
          return !min || date < min ? date : min;
        },
        null as Date | null,
      ),
      latest: transactions.reduce(
        (max, tx) => {
          const date = new Date(tx.date as string);
          return !max || date > max ? date : max;
        },
        null as Date | null,
      ),
    },
  };

  // Use compact CSV-like format instead of verbose text
  const formatted = transactions
    .map((tx, index) => {
      return `${index + 1}|${tx.companyName}|${tx.importCountry}|${tx.categoryName}|${tx.quantity} ${tx.unit}|$${tx.unitPriceUSD}|$${tx.totalValueUSD}|${tx.date}`;
    })
    .join("\n");

  const summary = `
TÓM TẮT DỮ LIỆU:
- Tổng số giao dịch: ${stats.totalTransactions}
- Tổng giá trị: $${stats.totalValue.toFixed(2)}
- Số công ty: ${stats.companies.size}
- Số danh mục: ${stats.categories.size}
- Số nước: ${stats.countries.size}
- Khoảng thời gian: ${stats.dateRange.earliest?.toISOString().split("T")[0]} đến ${stats.dateRange.latest?.toISOString().split("T")[0]}

ĐỊNH DẠNG DỮ LIỆU: STT|Công ty|Nước|Danh mục|Số lượng|Đơn giá|Tổng giá trị|Ngày

DỮ LIỆU GIAO DỊCH:
${formatted}
`;

  return summary;
}

/**
 * Build system prompt for grounded analysis
 */
function buildSystemPrompt(transactionData: string): string {
  return `Bạn là chuyên gia phân tích dữ liệu chuyên về phân tích dữ liệu thương mại xuất/nhập khẩu. Bạn được cung cấp một tập dữ liệu các giao dịch xuất khẩu.

QUY TẮC QUAN TRỌNG:
1. Chỉ dựa trên dữ liệu giao dịch được cung cấp để trả lời
2. Luôn trích dẫn các giao dịch cụ thể khi đưa ra nhận định (ví dụ: "Giao dịch số 5 cho thấy...")
3. Nếu dữ liệu không chứa thông tin để trả lời câu hỏi, hãy nói "Tôi không tìm thấy thông tin này trong dữ liệu được cung cấp"
4. Sử dụng số liệu chính xác và tránh khái quát hóa
5. Khi tính tổng hoặc trung bình, hãy trình bày các bước tính toán
6. Luôn trả lời bằng tiếng Việt
7. CHÚ Ý: Dữ liệu được định dạng dạng bảng với dấu | phân cách. Đếm số dòng để biết tổng số giao dịch.

DỮ LIỆU GIAO DỊCH:
${transactionData}

Khi trả lời câu hỏi:
- Bắt đầu với câu trả lời trực tiếp
- Cung cấp bằng chứng hỗ trợ với trích dẫn số thứ tự giao dịch
- Bao gồm các thống kê liên quan (tổng, trung bình, phần trăm)
- Ngắn gọn nhưng đầy đủ
`;
}

/**
 * Extract citations from AI response
 */
function extractCitations(response: string): string[] {
  const citations: string[] = [];

  // Look for patterns like "Transaction 5", "giao dịch 3", etc.
  const patterns = [
    /Transaction (\d+)/gi,
    /giao dịch (\d+)/gi,
    /tờ khai số (\d+)/gi,
  ];

  for (const pattern of patterns) {
    const matches = response.matchAll(pattern);
    for (const match of matches) {
      citations.push(match[0]);
    }
  }

  // Remove duplicates
  return Array.from(new Set(citations));
}

/**
 * Estimate confidence level based on response characteristics
 */
function estimateConfidence(
  response: string,
  citations: string[],
): "high" | "medium" | "low" {
  // High confidence: Multiple citations, specific numbers, no uncertainty phrases
  if (
    citations.length >= 3 &&
    /\d+/.test(response) &&
    !/không chắc|maybe|might|possibly|uncertain/i.test(response)
  ) {
    return "high";
  }

  // Low confidence: No citations or uncertainty phrases
  if (
    citations.length === 0 ||
    /không tìm thấy|cannot find|không có thông tin|no information/i.test(
      response,
    )
  ) {
    return "low";
  }

  // Medium confidence: everything else
  return "medium";
}

/**
 * Query handler class
 */
export class QueryHandler {
  private ollamaClient: OllamaClient;
  private model: string;

  constructor(model?: string) {
    this.ollamaClient = new OllamaClient();
    // Use environment variable or default based on NODE_ENV
    this.model =
      model ||
      process.env.AI_MODEL ||
      (process.env.NODE_ENV === "production"
        ? "deepseek-r1:8b"
        : "deepseek-r1:1.5b");
  }

  /**
   * Extract FilterExpression[] from user question using AI analysis
   * Analyzes natural language to identify field filters (company, country, category, date range, etc.)
   */
  async extractFilters(userQuestion: string): Promise<FilterExpression[]> {
    const systemPrompt = `You are a filter extraction system. Analyze the user's question and extract structured filters.

Transaction fields available:
- companyName: string (e.g., "CÔNG TY ABC", "XYZ Corporation")
- importCountry: string (e.g., "United States", "Vietnam", "China")
- categoryName: string (e.g., "Electronics", "Machinery", "Textiles")
- date: string (YYYY-MM-DD format)
- totalValueUSD: number (e.g., 50000.00)
- quantity: number
- unitPriceUSD: number

Operators supported:
- equals: exact match (supports synonyms)
- contains: substring match (supports synonyms)
- startsWith: prefix match
- greaterThan: numeric comparison >
- lessThan: numeric comparison <
- between: range [min, max]
- in: array membership

Return ONLY a valid JSON array of filter objects. Each filter must have:
{
  "field": "fieldName",
  "operator": "operatorName",
  "value": "stringOrNumberOrArray",
  "matchStrategy": "exact" | "fuzzy" | "case-insensitive" | "normalized",
  "fuzzyThreshold": 0-5 (optional, for fuzzy matching),
  "logicalOperator": "AND" | "OR" (optional, default AND)
}

Examples:
Question: "Show me US companies"
Response: [{"field":"importCountry","operator":"contains","value":"US","matchStrategy":"case-insensitive"}]

Question: "Electronics from Vietnam in Q1 2024"
Response: [{"field":"categoryName","operator":"contains","value":"Electronics","matchStrategy":"case-insensitive"},{"field":"importCountry","operator":"contains","value":"Vietnam","matchStrategy":"case-insensitive"},{"field":"date","operator":"between","value":["2024-01-01","2024-03-31"]}]

Question: "Companies with sales over $50,000"
Response: [{"field":"totalValueUSD","operator":"greaterThan","value":"50000"}]

If no filters can be extracted, return an empty array: []

Respond ONLY with the JSON array, no other text.`;

    try {
      const response = await this.ollamaClient.generate({
        model: this.model,
        prompt: `${systemPrompt}

Question: ${userQuestion}

Filters:`,
        stream: false,
        temperature: 0.3, // Lower temperature for more structured output
      });

      // Parse JSON response
      let filtersJson = response.response.trim();

      // Remove markdown code blocks if present
      filtersJson = filtersJson
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      // Extract JSON array if wrapped in text
      const jsonMatch = filtersJson.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        filtersJson = jsonMatch[0];
      }

      const filters = JSON.parse(filtersJson);

      // Validate each filter with Zod schema
      if (!Array.isArray(filters)) {
        console.warn(
          "[QueryHandler] extractFilters returned non-array:",
          filters,
        );
        return [];
      }

      const validatedFilters: FilterExpression[] = [];
      for (const filter of filters) {
        try {
          const validated = FilterExpressionSchema.parse(filter);
          validatedFilters.push(validated);
        } catch (validationError) {
          console.warn(
            "[QueryHandler] Invalid filter expression:",
            filter,
            validationError,
          );
        }
      }

      return validatedFilters;
    } catch (error) {
      console.error("[QueryHandler] Error extracting filters:", error);
      return [];
    }
  }

  /**
   * Detect if filtered data is insufficient for the query
   * Returns true if data is too sparse or missing key fields
   */
  detectDataInsufficiency(
    filteredTransactions: Array<Record<string, unknown>>,
    userQuestion: string,
  ): { insufficient: boolean; reason?: string } {
    // No transactions after filtering
    if (filteredTransactions.length === 0) {
      return {
        insufficient: true,
        reason: "No transactions match the specified criteria",
      };
    }

    // Very small sample size (< 3 transactions) for aggregation queries
    const isAggregationQuery =
      /tổng|trung bình|average|total|sum|count|bao nhiêu|có mấy/i.test(
        userQuestion,
      );
    if (isAggregationQuery && filteredTransactions.length < 3) {
      return {
        insufficient: true,
        reason: `Only ${filteredTransactions.length} transaction(s) available for aggregation analysis`,
      };
    }

    // Check for missing critical fields
    const hasCompanyNames = filteredTransactions.some((tx) => tx.companyName);
    const hasValues = filteredTransactions.some((tx) => tx.totalValueUSD);
    const hasCategories = filteredTransactions.some((tx) => tx.categoryName);

    if (!hasCompanyNames && !hasValues && !hasCategories) {
      return {
        insufficient: true,
        reason:
          "Filtered data lacks critical fields (company, value, or category)",
      };
    }

    return { insufficient: false };
  }

  /**
   * Classify user question into query type and extract intent
   * Uses pattern matching and AI to determine optimal data strategy
   */
  async classifyQueryIntent(userQuestion: string): Promise<QueryIntent> {
    // Pattern matching for common query types
    const aggregationPatterns =
      /tổng|trung bình|average|total|sum|count|bao nhiêu|có mấy|nhiều nhất|ít nhất|most|least|highest|lowest/i;
    const detailPatterns =
      /show|hiển thị|list|danh sách|top \d+|liệt kê|chi tiết|details?/i;
    const trendPatterns =
      /trend|xu hướng|theo thời gian|over time|growth|tăng trưởng|biến động|changes?/i;
    const comparisonPatterns =
      /so sánh|compare|versus|vs\.|khác nhau|difference|better|worse/i;
    const recommendationPatterns =
      /recommend|đề xuất|suggest|gợi ý|should|nên|advice|tư vấn/i;
    const rankingPatterns =
      /top|rank|xếp hạng|hàng đầu|leading|best|worst|tốt nhất|kém nhất/i;

    let type: QueryIntent["type"] = "detail"; // default
    let confidence = 0.5;

    // Classify by patterns
    if (aggregationPatterns.test(userQuestion)) {
      type = "aggregation";
      confidence = 0.8;
    } else if (trendPatterns.test(userQuestion)) {
      type = "trend";
      confidence = 0.8;
    } else if (comparisonPatterns.test(userQuestion)) {
      type = "comparison";
      confidence = 0.75;
    } else if (recommendationPatterns.test(userQuestion)) {
      type = "recommendation";
      confidence = 0.7;
    } else if (rankingPatterns.test(userQuestion)) {
      type = "ranking";
      confidence = 0.8;
    } else if (detailPatterns.test(userQuestion)) {
      type = "detail";
      confidence = 0.7;
    }

    // Extract filters (already implemented)
    const filters = await this.extractFilters(userQuestion);

    // Extract aggregations if type is aggregation or ranking
    let aggregations: QueryIntent["aggregations"];
    if (type === "aggregation" || type === "ranking") {
      aggregations = this.extractAggregationSpecs(userQuestion);
    }

    // Extract limit from question (e.g., "top 5", "10 companies")
    const limitMatch = userQuestion.match(
      /top (\d+)|(\d+) (công ty|companies|transactions|giao dịch|mặt hàng|goods)/i,
    );
    const limit = limitMatch
      ? parseInt(limitMatch[1] || limitMatch[2])
      : undefined;

    // Extract orderBy from question
    let orderBy: string | undefined;
    if (/nhiều nhất|most|highest|max|cao nhất/i.test(userQuestion)) {
      orderBy = "desc";
    } else if (/ít nhất|least|lowest|min|thấp nhất/i.test(userQuestion)) {
      orderBy = "asc";
    }

    return {
      type,
      filters,
      aggregations,
      limit,
      orderBy,
      confidence,
    };
  }

  /**
   * Extract aggregation specifications from user question
   * Identifies field, operation, and groupBy for aggregation queries
   */
  extractAggregationSpecs(userQuestion: string): Array<{
    field: string;
    operation: "count" | "sum" | "average" | "min" | "max";
    groupBy?: string;
  }> {
    const aggregations: Array<{
      field: string;
      operation: "count" | "sum" | "average" | "min" | "max";
      groupBy?: string;
    }> = [];

    // Detect operation type
    let operation: "count" | "sum" | "average" | "min" | "max" = "count";
    if (/tổng|total|sum/i.test(userQuestion)) {
      operation = "sum";
    } else if (/trung bình|average|mean/i.test(userQuestion)) {
      operation = "average";
    } else if (/nhiều nhất|most|max|highest|cao nhất/i.test(userQuestion)) {
      operation = "max";
    } else if (/ít nhất|least|min|lowest|thấp nhất/i.test(userQuestion)) {
      operation = "min";
    }

    // Detect field
    let field = "totalValueUSD"; // default
    if (/công ty|company|companies/i.test(userQuestion)) {
      field = "companyName";
    } else if (
      /mặt hàng|goods|category|categories|danh mục/i.test(userQuestion)
    ) {
      field = "categoryName";
    } else if (/quốc gia|country|countries/i.test(userQuestion)) {
      field = "importCountry";
    } else if (/giá trị|value/i.test(userQuestion)) {
      field = "totalValueUSD";
    } else if (/số lượng|quantity/i.test(userQuestion)) {
      field = "quantity";
    }

    // Detect groupBy
    let groupBy: string | undefined;
    if (/theo công ty|by company|per company/i.test(userQuestion)) {
      groupBy = "companyName";
    } else if (/theo mặt hàng|by category|per category/i.test(userQuestion)) {
      groupBy = "categoryName";
    } else if (/theo quốc gia|by country|per country/i.test(userQuestion)) {
      groupBy = "importCountry";
    } else if (/theo tháng|by month|per month/i.test(userQuestion)) {
      groupBy = "month";
    } else if (/theo năm|by year|per year/i.test(userQuestion)) {
      groupBy = "year";
    }

    aggregations.push({ field, operation, groupBy });

    return aggregations;
  }

  /**
   * Process a natural language query against session data
   */
  async processQuery(
    session: AISession,
    userQuestion: string,
  ): Promise<
    QueryResult & { filterLogs?: FilterLog[]; queryIntent?: QueryIntent }
  > {
    const startTime = Date.now();
    const filterLogs: FilterLog[] = [];

    try {
      // Classify query intent (US3)
      const queryIntent = await this.classifyQueryIntent(userQuestion);
      console.log(
        `[QueryHandler] Query intent: ${queryIntent.type} (confidence: ${queryIntent.confidence})`,
      );

      // Extract filters from query intent
      const filters = queryIntent.filters;

      // Apply filters if any were extracted
      let filteredTransactions = session.transactionData;
      if (filters.length > 0) {
        const filterStartTime = Date.now();

        filteredTransactions = executeFilters(
          session.transactionData as Array<Record<string, unknown>>,
          filters,
        );

        const filterExecutionTime = Date.now() - filterStartTime;

        // Update session filter view for iterative refinement (US2)
        updateFilterView(session.id, filteredTransactions, filters);

        // Log each filter execution with metadata (FR-012)
        filters.forEach((filter) => {
          const filterLog = {
            timestamp: new Date().toISOString(),
            filterExpression: filter,
            matchedCount: filteredTransactions.length,
            executionTimeMs: filterExecutionTime,
          };

          filterLogs.push(filterLog);

          // Persist to session context state
          addFilterLog(
            session.id,
            filter,
            filteredTransactions.length,
            session.transactionData.length,
            filterExecutionTime,
          );
        });

        console.log(
          `[QueryHandler] Applied ${filters.length} filters: ${session.transactionData.length} → ${filteredTransactions.length} transactions (${filterExecutionTime}ms)`,
        );
      }

      // Check for data insufficiency (US2)
      const insufficiencyCheck = this.detectDataInsufficiency(
        filteredTransactions,
        userQuestion,
      );
      if (insufficiencyCheck.insufficient) {
        return {
          answer: `Xin lỗi, dữ liệu sau khi lọc không đủ để trả lời câu hỏi của bạn. Lý do: ${insufficiencyCheck.reason}`,
          citations: [],
          confidence: "low",
          processingTime: Date.now() - startTime,
          filterLogs: filterLogs.length > 0 ? filterLogs : undefined,
        };
      }

      // Use aggregations for aggregation/ranking query types (US5)
      let transactionContext: string;
      if (
        queryIntent.type === "aggregation" ||
        queryIntent.type === "ranking"
      ) {
        // Compute aggregations instead of passing full transactions
        const aggregations = queryIntent.aggregations || [];

        // If no aggregations specified, infer from question
        if (aggregations.length === 0) {
          const inferredSpecs = this.extractAggregationSpecs(userQuestion);
          aggregations.push(...inferredSpecs);
        }

        // Convert to AggregationSpec format
        const aggSpecs: AggregationSpec[] = aggregations.map((agg) => ({
          field: agg.field,
          operation: agg.operation,
          groupBy: agg.groupBy,
        }));

        // Compute aggregations
        const aggResults = computeAggregations(filteredTransactions, aggSpecs);

        // Format aggregation results for AI (token-optimized)
        transactionContext = aggResults
          .map(formatAggregationForAI)
          .join("\n\n");

        console.log(
          `[QueryHandler] Using aggregations: ${aggSpecs.length} specs computed, ${transactionContext.length} bytes (vs ${JSON.stringify(filteredTransactions).length} bytes for full data)`,
        );
      } else {
        // Format filtered transaction data for context (detail/trend/comparison queries)
        transactionContext =
          formatTransactionDataForContext(filteredTransactions);
      }

      // Build system prompt
      const systemPrompt = buildSystemPrompt(transactionContext);

      // Build conversation history
      const conversationContext = session.conversationHistory
        .map(
          (msg) =>
            `${msg.role === "user" ? "Câu hỏi" : "Trả lời"}: ${msg.content}`,
        )
        .join("\n\n");

      // Combine system prompt, conversation history, and current question
      const fullPrompt = `${systemPrompt}

${conversationContext ? `Cuộc hội thoại trước:\n${conversationContext}\n\n` : ""}Câu hỏi hiện tại: ${userQuestion}

Trả lời:`;

      // Query Ollama using generate API
      const response = await this.ollamaClient.generate({
        model: this.model,
        prompt: fullPrompt,
        stream: false,
        temperature: 0.7,
      });

      const answer = response.response;

      // Extract citations
      const citations = extractCitations(answer);

      // Estimate confidence
      const confidence = estimateConfidence(answer, citations);

      const processingTime = Date.now() - startTime;

      return {
        answer,
        citations,
        confidence,
        processingTime,
        filterLogs: filterLogs.length > 0 ? filterLogs : undefined,
        queryIntent,
      };
    } catch (error) {
      console.error("[QueryHandler] Error processing query:", error);

      return {
        answer:
          "Xin lỗi, đã có lỗi xảy ra khi xử lý câu hỏi của bạn. Vui lòng thử lại.",
        citations: [],
        confidence: "low",
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate suggested queries based on data
   */
  async generateSuggestedQueries(session: AISession): Promise<string[]> {
    // If no data, return generic suggestions
    if (session.transactionData.length === 0) {
      return [
        "Công ty nào nhập khẩu nhiều nhất?",
        "Mặt hàng nào có giá trị xuất khẩu cao nhất?",
        "Tổng giá trị xuất khẩu là bao nhiêu?",
        "Có bao nhiêu giao dịch trong dữ liệu?",
      ];
    }

    // Analyze data to generate relevant suggestions
    const suggestions: string[] = [];

    // Extract unique companies
    const companies = new Set(
      session.transactionData
        .map((tx) => tx.companyName as string)
        .filter(Boolean),
    );

    // Extract unique categories
    const categories = new Set(
      session.transactionData
        .map((tx) => tx.categoryName as string)
        .filter(Boolean),
    );

    if (companies.size > 0) {
      suggestions.push(
        `Công ty nào nhập khẩu nhiều nhất trong ${companies.size} công ty?`,
      );
    }

    if (categories.size > 0) {
      suggestions.push(
        `Danh mục hàng hóa nào có giá trị xuất khẩu cao nhất trong ${categories.size} danh mục?`,
      );
    }

    suggestions.push(
      `Tổng giá trị xuất khẩu của ${session.transactionData.length} giao dịch là bao nhiêu?`,
    );

    suggestions.push("So sánh giá trị trung bình giữa các danh mục hàng hóa");

    suggestions.push("Xu hướng nhập khẩu theo thời gian thế nào?");

    return suggestions.slice(0, 5);
  }

  /**
   * Validate query before processing
   */
  validateQuery(query: string): { valid: boolean; error?: string } {
    if (!query || query.trim().length === 0) {
      return {
        valid: false,
        error: "Câu hỏi không được để trống",
      };
    }

    if (query.length > 1000) {
      return {
        valid: false,
        error: "Câu hỏi quá dài (tối đa 1000 ký tự)",
      };
    }

    return { valid: true };
  }
}

// Export singleton instance
export const queryHandler = new QueryHandler();
