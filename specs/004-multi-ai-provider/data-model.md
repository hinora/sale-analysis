# Data Model: Multi AI Provider Support

**Created**: December 8, 2025  
**Feature Branch**: `004-multi-ai-provider`

## Overview

This document defines the data structures and type definitions for the multi-provider AI architecture. No database schema changes are required; all entities are TypeScript interfaces for the provider abstraction layer.

---

## Core Entities

### 1. AIProvider (Interface)

The abstract contract all AI providers must implement.

| Property/Method | Type | Description |
|-----------------|------|-------------|
| `name` | `string` (readonly) | Provider identifier (e.g., "ollama", "gemini") |
| `generate()` | `Promise<GenerateResponse>` | Generate text completion |
| `healthCheck()` | `Promise<HealthCheckResult>` | Check provider availability |
| `listModels()` | `Promise<ModelInfo[]>` (optional) | List available models |

**Constraints**:
- All providers must be stateless (configuration injected via constructor)
- Methods must not throw unhandled exceptions; wrap in typed error responses

---

### 2. GenerateOptions

Input parameters for text generation.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `prompt` | `string` | Yes | - | The prompt text to send to the model |
| `model` | `string` | No | Provider default | Model identifier |
| `temperature` | `number` | No | `0.7` | Sampling temperature (0-1) |
| `topP` | `number` | No | `0.9` | Top-p sampling |
| `topK` | `number` | No | `40` | Top-k sampling |
| `maxTokens` | `number` | No | Provider default | Maximum response tokens |
| `context` | `unknown` | No | - | Provider-specific context (e.g., Ollama conversation context) |
| `keepAlive` | `string` | No | `"30m"` | Ollama-specific: how long to keep model loaded |

---

### 3. GenerateResponse

Output from text generation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | `string` | Yes | Generated text response |
| `model` | `string` | Yes | Model that generated the response |
| `context` | `unknown` | No | Provider-specific context for follow-up |
| `done` | `boolean` | No | Whether generation is complete |
| `usage` | `UsageInfo` | No | Token usage statistics |

---

### 4. UsageInfo

Token usage statistics (when available).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `promptTokens` | `number` | No | Tokens in the prompt |
| `completionTokens` | `number` | No | Tokens in the response |
| `totalTokens` | `number` | No | Total tokens used |

---

### 5. HealthCheckResult

Health check response.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `healthy` | `boolean` | Yes | Whether provider is operational |
| `provider` | `string` | Yes | Provider name |
| `latencyMs` | `number` | Yes | Response time in milliseconds |
| `error` | `string` | No | Error message if unhealthy |
| `details` | `Record<string, unknown>` | No | Additional diagnostic info |

---

### 6. ModelInfo

Information about an available model.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Model identifier |
| `displayName` | `string` | No | Human-readable name |
| `description` | `string` | No | Model description |
| `contextWindow` | `number` | No | Max context length in tokens |
| `modifiedAt` | `string` | No | Last modification timestamp |

---

### 7. ProviderConfig

Configuration for provider initialization.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"ollama" \| "gemini"` | Yes | Provider type |

#### OllamaConfig (extends ProviderConfig)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | `"ollama"` | Yes | - | Provider type |
| `host` | `string` | No | `"http://ollama:11434"` | Ollama host URL |
| `model` | `string` | No | `"deepseek-r1:1.5b"` | Default model |

#### GeminiConfig (extends ProviderConfig)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | `"gemini"` | Yes | - | Provider type |
| `apiKey` | `string` | Yes | - | Gemini API key |
| `model` | `string` | No | `"gemini-2.5-flash"` | Default model |
| `apiVersion` | `string` | No | `"v1beta"` | API version |

---

### 8. ProviderType (Enum)

Supported provider identifiers.

| Value | Description |
|-------|-------------|
| `"ollama"` | Local Ollama instance |
| `"gemini"` | Google Gemini API |

---

## Entity Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                      ProviderRegistry                        │
│  - Reads AI_PROVIDER env var                                 │
│  - Creates appropriate provider instance                     │
│  - Returns singleton AIProvider                              │
└─────────────────────┬───────────────────────────────────────┘
                      │ creates
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      AIProvider                              │
│                    <<interface>>                             │
├─────────────────────────────────────────────────────────────┤
│ + name: string                                               │
│ + generate(options: GenerateOptions): Promise<GenerateResponse>
│ + healthCheck(): Promise<HealthCheckResult>                  │
│ + listModels?(): Promise<ModelInfo[]>                        │
└─────────────────────┬───────────────────────────────────────┘
                      │ implemented by
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ OllamaProvider  │     │ GeminiProvider  │
├─────────────────┤     ├─────────────────┤
│ - OllamaClient  │     │ - GoogleGenAI   │
│ - OllamaConfig  │     │ - GeminiConfig  │
└─────────────────┘     └─────────────────┘
```

---

## State & Lifecycle

| Entity | Lifecycle | Notes |
|--------|-----------|-------|
| ProviderRegistry | Application singleton | Created once at startup |
| AIProvider | Application singleton | One instance per app lifecycle |
| GenerateOptions | Per-request | Created fresh for each AI call |
| GenerateResponse | Per-request | Immutable response object |

---

## Validation Rules

### GenerateOptions Validation

| Rule | Description |
|------|-------------|
| `prompt` | Must be non-empty string, max 100,000 characters |
| `temperature` | Must be 0 ≤ value ≤ 1 |
| `topP` | Must be 0 < value ≤ 1 |
| `topK` | Must be positive integer |
| `maxTokens` | Must be positive integer |

### ProviderConfig Validation

| Rule | Description |
|------|-------------|
| `type` | Must be "ollama" or "gemini" |
| `host` (Ollama) | Must be valid URL format |
| `apiKey` (Gemini) | Must be non-empty string when type is "gemini" |

---

## Environment Variable Mapping

| Env Variable | Entity Field | Default |
|--------------|--------------|---------|
| `AI_PROVIDER` | `ProviderConfig.type` | `"ollama"` |
| `OLLAMA_HOST` | `OllamaConfig.host` | `"http://ollama:11434"` |
| `AI_MODEL` | `OllamaConfig.model` | `"deepseek-r1:1.5b"` |
| `GEMINI_API_KEY` | `GeminiConfig.apiKey` | (required) |
| `GEMINI_MODEL` | `GeminiConfig.model` | `"gemini-2.5-flash"` |
