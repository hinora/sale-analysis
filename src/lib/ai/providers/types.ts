/**
 * AI Provider Types and Interfaces
 *
 * Defines the contract that all AI providers must implement.
 * Part of the multi-provider architecture supporting Ollama and Gemini.
 *
 * @module ai-providers
 * @version 1.0.0
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
   */
  prompt: string;

  /**
   * Model identifier (provider-specific)
   * @default Provider's configured model
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
   */
  text: string;

  /**
   * The model that generated this response
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
   */
  healthy: boolean;

  /**
   * Provider identifier
   */
  provider: string;

  /**
   * Response time in milliseconds
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
   * @default "http://ollama:11434" or process.env.OLLAMA_HOST
   */
  host?: string;

  /**
   * Ollama API key for authentication (optional)
   * @default process.env.OLLAMA_API_KEY
   */
  apiKey?: string;

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
   * Gemini API key (required)
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
 */
export interface AIProvider {
  /**
   * Unique provider identifier
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
export class AIProviderError extends Error {
  /** Error code for programmatic handling */
  readonly code: AIProviderErrorCode;
  /** Provider that generated the error */
  readonly provider: string;
  /** HTTP status code (if applicable) */
  readonly status?: number;
  /** Original error details */
  readonly cause?: unknown;

  constructor(
    message: string,
    code: AIProviderErrorCode,
    provider: string,
    options?: { status?: number; cause?: unknown },
  ) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
    this.provider = provider;
    this.status = options?.status;
    this.cause = options?.cause;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AIProviderError);
    }
  }

  /**
   * Create a user-friendly error message
   */
  toUserMessage(): string {
    switch (this.code) {
      case AIProviderErrorCode.CONNECTION_FAILED:
        return `Cannot connect to ${this.provider}. Please check if the service is running.`;
      case AIProviderErrorCode.AUTH_FAILED:
        return `Authentication failed for ${this.provider}. Please check your API key.`;
      case AIProviderErrorCode.RATE_LIMITED:
        return `Rate limit exceeded for ${this.provider}. Please wait and try again.`;
      case AIProviderErrorCode.QUOTA_EXCEEDED:
        return `API quota exceeded for ${this.provider}. Please check your billing settings.`;
      case AIProviderErrorCode.MODEL_NOT_FOUND:
        return `Model not found on ${this.provider}. Please check the model name.`;
      case AIProviderErrorCode.TIMEOUT:
        return `Request to ${this.provider} timed out. Please try again.`;
      default:
        return this.message;
    }
  }
}

// =============================================================================
// Environment Variable Names
// =============================================================================

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
