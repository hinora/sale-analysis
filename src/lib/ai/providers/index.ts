/**
 * AI Provider Registry
 *
 * Factory for creating and managing AI provider instances.
 * Provides singleton access to the configured provider based on environment variables.
 *
 * @module ai-providers
 */

import {
  type AIProvider,
  type ProviderConfig,
  type ProviderType,
  type OllamaProviderConfig,
  type GeminiProviderConfig,
  DEFAULT_PROVIDER,
  ENV_VARS,
  DEFAULTS,
} from "./types";
import { OllamaProvider } from "./ollama-provider";
import { GeminiProvider } from "./gemini-provider";

// Re-export all types for convenient imports
export * from "./types";
export { OllamaProvider } from "./ollama-provider";
export { GeminiProvider } from "./gemini-provider";

// Singleton provider instance
let providerInstance: AIProvider | null = null;

/**
 * Valid provider type values
 */
const VALID_PROVIDERS: readonly ProviderType[] = ["ollama", "gemini"] as const;

/**
 * Read and validate provider type from environment
 *
 * @returns The configured provider type, defaulting to 'ollama'
 */
function getProviderType(): ProviderType {
  const envValue = process.env[ENV_VARS.AI_PROVIDER]?.toLowerCase();

  if (!envValue) {
    return DEFAULT_PROVIDER;
  }

  if (!VALID_PROVIDERS.includes(envValue as ProviderType)) {
    console.warn(
      `[AIProvider] Invalid AI_PROVIDER value: "${envValue}". ` +
        `Valid values are: ${VALID_PROVIDERS.join(", ")}. ` +
        `Falling back to default: ${DEFAULT_PROVIDER}`,
    );
    return DEFAULT_PROVIDER;
  }

  return envValue as ProviderType;
}

/**
 * Build provider configuration from environment variables
 *
 * @returns Provider configuration based on environment
 */
export function getProviderConfig(): ProviderConfig {
  const providerType = getProviderType();

  if (providerType === "gemini") {
    const apiKey = process.env[ENV_VARS.GEMINI_API_KEY];

    if (!apiKey) {
      console.error(
        `[AIProvider] GEMINI_API_KEY is required when AI_PROVIDER=gemini. ` +
          `Falling back to Ollama provider.`,
      );
      // Fall back to Ollama if Gemini key is missing
      return {
        type: "ollama",
        host: process.env[ENV_VARS.OLLAMA_HOST] || DEFAULTS.OLLAMA_HOST,
        model: process.env[ENV_VARS.AI_MODEL] || DEFAULTS.OLLAMA_MODEL,
      } as OllamaProviderConfig;
    }

    return {
      type: "gemini",
      apiKey,
      model: process.env[ENV_VARS.GEMINI_MODEL] || DEFAULTS.GEMINI_MODEL,
    } as GeminiProviderConfig;
  }

  // Default: Ollama
  return {
    type: "ollama",
    host: process.env[ENV_VARS.OLLAMA_HOST] || DEFAULTS.OLLAMA_HOST,
    model: process.env[ENV_VARS.AI_MODEL] || DEFAULTS.OLLAMA_MODEL,
  } as OllamaProviderConfig;
}

/**
 * Create a new provider instance based on configuration
 *
 * @param config - Provider configuration
 * @returns New provider instance
 */
export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.type) {
    case "gemini":
      return new GeminiProvider(config as GeminiProviderConfig);
    case "ollama":
    default:
      return new OllamaProvider(config as OllamaProviderConfig);
  }
}

/**
 * Get the singleton AI provider instance
 *
 * Lazily initializes the provider based on environment configuration.
 * The same instance is returned on subsequent calls.
 *
 * @returns The configured AIProvider instance
 *
 * @example
 * ```typescript
 * import { getProvider } from './lib/ai/providers';
 *
 * const provider = getProvider();
 * const response = await provider.generate({ prompt: 'Hello' });
 * ```
 */
export function getProvider(): AIProvider {
  if (!providerInstance) {
    const config = getProviderConfig();
    providerInstance = createProvider(config);
    console.log(`[AIProvider] Initialized provider: ${providerInstance.name}`);
  }
  return providerInstance;
}

/**
 * Reset the provider instance (primarily for testing)
 *
 * Forces re-initialization on next getProvider() call.
 * Use with caution in production code.
 */
export function resetProvider(): void {
  providerInstance = null;
}

/**
 * Get the current provider name without initializing
 *
 * Useful for logging and diagnostics.
 *
 * @returns The configured provider type name
 */
export function getProviderName(): ProviderType {
  return getProviderType();
}
