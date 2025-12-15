# Tasks: Multi AI Provider Support

**Input**: Design documents from `/specs/004-multi-ai-provider/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ai-provider.ts ✅

**Tests**: Not explicitly requested in spec - tests are OPTIONAL but recommended for core provider logic.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, etc.) - omitted for Setup/Foundational phases

---

## Phase 1: Setup

**Purpose**: Install dependencies and create directory structure

- [x] T001 Install @google/genai SDK dependency via `npm install @google/genai`
- [x] T002 [P] Create providers directory structure at `src/lib/ai/providers/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core provider abstraction that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create AIProvider interface and types in `src/lib/ai/providers/types.ts` (from contracts/ai-provider.ts)
- [x] T004 [P] Create AIProviderError class and error codes in `src/lib/ai/providers/types.ts`
- [x] T005 Implement OllamaProvider class in `src/lib/ai/providers/ollama-provider.ts` (wraps existing OllamaClient)
- [x] T006 Implement OllamaProvider.generate() method mapping to OllamaClient.generate()
- [x] T007 Implement OllamaProvider.healthCheck() method using existing OllamaClient.healthCheck()
- [x] T008 [P] Implement OllamaProvider.listModels() method using existing OllamaClient.listModels()

**Checkpoint**: OllamaProvider complete - existing functionality preserved in new abstraction

---

## Phase 3: User Story 1 - Switch AI Provider via Environment Config (Priority: P1) 🎯 MVP

**Goal**: Enable switching between Ollama and Gemini via `AI_PROVIDER` environment variable

**Independent Test**: Set `AI_PROVIDER=ollama`, verify Ollama handles queries; set `AI_PROVIDER=gemini`, verify Gemini handles queries

### Implementation for User Story 1

- [x] T009 [US1] Create ProviderRegistry factory in `src/lib/ai/providers/index.ts`
- [x] T010 [US1] Implement getProviderConfig() to read env vars (AI_PROVIDER, OLLAMA_HOST, AI_MODEL, GEMINI_API_KEY, GEMINI_MODEL)
- [x] T011 [US1] Implement createProvider() factory method that instantiates correct provider based on config
- [x] T012 [US1] Implement getProvider() singleton accessor with lazy initialization
- [x] T013 [US1] Add validation for AI_PROVIDER env var with warning log for invalid values
- [x] T014 [US1] Add fallback to Ollama when AI_PROVIDER is not set or invalid
- [x] T015 [US1] Export provider types and getProvider() from `src/lib/ai/providers/index.ts`
- [x] T016 [US1] Update QueryHandler in `src/lib/ai/query-handler.ts` to use getProvider() instead of OllamaClient
- [x] T017 [US1] Update AIClassifier in `src/lib/ai/classifier.ts` to use getProvider() instead of getOllamaClient()
- [x] T018 [US1] Update AINameShortener in `src/lib/ai/name-shortener.ts` to use getProvider() instead of getOllamaClient()

**Checkpoint**: User Story 1 complete - provider switching works via env config, Ollama fully functional

---

## Phase 4: User Story 2 - Query AI Using Gemini Provider (Priority: P1)

**Goal**: Implement GeminiProvider so analysts can query transaction data using Gemini

**Independent Test**: Set `AI_PROVIDER=gemini` with valid `GEMINI_API_KEY`, submit query, verify Gemini returns analysis

### Implementation for User Story 2

- [x] T019 [US2] Create GeminiProvider class in `src/lib/ai/providers/gemini-provider.ts`
- [x] T020 [US2] Initialize GoogleGenAI client with apiKey from config
- [x] T021 [US2] Implement GeminiProvider.generate() method using ai.models.generateContent()
- [x] T022 [US2] Map GenerateOptions to Gemini SDK format (prompt, model, temperature, topP, topK)
- [x] T023 [US2] Map Gemini response to GenerateResponse format (text, model, usage)
- [x] T024 [US2] Implement error handling for Gemini API errors (AUTH_FAILED, RATE_LIMITED, QUOTA_EXCEEDED)
- [x] T025 [US2] Add clear error messages for missing/invalid GEMINI_API_KEY
- [x] T026 [US2] Register GeminiProvider in ProviderRegistry factory (update createProvider in `src/lib/ai/providers/index.ts`)

**Checkpoint**: User Story 2 complete - Gemini queries work with proper error handling

---

## Phase 5: User Story 3 - Configure Provider-Specific Settings (Priority: P2)

**Goal**: Support provider-specific configuration (model, temperature, etc.) via environment variables

**Independent Test**: Set GEMINI_MODEL=gemini-2.5-pro, verify Gemini uses that model; set AI_MODEL=deepseek-r1:8b, verify Ollama uses that model

### Implementation for User Story 3

- [x] T027 [US3] Add GEMINI_MODEL env var support in GeminiProvider (default: gemini-2.5-flash)
- [x] T028 [US3] Ensure OllamaProvider respects AI_MODEL env var (existing behavior)
- [x] T029 [US3] Add temperature configuration support to both providers
- [x] T030 [US3] Update docker-compose.yml with new Gemini env var placeholders (commented)
- [x] T031 [US3] Update docker-compose.prod.yml with new Gemini env var placeholders (commented)

**Checkpoint**: User Story 3 complete - provider-specific settings configurable

---

## Phase 6: User Story 4 - Health Check for Active Provider (Priority: P2)

**Goal**: Provide health check endpoint to verify active provider status

**Independent Test**: Call health check endpoint, verify it returns provider name, healthy status, and latency

### Implementation for User Story 4

- [x] T032 [US4] Implement GeminiProvider.healthCheck() method using simple generateContent call
- [x] T033 [US4] Create health check API endpoint at `src/pages/api/ai/health.ts`
- [x] T034 [US4] Return HealthCheckResult JSON (healthy, provider, latencyMs, error)
- [x] T035 [US4] Handle provider errors gracefully in health check response

**Checkpoint**: User Story 4 complete - health check endpoint functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finalization, documentation, and validation

- [x] T036 [P] Add JSDoc comments to all public functions in providers/
- [x] T037 [P] Update quickstart.md if any configuration changes
- [x] T038 Verify backward compatibility: test with AI_PROVIDER unset (should use Ollama)
- [x] T039 Run existing test suite to ensure no regressions
- [x] T040 Manual validation per quickstart.md scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ─────────────────┐
                                ▼
Phase 2: Foundational ──────────┤ (BLOCKS all user stories)
                                │
         ┌──────────────────────┴──────────────────────┐
         ▼                      ▼                      ▼
Phase 3: US1 (P1)        Phase 4: US2 (P1)     (depends on US1)
Provider Switching       Gemini Implementation
         │                      │
         └──────────────────────┴──────────────────────┐
                                                       ▼
                    Phase 5: US3 (P2) ─────► Phase 6: US4 (P2)
                    Provider Settings       Health Check
                                                       │
                                                       ▼
                                            Phase 7: Polish
```

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|------------|-------------------|
| US1 (Provider Switching) | Foundational | - |
| US2 (Gemini Implementation) | US1 (needs registry) | - |
| US3 (Provider Settings) | US1 + US2 | US4 |
| US4 (Health Check) | US1 + US2 | US3 |

### Within Each Phase

- Types/interfaces before implementations
- Core provider methods before factory registration
- Factory complete before consumers updated

---

## Parallel Opportunities

### Phase 2 Parallelization

```bash
# Can run in parallel:
T004 [P] Create AIProviderError class
T008 [P] Implement OllamaProvider.listModels()
```

### Phase 3 (US1) - After T015 completes

```bash
# Can run in parallel (different files):
T016 Update QueryHandler
T017 Update AIClassifier  
T018 Update AINameShortener
```

### Phase 7 Parallelization

```bash
# Can run in parallel:
T036 [P] Add JSDoc comments
T037 [P] Update quickstart.md
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (OllamaProvider working)
3. Complete Phase 3: US1 - Provider switching via env
4. **VALIDATE**: Test with AI_PROVIDER=ollama (existing functionality preserved)
5. Complete Phase 4: US2 - Gemini implementation
6. **VALIDATE**: Test with AI_PROVIDER=gemini (new capability works)
7. **MVP COMPLETE** - Can deploy/demo

### Full Feature Delivery

1. MVP (above)
2. Add US3: Provider-specific settings
3. Add US4: Health check endpoint
4. Complete Polish phase
5. Full feature complete

---

## Notes

- `ollama-client.ts` is PRESERVED (not modified) - OllamaProvider wraps it
- No database changes required
- No UI changes required (backend only)
- Backward compatible: unset AI_PROVIDER defaults to Ollama
- Total tasks: 40
- Estimated parallelizable: ~30%
