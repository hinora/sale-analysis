/**
 * Ollama AI Provider
 *
 * Implements the AIProvider interface for Ollama backend.
 * Wraps the existing OllamaClient with the standardized provider interface.
 *
 * @module ollama-provider
 */

import {
  OllamaClient,
  type OllamaGenerateOptions,
  type OllamaModel,
} from "../ollama-client";
import {
  type AIProvider,
  type GenerateOptions,
  type GenerateResponse,
  type HealthCheckResult,
  type ModelInfo,
  type OllamaProviderConfig,
  AIProviderError,
  AIProviderErrorCode,
  DEFAULTS,
} from "./types";

/**
 * Ollama AI Provider implementation
 *
 * Wraps the existing OllamaClient to provide a standardized interface
 * for the multi-provider architecture.
 */
export class OllamaProvider implements AIProvider {
  readonly name = "ollama";

  private client: OllamaClient;
  private defaultModel: string;

  /**
   * Create a new OllamaProvider
   *
   * @param config - Ollama configuration options
   */
  constructor(config?: OllamaProviderConfig) {
    const host = config?.host || process.env.OLLAMA_HOST || DEFAULTS.OLLAMA_HOST;
    this.defaultModel = config?.model || process.env.AI_MODEL || DEFAULTS.OLLAMA_MODEL;
    this.client = new OllamaClient(host);
  }

  /**
   * Generate text completion using Ollama
   *
   * @param options - Generation parameters
   * @returns Generated response with text and metadata
   * @throws AIProviderError on failure
   */
  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    // console.log(`[OllamaProvider] Generating with model: ${options.model || this.defaultModel} with options:`, options);
    const ollamaOptions: OllamaGenerateOptions = {
      model: options.model || this.defaultModel,
      prompt: options.prompt,
      context: options.context as number[] | undefined,
      stream: false,
      temperature: options.temperature ?? DEFAULTS.TEMPERATURE,
      top_p: options.topP ?? DEFAULTS.TOP_P,
      top_k: options.topK ?? DEFAULTS.TOP_K,
      keep_alive: options.keepAlive ?? DEFAULTS.KEEP_ALIVE,
    };

    try {
      const response = await this.client.generate(ollamaOptions);

      return {
        text: response.response,
        model: response.model,
        context: response.context,
        done: response.done,
        usage: {
          promptTokens: response.prompt_eval_count,
          completionTokens: response.eval_count,
          totalTokens:
            (response.prompt_eval_count || 0) + (response.eval_count || 0),
        },
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  /**
   * Check if Ollama is healthy and reachable
   *
   * @returns Health status with latency information
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const healthy = await this.client.healthCheck();
      const latencyMs = Date.now() - startTime;

      if (!healthy) {
        return {
          healthy: false,
          provider: this.name,
          latencyMs,
          error: "Ollama health check failed",
        };
      }

      return {
        healthy: true,
        provider: this.name,
        latencyMs,
        details: {
          host: process.env.OLLAMA_HOST || DEFAULTS.OLLAMA_HOST,
          defaultModel: this.defaultModel,
        },
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return {
        healthy: false,
        provider: this.name,
        latencyMs,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * List available models from Ollama
   *
   * @returns Array of available model information
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const models: OllamaModel[] = await this.client.listModels();

      return models.map((model) => ({
        name: model.name,
        displayName: model.name,
        modifiedAt: model.modified_at,
        size: model.size,
      }));
    } catch (error) {
      throw this.mapError(error);
    }
  }

  /**
   * Map Ollama errors to AIProviderError
   */
  private mapError(error: unknown): AIProviderError {
    if (error instanceof AIProviderError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    // Parse error message to determine error code
    if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND")) {
      return new AIProviderError(
        `Cannot connect to Ollama: ${message}`,
        AIProviderErrorCode.CONNECTION_FAILED,
        this.name,
        { cause: error }
      );
    }

    if (message.includes("timeout")) {
      return new AIProviderError(
        `Ollama request timed out: ${message}`,
        AIProviderErrorCode.TIMEOUT,
        this.name,
        { cause: error }
      );
    }

    if (message.includes("model") && message.includes("not found")) {
      return new AIProviderError(
        `Model not found: ${message}`,
        AIProviderErrorCode.MODEL_NOT_FOUND,
        this.name,
        { cause: error }
      );
    }

    return new AIProviderError(
      `Ollama error: ${message}`,
      AIProviderErrorCode.PROVIDER_ERROR,
      this.name,
      { cause: error }
    );
  }
}
