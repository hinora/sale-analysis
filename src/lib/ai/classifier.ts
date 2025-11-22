import { getOllamaClient } from "./ollama-client";
import { Category } from "../db/models/Category";

/**
 * Classification result
 */
export interface ClassificationResult {
  category: string;
  confidence: number;
  reasoning?: string;
}

/**
 * AI goods classifier using Ollama deepseek-r1
 * Assigns categories to goods based on their raw names
 * Uses deepseek-r1:1.5b for development, deepseek-r1:14b for production
 */
export class AIClassifier {
  private modelName = process.env.AI_MODEL || 
    (process.env.NODE_ENV === "production" ? "deepseek-r1:14b" : "deepseek-r1:1.5b");
  private ollamaClient = getOllamaClient();

  /**
   * Classify a single goods name into a category
   */
  async classifyGoods(goodsName: string): Promise<ClassificationResult> {
    const prompt = this.buildClassificationPrompt(goodsName);

    try {
      const response = await this.ollamaClient.generate({
        model: this.modelName,
        prompt,
        temperature: 0.3, // Lower temperature for more consistent results
      });

      return this.parseClassificationResponse(response.response);
    } catch (error) {
      console.error("[AIClassifier] Classification error:", error);
      return {
        category: "Other",
        confidence: 0,
        reasoning: "Classification failed",
      };
    }
  }

  /**
   * Classify multiple goods names in batch
   */
  async classifyBatch(
    goodsNames: string[],
  ): Promise<Map<string, ClassificationResult>> {
    const results = new Map<string, ClassificationResult>();

    // Process in parallel with limit
    const batchSize = 5;
    for (let i = 0; i < goodsNames.length; i += batchSize) {
      const batch = goodsNames.slice(i, i + batchSize);
      const promises = batch.map((name) => this.classifyGoods(name));
      const batchResults = await Promise.all(promises);

      for (let j = 0; j < batch.length; j++) {
        results.set(batch[j], batchResults[j]);
      }

      console.log(
        `[AIClassifier] Classified ${i + batch.length}/${goodsNames.length} goods`,
      );
    }

    return results;
  }

  /**
   * Build classification prompt
   */
  private buildClassificationPrompt(goodsName: string): string {
    return `You are a product classification expert. Classify the following export goods into one of these categories:

Categories:
- Frozen Seafood (frozen shrimp, fish, squid, etc.)
- Fresh Seafood (fresh fish, shellfish, etc.)
- Agricultural Products (rice, coffee, fruits, vegetables, etc.)
- Textiles & Garments (fabric, clothing, shoes, etc.)
- Wood Products (furniture, lumber, plywood, etc.)
- Electronics & Machinery (electronics, machines, equipment, etc.)
- Chemicals & Plastics (chemicals, plastic products, rubber, etc.)
- Food & Beverages (processed food, drinks, snacks, etc.)
- Other (anything else)

Goods name: "${goodsName}"

Respond in JSON format with exactly this structure:
{
  "category": "category name",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Classification:`;
  }

  /**
   * Parse AI response into classification result
   */
  private parseClassificationResponse(response: string): ClassificationResult {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        category: parsed.category || "Other",
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || "",
      };
    } catch (error) {
      console.error("[AIClassifier] Parse error:", error);
      console.error("[AIClassifier] Response:", response);

      // Fallback: try to extract category from text
      const categoryMatch = response.match(/category[:\s]+["']?(\w+[\w\s&]*)/i);
      return {
        category: categoryMatch ? categoryMatch[1] : "Other",
        confidence: 0.5,
        reasoning: "Parsed from text response",
      };
    }
  }

  /**
   * Get or create category in database
   */
  async getOrCreateCategory(categoryName: string): Promise<string> {
    try {
      let category = await Category.findOne({ name: categoryName });

      if (!category) {
        category = await Category.create({
          name: categoryName,
          description: `Auto-generated category for ${categoryName}`,
        });
        console.log(`[AIClassifier] Created new category: ${categoryName}`);
      }

      return category._id.toString();
    } catch (error) {
      console.error("[AIClassifier] Category creation error:", error);
      // Return default "Other" category
      const defaultCategory = await Category.findOneAndUpdate(
        { name: "Other" },
        { name: "Other", description: "Uncategorized products" },
        { upsert: true, new: true },
      );
      return defaultCategory._id.toString();
    }
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
export const aiClassifier = new AIClassifier();
