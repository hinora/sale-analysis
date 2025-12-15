# Research: Multi AI Provider Support

**Created**: December 8, 2025  
**Feature Branch**: `004-multi-ai-provider`

## Summary

Research findings for implementing a multi-provider AI architecture supporting Ollama and Google Gemini with environment-based provider selection.

---

## 1. Google Gemini SDK Selection

### Decision: Use `@google/genai` SDK

**Rationale**: The previously popular `@google/generative-ai` SDK is now **deprecated** (end-of-life: August 31, 2025). Google recommends migrating to the new `@google/genai` SDK.

### Alternatives Considered

| SDK | Status | Notes |
|-----|--------|-------|
| `@google/generative-ai` | ⚠️ Deprecated | EOL August 2025, no new features |
| `@google/genai` | ✅ Active | New unified SDK, Gemini 2.0+ features |
| Direct HTTP API | ❌ Rejected | Per clarification: use SDK not direct calls |

### Key SDK Features

```typescript
// Installation
npm install @google/genai

// Basic usage
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Your prompt here',
});

console.log(response.text);
```

### SDK Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `apiKey` | Gemini API key (required for Gemini Developer API) | - |
| `apiVersion` | API version (`v1`, `v1beta`, `v1alpha`) | `v1beta` |
| `vertexai` | Enable Vertex AI mode | `false` |

### Error Handling

The SDK provides `ApiError` class with structured error information:
- `error.name` - Error type
- `error.message` - Human-readable message
- `error.status` - HTTP status code

---

## 2. Provider Interface Design

### Decision: Simple Strategy Pattern with Factory

**Rationale**: Single provider active at runtime (no fallback); simple factory pattern sufficient.

### Interface Contract

```typescript
interface AIProvider {
  readonly name: string;
  
  generate(options: GenerateOptions): Promise<GenerateResponse>;
  healthCheck(): Promise<HealthCheckResult>;
  listModels?(): Promise<ModelInfo[]>;
}

interface GenerateOptions {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  context?: unknown; // Provider-specific context (e.g., Ollama's context array)
}

interface GenerateResponse {
  text: string;
  model: string;
  context?: unknown; // For maintaining conversation state
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

interface HealthCheckResult {
  healthy: boolean;
  provider: string;
  latencyMs: number;
  error?: string;
}
```

### Alternatives Considered

| Pattern | Decision | Reason |
|---------|----------|--------|
| Abstract Factory | ❌ Rejected | Over-engineering for 2 providers |
| Dependency Injection Container | ❌ Rejected | Project doesn't use DI framework |
| Simple Factory + Strategy | ✅ Selected | Matches existing codebase patterns |

---

## 3. Environment Variable Schema

### Decision: Provider-specific env vars with common selector

```bash
# Provider selection
AI_PROVIDER=ollama|gemini  # Default: ollama

# Ollama-specific (existing)
OLLAMA_HOST=http://host.docker.internal:11434
AI_MODEL=deepseek-r1:8b

# Gemini-specific (new)
GEMINI_API_KEY=your-api-key
GEMINI_MODEL=gemini-2.5-flash  # Default if not set
```

### Validation Rules

| Variable | Required | Validation |
|----------|----------|------------|
| `AI_PROVIDER` | No | Must be `ollama` or `gemini`; defaults to `ollama` |
| `OLLAMA_HOST` | When Ollama | Valid URL format |
| `AI_MODEL` | No | Used by Ollama; has default |
| `GEMINI_API_KEY` | When Gemini | Non-empty string |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash` |

---

## 4. Model Recommendations

### Gemini Models

| Model | Use Case | Context Window |
|-------|----------|----------------|
| `gemini-2.5-flash` | Fast responses, cost-effective | 1M tokens |
| `gemini-2.5-pro` | Complex reasoning | 1M tokens |
| `gemini-2.0-flash` | Latest features | 1M tokens |

**Recommendation**: Default to `gemini-2.5-flash` for balance of speed/quality.

### Ollama Models (existing)

| Model | Use Case |
|-------|----------|
| `deepseek-r1:1.5b` | Development (fast, low memory) |
| `deepseek-r1:8b` | Production (better quality) |

---

## 5. Migration Strategy for Existing Code

### Files Requiring Modification

| File | Change Type | Scope |
|------|-------------|-------|
| `src/lib/ai/query-handler.ts` | Modify | Replace `OllamaClient` with `AIProvider` |
| `src/lib/ai/classifier.ts` | Modify | Replace `getOllamaClient()` with `getProvider()` |
| `src/lib/ai/name-shortener.ts` | Modify | Replace `getOllamaClient()` with `getProvider()` |
| `src/lib/ai/ollama-client.ts` | Preserve | Keep as low-level client for OllamaProvider |

### New Files

| File | Purpose |
|------|---------|
| `src/lib/ai/providers/types.ts` | AIProvider interface, config types |
| `src/lib/ai/providers/ollama-provider.ts` | OllamaProvider implementation |
| `src/lib/ai/providers/gemini-provider.ts` | GeminiProvider implementation |
| `src/lib/ai/providers/index.ts` | ProviderRegistry, `getProvider()` factory |

### Backward Compatibility

- `AI_PROVIDER` defaults to `ollama` - no change required for existing deployments
- `AI_MODEL` continues to work for Ollama model selection
- Existing `OLLAMA_HOST` configuration preserved

---

## 6. Testing Strategy

### Unit Tests

| Test File | Coverage |
|-----------|----------|
| `ollama-provider.test.ts` | Mock Ollama HTTP responses |
| `gemini-provider.test.ts` | Mock GoogleGenAI SDK |
| `provider-registry.test.ts` | Factory logic, env validation |

### Integration Tests

| Scenario | Description |
|----------|-------------|
| Provider switching | Verify correct provider selected by env |
| Health check | Verify health endpoint per provider |
| Error handling | Verify clear error messages on failure |

---

## 7. Docker/Environment Updates

### docker-compose.yml changes

```yaml
environment:
  - AI_PROVIDER=ollama  # or gemini
  - OLLAMA_HOST=http://host.docker.internal:11434
  - AI_MODEL=deepseek-r1:1.5b
  # Add for Gemini:
  # - GEMINI_API_KEY=${GEMINI_API_KEY}
  # - GEMINI_MODEL=gemini-2.5-flash
```

---

## References

- [Google Gen AI SDK (npm)](https://www.npmjs.com/package/@google/genai)
- [Google Gen AI SDK (GitHub)](https://github.com/googleapis/js-genai)
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Migration Guide from old SDK](https://ai.google.dev/gemini-api/docs/migrate)
