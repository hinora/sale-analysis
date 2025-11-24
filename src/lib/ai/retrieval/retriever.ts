/**
 * Retriever module for semantic search across transaction embeddings
 *
 * Provides functions to perform cosine similarity search against a vector index
 * to find the most relevant transactions for a given query embedding.
 *
 * Key Features:
 * - Semantic search using vectra vector database
 * - Configurable retrieval count (k) and similarity threshold
 * - Transaction ID tracking for citation support
 * - Score-based relevance filtering
 *
 * @module retriever
 */

import { getIndex } from "./index";
import type { RetrievalResult } from "./types";

/**
 * Retrieve relevant transactions using semantic similarity search
 *
 * Searches the session's vector index for transactions most similar to the
 * query embedding. Returns only transactions above the specified similarity
 * threshold, ordered by relevance (highest score first).
 *
 * @param {string} sessionId - AI session identifier
 * @param {number[]} queryEmbedding - 384-dimensional query vector
 * @param {Array<Record<string, unknown>>} sessionTransactions - Full transaction dataset
 * @param {number} [k=100] - Maximum number of transactions to retrieve (1-500)
 * @param {number} [threshold=0.6] - Minimum cosine similarity score (0-1)
 * @returns {Promise<RetrievalResult>} Retrieved transactions with similarity scores
 * @throws {Error} If session index not found or retrieval fails
 *
 * @example
 * const result = await retrieve(
 *   'session-123',
 *   queryEmbedding,
 *   allTransactions,
 *   100,
 *   0.6
 * );
 * console.log(`Found ${result.retrievedTransactions.length} relevant transactions`);
 * console.log(`Top score: ${result.similarityScores[0]}`);
 *
 * @remarks
 * - Typical retrieval time: <100ms for 1M transaction index
 * - Higher threshold (e.g., 0.8) = stricter matching, fewer results
 * - Lower threshold (e.g., 0.4) = more lenient, more results
 */
export async function retrieve(
  sessionId: string,
  queryEmbedding: number[],
  sessionTransactions: Array<Record<string, unknown>>,
  k = 100,
  threshold = 0.6,
): Promise<RetrievalResult> {
  try {
    const index = getIndex(sessionId);

    if (!index) {
      throw new Error(`No index found for session ${sessionId}`);
    }

    console.log(
      `[Retriever] Searching for top ${k} relevant transactions with threshold ${threshold}`,
    );

    // Query vector index (use empty string for pure vector search without BM25)
    const results = await index.queryItems(queryEmbedding, "", k);

    // Filter by relevance threshold
    const filtered = results.filter((r) => r.score >= threshold);

    console.log(
      `[Retriever] Found ${filtered.length} transactions above threshold (from ${results.length} results)`,
    );

    // Extract transaction IDs and scores
    const transactionIds = filtered.map(
      (r) => r.item.metadata.transactionId as string,
    );
    const scores = filtered.map((r) => r.score);

    // Map transaction IDs to actual transaction objects
    const transactionMap = new Map(
      sessionTransactions.map((tx) => [String(tx._id || tx.id), tx]),
    );

    const retrievedTransactions = transactionIds
      .map((id: string) => transactionMap.get(id))
      .filter((tx): tx is Record<string, unknown> => tx !== undefined);

    return {
      retrievedTransactions,
      transactionIds, // Return IDs for citation support
      similarityScores: scores,
      query: "", // Will be filled in by caller
      queryEmbedding,
      retrievalCount: retrievedTransactions.length,
      relevanceThreshold: threshold,
      retrievedAt: new Date(),
    };
  } catch (error) {
    console.error("[Retriever] Error during retrieval:", error);
    throw new Error(`Failed to retrieve transactions: ${error}`);
  }
}

/**
 * Helper function to retrieve with scores
 *
 * Simplified retrieval function that returns transactions and scores without
 * applying a similarity threshold filter. Useful for debugging or when you
 * want to see all results regardless of relevance.
 *
 * @param {string} sessionId - AI session identifier
 * @param {number[]} queryEmbedding - 384-dimensional query vector
 * @param {Array<Record<string, unknown>>} sessionTransactions - Full transaction dataset
 * @param {number} k - Number of transactions to retrieve
 * @returns {Promise<{transactions: Array<Record<string, unknown>>, scores: number[]}>}
 *          Transactions and their similarity scores
 *
 * @example
 * const { transactions, scores } = await retrieveWithScores(
 *   'session-123',
 *   queryEmbedding,
 *   allTransactions,
 *   50
 * );
 * // Returns all top 50 results regardless of score
 */
export async function retrieveWithScores(
  sessionId: string,
  queryEmbedding: number[],
  sessionTransactions: Array<Record<string, unknown>>,
  k: number,
): Promise<{
  transactions: Array<Record<string, unknown>>;
  scores: number[];
}> {
  const result = await retrieve(
    sessionId,
    queryEmbedding,
    sessionTransactions,
    k,
    0.0, // No threshold for this helper
  );

  return {
    transactions: result.retrievedTransactions,
    scores: result.similarityScores,
  };
}
