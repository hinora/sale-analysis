import { getOllamaClient } from "./ollama-client";

/**
 * Name shortening result
 */
export interface ShortenResult {
  shortName: string;
  originalLength: number;
  shortLength: number;
  compressionRatio: number;
}

/**
 * AI name shortener using Ollama deepseek-r1
 * Generates concise goods names (max 100 characters)
 * Uses deepseek-r1:1.5b for development, deepseek-r1:14b for production
 */
export class AINameShortener {
  private modelName =
    process.env.AI_MODEL ||
    (process.env.NODE_ENV === "production"
      ? "deepseek-r1:14b"
      : "deepseek-r1:1.5b");
  private ollamaClient = getOllamaClient();
  private maxLength = 100;

  /**
   * Shorten a single goods name
   */
  async shortenName(goodsName: string): Promise<ShortenResult> {
    // If already short enough, return as-is
    if (goodsName.length <= this.maxLength) {
      return {
        shortName: goodsName,
        originalLength: goodsName.length,
        shortLength: goodsName.length,
        compressionRatio: 1.0,
      };
    }

    const prompt = this.buildShorteningPrompt(goodsName);

    try {
      const response = await this.ollamaClient.generate({
        model: this.modelName,
        prompt,
        temperature: 0.3,
      });

      const shortName = this.extractShortName(response.response);

      return {
        shortName,
        originalLength: goodsName.length,
        shortLength: shortName.length,
        compressionRatio: shortName.length / goodsName.length,
      };
    } catch (error) {
      console.error("[AINameShortener] Shortening error:", error);
      // Fallback: simple truncation
      const truncated = goodsName.slice(0, this.maxLength - 3) + "...";
      return {
        shortName: truncated,
        originalLength: goodsName.length,
        shortLength: truncated.length,
        compressionRatio: truncated.length / goodsName.length,
      };
    }
  }

  /**
   * Shorten multiple goods names in batch
   */
  async shortenBatch(
    goodsNames: string[],
  ): Promise<Map<string, ShortenResult>> {
    const results = new Map<string, ShortenResult>();

    // Process in parallel with limit
    const batchSize = 5;
    for (let i = 0; i < goodsNames.length; i += batchSize) {
      const batch = goodsNames.slice(i, i + batchSize);
      const promises = batch.map((name) => this.shortenName(name));
      const batchResults = await Promise.all(promises);

      for (let j = 0; j < batch.length; j++) {
        results.set(batch[j], batchResults[j]);
      }

      console.log(
        `[AINameShortener] Shortened ${i + batch.length}/${goodsNames.length} names`,
      );
    }

    return results;
  }

  /**
   * Build shortening prompt
   */
  private buildShorteningPrompt(goodsName: string): string {
    return `You are a product name editor. Create a concise, clear version of this product name while preserving key information.

Rules:
- Maximum ${this.maxLength} characters
- Keep essential product details (type, specification, key features)
- Remove redundant words and descriptions
- Use standard abbreviations when appropriate
- Maintain clarity and searchability

Original name: "${goodsName}"

Provide ONLY the shortened name, nothing else:`;
  }

  /**
   * Extract short name from AI response
   */
  private extractShortName(response: string): string {
    // Clean up response
    let shortName = response
      .trim()
      .replace(/^["']|["']$/g, "") // Remove quotes
      .replace(/\n.*/g, "") // Take only first line
      .trim();

    // If too long, truncate
    if (shortName.length > this.maxLength) {
      shortName = shortName.slice(0, this.maxLength - 3) + "...";
    }

    // If empty or too short, use fallback
    if (!shortName || shortName.length < 3) {
      throw new Error("Invalid short name generated");
    }

    return shortName;
  }

  /**
   * Simple fallback shortening without AI
   */
  simpleShortenName(goodsName: string): string {
    if (goodsName.length <= this.maxLength) {
      return goodsName;
    }

    // Try to find a natural break point (comma, semicolon, dash)
    const breakChars = [",", ";", "-", "("];
    for (const char of breakChars) {
      const index = goodsName.indexOf(char);
      if (index > 20 && index < this.maxLength) {
        return goodsName.slice(0, index).trim();
      }
    }

    // Simple truncation
    return goodsName.slice(0, this.maxLength - 3) + "...";
  }

  /**
   * Check if Ollama service is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      return await this.ollamaClient.healthCheck();
    } catch {
      return false;
    }
  }
}

/**
 * Export singleton instance
 */
export const aiNameShortener = new AINameShortener();
