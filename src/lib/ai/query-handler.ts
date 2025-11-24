/**
 * AI Query Handler
 *
 * Formats prompts and processes natural language queries against transaction data
 * using Ollama LLM with grounded, citation-based responses.
 * Supports both traditional (load all data) and RAG-based (retrieval) approaches.
 */

import { OllamaClient } from "./ollama-client";
import type { AISession, AIMessage } from "./session-manager";
import { generateQueryEmbedding } from "./retrieval/embedder";
import { retrieve } from "./retrieval/retriever";

/**
 * Query result with response and citations
 */
export interface QueryResult {
  answer: string;
  citations: string[];
  confidence: "high" | "medium" | "low";
  processingTime: number;
  retrievalMetadata?: {
    retrievedCount: number;
    totalAvailable: number;
    avgSimilarityScore?: number;
    threshold?: number;
  };
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
function buildSystemPrompt(transactionData: string, isRAG = false): string {
  const ragInstructions = isRAG
    ? `
CHÚ Ý ĐẶC BIỆT VỚI DỮ LIỆU ĐÃ LỌC:
- Dữ liệu này đã được lọc dựa trên độ liên quan đến câu hỏi
- Mỗi giao dịch có số thứ tự (STT) - BẮT BUỘC trích dẫn STT khi phân tích
- Ví dụ trích dẫn đúng: "Dựa vào giao dịch số 3 và số 7, ta thấy..."
- KHÔNG được nói về dữ liệu ngoài các STT được cung cấp
`
    : `
7. CHÚ Ý: Dữ liệu được định dạng dạng bảng với dấu | phân cách. Đếm số dòng để biết tổng số giao dịch.
`;

  return `Bạn là chuyên gia phân tích dữ liệu chuyên về phân tích dữ liệu thương mại xuất/nhập khẩu. Bạn được cung cấp một tập dữ liệu các giao dịch xuất khẩu.

QUY TẮC QUAN TRỌNG:
1. Chỉ dựa trên dữ liệu giao dịch được cung cấp để trả lời
2. Luôn trích dẫn các giao dịch cụ thể khi đưa ra nhận định (ví dụ: "Giao dịch số 5 cho thấy...")
3. Nếu dữ liệu không chứa thông tin để trả lời câu hỏi, hãy nói "Tôi không tìm thấy thông tin này trong dữ liệu được cung cấp"
4. Sử dụng số liệu chính xác và tránh khái quát hóa
5. Khi tính tổng hoặc trung bình, hãy trình bày các bước tính toán
6. Luôn trả lời bằng tiếng Việt${ragInstructions}

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
 *
 * @param response - AI response text
 * @param retrievedTransactionIds - Optional list of valid transaction IDs from retrieval
 * @returns Array of citation strings found in the response
 */
function extractCitations(
  response: string,
  retrievedTransactionIds?: string[],
): string[] {
  const citations: string[] = [];
  const citationNumbers = new Set<number>();

  // Look for patterns like "Transaction 5", "giao dịch 3", "STT 7", etc.
  const patterns = [
    /Transaction (\d+)/gi,
    /giao dịch (\d+)/gi,
    /tờ khai số (\d+)/gi,
    /STT[:\s]*(\d+)/gi,
    /số (\d+)/gi,
  ];

  for (const pattern of patterns) {
    const matches = response.matchAll(pattern);
    for (const match of matches) {
      const citationNum = Number.parseInt(match[1], 10);

      // If we have retrieved transaction IDs, validate citation is within range
      if (retrievedTransactionIds) {
        if (citationNum >= 1 && citationNum <= retrievedTransactionIds.length) {
          citationNumbers.add(citationNum);
          citations.push(match[0]);
        }
      } else {
        citationNumbers.add(citationNum);
        citations.push(match[0]);
      }
    }
  }

  // Remove duplicates while preserving order
  return Array.from(new Set(citations));
}

/**
 * Summarize conversation history for context (last 3 Q&A pairs)
 *
 * @param conversationHistory - Full conversation history
 * @returns Summarized context string
 */
function summarizeConversationContext(
  conversationHistory: AIMessage[],
): string {
  // Get last 3 Q&A pairs (6 messages)
  const recentMessages = conversationHistory.slice(-6);

  if (recentMessages.length === 0) {
    return "";
  }

  const summary = recentMessages
    .map((msg) => {
      const label = msg.role === "user" ? "Q" : "A";
      // Truncate long messages to first 200 chars
      const content =
        msg.content.length > 200
          ? msg.content.substring(0, 200) + "..."
          : msg.content;
      return `${label}: ${content}`;
    })
    .join("\n");

  return summary;
}

/**
 * Extract entities (company names, categories, products) from conversation history
 *
 * @param conversationHistory - Full conversation history
 * @returns Object with extracted entities
 */
function extractEntitiesFromHistory(conversationHistory: AIMessage[]): {
  companies: string[];
  categories: string[];
  products: string[];
} {
  const companies = new Set<string>();
  const categories = new Set<string>();
  const products = new Set<string>();

  // Patterns to detect entities
  const companyPatterns = [
    /công ty ([A-ZẮẰẲẴẶẤẦẨẪẬÁÀẢÃẠ][\wĐđ\s]+)/gi,
    /([A-ZẮẰẲẴẶẤẦẨẪẬÁÀẢÃẠ][\wĐđ]+\s+(?:Corp|Ltd|Inc|Co|Company|Corporation))/gi,
  ];

  const categoryPatterns = [/danh mục ([\wĐđ\s]+)/gi, /category ([\w\s]+)/gi];

  // Extract from recent messages (last 5)
  const recentMessages = conversationHistory.slice(-5);
  const combinedText = recentMessages.map((m) => m.content).join(" ");

  // Extract companies
  for (const pattern of companyPatterns) {
    const matches = combinedText.matchAll(pattern);
    for (const match of matches) {
      const company = match[1].trim();
      if (company.length > 2) {
        companies.add(company);
      }
    }
  }

  // Extract categories
  for (const pattern of categoryPatterns) {
    const matches = combinedText.matchAll(pattern);
    for (const match of matches) {
      const category = match[1].trim();
      if (category.length > 2) {
        categories.add(category);
      }
    }
  }

  return {
    companies: Array.from(companies).slice(0, 5), // Limit to top 5
    categories: Array.from(categories).slice(0, 5),
    products: Array.from(products).slice(0, 5),
  };
}

/**
 * Detect conversational references ("it", "they", "that company", etc.)
 *
 * @param query - User query
 * @returns True if query contains conversational references
 */
function hasConversationalReferences(query: string): boolean {
  const patterns = [
    /\b(it|its|that|those|these|them|they|their)\b/i,
    /\b(nó|đó|những|các|họ|công ty đó|sản phẩm đó)\b/i,
    /\b(first|second|third|last|previous|above|mentioned)\b/i,
    /\b(đầu tiên|thứ hai|thứ ba|cuối|trước|trên|đã nói)\b/i,
  ];

  return patterns.some((pattern) => pattern.test(query));
}

/**
 * Estimate confidence level based on response characteristics
 */
function estimateConfidence(
  response: string,
  citations: string[],
  similarityScores?: number[],
): "high" | "medium" | "low" {
  // Calculate average similarity score if available (RAG mode)
  const avgSimilarity = similarityScores?.length
    ? similarityScores.reduce((sum, score) => sum + score, 0) /
      similarityScores.length
    : null;

  // Low confidence: No citations, uncertainty phrases, or low similarity scores
  if (
    citations.length === 0 ||
    /không tìm thấy|cannot find|không có thông tin|no information/i.test(
      response,
    ) ||
    (avgSimilarity !== null && avgSimilarity < 0.7)
  ) {
    return "low";
  }

  // High confidence: Multiple citations, specific numbers, no uncertainty, high similarity
  if (
    citations.length >= 3 &&
    /\d+/.test(response) &&
    !/không chắc|maybe|might|possibly|uncertain/i.test(response) &&
    (avgSimilarity === null || avgSimilarity >= 0.85)
  ) {
    return "high";
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
   * Process a natural language query using RAG (Retrieval-Augmented Generation)
   * Only retrieves relevant transactions instead of loading all data
   */
  /**
   * Process query with RAG retrieval (User Story 1 + 3)
   * Enhanced with conversation context support
   */
  async processQueryWithRetrieval(
    session: AISession,
    userQuestion: string,
    topK = 50,
    threshold = 0.7,
  ): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      console.log(
        `[QueryHandler] Processing RAG query for session ${session.id}`,
      );

      // T053-T055: Extract conversation context if present
      let contextSummary = "";
      let entities = {
        companies: [] as string[],
        categories: [] as string[],
        products: [] as string[],
      };

      if (session.conversationHistory.length > 0) {
        // Check if query has conversational references
        const hasReferences = hasConversationalReferences(userQuestion);

        if (hasReferences) {
          console.log(
            "[QueryHandler] Detected conversational references, using conversation context",
          );

          // Summarize recent conversation
          contextSummary = summarizeConversationContext(
            session.conversationHistory,
          );

          // Extract entities from history
          entities = extractEntitiesFromHistory(session.conversationHistory);

          console.log(
            `[QueryHandler] Context: ${contextSummary.substring(0, 100)}...`,
          );
          console.log(
            `[QueryHandler] Entities: ${entities.companies.length} companies, ${entities.categories.length} categories`,
          );
        }
      }

      // Generate query embedding with optional conversation context (T055)
      const queryEmbeddingResult = await generateQueryEmbedding(
        userQuestion,
        contextSummary, // Include conversation context in embedding
      );
      const queryEmbedding = queryEmbeddingResult.queryEmbedding;

      console.log(
        `[QueryHandler] Generated query embedding (dim: ${queryEmbedding.length})`,
      );

      // Retrieve relevant transactions using semantic search
      const retrievalResult = await retrieve(
        session.id,
        queryEmbedding,
        session.transactionData,
        topK,
        threshold,
      );

      console.log(
        `[QueryHandler] Retrieved ${retrievalResult.retrievedTransactions.length} relevant transactions (threshold: ${threshold})`,
      );

      // If no relevant transactions found, return early
      if (retrievalResult.retrievedTransactions.length === 0) {
        return {
          answer:
            "Tôi không tìm thấy thông tin liên quan trong dữ liệu để trả lời câu hỏi này.",
          citations: [],
          confidence: "low",
          processingTime: Date.now() - startTime,
        };
      }

      // Format retrieved transactions for context
      const transactionContext = formatTransactionDataForContext(
        retrievalResult.retrievedTransactions,
      );

      // T059: Build system prompt with conversation context awareness
      let systemPrompt = buildSystemPrompt(transactionContext, true);

      if (contextSummary) {
        systemPrompt += `\n\nBỐI CẢNH HỘI THOẠI:\n${contextSummary}\n`;

        // Add entity hints if extracted
        if (entities.companies.length > 0 || entities.categories.length > 0) {
          systemPrompt += `\nCÁC THỰC THỂ ĐÃ NÓI: `;
          if (entities.companies.length > 0) {
            systemPrompt += `Công ty: ${entities.companies.join(", ")}. `;
          }
          if (entities.categories.length > 0) {
            systemPrompt += `Danh mục: ${entities.categories.join(", ")}.`;
          }
        }
      }

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

      // T046: Extract citations with retrieved transaction ID validation
      const citations = extractCitations(
        answer,
        retrievalResult.transactionIds,
      );

      // Estimate confidence with retrieval similarity scores
      const confidence = estimateConfidence(
        answer,
        citations,
        retrievalResult.similarityScores,
      );

      const processingTime = Date.now() - startTime;

      // Calculate average similarity score
      const avgSimilarityScore =
        retrievalResult.similarityScores.length > 0
          ? retrievalResult.similarityScores.reduce(
              (sum, score) => sum + score,
              0,
            ) / retrievalResult.similarityScores.length
          : undefined;

      console.log(
        `[QueryHandler] RAG query completed in ${processingTime}ms (confidence: ${confidence}, citations: ${citations.length}, avgSimilarity: ${avgSimilarityScore?.toFixed(3)})`,
      );

      return {
        answer,
        citations,
        confidence,
        processingTime,
        retrievalMetadata: {
          retrievedCount: retrievalResult.retrievedTransactions.length,
          totalAvailable: session.transactionData.length,
          avgSimilarityScore,
          threshold,
        },
      };
    } catch (error) {
      console.error("[QueryHandler] Error processing RAG query:", error);

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
      const systemPrompt = buildSystemPrompt(transactionContext, true);

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
