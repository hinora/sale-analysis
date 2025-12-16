/**
 * Gemini AI Provider
 *
 * Implements the AIProvider interface for Google Gemini backend.
 * Uses the official @google/genai SDK.
 *
 * @module gemini-provider
 */

import { GoogleGenAI } from "@google/genai";
import {
  type AIProvider,
  type GenerateOptions,
  type GenerateResponse,
  type HealthCheckResult,
  type ModelInfo,
  type GeminiProviderConfig,
  AIProviderError,
  AIProviderErrorCode,
  DEFAULTS,
} from "./types";

/**
 * Gemini AI Provider implementation
 *
 * Provides access to Google's Gemini models through the official SDK.
 */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini";

  private client: GoogleGenAI;
  private defaultModel: string;

  /**
   * Create a new GeminiProvider
   *
   * @param config - Gemini configuration options
   * @throws AIProviderError if API key is missing
   */
  constructor(config: GeminiProviderConfig) {
    if (!config.apiKey) {
      throw new AIProviderError(
        "GEMINI_API_KEY is required for Gemini provider",
        AIProviderErrorCode.AUTH_FAILED,
        this.name,
      );
    }

    this.client = new GoogleGenAI({ apiKey: config.apiKey });
    this.defaultModel = config.model || DEFAULTS.GEMINI_MODEL;
  }

  /**
   * Generate text completion using Gemini
   *
   * @param options - Generation parameters
   * @returns Generated response with text and metadata
   * @throws AIProviderError on failure
   */
  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    const model = options.model || this.defaultModel;
    // console.log(`[GeminiProvider] Generating with model: ${model} with options:`, options);

    try {
      const response = await this.client.models.generateContent({
        model,
        contents: options.prompt,
        config: {
          temperature: options.temperature ?? DEFAULTS.TEMPERATURE,
          topP: options.topP ?? DEFAULTS.TOP_P,
          topK: options.topK ?? DEFAULTS.TOP_K,
          maxOutputTokens: options.maxTokens,
        },
      });

      const text = response.text ?? "";

      return {
        text,
        model,
        done: true,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount,
          completionTokens: response.usageMetadata?.candidatesTokenCount,
          totalTokens: response.usageMetadata?.totalTokenCount,
        },
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  /**
   * Check if Gemini is healthy and reachable
   *
   * @returns Health status with latency information
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Use a simple prompt to test connectivity
      await this.client.models.generateContent({
        model: this.defaultModel,
        contents: "Hi",
        config: {
          maxOutputTokens: 5,
        },
      });

      const latencyMs = Date.now() - startTime;

      return {
        healthy: true,
        provider: this.name,
        latencyMs,
        details: {
          model: this.defaultModel,
        },
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const mappedError = this.mapError(error);

      return {
        healthy: false,
        provider: this.name,
        latencyMs,
        error: mappedError.message,
        details: {
          code: mappedError.code,
        },
      };
    }
  }

  /**
   * List available models from Gemini
   *
   * Note: Gemini SDK doesn't provide a direct list models API.
   * Returns commonly available models.
   *
   * @returns Array of available model information
   */
  async listModels(): Promise<ModelInfo[]> {
    // Gemini doesn't have a listModels API in @google/genai SDK
    // Return known models
    return [
      {
        name: "gemini-2.5-flash",
        displayName: "Gemini 2.5 Flash",
        description: "Fast and cost-effective model",
        contextWindow: 1000000,
      },
      {
        name: "gemini-2.5-pro",
        displayName: "Gemini 2.5 Pro",
        description: "Advanced reasoning model",
        contextWindow: 1000000,
      },
      {
        name: "gemini-2.0-flash",
        displayName: "Gemini 2.0 Flash",
        description: "Latest features model",
        contextWindow: 1000000,
      },
    ];
  }

  /**
   * Map Gemini errors to AIProviderError
   */
  private mapError(error: unknown): AIProviderError {
    if (error instanceof AIProviderError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : "";

    // Check for specific Gemini error patterns
    if (
      message.includes("API key") ||
      message.includes("401") ||
      message.includes("UNAUTHENTICATED") ||
      errorName === "AuthenticationError"
    ) {
      return new AIProviderError(
        "Invalid or missing Gemini API key. Please check GEMINI_API_KEY environment variable.",
        AIProviderErrorCode.AUTH_FAILED,
        this.name,
        { cause: error },
      );
    }

    if (
      message.includes("429") ||
      message.includes("RESOURCE_EXHAUSTED") ||
      message.includes("rate limit")
    ) {
      return new AIProviderError(
        "Gemini API rate limit exceeded. Please wait and try again.",
        AIProviderErrorCode.RATE_LIMITED,
        this.name,
        { cause: error },
      );
    }

    if (
      message.includes("quota") ||
      message.includes("QUOTA_EXCEEDED") ||
      message.includes("billing")
    ) {
      return new AIProviderError(
        "Gemini API quota exceeded. Please check your billing settings.",
        AIProviderErrorCode.QUOTA_EXCEEDED,
        this.name,
        { cause: error },
      );
    }

    if (
      message.includes("model") &&
      (message.includes("not found") || message.includes("404"))
    ) {
      return new AIProviderError(
        `Gemini model not found: ${message}`,
        AIProviderErrorCode.MODEL_NOT_FOUND,
        this.name,
        { cause: error },
      );
    }

    if (
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("network")
    ) {
      return new AIProviderError(
        `Cannot connect to Gemini API: ${message}`,
        AIProviderErrorCode.CONNECTION_FAILED,
        this.name,
        { cause: error },
      );
    }

    if (message.includes("timeout")) {
      return new AIProviderError(
        `Gemini request timed out: ${message}`,
        AIProviderErrorCode.TIMEOUT,
        this.name,
        { cause: error },
      );
    }

    return new AIProviderError(
      `Gemini error: ${message}`,
      AIProviderErrorCode.PROVIDER_ERROR,
      this.name,
      { cause: error },
    );
  }
}
