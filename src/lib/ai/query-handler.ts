/**
 * AI Query Handler
 *
 * Formats prompts and processes natural language queries against transaction data
 * using Ollama LLM with grounded, citation-based responses
 */

import { getProvider, type AIProvider } from "./providers";
import type { AIMessage, AISession } from "./session-manager";

import { getTools, toolMapper } from "./aggregation-database";
import { transactionColumnExplanations } from "../db/models/Transaction";

/**
 * Query result with response and citations
 */
export interface QueryResult {
  answer: string;
  citations: string[];
  confidence: "high" | "medium" | "low";
  processingTime: number;
}

/**
 * Filter execution log for debugging and performance tracking
 */
/**
 * Query handler class
 */
export class QueryHandler {
  private provider: AIProvider;

  constructor() {
    this.provider = getProvider();
  }

  /**
   * Validate query before processing
   */
  validateQuery(query: string): { valid: boolean; error?: string } {
    if (!query || query.trim().length === 0) {
      return {
        valid: false,
        error: "Câu hỏi không được để trống",
      };
    }

    if (query.length > 1000) {
      return {
        valid: false,
        error: "Câu hỏi quá dài (tối đa 1000 ký tự)",
      };
    }

    return { valid: true };
  }

  /**
   * Validate AI response structure
   */
  private validateAIResponse(
    responseText: string,
    session: AISession,
  ): {
    valid: boolean;
    parsedResponse?: {
      answer?: string;
      tools?: Array<{
        toolName: string;
        parameters: Record<string, unknown>;
      }>;
    };
  } {
    // Try to parse JSON
    let parsedResponse: {
      answer?: string;
      tools?: Array<{
        toolName: string;
        parameters: Record<string, unknown>;
      }>;
    };

    try {
      parsedResponse = JSON.parse(responseText);
    } catch (jsonError) {
      // Try to extract JSON from the end of the response
      console.log(
        "[IterativeQuery] Direct JSON parse failed, attempting to extract JSON from text",
      );

      // Look for JSON object at the end (matches { ... } or [ ... ])
      const jsonMatch = responseText.match(/(\{[\s\S]*\}|\[[\s\S]*\])$/);

      if (jsonMatch) {
        try {
          parsedResponse = JSON.parse(jsonMatch[1]);
          console.log(
            "[IterativeQuery] Successfully extracted JSON from response text",
          );
        } catch (extractError) {
          console.error(
            "[IterativeQuery] Failed to parse extracted JSON:",
            extractError,
          );

          session.conversationHistory.push({
            role: "system",
            content: `ERROR: Invalid JSON. Required format: {"answer": "..."} or {"tools": [...]}`,
            timestamp: new Date(),
          });

          return { valid: false };
        }
      } else {
        console.error(
          "[IterativeQuery] No JSON structure found in response:",
          jsonError,
        );

        session.conversationHistory.push({
          role: "system",
          content: `ERROR: Invalid JSON. Required format: {"answer": "..."} or {"tools": [...]}`,
          timestamp: new Date(),
        });

        return { valid: false };
      }
    }

    // Validate JSON structure
    const hasAnswer = typeof parsedResponse.answer === "string";
    const hasTools = Array.isArray(parsedResponse.tools);

    if (!hasAnswer && !hasTools) {
      console.error(
        "[IterativeQuery] Invalid JSON structure - missing both 'answer' and 'tools'",
      );

      session.conversationHistory.push({
        role: "system",
        content: `ERROR: Missing required field. Include "answer" or "tools".`,
        timestamp: new Date(),
      });

      return { valid: false };
    }

    // If has answer, it's valid
    if (hasAnswer) {
      return { valid: true, parsedResponse };
    }

    // Validate tools array is not empty
    if (!parsedResponse.tools || parsedResponse.tools.length === 0) {
      console.log(
        "[IterativeQuery] No tools requested, but no answer provided.",
      );

      session.conversationHistory.push({
        role: "system",
        content: `ERROR: Empty tools array. Provide answer or valid tools.`,
        timestamp: new Date(),
      });

      return { valid: false };
    }

    // Validate each tool request structure
    for (const tool of parsedResponse.tools) {
      if (!tool.toolName || typeof tool.toolName !== "string") {
        console.error(
          "[IterativeQuery] Invalid tool request - missing or invalid toolName",
        );

        session.conversationHistory.push({
          role: "system",
          content: `ERROR: Tool missing "toolName" string field.`,
          timestamp: new Date(),
        });

        return { valid: false };
      }

      if (!tool.parameters || typeof tool.parameters !== "object") {
        console.error(
          "[IterativeQuery] Invalid tool request - missing or invalid parameters",
        );

        session.conversationHistory.push({
          role: "system",
          content: `ERROR: Tool "${tool.toolName}" missing "parameters" object.`,
          timestamp: new Date(),
        });

        return { valid: false };
      }
    }

    return { valid: true, parsedResponse };
  }

  buildSystemMessage(): AIMessage[] {
    return [
      {
        role: "system",
        content: `You are an AI assistant specialized in analyzing import trade data. Your task is to answer questions based on the provided transaction data, using the available tools to retrieve necessary information. Always respond in Vietnamese, do not use any other language.
CRITICAL RULES FOR DATA MATCHING:
1. NEVER assume the exact format of data in the database (e.g., country names, company names, product names)
2. BEFORE filtering by any field value (importCountry, importCompany, goodsName, etc.), you MUST first use getDistinctValues tool to check what values actually exist in the database
3. Example: If user asks about "Mỹ" (America), first use getDistinctValues for importCountry to see the database contains "US", "USA", "United States", etc.
4. If a filter returns no results, use getDistinctValues to check what values are available, then retry with the correct value
5. Do NOT tell user "no data found" without first checking what data exists in the database

WORKFLOW FOR QUERIES WITH FILTERING:
Step 1: Use getDistinctValues to discover actual values in database
Step 2: Match user's query terms with actual database values
Step 3: Use appropriate query tools with correct database values
Step 4: Provide answer based on results

non negotiable: All company inside the database is import company. Do NOT mention import company in your answer.

Available tools for querying transaction data:
        ${JSON.stringify(getTools())}

Transaction data fields reference:
        ${JSON.stringify(transactionColumnExplanations())}

non negotiable: Your response MUST be in one of these 2 JSON formats:
1. If the question can be answered directly without tools:
{
  "answer": "Your answer string for the user's question"
}

2. If you need to use tools to get data before answering:
{
  "tools": [
    {
      "toolName": "Name of the tool to use",
      "parameters": "Tool parameters as a JSON object"
    }
  ]
}

non negotiable: Only respond in one of the two JSON formats above. Do NOT respond in any other format. Do NOT include any text outside the JSON structure. If you don't have enough information to answer, use the tools to retrieve the necessary data.
non negotiable: Your answer to the user must always be in Vietnamese.
        `,
        timestamp: new Date(),
      },
    ];
  }

  async processUserQuestion(session: AISession, userQuestion: string) {
    console.log(
      `[IterativeQuery] Starting iterative query processing for: "${userQuestion.substring(0, 100)}..."`,
    );

    try {
      if (session.conversationHistory.length === 0) {
        // First message - add system prompt
        session.conversationHistory.push(...this.buildSystemMessage());
      }

      // Add user question to conversation history
      session.conversationHistory.push({
        role: "user",
        content: userQuestion,
        timestamp: new Date(),
      });

      while (true) {
        const response = await this.provider.generate({
          prompt: JSON.stringify(session.conversationHistory),
          temperature: 0.3,
        });

        console.log(`[IterativeQuery] LLM Response: ${response.text}`);

        session.conversationHistory.push({
          role: "assistant",
          content: response.text,
          timestamp: new Date(),
        });

        // Track the current history length before validation
        const historyLengthBeforeValidation =
          session.conversationHistory.length;

        // Validate AI response
        const validation = this.validateAIResponse(response.text, session);

        if (!validation.valid || !validation.parsedResponse) {
          // Error message was added to history by validateAIResponse
          // Continue to let AI see the error, but we'll remove it in the next iteration
          continue; // Retry with error feedback
        }

        // If validation passed, remove any error messages that were added in previous iteration
        // Find and remove system error messages that came after the previous assistant response
        const errorMessageIndex = session.conversationHistory.findIndex(
          (msg, idx) =>
            idx >= historyLengthBeforeValidation - 1 &&
            msg.role === "system" &&
            msg.content.startsWith("ERROR:"),
        );

        if (errorMessageIndex !== -1) {
          console.log(
            "[IterativeQuery] Removing previous error message from context",
          );
          session.conversationHistory.splice(errorMessageIndex, 1);
        }

        const parsedResponse = validation.parsedResponse;

        // If AI provided a final answer, return it
        if (parsedResponse.answer) {
          console.log(
            "[IterativeQuery] AI provided final answer without tools",
          );
          return {
            success: true,
            answer: parsedResponse.answer,
          };
        }

        // Execute requested tools
        if (parsedResponse.tools) {
          for (const toolRequest of parsedResponse.tools) {
            console.log(
              `[IterativeQuery] Tool requested: ${toolRequest.toolName} with parameters`,
              toolRequest.parameters,
            );

            // Call the requested tool and get result
            let toolResult: unknown;

            const tools = toolMapper();
            const toolFunction =
              tools[toolRequest.toolName as keyof typeof tools];

            if (toolFunction) {
              try {
                console.log(`[IterativeQuery] Calling ${toolRequest.toolName}`);
                toolResult = await toolFunction(
                  toolRequest.parameters as never,
                );

                console.log(
                  `[IterativeQuery] Tool ${toolRequest.toolName} returned:`,
                  toolResult,
                );
              } catch (toolError) {
                console.error(
                  `[IterativeQuery] Error executing tool ${toolRequest.toolName}:`,
                  toolError,
                );
                toolResult = {
                  error: `Failed to execute tool: ${toolError instanceof Error ? toolError.message : String(toolError)}`,
                };
              }
            } else {
              console.warn(
                `[IterativeQuery] Unknown tool: ${toolRequest.toolName}`,
              );
              toolResult = {
                error: `Unknown tool: ${toolRequest.toolName}`,
              };
            }

            // Add tool result to conversation history
            session.conversationHistory.push({
              role: "tool",
              content: `Tool ${toolRequest.toolName} result: ${JSON.stringify(toolResult)}`,
              timestamp: new Date(),
            });
          }
        }
      }
    } catch (error) {
      console.error("[IterativeQuery] Error during iterative processing:", {
        error: error instanceof Error ? error.message : String(error),
        userQuestion: userQuestion.substring(0, 100),
      });

      return {
        success: false,
        error: { type: "application_error", message: String(error) },
      };
    }
  }
}

// Export singleton instance
export const queryHandler = new QueryHandler();
