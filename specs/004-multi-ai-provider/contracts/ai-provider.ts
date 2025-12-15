/**
 * AI Provider Interface Contract
 * 
 * This file defines the contract that all AI providers must implement.
 * It is the reference specification for the multi-provider architecture.
 * 
 * @module ai-provider-contract
 * @version 1.0.0
 * @created December 8, 2025
 * @feature 004-multi-ai-provider
 */

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Supported AI provider types
 */
export type ProviderType = "ollama" | "gemini";

/**
 * Default provider when AI_PROVIDER env var is not set
 */
export const DEFAULT_PROVIDER: ProviderType = "ollama";

// =============================================================================
// Generation Options & Response
// =============================================================================

/**
 * Options for text generation requests
 */
export interface GenerateOptions {
  /**
   * The prompt text to send to the model
   * @required
   */
  prompt: string;

  /**
   * Model identifier (provider-specific)
   * @optional - defaults to provider's configured model
   */
  model?: string;

  /**
   * Sampling temperature (0-1)
   * Lower values make output more deterministic
   * @default 0.7
   */
  temperature?: number;

  /**
   * Top-p (nucleus) sampling
   * @default 0.9
   */
  topP?: number;

  /**
   * Top-k sampling
   * @default 40
   */
  topK?: number;

  /**
   * Maximum number of tokens to generate
   * @optional - defaults to provider's limit
   */
  maxTokens?: number;

  /**
   * Provider-specific context for conversation continuity
   * - Ollama: number[] (context array from previous response)
   * - Gemini: not used (SDK handles internally)
   */
  context?: unknown;

  /**
   * Ollama-specific: how long to keep model loaded
   * @example "5m", "1h", "0" (unload immediately)
   * @default "30m"
   */
  keepAlive?: string;
}

/**
 * Token usage statistics
 */
export interface UsageInfo {
  /** Tokens in the input prompt */
  promptTokens?: number;
  /** Tokens in the generated response */
  completionTokens?: number;
  /** Total tokens (prompt + completion) */
  totalTokens?: number;
}

/**
 * Response from text generation
 */
export interface GenerateResponse {
  /**
   * The generated text content
   * @required
   */
  text: string;

  /**
   * The model that generated this response
   * @required
   */
  model: string;

  /**
   * Provider-specific context for follow-up requests
   * Pass this back in GenerateOptions.context for conversation continuity
   */
  context?: unknown;

  /**
   * Whether generation is complete
   * Always true for non-streaming responses
   */
  done?: boolean;

  /**
   * Token usage statistics (when available)
   */
  usage?: UsageInfo;
}

// =============================================================================
// Health Check
// =============================================================================

/**
 * Result of a provider health check
 */
export interface HealthCheckResult {
  /**
   * Whether the provider is operational
   * @required
   */
  healthy: boolean;

  /**
   * Provider identifier
   * @required
   */
  provider: string;

  /**
   * Response time in milliseconds
   * @required
   */
  latencyMs: number;

  /**
   * Error message if unhealthy
   */
  error?: string;

  /**
   * Additional diagnostic information
   */
  details?: Record<string, unknown>;
}

// =============================================================================
// Model Information
// =============================================================================

/**
 * Information about an available model
 */
export interface ModelInfo {
  /**
   * Model identifier used in API calls
   * @required
   */
  name: string;

  /**
   * Human-readable display name
   */
  displayName?: string;

  /**
   * Model description
   */
  description?: string;

  /**
   * Maximum context window in tokens
   */
  contextWindow?: number;

  /**
   * Last modification timestamp (ISO 8601)
   */
  modifiedAt?: string;

  /**
   * Model size in bytes (Ollama-specific)
   */
  size?: number;
}

// =============================================================================
// Provider Configuration
// =============================================================================

/**
 * Base configuration for all providers
 */
export interface BaseProviderConfig {
  /**
   * Provider type identifier
   * @required
   */
  type: ProviderType;
}

/**
 * Configuration for Ollama provider
 */
export interface OllamaProviderConfig extends BaseProviderConfig {
  type: "ollama";

  /**
   * Ollama server host URL
   * @default "http://ollama:11434" (Docker) or process.env.OLLAMA_HOST
   */
  host?: string;

  /**
   * Default model to use
   * @default "deepseek-r1:1.5b" or process.env.AI_MODEL
   */
  model?: string;
}

/**
 * Configuration for Gemini provider
 */
export interface GeminiProviderConfig extends BaseProviderConfig {
  type: "gemini";

  /**
   * Gemini API key
   * @required - must be provided via GEMINI_API_KEY env var
   */
  apiKey: string;

  /**
   * Default model to use
   * @default "gemini-2.5-flash" or process.env.GEMINI_MODEL
   */
  model?: string;

  /**
   * API version
   * @default "v1beta"
   */
  apiVersion?: string;
}

/**
 * Union type for all provider configurations
 */
export type ProviderConfig = OllamaProviderConfig | GeminiProviderConfig;

// =============================================================================
// AIProvider Interface
// =============================================================================

/**
 * Abstract interface for AI providers
 * 
 * All AI providers must implement this interface to be compatible with
 * the multi-provider architecture.
 * 
 * @example
 * ```typescript
 * class MyProvider implements AIProvider {
 *   readonly name = "my-provider";
 *   
 *   async generate(options: GenerateOptions): Promise<GenerateResponse> {
 *     // Implementation
 *   }
 *   
 *   async healthCheck(): Promise<HealthCheckResult> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export interface AIProvider {
  /**
   * Unique provider identifier
   * @readonly
   */
  readonly name: string;

  /**
   * Generate text completion from a prompt
   * 
   * @param options - Generation parameters
   * @returns Generated response with text and metadata
   * @throws AIProviderError on failure
   */
  generate(options: GenerateOptions): Promise<GenerateResponse>;

  /**
   * Check if the provider is healthy and reachable
   * 
   * @returns Health status with latency information
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * List available models (optional)
   * 
   * @returns Array of available model information
   */
  listModels?(): Promise<ModelInfo[]>;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error codes for AI provider failures
 */
export enum AIProviderErrorCode {
  /** Provider is not reachable */
  CONNECTION_FAILED = "CONNECTION_FAILED",
  /** Authentication failed (invalid API key, etc.) */
  AUTH_FAILED = "AUTH_FAILED",
  /** Rate limit exceeded */
  RATE_LIMITED = "RATE_LIMITED",
  /** Quota exceeded */
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  /** Model not found */
  MODEL_NOT_FOUND = "MODEL_NOT_FOUND",
  /** Invalid request parameters */
  INVALID_REQUEST = "INVALID_REQUEST",
  /** Provider returned an error */
  PROVIDER_ERROR = "PROVIDER_ERROR",
  /** Request timed out */
  TIMEOUT = "TIMEOUT",
  /** Unknown error */
  UNKNOWN = "UNKNOWN",
}

/**
 * Structured error for AI provider failures
 */
export interface AIProviderError extends Error {
  /** Error code for programmatic handling */
  code: AIProviderErrorCode;
  /** Provider that generated the error */
  provider: string;
  /** HTTP status code (if applicable) */
  status?: number;
  /** Original error details */
  cause?: unknown;
}

// =============================================================================
// Provider Registry
// =============================================================================

/**
 * Factory function signature for getting the active provider
 * 
 * @returns The configured AIProvider singleton instance
 * @throws Error if provider configuration is invalid
 */
export type GetProviderFn = () => AIProvider;

/**
 * Environment variable names used for provider configuration
 */
export const ENV_VARS = {
  /** Provider selection */
  AI_PROVIDER: "AI_PROVIDER",
  /** Ollama host URL */
  OLLAMA_HOST: "OLLAMA_HOST",
  /** Ollama/default model */
  AI_MODEL: "AI_MODEL",
  /** Gemini API key */
  GEMINI_API_KEY: "GEMINI_API_KEY",
  /** Gemini model */
  GEMINI_MODEL: "GEMINI_MODEL",
} as const;

/**
 * Default values for provider configuration
 */
export const DEFAULTS = {
  /** Default Ollama host */
  OLLAMA_HOST: "http://ollama:11434",
  /** Default Ollama model */
  OLLAMA_MODEL: "deepseek-r1:1.5b",
  /** Default Gemini model */
  GEMINI_MODEL: "gemini-2.5-flash",
  /** Default temperature */
  TEMPERATURE: 0.7,
  /** Default top_p */
  TOP_P: 0.9,
  /** Default top_k */
  TOP_K: 40,
  /** Default keep_alive for Ollama */
  KEEP_ALIVE: "30m",
} as const;
