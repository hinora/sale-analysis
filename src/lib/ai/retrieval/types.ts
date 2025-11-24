/**
 * TypeScript interfaces for RAG retrieval system
 */

/**
 * Embedding representation of a transaction for semantic search
 */
export interface TransactionEmbedding {
  transactionId: string;
  embedding: number[]; // 384 dimensions
  textRepresentation: string;
  createdAt: Date;
}

/**
 * Vector index for a session's transaction data
 */
export interface SessionVectorIndex {
  sessionId: string;
  vectorIndex: unknown; // vectra Index instance
  transactionCount: number;
  embeddingDimensions: number; // Always 384
  indexedAt: Date;
  status: "building" | "ready" | "failed";
}

/**
 * Result from semantic search retrieval
 */
export interface RetrievalResult {
  retrievedTransactions: Array<Record<string, unknown>>;
  transactionIds: string[]; // IDs of retrieved transactions for citation
  similarityScores: number[]; // Relevance scores (0-1) for each transaction
  query: string;
  queryEmbedding: number[];
  retrievalCount: number;
  relevanceThreshold: number;
  retrievedAt: Date;
}

/**
 * Configuration for retrieval parameters
 */
export interface RetrievalConfig {
  k: number; // Number of transactions to retrieve (default: 100)
  threshold: number; // Minimum similarity score (default: 0.6)
  maxK: number; // Hard limit (500)
}

/**
 * Transaction embedding request
 */
export interface TransactionEmbeddingRequest {
  transaction: Record<string, unknown>;
  format?: "natural_language" | "compact";
}

/**
 * Query embedding request
 */
export interface QueryEmbeddingRequest {
  query: string;
  conversationContext?: string;
}

/**
 * Query embedding response
 */
export interface QueryEmbeddingResponse {
  queryEmbedding: number[];
  enhancedQuery: string;
}
