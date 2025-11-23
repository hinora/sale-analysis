# Implementation Plan: Multi-Stage Adaptive Query System

**Branch**: `002-multi-stage-adaptive-query` | **Date**: 2025-11-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-multi-stage-adaptive-query/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement intelligent, multi-stage query system that filters already-loaded transactions in memory using smart text matching (case-insensitive, contains, Vietnamese normalization, fuzzy matching) and computes in-memory aggregations to enable efficient AI analysis with 80% token reduction. System maintains single active session per user with in-memory transaction storage. AI analyzes user questions to extract filters, applies them to in-memory transaction arrays using JavaScript filter functions, and routes queries to appropriate data processing strategies (aggregations vs full details) based on intent classification.

## Technical Context

**Language/Version**: TypeScript 5+ (strict mode), Next.js 16.0.3 with React 19.2.0  
**Primary Dependencies**: Material-UI v6 (UI components), Mongoose 8.0 (MongoDB ODM), Zod 3.22 (validation), PapaParse 5.4 (CSV), date-fns 4.1 (date handling), react-window 1.8 (virtualization)  
**Storage**: MongoDB 7+ with Mongoose schema validation (existing Transaction, AISession collections), localStorage for session list persistence  
**Testing**: NEEDS CLARIFICATION (no test framework currently configured - recommend Jest + React Testing Library)  
**Target Platform**: Web application (Next.js Pages Router, server-side API routes + client-side React components)  
**Project Type**: Web application (frontend + backend in single Next.js project)  
**Performance Goals**: In-memory filtering <100ms, aggregations <100ms, session switching <500ms, session list display <200ms, support 10,000+ loaded transactions without degradation  
**Constraints**: 64K token context window (deepseek-r1:8b), sub-100ms filter execution for real-time feel, >95% recall on raw data variations (case, whitespace, synonyms, typos), localStorage size limits for session list  
**Scale/Scope**: Single active AI session per user, 5,000-10,000 transactions per session, 8 core query types (aggregation, detail, trend, comparison, recommendation, ranking, value-ranking, time-series), 15 functional requirements, 5 key entities

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Check (Before Phase 0) ✅

### ✅ I. Data Integrity & AI-Driven Classification
- **Compliant**: Feature preserves raw transaction data already loaded in memory, applies non-destructive filters
- **Compliant**: Smart text matching (case-insensitive, contains, Vietnamese normalization) maintains semantic accuracy while handling data quality issues
- **Compliant**: Filter operations are logged for audit trail (FR-009), all transformations reversible
- **Compliant**: No duplicate detection needed - filtering works with already-loaded unique transactions from 001 feature

### ✅ II. Type Safety & Schema Validation
- **Compliant**: TypeScript interfaces required for FilterExpression, QueryIntent, SessionMetadata, ContextState, AggregationResult, FilterLog entities
- **Compliant**: Zod validation schemas for filter expressions and session operations (extends existing AISessionCreateSchema)
- **Compliant**: Enum types for query intent classification (aggregation, detail, trend, comparison, recommendation, ranking)
- **Compliant**: Existing date format (ISO 8601) and currency precision standards maintained

### ✅ III. Performance & Scalability
- **Compliant**: In-memory filtering (<100ms) and aggregations (<100ms) meet <3s API response standard
- **Compliant**: Session switching (<500ms) and list display (<200ms) provide responsive UX
- **Compliant**: Supports 10,000+ loaded transactions without degradation (SC-005)
- **Compliant**: 80% token reduction via aggregations (SC-006) improves scalability
- **Compliant**: Existing react-window virtualization can render large filtered result sets

### ✅ IV. User Experience & Accessibility
- **Compliant**: Material-UI components for session management UI (create/switch/view/delete buttons, session dropdown, confirmation dialogs)
- **Compliant**: Vietnamese language support with diacritics handling and domain terminology (company names, categories)
- **Compliant**: Progress indicators for filter operations (FR-012 provides execution time metadata)
- **Compliant**: localStorage persistence for session list survives page refresh (FR-006b)
- **Compliant**: Inline validation for filter expressions with error feedback (User Story 7, scenario 5)

### ✅ V. AI Integration & Training Control
- **Compliant**: Users control which filtered subset of loaded data is sent to AI context (FR-001, FR-004)
- **Compliant**: AI context updated based on query relevance (User Story 5) - only relevant transactions included
- **Compliant**: Filter metadata provides transparency (FR-012: transactions matched, filter criteria, execution time)
- **Compliant**: Query intent classification (FR-003) determines optimal data presentation
- **Compliant**: Aggregation results cite specific data points (company rankings, item totals, time-series trends)
- **Compliant**: Existing Ollama integration maintained, no model selection changes needed

### Post-Design Check (After Phase 1) ✅

**Re-evaluation after research.md, data-model.md, contracts/, quickstart.md completion:**

### ✅ I. Data Integrity & AI-Driven Classification (Re-confirmed)
- **Design validates**: text-normalizer.ts with multi-strategy pipeline (case-insensitive, whitespace, diacritics, fuzzy, synonyms) maintains semantic accuracy per research.md decision #1
- **Design validates**: FilterLog entity provides complete audit trail with timestamp, filter expression, matched count, execution time, result sample
- **Design validates**: All filter operations reversible - currentFilterView derived from loadedTransactions, original data never modified

### ✅ II. Type Safety & Schema Validation (Re-confirmed)
- **Design validates**: Zod schemas defined in contracts (FilterExpressionSchema, QueryIntentSchema, SessionMetadataSchema, AggregationResultSchema)
- **Design validates**: TypeScript interfaces for all 6 entities (QueryIntent, FilterExpression, SessionMetadata, ContextState, AggregationResult, FilterLog) documented in data-model.md
- **Design validates**: Enum types specified in contracts (QueryIntent.type, FilterExpression.operator, AggregationSpec.operation)

### ✅ III. Performance & Scalability (Re-confirmed)
- **Design validates**: Aggregation cache optimization (research.md #3) achieves <30ms total (20ms build + 5ms filter + 1ms top-N) with 70ms margin below 100ms target
- **Design validates**: Filter execution complexity O(n) where n=filtered count, aggregation O(n) + O(k log k) where k=unique groups
- **Design validates**: Session switching uses in-memory Map lookup (O(1)), list display reads localStorage (O(sessions count))

### ✅ IV. User Experience & Accessibility (Re-confirmed)
- **Design validates**: SessionManager.tsx component uses Material-UI Select, Button, IconButton, Dialog per quickstart.md implementation
- **Design validates**: Vietnamese text handling via remove-accents library + custom vietnameseCharMap per research.md #6
- **Design validates**: Confirmation dialogs prevent accidental session deletion per SessionManager.tsx example in quickstart.md

### ✅ V. AI Integration & Training Control (Re-confirmed)
- **Design validates**: formatAggregationForAI() function produces token-optimized text (200 bytes vs 500KB) per contracts/aggregation-engine.ts
- **Design validates**: QueryIntent classification routes to aggregations (50-500 bytes) vs full details (50KB) per data-model.md entity definition
- **Design validates**: FilterMetadata returned with every filter operation (matchedCount, totalCount, executionTimeMs, appliedFilters, filterLogId) per contracts/filter-execution.ts

### Final Constitution Compliance: ALL GATES PASSED ✅

No design violations introduced during Phase 0 research or Phase 1 design. All technical decisions align with constitution principles:
- **fast-levenshtein** (2KB) and **remove-accents** (5KB) libraries are lightweight, don't introduce bloat
- **Jest + React Testing Library** are industry standard, align with quality standards
- **Hybrid localStorage + server memory** session persistence meets UX requirements without unnecessary database complexity
- **Precomputed aggregation cache** optimizes performance without violating data integrity (cache rebuilds on filter changes)
- **Zod validation** provides runtime type safety required by constitution Principle II
- **Multi-strategy text matching** handles Vietnamese data quality issues required by constitution Principle I

Proceeding to Phase 2 (task breakdown) approved.

## Project Structure

### Documentation (this feature)

```text
specs/002-multi-stage-adaptive-query/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── filter-execution.ts       # In-memory filter API contract
│   ├── session-management.ts     # Session CRUD operations
│   └── aggregation-engine.ts     # In-memory aggregation functions
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── ai/
│   │   ├── session-manager.ts          # MODIFY: Manage single active session state
│   │   ├── query-handler.ts            # MODIFY: Add filter extraction, intent classification
│   │   ├── filter-engine.ts            # NEW: In-memory filter execution with smart matching
│   │   ├── aggregation-engine.ts       # NEW: In-memory count/sum/group-by/top-N
│   │   └── text-normalizer.ts          # NEW: Case-insensitive, Vietnamese, fuzzy matching
│   ├── db/
│   │   └── models/
│   │       └── AISession.ts            # MODIFY: Add session metadata fields (createdAt, lastActivityAt, transactionCount)
│   └── utils/
│       └── validation.ts               # MODIFY: Add Zod schemas for FilterExpression, QueryIntent
├── components/
│   ├── ai/
│   │   └── FilterMetadata.tsx          # NEW: Display filter operation results
│   └── layout/
│       └── [existing components]
├── pages/
│   ├── ai-analysis.tsx                 # MODIFY: Handle single session state
│   └── api/
│       ├── ai/
│       │   ├── feed-data.ts            # MODIFY: Load data into current session
│       │   ├── chat.ts                 # MODIFY: Add filter execution and aggregation logic
│       │   └── filter.ts               # NEW: Filter operation API (for testing/debugging)
│       └── [existing APIs]
└── styles/
    └── [existing styles]

tests/                                   # NEW: Test framework to be established
├── unit/
│   ├── filter-engine.test.ts           # Filter matching, smart text normalization
│   ├── aggregation-engine.test.ts      # Group-by, sum, count, top-N
│   └── text-normalizer.test.ts         # Vietnamese, case-insensitive, fuzzy matching
├── integration/
│   ├── query-handler.test.ts           # End-to-end filter + aggregation workflows
│   └── session-manager.test.ts         # Multi-session CRUD operations
└── fixtures/
    └── sample-transactions.json         # Test data with Vietnamese text variations
```

**Structure Decision**: Web application structure with single Next.js project containing frontend (pages/, components/), backend (pages/api/), and shared libraries (lib/). New `filter-engine.ts`, `aggregation-engine.ts`, and `text-normalizer.ts` modules in `lib/ai/` provide core filtering and aggregation logic. New `SessionManager.tsx` and `SessionDetails.tsx` components provide session management UI. Existing `session-manager.ts` and `query-handler.ts` will be enhanced with multi-session support and filter execution. Test framework (Jest + React Testing Library recommended) to be established in Phase 0 research.

## Complexity Tracking

No constitution violations - complexity tracking not required.
