# Tasks: Multi-Stage Adaptive Query System

**Input**: Design documents from `/specs/002-multi-stage-adaptive-query/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Tests are OPTIONAL in this implementation - only core functionality tests included based on quickstart.md recommendations.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency installation

- [X] T001 Install new dependencies: `npm install --save fast-levenshtein remove-accents`
- [X] T002 [P] Install test dependencies: `npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest @types/jest`
- [X] T003 [P] Create Jest configuration file `jest.config.js` per quickstart.md
- [X] T004 [P] Create Jest setup file `jest.setup.js` with @testing-library/jest-dom import
- [X] T005 [P] Add test scripts to `package.json`: test, test:watch, test:coverage
- [X] T006 Create synonym configuration file `src/lib/ai/synonyms.json` with country and company mappings

**Checkpoint**: Dependencies installed, test framework configured

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core text normalization and validation infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 [P] Create `src/lib/ai/text-normalizer.ts` with normalizeText(), removeDiacritics(), matchesFilter() functions
- [X] T008 [P] Add vietnameseCharMap to text-normalizer.ts for đ/Đ character handling
- [X] T009 [P] Implement checkSynonyms() function in text-normalizer.ts with synonyms.json loading
- [X] T010 [P] Add Zod schemas to `src/lib/utils/validation.ts`: FilterExpressionSchema, QueryIntentSchema, AggregationSpecSchema
- [X] T011 Create unit test `tests/unit/text-normalizer.test.ts` with 5 test cases (case normalization, whitespace, diacritics, contains matching, synonyms)

**Checkpoint**: Foundation ready - text matching and validation infrastructure complete, all user stories can now begin

---

## Phase 3: User Story 1 - Intelligent In-Memory Filtering (Priority: P1) 🎯 MVP

**Goal**: Filter already-loaded transactions using smart text matching (case-insensitive, contains, Vietnamese normalization, fuzzy matching)

**Independent Test**: Load 5,000 transactions into session, ask "Show me US companies", verify only US transactions included in filtered result (should match "US", "USA", "United States" variations)

### Implementation for User Story 1

- [X] T012 [P] [US1] Create `src/lib/ai/filter-engine.ts` with FilterExpression, FilterOptions interfaces
- [X] T013 [P] [US1] Implement executeFilters() function in filter-engine.ts (applies multiple filters with AND/OR logic)
- [X] T014 [US1] Implement applyFilter() function in filter-engine.ts (applies single filter to transaction array)
- [X] T015 [US1] Implement matchesFilterExpression() private function in filter-engine.ts with operator handling (equals, contains, startsWith, greaterThan, lessThan, between, in)
- [X] T016 [US1] Integrate text-normalizer.ts matchesFilter() for string comparisons in filter-engine.ts
- [X] T017 [P] [US1] Create unit test `tests/unit/filter-engine.test.ts` with test cases for: case-insensitive matching, contains matching, fuzzy matching, synonym matching (US/USA/United States), Vietnamese text filtering
- [X] T018 [US1] Modify `src/lib/ai/query-handler.ts` to extract FilterExpression[] from user questions using AI analysis
- [X] T019 [US1] Add FilterLog tracking to query-handler.ts (timestamp, filter expression, matched count, execution time)

**Checkpoint**: User Story 1 complete - can filter transactions with smart text matching, independently testable

---

## Phase 4: User Story 2 - Iterative Context Refinement (Priority: P1)

**Goal**: AI works with different filtered views of same loaded data through multiple refinement iterations

**Independent Test**: Load 5,000 transactions, ask "Compare top 3 companies' performance across all categories", verify AI filters to different subsets without reloading from database

### Implementation for User Story 2

- [X] T020 [US2] Modify `src/lib/ai/session-manager.ts` to add ContextState interface with loadedTransactions, currentFilterView, appliedFilters arrays
- [X] T021 [US2] Implement updateFilterView() function in session-manager.ts to apply new filters to loadedTransactions
- [X] T022 [US2] Add iteration limit tracking (max 10 filter operations per query) in session-manager.ts
- [X] T023 [US2] Modify `src/pages/api/ai/chat.ts` to support multi-iteration filtering workflow (extract filters, apply to currentFilterView, analyze, repeat if needed)
- [X] T024 [US2] Add confidence estimation logic in query-handler.ts (check if filtered data sufficient for answering)
- [X] T025 [US2] Implement data insufficiency detection in query-handler.ts (request broader filters or inform user)

**Checkpoint**: User Story 2 complete - AI can iteratively refine context through multiple filter operations

---

## Phase 5: User Story 3 - Query Intent Analysis (Priority: P1)

**Goal**: Classify user questions into query types (aggregation, detail, trend, comparison, recommendation, ranking) to optimize token usage

**Independent Test**: Submit different question types, verify system routes to correct strategy (aggregations for "Which company imports the most?", full details for "Show me top 5 transactions")

### Implementation for User Story 3

- [X] T026 [P] [US3] Add QueryIntent interface to `src/lib/ai/query-handler.ts` with type, filters, aggregations, limit, orderBy, confidence fields
- [X] T027 [US3] Implement classifyQueryIntent() function in query-handler.ts (analyzes question text to determine type: aggregation, detail, trend, comparison, recommendation, ranking)
- [X] T028 [US3] Add routing logic in query-handler.ts: if type=aggregation → use aggregations, if type=detail → use full transaction details
- [X] T029 [US3] Implement extractAggregationSpecs() function in query-handler.ts to generate AggregationSpec[] from query intent
- [X] T030 [US3] Map 8 real-world questions to query types in query-handler.ts: "Which company imports most?" → aggregation, "Show top 5" → detail, "Import trend over time?" → trend, "Export to US suggest companies?" → recommendation
- [X] T031 [P] [US3] Create integration test `tests/integration/query-handler.test.ts` with test cases for all 8 real-world questions

**Checkpoint**: User Story 3 complete - query intent classification working, routes to optimal data strategy

---

## Phase 6: User Story 4 - Smart Context Window Management (Priority: P2)

**Goal**: Intelligently manage which subset of loaded transactions to include in AI context based on query relevance

**Independent Test**: Load 5,000 transactions, have multi-turn conversation where each question focuses on different aspects, verify AI context includes only relevant subset for each query

### Implementation for User Story 4

- [ ] T032 [US4] Add context window size tracking to `src/lib/ai/query-handler.ts` (64K token limit for deepseek-r1:8b)
- [ ] T033 [US4] Implement estimateTokenCount() function in query-handler.ts (estimates transaction data size in tokens)
- [ ] T034 [US4] Implement selectRelevantSubset() function in query-handler.ts (chooses which transactions to include based on query)
- [ ] T035 [US4] Add smart sampling logic in query-handler.ts when filtered subset exceeds token limit (top N by value, recent dates, diverse categories)
- [ ] T036 [US4] Implement conversation history clearing in session-manager.ts (clear history but retain loaded transactions)
- [ ] T037 [US4] Add narrowing/broadening logic in query-handler.ts (narrow: apply stricter filters, broaden: expand to full dataset)

**Checkpoint**: User Story 4 complete - context window managed intelligently, no truncation errors

---

## Phase 7: User Story 5 - In-Memory Aggregations (Priority: P2)

**Goal**: Compute aggregations (count, sum, average, top-N, group-by) from loaded transactions, pass only summary statistics to AI (80% token reduction)

**Independent Test**: Load 5,000 transactions, ask "Which company imports the most?", verify AI receives only aggregated summary (e.g., "CompanyA: $500K, CompanyB: $300K") not full transaction list

### Implementation for User Story 5

- [X] T038 [P] [US5] Create `src/lib/ai/aggregation-engine.ts` with AggregationSpec, AggregationResult, AggregationDataPoint, AggregationCache interfaces
- [X] T039 [P] [US5] Implement computeAggregations() function in aggregation-engine.ts (processes multiple aggregation specs)
- [X] T040 [US5] Implement computeAggregation() function in aggregation-engine.ts (single aggregation with groupBy support)
- [X] T041 [US5] Implement groupBy() function in aggregation-engine.ts (groups transactions by field, computes count/sum/average/min/max)
- [X] T042 [P] [US5] Implement getTopN() function in aggregation-engine.ts (sorts grouped data, returns top N results)
- [X] T043 [P] [US5] Implement computeTotal() function in aggregation-engine.ts (no grouping, simple total aggregation)
- [X] T044 [US5] Implement buildAggregationCache() function in aggregation-engine.ts (precomputes byCompany, byGoodsName, byCategory, byMonth aggregations)
- [X] T045 [P] [US5] Implement queryCacheTopN() function in aggregation-engine.ts (fast top-N retrieval from cache)
- [X] T046 [P] [US5] Implement formatAggregationForAI() function in aggregation-engine.ts (token-optimized text output: 200 bytes vs 500KB)
- [X] T047 [US5] Integrate aggregation-engine into `src/pages/api/ai/chat.ts` (if query type=aggregation, compute aggregations instead of loading full transactions)
- [X] T048 [US5] Add aggregation result caching to session-manager.ts ContextState (cache gets rebuilt on filter changes)
- [X] T049 [P] [US5] Create API route `src/pages/api/ai/aggregate.ts` with POST handler for explicit aggregation requests
- [X] T050 [P] [US5] Create unit test `tests/unit/aggregation-engine.test.ts` with test cases for: group-by, sum, count, top-N, time-series, cache performance (<100ms for 10K transactions)

**Checkpoint**: User Story 5 complete - in-memory aggregations working, 80% token reduction achieved

---

## Phase 8: User Story 6 - Filter Expression Language (Priority: P3)

**Goal**: AI expresses filter intent using structured format, system translates to JavaScript filter logic

**Independent Test**: Load 5,000 transactions, have AI generate filter expression like `FILTER importCountry=US AND categoryName=Electronics`, verify correct subset selected (US + electronics only)

### Implementation for User Story 6

- [ ] T051 [US6] Add filter expression parsing to `src/lib/ai/query-handler.ts` (AI generates FilterExpression objects, not string DSL)
- [ ] T052 [US6] Validate filter expressions using FilterExpressionSchema Zod schema before execution
- [ ] T053 [US6] Add filter expression syntax error handling in query-handler.ts (return validation error, AI can retry)
- [ ] T054 [US6] Implement ORDER BY logic in filter-engine.ts (sort filtered transactions by field asc/desc)
- [ ] T055 [US6] Implement LIMIT logic in filter-engine.ts (return only top N results after filtering)
- [ ] T056 [P] [US6] Create component `src/components/ai/FilterMetadata.tsx` to display filter operation results (matched count, execution time, filter criteria)
- [ ] T057 [US6] Integrate FilterMetadata component into ai-analysis.tsx conversation history

**Checkpoint**: User Story 6 complete - filter expression language working, validated, displayed in UI

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T058 [P] Add FilterLog entity persistence in session-manager.ts appliedFilters array
- [X] T059 [P] Implement filter operation metadata tracking (FR-012: matched count, total count, execution time, criteria)
- [X] T060 [P] Add error handling for all API routes: filter.ts, aggregate.ts, chat.ts
- [ ] T061 [P] Modify `src/pages/api/ai/feed-data.ts` to support current session data loading
- [X] T062 Add performance logging for filter operations (track sub-100ms target compliance)
- [X] T063 Add performance logging for aggregation operations (track sub-100ms target compliance)
- [ ] T064 [P] Update `README.md` with new feature documentation: smart filtering capabilities, in-memory aggregations
- [ ] T065 [P] Create or update `DOCKER.md` if deployment configuration changes needed
- [ ] T066 Run quickstart.md validation: install dependencies, verify synonym config, test text normalization, test filter engine, test aggregations

**Checkpoint**: All polish tasks complete, feature ready for production deployment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - US1 (Filtering), US2 (Refinement), US3 (Intent) can proceed in parallel after Phase 2
  - US4 (Context) depends on US1 (needs filtering logic)
  - US5 (Aggregations) depends on US3 (needs intent classification)
  - US6 (Expression Language) depends on US1 (extends filtering)
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 - Filtering (P1)**: Phase 2 complete → Can start immediately
- **US2 - Refinement (P1)**: Phase 2 complete → Can start immediately (independent of US1)
- **US3 - Intent (P1)**: Phase 2 complete → Can start immediately (independent of US1, US2)
- **US4 - Context (P2)**: US1 complete (needs filtering) → Start after US1
- **US5 - Aggregations (P2)**: US3 complete (needs intent) → Start after US3
- **US6 - Expression (P3)**: US1 complete (extends filtering) → Start after US1

### Within Each User Story

- Tests (where included) run in parallel with implementation
- Core interfaces/functions before integration
- API routes after backend functions complete
- UI components after API routes complete
- Story complete before moving to next priority

### Parallel Opportunities

**After Phase 1 (Setup) completes:**
- T007, T008, T009, T010 (all Phase 2 foundational) can run in parallel

**After Phase 2 (Foundational) completes:**
- US1 (T012-T019), US2 (T020-T025), US3 (T026-T031) can ALL start in parallel (if team capacity allows)

**Within User Story 1:**
- T012 (filter-engine.ts creation) and T017 (test file) can run in parallel
- T018 (query-handler modify) and T019 (FilterLog) are sequential

**Within User Story 4:**
- T032 (AISession.ts), T033 (schema), T035-T039 (session functions), T040-T041 (API routes), T042 (SessionManager), T045 (SessionDetails), T048 (tests) can all run in parallel
- T043 (localStorage functions) depends on T042 (SessionManager component exists)
- T046-T047 (integration) depend on T042 (SessionManager component complete)

**Within User Story 6:**
- T055-T063 (all aggregation-engine.ts functions) can be developed in parallel by different developers
- T067 (tests) can run in parallel with T055-T063

---

## Parallel Example: Phase 2 (Foundational)

```bash
# All Phase 2 tasks can launch together:
Task T007: "Create src/lib/ai/text-normalizer.ts with normalizeText() function"
Task T008: "Add vietnameseCharMap to text-normalizer.ts"
Task T009: "Implement checkSynonyms() in text-normalizer.ts"
Task T010: "Add Zod schemas to src/lib/utils/validation.ts"
Task T011: "Create tests/unit/text-normalizer.test.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1, 3, 5 Only)

**Why these 3 stories?** They deliver core value: smart filtering (US1), intent classification (US3), and aggregations (US5) enable efficient AI analysis with 80% token reduction.

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (text normalization, validation)
3. Complete Phase 3: User Story 1 (Filtering) ✅
4. Complete Phase 5: User Story 3 (Intent Classification) ✅
5. Complete Phase 7: User Story 5 (Aggregations) ✅
6. **STOP and VALIDATE**: Test core workflow (filter → classify → aggregate)
7. Deploy/demo MVP

**Deferred for later**: US2 (iterative refinement), US4 (context management), US6 (expression language)

### Incremental Delivery (All P1 Stories)

1. Complete Setup + Foundational → Foundation ready
2. Add US1 (Filtering) → Test independently → Deploy/Demo
3. Add US2 (Refinement) → Test independently → Deploy/Demo
4. Add US3 (Intent) → Test independently → Deploy/Demo
5. Add US4 (Context) → Test independently → Deploy/Demo
6. Add US5 (Aggregations) → Test independently → Deploy/Demo
7. Add US6 (Expression) → Test independently → Deploy/Demo

### Parallel Team Strategy

With 3 developers after Foundational phase completes:

- **Developer A**: User Story 1 (Filtering) + User Story 4 (Context - depends on US1) + User Story 6 (Expression - depends on US1)
- **Developer B**: User Story 2 (Refinement)
- **Developer C**: User Story 3 (Intent) + User Story 5 (Aggregations - depends on US3)

Stories complete independently, integrate at end.

---

## Task Summary

- **Total Tasks**: 66
- **Setup Phase**: 6 tasks
- **Foundational Phase**: 5 tasks (BLOCKS all user stories)
- **User Story 1 (P1)**: 8 tasks (filtering)
- **User Story 2 (P1)**: 6 tasks (refinement)
- **User Story 3 (P1)**: 6 tasks (intent)
- **User Story 4 (P2)**: 6 tasks (context)
- **User Story 5 (P2)**: 13 tasks (aggregations)
- **User Story 6 (P3)**: 7 tasks (expression)
- **Polish Phase**: 9 tasks

**Parallel Opportunities Identified**: 25+ tasks can run in parallel (marked with [P])

**MVP Scope Recommendation**: Phase 1-2 + US1 + US3 + US5 = **34 tasks** (delivers core smart filtering and aggregations)

**Full Feature**: All 66 tasks

---

## Notes

- [P] tasks = different files, no blocking dependencies
- [Story] label maps task to specific user story (US1-US7)
- Each user story independently completable and testable
- Tests included only for core functionality (text normalization, filtering, aggregations, sessions)
- Commit after completing each user story phase for incremental progress
- Verify independent story tests pass before moving to next priority
- Constitution compliance verified in plan.md - all performance targets and quality standards documented
