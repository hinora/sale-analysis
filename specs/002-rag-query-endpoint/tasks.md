# Tasks: RAG-based Query Endpoint

**Input**: Design documents from `/specs/002-rag-query-endpoint/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are NOT explicitly requested in the specification, so test tasks are EXCLUDED from this task list.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency installation

- [X] T001 Install @xenova/transformers dependency in package.json
- [X] T002 Install vectra dependency in package.json
- [X] T003 [P] Install vitest and @vitest/ui devDependencies in package.json
- [X] T004 [P] Install @testing-library/react devDependency in package.json
- [X] T005 Create vitest.config.ts with TypeScript path aliases and test settings
- [X] T006 [P] Add test scripts to package.json (test, test:ui, test:coverage)
- [X] T007 [P] Create tests/setup.ts for test configuration

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core RAG infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Create src/lib/ai/retrieval/ directory structure
- [X] T009 [P] Create src/lib/ai/retrieval/types.ts with TypeScript interfaces (TransactionEmbedding, SessionVectorIndex, RetrievalResult, RetrievalConfig)
- [X] T010 Create src/lib/ai/retrieval/embedder.ts with model initialization function
- [X] T011 Implement formatTransactionForEmbedding function in src/lib/ai/retrieval/embedder.ts
- [X] T012 Implement generateTransactionEmbedding function in src/lib/ai/retrieval/embedder.ts
- [X] T013 Implement generateQueryEmbedding function in src/lib/ai/retrieval/embedder.ts
- [X] T014 Implement generateBatchEmbeddings function in src/lib/ai/retrieval/embedder.ts (batch size 100)
- [X] T015 Create src/lib/ai/retrieval/index.ts with in-memory session index storage (Map)
- [X] T016 Implement buildIndex function in src/lib/ai/retrieval/index.ts using vectra
- [X] T017 [P] Implement getIndex function in src/lib/ai/retrieval/index.ts
- [X] T018 [P] Implement deleteIndex function in src/lib/ai/retrieval/index.ts
- [X] T019 [P] Implement rebuildIndex function in src/lib/ai/retrieval/index.ts
- [X] T020 Create src/lib/ai/retrieval/retriever.ts
- [X] T021 Implement retrieve function in src/lib/ai/retrieval/retriever.ts with similarity threshold filtering
- [X] T022 Implement retrieveWithScores helper function in src/lib/ai/retrieval/retriever.ts
- [X] T023 Add vectorIndex and useRAG fields to AISession interface in src/lib/ai/session-manager.ts
- [X] T024 Create tests/unit/lib/ai/retrieval/ directory structure
- [X] T025 [P] Create test fixtures for sample transaction data in tests/unit/lib/ai/retrieval/fixtures.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Query Large Datasets Efficiently (Priority: P1) 🎯 MVP

**Goal**: Enable scalable querying on millions of transactions by retrieving only relevant data instead of loading everything into memory

**Independent Test**: Load 1 million transaction records, ask "Which company imported the most in Q4 2024?", verify answer returns within 10 seconds with memory usage under 2GB

### Implementation for User Story 1

- [X] T026 [P] [US1] Modify feed-data endpoint in src/pages/api/ai/feed-data.ts to detect useRAG flag on session
- [X] T027 [US1] Add indexing status update logic to src/pages/api/ai/feed-data.ts (status: indexing)
- [X] T028 [US1] Implement batch embedding generation in src/pages/api/ai/feed-data.ts after transaction data is stored
- [X] T029 [US1] Call buildIndex function from feed-data endpoint in src/pages/api/ai/feed-data.ts
- [X] T030 [US1] Update session vectorIndex field with index status in src/pages/api/ai/feed-data.ts
- [X] T031 [US1] Update session status to ready after successful indexing in src/pages/api/ai/feed-data.ts
- [X] T032 [US1] Add error handling for indexing failures in src/pages/api/ai/feed-data.ts (graceful degradation)
- [X] T033 [P] [US1] Create processQueryWithRetrieval function in src/lib/ai/query-handler.ts
- [X] T034 [US1] Modify query endpoint in src/pages/api/ai/query.ts to check session.useRAG flag
- [X] T035 [US1] Add query embedding generation in src/pages/api/ai/query.ts when useRAG is true
- [X] T036 [US1] Call retrieve function to get relevant transactions in src/pages/api/ai/query.ts
- [X] T037 [US1] Modify formatTransactionDataForContext in src/lib/ai/query-handler.ts to accept filtered transaction list
- [X] T038 [US1] Update buildSystemPrompt in src/lib/ai/query-handler.ts to work with retrieved subset
- [X] T039 [US1] Add fallback logic in src/pages/api/ai/query.ts for non-RAG sessions (preserve old behavior)
- [X] T040 [US1] Add performance logging (query time, memory usage) in src/pages/api/ai/query.ts

**Checkpoint**: At this point, User Story 1 should be fully functional - queries work on large datasets with retrieval

---

## Phase 4: User Story 2 - Maintain Query Accuracy with Citations (Priority: P2)

**Goal**: Ensure all query responses include proper citations referencing the specific retrieved transactions used to generate the answer

**Independent Test**: Ask specific questions, verify answer accuracy against database, confirm all claims cite specific transaction IDs or ranges

### Implementation for User Story 2

- [X] T041 [P] [US2] Enhance RetrievalResult type in src/lib/ai/retrieval/types.ts to include transaction IDs with scores
- [X] T042 [US2] Modify retrieve function in src/lib/ai/retrieval/retriever.ts to return transaction IDs alongside transactions
- [X] T043 [US2] Update extractCitations function in src/lib/ai/query-handler.ts to parse transaction references from retrieved set
- [X] T044 [US2] Modify buildSystemPrompt in src/lib/ai/query-handler.ts to explicitly instruct LLM to cite by transaction numbers
- [X] T045 [US2] Add transaction numbering to formatTransactionDataForContext in src/lib/ai/query-handler.ts (1|Company|..., 2|Company|...)
- [X] T046 [US2] Enhance processQueryWithRetrieval in src/lib/ai/query-handler.ts to map retrieved transactions to numbered citations
- [X] T047 [US2] Update estimateConfidence function in src/lib/ai/query-handler.ts to consider retrieval relevance scores
- [X] T048 [US2] Implement citation validation in src/pages/api/ai/query.ts (verify cited transactions are in retrieved set)
- [X] T049 [US2] Add "No relevant data found" response handling in src/pages/api/ai/query.ts when retrieval returns empty set
- [X] T050 [US2] Update QueryResponse interface in src/pages/api/ai/query.ts to include retrievalMetadata (count, scores)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - queries are fast AND include proper citations

---

## Phase 5: User Story 3 - Handle Conversational Query Context (Priority: P3)

**Goal**: Enable natural follow-up questions by maintaining conversation context and retrieving contextually relevant additional transactions

**Independent Test**: Conduct multi-turn conversation ("Who are the top importers?" → "What categories does the first company import?" → "Show their trend over time"), verify contextually appropriate answers

### Implementation for User Story 3

- [X] T051 [P] [US3] Create query enhancement function in src/lib/ai/retrieval/embedder.ts to append conversation context
- [X] T052 [US3] Modify generateQueryEmbedding in src/lib/ai/retrieval/embedder.ts to accept optional conversation context parameter
- [X] T053 [US3] Update query endpoint in src/pages/api/ai/query.ts to extract relevant conversation history from session
- [X] T054 [US3] Implement conversation context summarization in src/lib/ai/query-handler.ts (last 3 Q&A pairs)
- [X] T055 [US3] Enhance query embedding generation in src/pages/api/ai/query.ts to include conversation context
- [X] T056 [US3] Add conversational reference detection in src/lib/ai/query-handler.ts (detect "it", "they", "that company")
- [X] T057 [US3] Implement entity extraction from conversation history in src/lib/ai/query-handler.ts (company names, categories mentioned)
- [X] T058 [US3] Modify retrieve function call in src/pages/api/ai/query.ts to use enhanced query with context
- [X] T059 [US3] Add conversation context to buildSystemPrompt in src/lib/ai/query-handler.ts
- [X] T060 [US3] Update processQueryWithRetrieval in src/lib/ai/query-handler.ts to consider previous retrieved transactions for continuity

**Checkpoint**: All user stories should now be independently functional - fast queries, proper citations, AND conversational flow

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T061 [P] Add error boundary for embedding model initialization failures in src/lib/ai/retrieval/embedder.ts
- [X] T062 [P] Implement embedding model pre-warming on server startup in src/pages/api/ai/query.ts
- [X] T063 [P] Add memory cleanup for expired session indexes in src/lib/ai/retrieval/index.ts
- [X] T064 [P] Create monitoring/logging for index build performance in src/lib/ai/retrieval/index.ts
- [X] T065 Add retrieval performance metrics to query response in src/pages/api/ai/query.ts (indexTime, retrievalTime)
- [X] T066 [P] Document RAG architecture in specs/002-rag-query-endpoint/implementation-summary.md
- [X] T067 [P] Update README.md with new dependencies and environment requirements
- [X] T068 Create benchmark script in scripts/benchmark-rag.ts per quickstart.md
- [X] T069 [P] Add environment variable for retrieval config (k, threshold) with defaults
- [X] T070 Validate all quickstart.md examples are executable
- [X] T071 [P] Add JSDoc comments to all retrieval module functions
- [X] T072 Code review and refactoring pass across all modified files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 can start after Phase 2 - No dependencies on other stories
  - US2 can start after Phase 2 - Enhances US1 but independently testable
  - US3 can start after Phase 2 - Builds on US1/US2 but independently testable
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Foundational complete → Can start immediately - HIGHEST PRIORITY for MVP
- **User Story 2 (P2)**: Foundational complete → Can start in parallel with US1 or after US1 - Citations layer
- **User Story 3 (P3)**: Foundational complete → Can start in parallel or after US1/US2 - Conversation enhancement

### Within Each User Story

- **US1**: Feed-data modification → Query endpoint modification → Query handler integration
- **US2**: Retrieval enhancement → Citation extraction → Response validation
- **US3**: Query enhancement → Conversation context → Entity extraction

### Parallel Opportunities

**Setup Phase (Phase 1):**
- T003 (vitest), T004 (@testing-library), T006 (test scripts), T007 (test setup) can run in parallel

**Foundational Phase (Phase 2):**
- T009 (types.ts), T024 (test directory), T025 (fixtures) can run in parallel after T008
- T017 (getIndex), T018 (deleteIndex), T019 (rebuildIndex) can run in parallel after T016

**User Story 1:**
- T026 (feed-data useRAG check) and T033 (processQueryWithRetrieval) can run in parallel

**User Story 2:**
- T041 (RetrievalResult type), T042 (retrieve modification), T043 (extractCitations) can run in parallel

**User Story 3:**
- T051 (query enhancement), T052 (generateQueryEmbedding update), T053 (query endpoint) can run in parallel

**Polish Phase (Phase 6):**
- T061 (error boundary), T062 (pre-warming), T063 (memory cleanup), T064 (logging), T066 (docs), T067 (README), T071 (JSDoc) can all run in parallel

---

## Parallel Example: User Story 1

```bash
# These tasks can launch together within US1:
Task T026: "Modify feed-data endpoint to detect useRAG flag" (src/pages/api/ai/feed-data.ts)
Task T033: "Create processQueryWithRetrieval function" (src/lib/ai/query-handler.ts)

# After T028-T032 complete feed-data, these can run in parallel:
Task T034: "Check session.useRAG in query endpoint" (src/pages/api/ai/query.ts)
Task T037: "Modify formatTransactionDataForContext" (src/lib/ai/query-handler.ts)
Task T038: "Update buildSystemPrompt" (src/lib/ai/query-handler.ts)
```

---

## Parallel Example: Foundational Phase

```bash
# After directory structure (T008) is created:
Task T009: "Create types.ts interfaces" (src/lib/ai/retrieval/types.ts)
Task T024: "Create test directory" (tests/unit/lib/ai/retrieval/)
Task T025: "Create test fixtures" (tests/unit/lib/ai/retrieval/fixtures.ts)

# After index.ts structure (T015-T016):
Task T017: "Implement getIndex" (src/lib/ai/retrieval/index.ts)
Task T018: "Implement deleteIndex" (src/lib/ai/retrieval/index.ts)
Task T019: "Implement rebuildIndex" (src/lib/ai/retrieval/index.ts)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. ✅ Complete Phase 1: Setup (T001-T007)
2. ✅ Complete Phase 2: Foundational (T008-T025) - **CRITICAL GATE**
3. ✅ Complete Phase 3: User Story 1 (T026-T040)
4. **STOP and VALIDATE**: 
   - Load 1M transactions into a session
   - Ask analytical queries
   - Verify <10s response time
   - Verify <2GB memory usage
5. Deploy/demo MVP if ready

### Incremental Delivery

1. **Foundation** (Phase 1+2): Dependencies installed, RAG modules built → Foundation ready
2. **MVP** (Phase 3): User Story 1 → Test with large dataset → Deploy/Demo (scalable queries!)
3. **Citations** (Phase 4): User Story 2 → Test citation accuracy → Deploy/Demo (trustworthy answers!)
4. **Conversations** (Phase 5): User Story 3 → Test multi-turn dialogs → Deploy/Demo (natural UX!)
5. **Production Ready** (Phase 6): Polish → Final validation → Production deployment

Each increment delivers measurable value and can be demoed independently.

### Parallel Team Strategy

With multiple developers:

1. **Together**: Complete Setup (Phase 1) + Foundational (Phase 2)
2. **After Phase 2 completes**, parallelize:
   - **Developer A**: User Story 1 (T026-T040) - Core RAG query flow
   - **Developer B**: User Story 2 (T041-T050) - Citation enhancement
   - **Developer C**: User Story 3 (T051-T060) - Conversation context
3. Each developer tests their story independently
4. **Together**: Phase 6 Polish and integration validation

---

## Success Validation

### After User Story 1 (MVP)
- ✅ SC-001: Query 1M transactions in <10s
- ✅ SC-003: Memory usage <2GB
- ✅ SC-007: Index 100k transactions in <60s

### After User Story 2 (Citations)
- ✅ SC-002: 95% citation accuracy vs full-data approach
- ✅ SC-005: 95% queries have proper citations
- ✅ FR-008: Citations reference specific retrieved transactions

### After User Story 3 (Conversations)
- ✅ SC-008: 85% follow-up questions retrieve contextually relevant data
- ✅ FR-010: Conversation history improves retrieval

### After Polish (Production)
- ✅ SC-006: 100 concurrent queries with <15s response
- ✅ FR-014: API contract preserved (no client changes)
- ✅ All quickstart.md examples validated

---

## Notes

- **[P] tasks**: Different files, no dependencies, can run simultaneously
- **[Story] label**: Maps task to specific user story (US1, US2, US3) for traceability
- **Each user story**: Independently completable and testable without others
- **No test tasks**: Tests not explicitly requested in specification, excluded per template guidance
- **File paths**: All paths specified to enable precise implementation
- **MVP = User Story 1**: Delivers core scalability value, can deploy independently
- **Commit frequency**: After each task or logical group for incremental progress
- **Checkpoints**: Stop after each phase to validate story independence before proceeding
