/**
 * Embedder module for generating embeddings using Transformers.js
 *
 * This module provides functions to convert transactions and queries into
 * semantic vector representations (384-dimensional embeddings) using the
 * multilingual-e5-small model from Hugging Face.
 *
 * Key Features:
 * - Lazy model loading with automatic retry logic
 * - Batch processing for efficient bulk embedding generation
 * - Support for Vietnamese and English text
 * - Error boundary with cached failures to avoid repeated initialization attempts
 *
 * @module embedder
 */

import { pipeline } from "@xenova/transformers";
import type { TransactionEmbedding, QueryEmbeddingResponse } from "./types";

// Singleton embedding model instance
let embedder: unknown = null;
let modelLoadError: Error | null = null;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Initialize and get the embedding model (lazy loaded with retry logic)
 *
 * The model is loaded once and cached for subsequent calls. If loading fails,
 * the error is cached to avoid repeated initialization attempts.
 *
 * @returns {Promise<unknown>} The initialized embedding pipeline
 * @throws {Error} If model initialization fails after all retry attempts
 *
 * @example
 * const model = await getEmbedder();
 * const result = await model('Hello world', { pooling: 'mean', normalize: true });
 */
async function getEmbedder() {
  if (embedder) {
    return embedder;
  }

  // If previous initialization failed, throw cached error
  if (modelLoadError) {
    throw new Error(
      `Embedding model failed to initialize: ${modelLoadError.message}`,
    );
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(
        `[Embedder] Loading multilingual-e5-small model (attempt ${attempt}/${MAX_RETRY_ATTEMPTS})...`,
      );

      embedder = await pipeline(
        "feature-extraction",
        "Xenova/multilingual-e5-small",
      );

      console.log("[Embedder] Model loaded successfully");
      return embedder;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `[Embedder] Failed to load model (attempt ${attempt}/${MAX_RETRY_ATTEMPTS}):`,
        lastError.message,
      );

      if (attempt < MAX_RETRY_ATTEMPTS) {
        console.log(`[Embedder] Retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  // Cache the error to avoid repeated initialization attempts
  modelLoadError = lastError || new Error("Unknown model loading error");
  throw modelLoadError;
}

/**
 * Format transaction data into natural language for embedding
 *
 * Converts structured transaction fields into a human-readable text format
 * that works well with multilingual embedding models.
 *
 * @param {Record<string, unknown>} tx - Transaction object with fields
 * @returns {string} Natural language representation of the transaction
 *
 * @example
 * const text = formatTransactionForEmbedding({
 *   companyName: 'ABC Corp',
 *   importCountry: 'Vietnam',
 *   categoryName: 'Electronics',
 *   goodsName: 'Smartphones',
 *   date: '2024-10-15',
 *   totalValueUSD: 25000,
 *   quantity: 500,
 *   unit: 'units',
 *   unitPriceUSD: 50
 * });
 * // Returns: "Company: ABC Corp\nCountry: Vietnam\n..."
 */
export function formatTransactionForEmbedding(
  tx: Record<string, unknown>,
): string {
  return `Company: ${tx.companyName || "Unknown"}
Country: ${tx.importCountry || "Unknown"}
Category: ${tx.categoryName || "Unknown"}
Product: ${tx.goodsName || "Unknown"}
Date: ${tx.date || "Unknown"}
Value: $${tx.totalValueUSD || 0} USD
Quantity: ${tx.quantity || 0} ${tx.unit || "units"} at $${tx.unitPriceUSD || 0} per unit`;
}

/**
 * Generate embedding for a single transaction
 *
 * Converts a transaction object into a 384-dimensional semantic vector
 * representation using the multilingual-e5-small model.
 *
 * @param {Record<string, unknown>} transaction - Transaction object to embed
 * @returns {Promise<TransactionEmbedding>} Embedding with metadata
 * @throws {Error} If embedding generation fails
 *
 * @example
 * const embedding = await generateTransactionEmbedding({
 *   _id: 'tx-123',
 *   companyName: 'ABC Corp',
 *   goodsName: 'Smartphones',
 *   totalValueUSD: 25000
 * });
 * console.log(embedding.embedding.length); // 384
 */
export async function generateTransactionEmbedding(
  transaction: Record<string, unknown>,
): Promise<TransactionEmbedding> {
  try {
    const text = formatTransactionForEmbedding(transaction);
    const model = (await getEmbedder()) as {
      (
        text: string,
        options: { pooling: string; normalize: boolean },
      ): Promise<{
        data: Float32Array;
      }>;
    };

    const result = await model(text, { pooling: "mean", normalize: true });

    return {
      transactionId: String(transaction._id || transaction.id),
      embedding: Array.from(result.data),
      textRepresentation: text,
      createdAt: new Date(),
    };
  } catch (error) {
    console.error("[Embedder] Error generating transaction embedding:", error);
    throw new Error(
      `Failed to generate embedding for transaction ${transaction._id || transaction.id}`,
    );
  }
}

/**
 * Generate embedding for a query with optional conversation context
 *
 * Converts a natural language query into a 384-dimensional vector for
 * semantic search. Optionally includes conversation history for better
 * contextual understanding in follow-up questions.
 *
 * @param {string} query - User's natural language question
 * @param {string} [context] - Optional conversation context from previous Q&A
 * @returns {Promise<QueryEmbeddingResponse>} Query embedding and enhanced text
 * @throws {Error} If query embedding generation fails
 *
 * @example
 * const result = await generateQueryEmbedding(
 *   'What about company B?',
 *   'Previous: discussing top importers in electronics'
 * );
 * console.log(result.queryEmbedding.length); // 384
 * console.log(result.enhancedQuery); // Includes context
 */
export async function generateQueryEmbedding(
  query: string,
  context?: string,
): Promise<QueryEmbeddingResponse> {
  try {
    const enhancedQuery = context ? `${query}\nContext: ${context}` : query;

    const model = (await getEmbedder()) as {
      (
        text: string,
        options: { pooling: string; normalize: boolean },
      ): Promise<{
        data: Float32Array;
      }>;
    };

    const result = await model(enhancedQuery, {
      pooling: "mean",
      normalize: true,
    });

    return {
      queryEmbedding: Array.from(result.data),
      enhancedQuery,
    };
  } catch (error) {
    console.error("[Embedder] Error generating query embedding:", error);
    throw new Error("Failed to generate query embedding");
  }
}

/**
 * Generate embeddings for multiple transactions in batches
 *
 * Processes transactions sequentially in batches to avoid memory spikes.
 * Recommended for bulk embedding generation during index building.
 *
 * @param {Array<Record<string, unknown>>} transactions - Array of transactions to embed
 * @param {number} [batchSize=100] - Number of transactions per batch
 * @returns {Promise<TransactionEmbedding[]>} Array of transaction embeddings
 *
 * @example
 * const embeddings = await generateBatchEmbeddings(transactions, 100);
 * console.log(`Generated ${embeddings.length} embeddings`);
 *
 * @remarks
 * - Processing is sequential to prevent memory overflow
 * - Each batch is logged for progress tracking
 * - Typical speed: ~50-100ms per transaction
 */
export async function generateBatchEmbeddings(
  transactions: Array<Record<string, unknown>>,
  batchSize = 100,
): Promise<TransactionEmbedding[]> {
  const embeddings: TransactionEmbedding[] = [];
  const total = transactions.length;

  console.log(`[Embedder] Starting batch embedding for ${total} transactions`);

  for (let i = 0; i < total; i += batchSize) {
    const batch = transactions.slice(i, Math.min(i + batchSize, total));
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(total / batchSize);

    console.log(
      `[Embedder] Processing batch ${batchNum}/${totalBatches} (${batch.length} transactions)`,
    );

    // Process batch sequentially to avoid memory spikes
    for (const transaction of batch) {
      const embedding = await generateTransactionEmbedding(transaction);
      embeddings.push(embedding);
    }
  }

  console.log(
    `[Embedder] Completed embedding generation for ${total} transactions`,
  );
  return embeddings;
}

/**
 * Pre-warm the embedding model by loading it during server startup
 * This eliminates the first-query delay
 */
export async function prewarmEmbedder(): Promise<void> {
  try {
    console.log("[Embedder] Pre-warming embedding model...");
    const startTime = Date.now();

    // Load the model
    await getEmbedder();

    // Optionally run a test embedding to ensure it works
    const testModel = (await getEmbedder()) as {
      (
        text: string,
        options: { pooling: string; normalize: boolean },
      ): Promise<{
        data: Float32Array;
      }>;
    };
    await testModel("test", { pooling: "mean", normalize: true });

    const duration = Date.now() - startTime;
    console.log(`[Embedder] Model pre-warmed successfully in ${duration}ms`);
  } catch (error) {
    console.error("[Embedder] Failed to pre-warm model:", error);
    // Don't throw - let the application continue with lazy loading
  }
}
