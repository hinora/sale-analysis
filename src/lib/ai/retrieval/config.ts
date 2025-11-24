/**
 * RAG Retrieval Configuration
 *
 * Centralized configuration for RAG parameters with environment variable overrides.
 * Provides default values and validation for retrieval settings.
 *
 * Environment Variables:
 * - RAG_TOP_K: Number of transactions to retrieve (default: 50)
 * - RAG_SIMILARITY_THRESHOLD: Minimum similarity score (default: 0.7)
 * - RAG_BATCH_SIZE: Batch size for embedding generation (default: 100)
 *
 * @module config
 */

/**
 * Default retrieval configuration
 *
 * These values are optimized for balanced performance and accuracy.
 * They can be overridden via environment variables.
 */
export const DEFAULT_RETRIEVAL_CONFIG = {
  // Number of top results to retrieve
  topK: 50,

  // Minimum similarity threshold (0-1)
  similarityThreshold: 0.7,

  // Batch size for embedding generation
  embeddingBatchSize: 100,

  // Embedding model dimensions
  embeddingDimensions: 384,

  // Session index TTL (30 minutes in milliseconds)
  indexTTL: 30 * 60 * 1000,

  // Model retry configuration
  modelRetryAttempts: 3,
  modelRetryDelayMs: 2000,
} as const;

/**
 * Get retrieval configuration with environment variable overrides
 *
 * Merges default configuration with environment variable values. Environment
 * variables take precedence over defaults.
 *
 * @returns {Object} Retrieval configuration object
 * @returns {number} topK - Number of transactions to retrieve (1-1000)
 * @returns {number} similarityThreshold - Minimum similarity score (0-1)
 * @returns {number} embeddingBatchSize - Batch size for embeddings (1-1000)
 * @returns {number} embeddingDimensions - Fixed at 384 for multilingual-e5-small
 * @returns {number} indexTTL - Index expiration time in milliseconds (30 minutes)
 * @returns {number} modelRetryAttempts - Number of model load retries (3)
 * @returns {number} modelRetryDelayMs - Delay between retries in ms (2000)
 *
 * @example
 * const config = getRetrievalConfig();
 * console.log(`Will retrieve top ${config.topK} transactions`);
 * console.log(`Threshold: ${config.similarityThreshold}`);
 */
export function getRetrievalConfig() {
  return {
    topK: process.env.RAG_TOP_K
      ? Number.parseInt(process.env.RAG_TOP_K, 10)
      : DEFAULT_RETRIEVAL_CONFIG.topK,

    similarityThreshold: process.env.RAG_SIMILARITY_THRESHOLD
      ? Number.parseFloat(process.env.RAG_SIMILARITY_THRESHOLD)
      : DEFAULT_RETRIEVAL_CONFIG.similarityThreshold,

    embeddingBatchSize: process.env.RAG_BATCH_SIZE
      ? Number.parseInt(process.env.RAG_BATCH_SIZE, 10)
      : DEFAULT_RETRIEVAL_CONFIG.embeddingBatchSize,

    embeddingDimensions: DEFAULT_RETRIEVAL_CONFIG.embeddingDimensions,

    indexTTL: DEFAULT_RETRIEVAL_CONFIG.indexTTL,

    modelRetryAttempts: DEFAULT_RETRIEVAL_CONFIG.modelRetryAttempts,
    modelRetryDelayMs: DEFAULT_RETRIEVAL_CONFIG.modelRetryDelayMs,
  };
}

/**
 * Validate retrieval configuration
 *
 * Checks if configuration values are within acceptable ranges. Use this to
 * validate user-provided or environment variable configurations before use.
 *
 * @param {ReturnType<typeof getRetrievalConfig>} config - Configuration object to validate
 * @returns {Object} Validation result
 * @returns {boolean} valid - True if configuration is valid
 * @returns {string[]} errors - Array of error messages if invalid
 *
 * @example
 * const config = getRetrievalConfig();
 * const validation = validateRetrievalConfig(config);
 * if (!validation.valid) {
 *   console.error('Invalid config:', validation.errors);
 * }
 */
export function validateRetrievalConfig(
  config: ReturnType<typeof getRetrievalConfig>,
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.topK < 1 || config.topK > 1000) {
    errors.push("topK must be between 1 and 1000");
  }

  if (config.similarityThreshold < 0 || config.similarityThreshold > 1) {
    errors.push("similarityThreshold must be between 0 and 1");
  }

  if (config.embeddingBatchSize < 1 || config.embeddingBatchSize > 1000) {
    errors.push("embeddingBatchSize must be between 1 and 1000");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
