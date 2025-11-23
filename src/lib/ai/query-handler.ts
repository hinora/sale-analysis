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
 * Note: Transactions are already limited to 10,000 in feed-data endpoint
 * Uses compact CSV format to fit more data within model context window
 */
function formatTransactionDataForContext(
  transactions: Array<Record<string, unknown>>,
): string {
  // Calculate aggregated statistics for context
  const stats = {
    totalTransactions: transactions.length,
    totalValue: transactions.reduce((sum, tx) => sum + (Number(tx.totalValueUSD) || 0), 0),
    companies: new Set(transactions.map(tx => tx.companyName).filter(Boolean)),
    categories: new Set(transactions.map(tx => tx.categoryName).filter(Boolean)),
    countries: new Set(transactions.map(tx => tx.importCountry).filter(Boolean)),
    dateRange: {
      earliest: transactions.reduce((min, tx) => {
        const date = new Date(tx.date as string);
        return !min || date < min ? date : min;
      }, null as Date | null),
      latest: transactions.reduce((max, tx) => {
        const date = new Date(tx.date as string);
        return !max || date > max ? date : max;
      }, null as Date | null),
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
- Khoảng thời gian: ${stats.dateRange.earliest?.toISOString().split('T')[0]} đến ${stats.dateRange.latest?.toISOString().split('T')[0]}

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
      );

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
