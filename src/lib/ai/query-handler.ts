/**
 * AI Query Handler
 *
 * Formats prompts and processes natural language queries against transaction data
 * using Ollama LLM with grounded, citation-based responses
 */

import { OllamaClient } from "./ollama-client";
import type { AISession } from "./session-manager";
import type { FilterExpression } from "./filter-engine";
import { executeFilters } from "./filter-engine";
import {
  computeAggregations,
  formatAggregationForAI,
  type AggregationSpec,
} from "./aggregation-engine";
import type {
  IterationConfiguration,
  IterativeQueryResponse,
  DataValidationResult,
  IterativeQuerySession,
} from "../../types/iterative-ai";
import {
  DEFAULT_ITERATION_CONFIG,
  createIterativeSession,
  trackQueryRequest,
  shouldContinueIteration,
  completeSession,
  failSession,
} from "./iterative-session";
import { validateDataQuality } from "./data-validator";

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
      transactions.map((tx) => tx.importCompanyName).filter(Boolean),
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
      return `${index + 1}|${tx.declarationNumber}|${tx.date}|${tx.importCompanyName}|${tx.importCompanyAddress}|${tx.importCountry}|${tx.goodsName}|${tx.goodsShortName}|${tx.categoryName}|${tx.quantity} ${tx.unit}|$${tx.unitPriceUSD}|$${tx.totalValueUSD}`;
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

ĐỊNH DẠNG DỮ LIỆU: STT|Số tờ khai|Ngày|Công ty nhập khẩu|Địa chỉ công ty nhập khẩu|Nước nhập khẩu|Tên hàng hóa|Tên rút gọn|Danh mục|Số lượng|Đơn giá|Tổng giá trị

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
    // Use environment variable or default
    this.model = model || process.env.AI_MODEL || "deepseek-r1:1.5b";
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

  /**
   * Process iterative query with AI-driven data exploration
   *
   * @param session - AI session with transaction data
   * @param userQuestion - Original user question
   * @param config - Iteration configuration
   * @returns Final answer with iteration details
   */
  async processIterativeQuery(
    session: AISession,
    userQuestion: string,
    config?: Partial<IterationConfiguration>,
  ): Promise<IterativeQueryResponse> {
    console.log(
      `[IterativeQuery] Starting iterative query processing for: "${userQuestion.substring(0, 100)}..."`,
    );

    // Create iterative session
    const iterativeSession = createIterativeSession(userQuestion, config);
    console.log(
      `[IterativeQuery] Created session: ${iterativeSession.sessionId}`,
    );

    let currentValidation: DataValidationResult = this.initializeValidation();

    try {
      // Iteration loop
      const currentData: Array<{
        iteration: number;
        queryIntent: QueryIntent;
        result: QueryResult;
        validation: DataValidationResult;
      }> = [];
      let finalAnswer = "";

      while (true) {
        const iterationStartTime = Date.now();
        console.log(
          `[IterativeQuery] Starting iteration ${iterativeSession.iterationCount + 1}`,
        );

        // Generate QueryIntent using AI analysis
        const queryIntent = await this.generateQueryIntentForIteration(
          userQuestion,
          iterativeSession,
          currentData,
        );

        console.log(
          `[IterativeQuery] Iteration ${iterativeSession.iterationCount + 1}: ${queryIntent.type} intent with ${queryIntent.filters?.length || 0} filters`,
          queryIntent,
        );

        // Process data based on QueryIntent
        const { filteredTransactions, contextForAI } =
          await this.processDataWithQueryIntent(
            session.transactionData as Array<Record<string, unknown>>,
            queryIntent,
            userQuestion,
          );

        // Generate AI response
        const queryResult = await this.generateAIResponse(
          contextForAI,
          userQuestion,
          queryIntent,
          iterationStartTime,
        );

        // Validate and track the iteration
        const validation = this.validateAndTrackIteration(
          queryResult,
          queryIntent,
          filteredTransactions,
          iterativeSession,
          currentData,
        );

        currentValidation = validation;

        // Check if we should continue iterating
        const continueDecision = shouldContinueIteration(
          iterativeSession.sessionId,
          validation,
          { ...DEFAULT_ITERATION_CONFIG, ...config },
        );

        console.log(
          `[IterativeQuery] Continue decision: ${continueDecision.shouldContinue}, reason: ${continueDecision.reason}`,
        );

        if (!continueDecision.shouldContinue) {
          // Session complete - generate final answer
          console.log(
            `[IterativeQuery] Generating final answer from ${currentData.length} iterations`,
          );
          finalAnswer = await this.generateFinalAnswer(
            userQuestion,
            currentData,
          );

          const completedSession = completeSession(
            iterativeSession.sessionId,
            finalAnswer,
            continueDecision.reason,
          );

          if (!completedSession) {
            throw new Error("Failed to complete session");
          }

          console.log(`[IterativeQuery] Session completed successfully`);
          return {
            success: true,
            session: completedSession,
            validation: validation,
            needsMoreData: false,
            answer: finalAnswer,
          };
        }

        // Continue iteration with updated context
        console.log(
          `[IterativeQuery] Continuing iteration: ${continueDecision.reason}`,
        );
      }
    } catch (error) {
      console.error("[IterativeQuery] Error during iterative processing:", {
        error: error instanceof Error ? error.message : String(error),
        sessionId: iterativeSession.sessionId,
        iterationCount: iterativeSession.iterationCount,
        userQuestion: userQuestion.substring(0, 100),
      });

      const failedSession = failSession(
        iterativeSession.sessionId,
        String(error),
        "Processing error",
      );

      if (!failedSession) {
        console.error("Failed to update session with error state");
      }

      return {
        success: false,
        session: failedSession || iterativeSession,
        validation: currentValidation || this.initializeValidation(),
        needsMoreData: false,
        error: {
          type: "application_error",
          message: String(error),
        },
      };
    }
  }

  /**
   * Initialize validation result structure
   */
  private initializeValidation(): DataValidationResult {
    return {
      isSufficient: false,
      isComplete: false,
      isValid: false,
      recordCount: 0,
      missingFields: [],
      issues: [],
      suggestions: [],
      confidence: 0,
    };
  }

  /**
   * Process transaction data based on QueryIntent
   */
  private async processDataWithQueryIntent(
    transactionData: Array<Record<string, unknown>>,
    queryIntent: QueryIntent,
    userQuestion: string,
  ): Promise<{
    filteredTransactions: Array<Record<string, unknown>>;
    contextForAI: string;
  }> {
    console.log(
      `[IterativeQuery] Processing ${transactionData.length} transactions with QueryIntent`,
    );

    let filteredTransactions = [...transactionData];

    // Apply filters to reduce dataset size
    if (queryIntent.filters && queryIntent.filters.length > 0) {
      console.log(
        `[IterativeQuery] Applying ${queryIntent.filters.length} filters:`,
        queryIntent.filters.map((f) => `${f.field} ${f.operator} ${f.value}`),
      );
      filteredTransactions = executeFilters(
        filteredTransactions,
        queryIntent.filters,
      );
      console.log(
        `[IterativeQuery] Filtered: ${transactionData.length} → ${filteredTransactions.length} transactions`,
      );
    }

    // Apply sorting if specified
    if (queryIntent.orderBy && typeof queryIntent.orderBy === "string") {
      filteredTransactions = this.applySorting(
        filteredTransactions,
        queryIntent,
        userQuestion,
      );
    }

    // Apply limit if specified
    if (queryIntent.limit && queryIntent.limit > 0) {
      const beforeLimit = filteredTransactions.length;
      filteredTransactions = filteredTransactions.slice(0, queryIntent.limit);
      console.log(
        `[IterativeQuery] Limited: ${beforeLimit} → ${filteredTransactions.length} transactions (limit: ${queryIntent.limit})`,
      );
    }

    // Generate context based on query type
    const contextForAI = this.generateContextForAI(
      filteredTransactions,
      queryIntent,
    );

    return { filteredTransactions, contextForAI };
  }

  /**
   * Apply sorting to transactions
   */
  private applySorting(
    transactions: Array<Record<string, unknown>>,
    queryIntent: QueryIntent,
    userQuestion: string,
  ): Array<Record<string, unknown>> {
    const sortField = queryIntent.orderBy as string;
    const sortDirection =
      queryIntent.type === "ranking" ||
      /most|highest|top|max/i.test(userQuestion)
        ? "desc"
        : "asc";

    console.log(`[IterativeQuery] Sorting by ${sortField} (${sortDirection})`);

    const sorted = [...transactions].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      // Handle numeric sorting
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
      }

      // Handle string sorting
      const aStr = String(aVal || "");
      const bStr = String(bVal || "");
      const comparison = aStr.localeCompare(bStr);
      return sortDirection === "desc" ? -comparison : comparison;
    });

    console.log(
      `[IterativeQuery] Sorted ${transactions.length} transactions by ${sortField}`,
    );
    return sorted;
  }

  /**
   * Generate AI context based on query type and data
   */
  private generateContextForAI(
    filteredTransactions: Array<Record<string, unknown>>,
    queryIntent: QueryIntent,
  ): string {
    let contextForAI: string;

    if (
      queryIntent.type === "aggregation" &&
      queryIntent.aggregations &&
      queryIntent.aggregations.length > 0
    ) {
      // Use aggregation for compact summary
      console.log(
        `[IterativeQuery] Computing ${queryIntent.aggregations.length} aggregations for ${filteredTransactions.length} transactions`,
      );

      const aggregationSpecs: AggregationSpec[] = queryIntent.aggregations.map(
        (agg) => ({
          field: agg.field,
          operation: agg.operation,
          groupBy: agg.groupBy,
        }),
      );

      const aggregationResults = computeAggregations(
        filteredTransactions,
        aggregationSpecs,
      );

      // Format aggregations for AI context (much more compact than raw transactions)
      const aggregationContext = aggregationResults
        .map((result) => formatAggregationForAI(result))
        .join("\n\n");

      contextForAI = `TỔNG HỢP DỮ LIỆU (${filteredTransactions.length} giao dịch):\n${aggregationContext}`;
      console.log(
        `[IterativeQuery] Generated aggregation context: ${contextForAI.length} characters, ${aggregationResults.length} aggregations`,
      );
    } else {
      // Use filtered transaction details for other query types
      contextForAI = formatTransactionDataForContext(filteredTransactions);
      console.log(
        `[IterativeQuery] Generated transaction context: ${contextForAI.length} characters for ${filteredTransactions.length} transactions`,
      );
    }

    return contextForAI;
  }

  /**
   * Generate AI response based on context and query intent
   */
  private async generateAIResponse(
    contextForAI: string,
    userQuestion: string,
    queryIntent: QueryIntent,
    iterationStartTime: number,
  ): Promise<QueryResult> {
    console.log(
      `[IterativeQuery] Generating AI response with context size: ${contextForAI.length} characters`,
    );

    const systemPrompt = buildSystemPrompt(contextForAI);
    const fullPrompt = `${systemPrompt}

Câu hỏi: ${userQuestion}
Loại truy vấn: ${queryIntent.type}
Bộ lọc đã áp dụng: ${JSON.stringify(queryIntent.filters)}
${queryIntent.aggregations ? `Tổng hợp đã tính: ${JSON.stringify(queryIntent.aggregations)}` : ""}

Trả lời:`;

    console.log(
      `[IterativeQuery] Full prompt size: ${fullPrompt.length} characters`,
    );

    const response = await this.ollamaClient.generate({
      model: this.model,
      prompt: fullPrompt,
      stream: false,
      temperature: 0.7,
    });

    const queryResult: QueryResult = {
      answer: response.response,
      citations: extractCitations(response.response),
      confidence: estimateConfidence(
        response.response,
        extractCitations(response.response),
      ),
      processingTime: Date.now() - iterationStartTime,
    };

    console.log(
      `[IterativeQuery] AI response generated: ${queryResult.answer.length} characters, ${queryResult.citations.length} citations, confidence: ${queryResult.confidence}, time: ${queryResult.processingTime}ms`,
    );

    return queryResult;
  }

  /**
   * Validate iteration results and track the query request
   */
  private validateAndTrackIteration(
    queryResult: QueryResult,
    queryIntent: QueryIntent,
    filteredTransactions: Array<Record<string, unknown>>,
    iterativeSession: IterativeQuerySession,
    currentData: Array<{
      iteration: number;
      queryIntent: QueryIntent;
      result: QueryResult;
      validation: DataValidationResult;
    }>,
  ): DataValidationResult {
    console.log(
      `[IterativeQuery] Validating iteration with ${filteredTransactions.length} filtered transactions`,
    );

    // Validate data quality
    const expectedFields = queryIntent.aggregations
      ? queryIntent.aggregations.map((agg) => agg.field)
      : ["totalValueUSD", "importCompanyName", "categoryName"];
    const validation = validateDataQuality(queryResult, expectedFields);
    validation.recordCount = filteredTransactions.length;

    console.log(
      `[IterativeQuery] Validation result: sufficient=${validation.isSufficient}, complete=${validation.isComplete}, valid=${validation.isValid}, confidence=${validation.confidence}`,
    );

    if (validation.issues && validation.issues.length > 0) {
      console.log(`[IterativeQuery] Validation issues:`, validation.issues);
    }

    if (validation.suggestions && validation.suggestions.length > 0) {
      console.log(
        `[IterativeQuery] Validation suggestions:`,
        validation.suggestions,
      );
    }

    const processingTime = queryResult.processingTime;

    // Track this iteration
    const compatibleQueryIntent = {
      type: queryIntent.type,
      filters: queryIntent.filters,
      aggregations: queryIntent.aggregations,
      limit: queryIntent.limit,
      orderBy: queryIntent.orderBy
        ? { field: queryIntent.orderBy, direction: "desc" as const }
        : undefined,
      confidence: queryIntent.confidence,
    };

    const updatedSession = trackQueryRequest(
      iterativeSession.sessionId,
      compatibleQueryIntent,
      queryResult,
      validation,
      `Iteration ${iterativeSession.iterationCount + 1}: Exploring ${queryIntent.type} data`,
      processingTime,
    );

    if (!updatedSession) {
      console.error("[IterativeQuery] Failed to track query request");
      throw new Error("Failed to track query request");
    }

    console.log(
      `[IterativeQuery] Successfully tracked iteration ${iterativeSession.iterationCount}`,
    );

    // Update current data with new information
    if (validation.recordCount > 0) {
      currentData.push({
        iteration: iterativeSession.iterationCount,
        queryIntent,
        result: queryResult,
        validation,
      });
      console.log(
        `[IterativeQuery] Added iteration data, total iterations: ${currentData.length}`,
      );
    } else {
      console.log(`[IterativeQuery] Skipping iteration data (no records)`);
    }

    return validation;
  }

  /**
   * Generate QueryIntent for current iteration based on user question and previous data
   */
  private async generateQueryIntentForIteration(
    userQuestion: string,
    _iterativeSession: IterativeQuerySession,
    currentData: Array<{
      iteration: number;
      queryIntent: QueryIntent;
      result: QueryResult;
      validation: DataValidationResult;
    }>,
  ): Promise<QueryIntent> {
    // Build context from previous iterations
    const iterationContext = currentData
      .map(
        (data, index) =>
          `Iteration ${index + 1}: ${data.queryIntent.type} query returned ${data.validation.recordCount} records`,
      )
      .join("\n");

    const systemPrompt = this.buildIterativeSystemPrompt();

    const prompt = `${systemPrompt}

Câu hỏi người dùng: ${userQuestion}

Các lần lặp trước đó:
${iterationContext || "Không có - đây là lần lặp đầu tiên"}

Trạng thái hiện tại: Cần thu thập dữ liệu ${currentData.length === 0 ? "ban đầu" : "bổ sung"} để trả lời câu hỏi.

Tạo một cấu trúc QueryIntent để yêu cầu dữ liệu cần thiết từ ứng dụng.
Chỉ trả lời bằng một đối tượng JSON QueryIntent hợp lệ:`;

    try {
      const response = await this.ollamaClient.generate({
        model: this.model,
        prompt,
        stream: false,
        temperature: 0.3,
      });

      // Parse the AI response to extract QueryIntent
      const queryIntent = this.parseQueryIntentFromResponse(response.response);
      return queryIntent;
    } catch (error) {
      console.error("[IterativeQuery] Error generating QueryIntent:", error);

      // Fallback to basic intent
      return {
        type: "detail",
        filters: [],
        confidence: 0.5,
        limit: 50,
      };
    }
  }

  /**
   * Build system prompt with QueryIntent tool documentation for iterative processing
   */
  private buildIterativeSystemPrompt(): string {
    return `Bạn là hệ thống AI khám phá dữ liệu giao dịch thông qua cấu trúc QueryIntent. Vai trò của bạn là tạo các yêu cầu dữ liệu để thu thập thông tin cần thiết cho việc trả lời câu hỏi của người dùng.

CÔNG CỤ QUERYINTENT KHẢ DỤNG:

**Các trường giao dịch khả dụng:**
1. declarationNumber: string (ví dụ: "DEC-2024-001", "VN123456")
2. date: string (định dạng YYYY-MM-DD, ví dụ: "2024-01-15")
3. importCompanyName: string (ví dụ: "CÔNG TY ABC", "XYZ Corporation")
4. importCompanyAddress: string (ví dụ: "123 Main St, Hanoi")
5. importCountry: string (ví dụ: "United States", "Vietnam", "China")
6. goodsName: string (ví dụ: "Laptop Dell Inspiron 15")
7. quantity: number (ví dụ: 100, 500)
8. unit: string (ví dụ: "pcs", "kg", "cái", "chiếc")
9. unitPriceUSD: number (ví dụ: 299.99, 1500.50)
10. totalValueUSD: number (ví dụ: 50000.00, 125000.00)

**Cấu trúc QueryIntent:**
{
  "type": "aggregation" | "detail" | "trend" | "comparison" | "recommendation" | "ranking",
  "filters": FilterExpression[],
  "aggregations": AggregationSpec[] (tùy chọn),
  "limit": number (tùy chọn),
  "orderBy": { "field": string, "direction": "asc" | "desc" } (tùy chọn),
  "confidence": number (0-1)
}

**Cấu trúc FilterExpression:**
{
  "field": string,
  "operator": "equals" | "contains" | "startsWith" | "greaterThan" | "lessThan" | "between" | "in",
  "value": string | number | Array,
  "matchStrategy": "exact" | "fuzzy" | "case-insensitive" | "normalized" (tùy chọn),
  "fuzzyThreshold": number (tùy chọn, 0-5),
  "logicalOperator": "AND" | "OR" (tùy chọn)
}

**Cấu trúc AggregationSpec:**
{
  "field": string,
  "operation": "count" | "sum" | "average" | "min" | "max",
  "groupBy": string (tùy chọn)
}

**Ví dụ các yêu cầu QueryIntent:**

Yêu cầu dữ liệu rộng ban đầu:
{
  "type": "aggregation",
  "filters": [],
  "aggregations": [{"field": "totalValueUSD", "operation": "sum", "groupBy": "importCountry"}],
  "limit": 10,
  "confidence": 0.8
}

Yêu cầu lọc cụ thể:
{
  "type": "detail",
  "filters": [
    {
      "field": "goodsName",
      "operator": "contains",
      "value": "Laptop",
      "matchStrategy": "case-insensitive"
    }
  ],
  "limit": 50,
  "confidence": 0.9
}

Bạn nên thực hiện nhiều yêu cầu QueryIntent cho đến khi có đủ dữ liệu để trả lời câu hỏi của người dùng một cách toàn diện.`;
  }

  /**
   * Parse QueryIntent from AI response
   */
  private parseQueryIntentFromResponse(response: string): QueryIntent {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Không tìm thấy JSON trong phản hồi");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate basic structure
      if (!parsed.type || !Array.isArray(parsed.filters)) {
        throw new Error("Cấu trúc QueryIntent không hợp lệ");
      }

      return {
        type: parsed.type,
        filters: parsed.filters || [],
        aggregations: parsed.aggregations,
        limit: parsed.limit,
        orderBy: parsed.orderBy,
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      console.error("[IterativeQuery] Failed to parse QueryIntent:", error);

      // Return fallback QueryIntent
      return {
        type: "detail",
        filters: [],
        confidence: 0.3,
      };
    }
  }

  /**
   * Generate final comprehensive answer from all collected data
   */
  private async generateFinalAnswer(
    userQuestion: string,
    collectedData: Array<{
      iteration: number;
      queryIntent: QueryIntent;
      result: QueryResult;
      validation: DataValidationResult;
    }>,
  ): Promise<string> {
    // Prepare context from all iterations
    const dataContext = collectedData
      .map(
        (data, index) =>
          `Data from iteration ${index + 1} (${data.queryIntent.type}): ${data.result.answer}`,
      )
      .join("\n\n");

    const prompt = `Dựa trên dữ liệu sau được thu thập qua nhiều truy vấn, hãy đưa ra câu trả lời toàn diện cho câu hỏi của người dùng.

Câu hỏi người dùng: ${userQuestion}

Dữ liệu đã thu thập:
${dataContext}

Hãy đưa ra câu trả lời toàn diện, có cấu trúc tốt, tổng hợp tất cả thông tin đã thu thập:`;

    try {
      const response = await this.ollamaClient.generate({
        model: this.model,
        prompt,
        stream: false,
        temperature: 0.7,
      });

      return response.response;
    } catch (error) {
      console.error("[IterativeQuery] Error generating final answer:", error);
      return `Dựa trên ${collectedData.length} truy vấn dữ liệu, tôi đã thu thập thông tin để trả lời câu hỏi của bạn, nhưng gặp lỗi trong việc tổng hợp cuối cùng. Vui lòng xem lại các kết quả truy vấn riêng lẻ để có thêm thông tin chi tiết.`;
    }
  }
}

// Export singleton instance
export const queryHandler = new QueryHandler();
