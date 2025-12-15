# Implementation Plan: Multi AI Provider Support

**Branch**: `004-multi-ai-provider` | **Date**: December 8, 2025 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-multi-ai-provider/spec.md`

## Summary

Refactor the existing Ollama-only AI architecture into a provider-agnostic pattern that supports multiple AI backends (Ollama, Gemini) selectable via environment variable. The system will use a common `AIProvider` interface with concrete implementations, resolved at startup by a `ProviderRegistry` based on `AI_PROVIDER` env config. Gemini integration will use the official `@google/genai` SDK.

## Technical Context

**Language/Version**: TypeScript 5+ (strict mode)  
**Primary Dependencies**: Next.js 16+, React 19+, Material-UI v6+, Mongoose ODM, @google/genai (new)  
**Storage**: MongoDB 7+ (existing - no changes for this feature)  
**Testing**: Jest (existing setup - jest.config.js)  
**Target Platform**: Node.js (Next.js API Routes), Browser (React frontend)  
**Project Type**: Web application (monorepo with src/pages, src/lib, src/components)  
**Performance Goals**: API response < 3s for standard queries, < 10s for complex aggregations (per constitution)  
**Constraints**: No automatic fallback between providers; fail with clear error message  
**Scale/Scope**: Single active provider at runtime; supports 2 providers (Ollama, Gemini)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Data Integrity & AI-Driven Classification | ✅ PASS | No changes to data processing; AI provider abstraction preserves classification behavior |
| II. Type Safety & Schema Validation | ✅ PASS | TypeScript interfaces required for AIProvider contract; strong typing maintained |
| III. Performance & Scalability | ✅ PASS | Must maintain <3s standard / <10s complex query response times |
| IV. User Experience & Accessibility | ✅ PASS | No UI changes; backend refactoring only |
| V. AI Integration & Training Control | ✅ PASS | Preserves user control over data fed to AI; provider abstraction is transparent |

**Technology Stack Compliance**:
- ✅ TypeScript 5+ (strict mode) - Maintained
- ✅ Next.js API Routes - No changes to routing structure
- ✅ Ollama integration - Preserved via OllamaProvider
- ⚠️ New dependency: `@google/genai` SDK - Aligns with AI integration principle

**GATE RESULT**: PASS - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/004-multi-ai-provider/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (TypeScript interfaces)
│   └── ai-provider.ts   # AIProvider interface contract
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (this feature)

```text
src/
└── lib/
    └── ai/
        ├── providers/              # NEW: Provider implementations
        │   ├── types.ts            # AIProvider interface, ProviderConfig types
        │   ├── ollama-provider.ts  # OllamaProvider (refactored from ollama-client.ts)
        │   ├── gemini-provider.ts  # GeminiProvider (new)
        │   └── index.ts            # ProviderRegistry, getProvider()
        ├── ollama-client.ts        # PRESERVED: Low-level Ollama HTTP client (used by OllamaProvider)
        ├── query-handler.ts        # MODIFIED: Use AIProvider instead of direct OllamaClient
        ├── classifier.ts           # MODIFIED: Use AIProvider instead of getOllamaClient()
        └── name-shortener.ts       # MODIFIED: Use AIProvider instead of getOllamaClient()

tests/
├── unit/
│   ├── ollama-provider.test.ts     # NEW
│   ├── gemini-provider.test.ts     # NEW
│   └── provider-registry.test.ts   # NEW
└── integration/
    └── ai-provider.test.ts         # NEW: Integration tests for provider switching
```

**Structure Decision**: Follows existing `src/lib/ai/` structure. New `providers/` subdirectory isolates provider abstraction from existing AI utilities. Minimal changes to existing files.

## Complexity Tracking

> No constitution violations requiring justification.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Provider Pattern | Simple Factory via ProviderRegistry | Avoids over-engineering; single provider active at runtime |
| Dependency | @google/genai SDK | Per clarification - use SDK not direct HTTP calls |
| Fallback | None (fail with error) | Per clarification - clearer behavior, simpler implementation |

## Constitution Re-Check (Post-Design)

*Verified after Phase 1 design completion*

| Principle | Status | Design Compliance |
|-----------|--------|-------------------|
| I. Data Integrity | ✅ PASS | AIProvider interface preserves prompt/response flow; no data transformation changes |
| II. Type Safety | ✅ PASS | Strong TypeScript interfaces in `contracts/ai-provider.ts`; all types exported |
| III. Performance | ✅ PASS | Design adds minimal overhead (factory lookup); provider implementations maintain perf |
| IV. User Experience | ✅ PASS | Backend-only change; UI unaffected |
| V. AI Integration | ✅ PASS | Both providers support `generate()` with same response format for classification/queries |

**Design Artifacts Verified**:
- ✅ `data-model.md` - All entities properly typed
- ✅ `contracts/ai-provider.ts` - Complete interface contract
- ✅ `research.md` - SDK selection documented with rationale
- ✅ `quickstart.md` - Configuration guide complete

**GATE RESULT**: PASS - Ready for Phase 2 (/speckit.tasks)
