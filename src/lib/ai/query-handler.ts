/**
 * AI Query Handler
 * 
 * Formats prompts and processes natural language queries against transaction data
 * using Ollama LLM with grounded, citation-based responses
 */

import { OllamaClient } from "./ollama-client";
import type { AISession } from "./session-manager";

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
 * Format transaction data for AI context
 */
function formatTransactionDataForContext(
  transactions: Array<Record<string, unknown>>,
  maxTransactions = 100,
): string {
  // Sample transactions if too many
  const sampleTransactions =
    transactions.length > maxTransactions
      ? transactions.slice(0, maxTransactions)
      : transactions;

  // Format as structured data
  const formatted = sampleTransactions
    .map((tx, index) => {
      return `Transaction ${index + 1}:
- Company: ${tx.companyName || "N/A"}
- Goods: ${tx.goodsName || "N/A"}
- Category: ${tx.categoryName || "N/A"}
- Quantity: ${tx.quantity || 0} ${tx.unit || ""}
- Unit Price: $${tx.unitPriceUSD || 0}
- Total Value: $${tx.totalValueUSD || 0}
- Date: ${tx.date || "N/A"}
`;
    })
    .join("\n");

  const summary = `
Dataset Summary:
- Total transactions: ${transactions.length}
- Transactions shown: ${sampleTransactions.length}
- Data coverage: ${transactions.length > maxTransactions ? `Sampled (${maxTransactions} of ${transactions.length})` : "Complete"}
`;

  return summary + "\n" + formatted;
}

/**
 * Build system prompt for grounded analysis
 */
function buildSystemPrompt(transactionData: string): string {
  return `You are an expert data analyst specializing in export/import trade data analysis. You have been provided with a dataset of export transactions.

IMPORTANT RULES:
1. Base your answers ONLY on the provided transaction data
2. Always cite specific transactions when making claims (e.g., "Transaction 5 shows...")
3. If the data doesn't contain information to answer the question, say "I cannot find this information in the provided data"
4. Use precise numbers and avoid generalizations
5. When calculating totals or averages, show your work
6. Respond in Vietnamese when appropriate based on the question language

TRANSACTION DATA:
${transactionData}

When answering questions:
- Start with a direct answer
- Provide supporting evidence with transaction citations
- Include relevant statistics (totals, averages, percentages)
- Be concise but thorough
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
    this.model = model || process.env.AI_MODEL || 
      (process.env.NODE_ENV === "production" ? "deepseek-r1:14b" : "deepseek-r1:1.5b");
  }

  /**
   * Process a natural language query against session data
   */
  async processQuery(
    session: AISession,
    userQuestion: string,
  ): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      // Format transaction data for context
      const transactionContext = formatTransactionDataForContext(
        session.transactionData,
        200, // Increase sample size for better analysis
      );

      // Build system prompt
      const systemPrompt = buildSystemPrompt(transactionContext);

      // Build conversation history
      const conversationContext = session.conversationHistory
        .map((msg) => `${msg.role === "user" ? "Question" : "Answer"}: ${msg.content}`)
        .join("\n\n");

      // Combine system prompt, conversation history, and current question
      const fullPrompt = `${systemPrompt}

${conversationContext ? `Previous conversation:\n${conversationContext}\n\n` : ""}Current question: ${userQuestion}

Answer:`;

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
      };
    } catch (error) {
      console.error("[QueryHandler] Error processing query:", error);

      return {
        answer: "Xin lỗi, đã có lỗi xảy ra khi xử lý câu hỏi của bạn. Vui lòng thử lại.",
        citations: [],
        confidence: "low",
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate suggested queries based on data
   */
  async generateSuggestedQueries(
    session: AISession,
  ): Promise<string[]> {
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

    suggestions.push(
      "So sánh giá trị trung bình giữa các danh mục hàng hóa",
    );

    suggestions.push(
      "Xu hướng nhập khẩu theo thời gian thế nào?",
    );

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
