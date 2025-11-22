# Tasks: Export Goods Analysis Application

**Branch**: `001-export-goods-analysis`  
**Input**: Design documents from `/specs/001-export-goods-analysis/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested - focusing on implementation tasks

**Organization**: Tasks grouped by user story to enable independent implementation and testing

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1, US2, US3, US4, US5) - applies to user story phases only
- Include exact file paths in task descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Docker Compose configuration and project initialization

- [X] T001 Verify Docker Compose configuration in docker-compose.yml and start all services
- [X] T002 Create MongoDB connection utility in src/lib/db/connection.ts with retry logic
- [X] T003 [P] Configure MUI theme with Vietnamese locale in src/styles/theme.ts
- [X] T004 [P] Create main layout component with navigation in src/components/layout/Navigation.tsx
- [X] T005 [P] Update _app.tsx to wrap application with MUI ThemeProvider and layout
- [X] T006 [P] Create reusable page header component in src/components/layout/PageHeader.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Create Transaction Mongoose schema in src/lib/db/models/Transaction.ts with unique index on declarationNumber
- [X] T008 [P] Create Company Mongoose schema in src/lib/db/models/Company.ts with virtual fields for aggregations
- [X] T009 [P] Create Goods Mongoose schema in src/lib/db/models/Goods.ts with unique index on rawName
- [X] T010 [P] Create Category Mongoose schema in src/lib/db/models/Category.ts
- [X] T011 [P] Create AISession Mongoose schema in src/lib/db/models/AISession.ts with TTL index
- [X] T012 Create compound indexes for Transaction model in src/lib/db/indexes.ts (company+date, goods+date)
- [X] T013 [P] Create Ollama client wrapper in src/lib/ai/ollama-client.ts for API communication
- [X] T014 [P] Create Zod validation schemas for API requests in src/lib/utils/validation.ts
- [X] T015 [P] Create Vietnamese text utilities in src/lib/utils/vietnamese.ts for UTF-8 handling
- [X] T016 [P] Create number/date formatting utilities in src/lib/utils/formatting.ts
- [X] T017 [P] Create reusable DataTable component in src/components/tables/DataTable.tsx with react-window virtualization
- [X] T018 [P] Create FilterBar component in src/components/tables/FilterBar.tsx for common filters
- [X] T019 [P] Create SortHeader component in src/components/tables/SortHeader.tsx for sortable columns

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - CSV Import with Duplicate Detection (Priority: P1) 🎯 MVP

**Goal**: Enable CSV upload with streaming processing, fallback classification (AI disabled for performance), duplicate detection, and data integrity preservation

**Independent Test**: Upload sale-raw-data-small.csv via import page, verify all records imported quickly, goods assigned "Other" category with truncated names, duplicates skipped on re-upload, raw data preserved

### Implementation for User Story 1

- [X] T020 [P] [US1] Create CSV streaming parser in src/lib/csv/parser.ts using papaparse with 1000-row chunks
- [X] T021 [P] [US1] Create CSV validator in src/lib/csv/validator.ts to check required columns and data types
- [X] T022 [P] [US1] Create deduplicator logic in src/lib/csv/deduplicator.ts using Set for in-file duplicates
- [X] T023 [P] [US1] Create AI goods classifier in src/lib/ai/classifier.ts to assign categories using Ollama llama3.1 (NOTE: Disabled in import for performance)
- [X] T024 [P] [US1] Create AI name shortener in src/lib/ai/name-shortener.ts to generate concise goods names using Ollama mistral (NOTE: Disabled in import for performance)
- [X] T025 [US1] Implement POST /api/import/upload endpoint in src/pages/api/import/upload.ts with multipart file handling
- [X] T026 [US1] Implement GET /api/import/template endpoint in src/pages/api/import/template.ts to serve CSV template
- [X] T027 [US1] Create import page UI in src/pages/import.tsx with drag-drop file upload
- [X] T028 [P] [US1] Create FileUpload component in src/components/import/FileUpload.tsx with drag-drop zone
- [X] T029 [P] [US1] Create ImportProgress component in src/components/import/ImportProgress.tsx with progress bar
- [X] T030 [P] [US1] Create ImportSummary component in src/components/import/ImportSummary.tsx to display results
- [X] T031 [US1] Connect import page to upload API and display progress/summary
- [X] T032 [US1] Copy sale-raw-data-small.csv to public/templates/export-data-template.csv for download

**Technical Decision - Performance Optimization** (2025-11-21):
AI classification (Ollama llama3.1 + mistral) was disabled in the CSV import endpoint to dramatically improve import speed. The original approach with AI processing was too slow for large files. Current implementation:
- Uses fallback classification: All goods assigned to "Other" category
- Uses simple name truncation: `simpleShortenName()` instead of AI-generated short names  
- Import speed: Reduced from ~5 minutes to <2 minutes for 10K rows
- AI tools (classifier.ts, name-shortener.ts) remain available for future batch processing or manual re-classification if needed
- Trade-off: Fast import with basic classification vs. slow import with intelligent AI categorization
- Decision rationale: User testing showed import performance was critical blocker for production use

**Checkpoint**: User Story 1 complete - CSV import with fast fallback classification fully functional (AI disabled for performance)

---

## Phase 3.5: User Story 1.5 - Background AI Classification Job (Priority: P1) 🎯 MVP

**Goal**: Process goods with fallback classification asynchronously to update them with AI-generated categories and short names

**Independent Test**: Import CSV with new goods (fallback classification), run background job manually or via cron, verify goods updated with proper AI categories and shortNames, confirm transactions reference updated goods

### Implementation for User Story 1.5

- [X] T032a [P] [US1.5] Create background job script in src/lib/jobs/classify-goods.ts with batch processing logic
- [X] T032b [P] [US1.5] Implement query to find goods where classifiedBy='fallback' with pagination support
- [X] T032c [P] [US1.5] Add batch processing loop to classify goods in chunks (e.g., 10 goods per batch to avoid overwhelming Ollama)
- [X] T032d [P] [US1.5] Integrate aiClassifier.classifyGoods() and aiNameShortener.shortenName() for each goods record
- [X] T032e [P] [US1.5] Update goods record with new category, shortName, classifiedBy='llama3.1', classifiedAt timestamp
- [X] T032f [US1.5] Add error handling with logging for AI failures (don't crash job, continue with next goods)
- [X] T032g [US1.5] Create API endpoint POST /api/jobs/classify-goods to trigger job manually (for testing/admin)
- [X] T032h [US1.5] Add GET /api/jobs/classify-goods endpoint to check job status (running/idle + last result)
- [X] T032i [US1.5] Create useBackgroundJobTrigger React hook in src/hooks/useBackgroundJobTrigger.ts for auto-trigger
- [X] T032j [US1.5] Integrate hook in _app.tsx to automatically trigger job every 5 minutes with status check
- [X] T032k [US1.5] Add optional GET /api/goods/unclassified-count endpoint for optimization (skip trigger if count=0)
- [X] T032l [US1.5] Add job status tracking (running boolean + lastResult object) in API endpoint
- [X] T032m [US1.5] Add logging for job execution: start time, goods processed, successes, failures, duration
- [X] T032n [US1.5] Test concurrent CSV import while job running to ensure no blocking or race conditions

**Checkpoint**: User Story 1.5 complete - Background AI classification job processes fallback goods asynchronously

---

## Phase 4: User Story 2 - Transaction Query (Priority: P1)

**Goal**: Enable flexible transaction filtering, sorting, and pagination with URL persistence

**Independent Test**: Navigate to transactions page, apply filters (company, date range, category), sort by different columns, verify pagination works, confirm URL preserves state

### Implementation for User Story 2

- [X] T033 [P] [US2] Implement GET /api/transactions/list endpoint in src/pages/api/transactions/list.ts with filter/sort/pagination
- [X] T034 [US2] Create transactions page UI in src/pages/transactions.tsx with filter controls and table
- [X] T035 [P] [US2] Create DateRangePicker component in src/components/common/DateRangePicker.tsx for date filters
- [X] T036 [P] [US2] Create CompanyAutocomplete component in src/components/common/CompanyAutocomplete.tsx for company search
- [X] T037 [P] [US2] Create CategorySelect component in src/components/common/CategorySelect.tsx for category dropdown
- [X] T038 [US2] Integrate FilterBar component with transaction-specific filters (company, date, category, goods)
- [X] T039 [US2] Connect transactions page to list API with filter/sort/pagination state management
- [X] T040 [US2] Implement URL query parameter persistence using next/router for filter/sort state
- [X] T041 [US2] Add virtualized table rendering for >100 rows using react-window in DataTable (Already implemented with virtualized prop)

**Checkpoint**: User Story 2 complete - Transaction query page fully functional with filters and sorting

---

## Phase 5: User Story 3 - Goods Catalog (Priority: P2)

**Goal**: Provide product-centric view with aggregated statistics, filtering, and drill-down to transactions

**Independent Test**: Navigate to goods page, view list with aggregated metrics (total quantity, value, transaction count), apply filters, sort by metrics, click goods to see detail view

### Implementation for User Story 3

- [X] T042 [P] [US3] Implement GET /api/goods/list endpoint in src/pages/api/goods/list.ts with aggregation pipeline
- [X] T043 [P] [US3] Implement GET /api/goods/[id] endpoint in src/pages/api/goods/[id].ts for goods detail
- [X] T044 [US3] Create goods catalog page UI in src/pages/goods.tsx with filters and aggregated table
- [X] T045 [US3] Add aggregation logic to calculate totalQuantityExported, totalValueExported, transactionCount per goods
- [X] T046 [US3] Integrate FilterBar with goods-specific filters (company, date range, category)
- [X] T047 [US3] Connect goods page to list API with aggregated data display
- [X] T048 [US3] Implement goods detail modal/page showing all transactions for selected goods
- [X] T049 [US3] Add sorting by aggregated metrics (export value, quantity, transaction count, average price)

**Checkpoint**: User Story 3 complete - Goods catalog with aggregations and drill-down functional

---

## Phase 6: User Story 4 - Company Dashboard (Priority: P2)

**Goal**: Provide customer-centric view with import statistics, filtering, and drill-down to transactions

**Independent Test**: Navigate to companies page, view list with aggregated metrics (total import value, transaction count, unique goods), apply filters, sort by metrics, click company to see detail

### Implementation for User Story 4

- [X] T050 [P] [US4] Implement GET /api/companies/list endpoint in src/pages/api/companies/list.ts with aggregation pipeline
- [X] T051 [P] [US4] Implement GET /api/companies/[id] endpoint in src/pages/api/companies/[id].ts for company detail
- [X] T052 [US4] Create company dashboard page UI in src/pages/companies.tsx with filters and aggregated table
- [X] T053 [US4] Add aggregation logic to calculate totalImportValue, uniqueGoodsCount, transactionCount per company
- [X] T054 [US4] Integrate FilterBar with company-specific filters (goods category, date range)
- [X] T055 [US4] Connect companies page to list API with aggregated data display
- [X] T056 [US4] Implement company detail modal/page showing all transactions and goods breakdown
- [X] T057 [US4] Add sorting by aggregated metrics (import value, transaction count, unique goods count)

**Checkpoint**: User Story 4 complete - Company dashboard with aggregations and drill-down functional

---

## Phase 7: User Story 5 - AI-Powered Analysis (Priority: P3)

**Goal**: Enable natural language queries over selected transaction data with contextual conversation

**Independent Test**: Navigate to AI analysis page, select data filters, click "Feed Data to AI", wait for ready status, ask questions like "Which company most imported?", verify grounded responses with citations

### Implementation for User Story 5

- [ ] T058 [P] [US5] Implement POST /api/ai/session endpoint in src/pages/api/ai/session.ts to create AI sessions
- [ ] T059 [P] [US5] Implement POST /api/ai/feed-data endpoint in src/pages/api/ai/feed-data.ts to load transactions into session
- [ ] T060 [P] [US5] Implement POST /api/ai/query endpoint in src/pages/api/ai/query.ts to process natural language queries
- [ ] T061 [P] [US5] Implement GET /api/ai/session/[id] endpoint in src/pages/api/ai/session/[id].ts to retrieve session state
- [ ] T062 [P] [US5] Create AI query handler in src/lib/ai/query-handler.ts to format prompts and parse responses
- [ ] T063 [P] [US5] Create session manager in src/lib/ai/session-manager.ts using in-memory Map with 30-minute TTL
- [ ] T064 [US5] Create AI analysis page UI in src/pages/ai-analysis.tsx with data selection and chat interface
- [ ] T065 [P] [US5] Create DataSelector component in src/components/ai/DataSelector.tsx with filters and summary
- [ ] T066 [P] [US5] Create ChatInterface component in src/components/ai/ChatInterface.tsx for conversation display
- [ ] T067 [P] [US5] Create SuggestedQueries component in src/components/ai/SuggestedQueries.tsx with clickable prompts
- [ ] T068 [P] [US5] Create AIStatus component in src/components/ai/AIStatus.tsx showing training/ready state
- [ ] T069 [US5] Connect AI page to session creation and data feed APIs with progress tracking
- [ ] T070 [US5] Implement conversation flow: question submission, response streaming, history display
- [ ] T071 [US5] Add 10K transaction limit validation before feeding data to AI
- [ ] T072 [US5] Implement session cleanup for expired sessions (>30 minutes idle)

**Checkpoint**: User Story 5 complete - AI-powered analysis with natural language queries functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple user stories and final validation

- [ ] T073 [P] Create dashboard/home page in src/pages/index.tsx with overview statistics and quick links
- [ ] T074 [P] Add error boundaries for all pages to handle API failures gracefully
- [ ] T075 [P] Implement loading states for all async operations (spinners, skeletons)
- [ ] T076 [P] Add Vietnamese translations file in public/locales/vi.json
- [ ] T077 [P] Update README.md with Docker quickstart instructions
- [ ] T078 [P] Add API health check endpoint in src/pages/api/health.ts
- [ ] T079 Code review and refactoring for consistency across all components
- [ ] T080 Performance optimization: verify indexes working, check N+1 queries, optimize aggregations
- [ ] T081 Security review: validate all user inputs, check for injection vulnerabilities
- [ ] T082 Run through quickstart.md steps to verify setup works end-to-end
- [ ] T083 Test with 100MB CSV file to verify streaming performance meets <5min goal
- [ ] T084 Test concurrent uploads from multiple sessions to verify no data corruption

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately after Docker Compose up
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) - **BLOCKS all user stories**
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) - No other story dependencies
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) + User Story 1 data (needs imported transactions)
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) + User Story 1 data (needs goods classifications)
- **User Story 4 (Phase 6)**: Depends on Foundational (Phase 2) + User Story 1 data (needs company records)
- **User Story 5 (Phase 7)**: Depends on Foundational (Phase 2) + User Story 1 data (needs transaction data for AI)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

**Critical Path**:
1. **User Story 1 (P1)** is the foundation - all data enters through CSV import
2. **User Story 2 (P1)** can start implementation in parallel but needs US1 data to test
3. **User Stories 3, 4, 5 (P2, P2, P3)** all depend on US1 data being available

**Recommended Execution Order**:
1. Complete Setup (Phase 1) + Foundational (Phase 2)
2. Complete User Story 1 (Phase 3) - **MVP milestone: can import and classify data**
3. Complete User Story 2 (Phase 4) - **Extended MVP: can query imported data**
4. Complete User Story 3 (Phase 5) - **Product intelligence added**
5. Complete User Story 4 (Phase 6) - **Customer intelligence added**
6. Complete User Story 5 (Phase 7) - **Premium AI analysis added**
7. Complete Polish (Phase 8) - **Production ready**

### Within Each User Story

- **Models and schemas** before services
- **Services and utilities** before API endpoints
- **API endpoints** before UI components
- **Individual UI components** before page integration
- **Page integration** before testing

### Parallel Opportunities

**Within Setup (Phase 1)**:
- T003, T004, T005, T006 can run in parallel (different files)

**Within Foundational (Phase 2)**:
- T008, T009, T010, T011 (model schemas) can run in parallel
- T013, T014, T015, T016, T017, T018, T019 (utilities and components) can run in parallel
- T007 and T012 must be sequential (model then indexes)

**Within User Story 1 (Phase 3)**:
- T020, T021, T022, T023, T024 (lib utilities) can run in parallel
- T028, T029, T030 (UI components) can run in parallel
- T025, T026 (API endpoints) depend on lib utilities being complete

**Within User Story 2 (Phase 4)**:
- T035, T036, T037 (filter components) can run in parallel

**Within User Story 3 (Phase 5)**:
- T042, T043 (API endpoints) can run in parallel

**Within User Story 4 (Phase 6)**:
- T050, T051 (API endpoints) can run in parallel

**Within User Story 5 (Phase 7)**:
- T058, T059, T060, T061 (API endpoints) can run in parallel
- T062, T063 (AI utilities) can run in parallel
- T065, T066, T067, T068 (UI components) can run in parallel

**Within Polish (Phase 8)**:
- T073, T074, T075, T076, T077, T078 can run in parallel

**Cross-Story Parallelization**:
- Once Foundational (Phase 2) is complete and User Story 1 data exists:
  - Developer A: User Story 2 implementation
  - Developer B: User Story 3 implementation
  - Developer C: User Story 4 implementation
  - Developer D: User Story 5 implementation

---

## Parallel Example: User Story 1

```bash
# Launch CSV processing utilities in parallel:
"Create CSV streaming parser in src/lib/csv/parser.ts" & \
"Create CSV validator in src/lib/csv/validator.ts" & \
"Create deduplicator logic in src/lib/csv/deduplicator.ts" & \
"Create AI goods classifier in src/lib/ai/classifier.ts" & \
"Create AI name shortener in src/lib/ai/name-shortener.ts"

# After utilities complete, launch UI components in parallel:
"Create FileUpload component in src/components/import/FileUpload.tsx" & \
"Create ImportProgress component in src/components/import/ImportProgress.tsx" & \
"Create ImportSummary component in src/components/import/ImportSummary.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

**Goal**: Get to working CSV import and transaction query as fast as possible

1. **Week 1**: Phase 1 (Setup) + Phase 2 (Foundational)
   - Docker Compose running
   - All Mongoose schemas created
   - Core utilities and components ready
   
2. **Week 2**: Phase 3 (User Story 1)
   - CSV import fully working
   - AI classification functional
   - Duplicate detection verified
   - **Milestone**: Can import data and see it in database
   
3. **Week 3**: Phase 4 (User Story 2)
   - Transaction query page complete
   - Filters and sorting working
   - **Milestone**: Can query and explore imported data
   
4. **Week 4**: Phase 8 (Polish - limited scope)
   - Dashboard with overview
   - Error handling
   - Performance validation
   - **Deploy MVP**: CSV import + transaction query working

### Incremental Delivery

1. **MVP Release (Weeks 1-4)**: User Stories 1 + 2
   - Core value: Import and query transaction data
   - Deploy and gather feedback

2. **Product Intelligence Release (Weeks 5-6)**: Add User Story 3
   - New capability: Goods catalog with aggregations
   - Deploy incremental update

3. **Customer Intelligence Release (Weeks 7-8)**: Add User Story 4
   - New capability: Company dashboard with analytics
   - Deploy incremental update

4. **Premium AI Release (Weeks 9-11)**: Add User Story 5
   - New capability: Natural language analysis
   - Deploy final feature set

5. **Production Hardening (Week 12)**: Complete Phase 8 Polish
   - Performance tuning
   - Security review
   - Full documentation
   - Production deployment

### Parallel Team Strategy (4 developers)

**Phase 1-2 (Weeks 1-2)**: All developers collaborate
- Developer A: Database schemas and indexes
- Developer B: Utilities (CSV, AI, validation)
- Developer C: Shared UI components (DataTable, FilterBar)
- Developer D: Docker and infrastructure

**Phase 3-7 (Weeks 3-10)**: Parallel user story development
- Developer A: User Story 1 (CSV import)
- Developer B: User Story 2 (Transaction query)
- After User Story 1 data available:
  - Developer C: User Story 3 (Goods catalog)
  - Developer D: User Story 4 (Company dashboard)
- Developer A+B: User Story 5 (AI analysis) - requires collaboration

**Phase 8 (Week 11-12)**: All developers on polish
- Code review and refactoring
- Performance optimization
- Security hardening
- Documentation

---

## Validation Checklist

Before marking any phase complete, verify:

### Phase 1: Setup
- [ ] Docker Compose successfully starts all 3 services (app, mongodb, ollama)
- [ ] MongoDB accessible at localhost:27017
- [ ] Ollama accessible at localhost:11434 with models downloaded
- [ ] Next.js app accessible at localhost:3000 with MUI theme rendering

### Phase 2: Foundational
- [ ] All 5 Mongoose schemas created and connected
- [ ] Database indexes created successfully
- [ ] Ollama client can communicate with service
- [ ] DataTable component renders with sample data
- [ ] FilterBar and SortHeader components render correctly

### Phase 3: User Story 1
- [ ] Can upload sale-raw-data-small.csv via UI
- [ ] All records imported within 5 minutes
- [ ] Goods classified with reasonable categories
- [ ] Re-uploading same file skips all duplicates
- [ ] Raw CSV data preserved in database
- [ ] CSV template downloads correctly

### Phase 4: User Story 2
- [ ] Transactions page loads with all imported data
- [ ] Company name filter works with partial match
- [ ] Date range filter works correctly
- [ ] Category filter shows only matching transactions
- [ ] Sorting by price/quantity/value works
- [ ] Pagination works with 50 records per page
- [ ] URL preserves filter/sort state on refresh

### Phase 5: User Story 3
- [ ] Goods catalog shows unique goods with aggregated stats
- [ ] Total quantity and value match database calculations
- [ ] Filters work correctly
- [ ] Sorting by metrics works
- [ ] Clicking goods shows detail view with transactions

### Phase 6: User Story 4
- [ ] Company dashboard shows all companies with aggregated stats
- [ ] Total import value and transaction counts accurate
- [ ] Filters work correctly
- [ ] Sorting by metrics works
- [ ] Clicking company shows detail view with transactions

### Phase 7: User Story 5
- [ ] Can select data via filters
- [ ] "Feed Data to AI" button works with progress indicator
- [ ] AI status shows "Ready for questions" after loading
- [ ] Can ask questions and receive grounded responses
- [ ] Responses include specific data citations
- [ ] Conversation history persists
- [ ] 10K transaction limit enforced

### Phase 8: Polish
- [ ] Home page dashboard shows overview statistics
- [ ] Error boundaries catch and display API errors
- [ ] Loading states display for all async operations
- [ ] All Vietnamese labels rendered correctly
- [ ] Quickstart guide successfully reproduced
- [ ] 100MB CSV file imports in <5 minutes
- [ ] Concurrent uploads don't create data corruption

---

## Notes

- **Task IDs**: Sequential T001-T084 for easy reference
- **[P] marker**: Tasks that can run in parallel (different files, no shared dependencies)
- **[Story] label**: Maps tasks to specific user stories (US1-US5) for traceability
- **File paths**: All tasks include exact file paths for clarity
- **Tests optional**: Not included since not explicitly requested in spec
- **Docker first**: Assumes Docker Compose as primary development environment
- **Constitution compliance**: All tasks align with 5 core principles from constitution.md
- **Incremental delivery**: Each user story is independently testable
- **Commit strategy**: Commit after each task or logical task group
- **Stop points**: Checkpoints at end of each phase for validation

---

**Total Tasks**: 84  
**Parallelizable**: 38 tasks marked with [P]  
**Estimated Timeline**: 12 weeks with 4 developers (or 24 weeks with 2 developers)  
**MVP Scope**: Phases 1-4 (Tasks T001-T041) = User Stories 1 + 2 = 41 tasks  
**Lines of Code Estimate**: ~8,000-10,000 LOC (models, services, components, pages)
