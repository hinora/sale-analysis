# Implementation Plan: RAG-based Query Endpoint

**Branch**: `002-rag-query-endpoint` | **Date**: November 23, 2025 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-rag-query-endpoint/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement Retrieval-Augmented Generation (RAG) for the AI query endpoint to enable scalable querying on datasets with millions of transactions. Instead of loading all transaction data into the LLM context, the system will convert transactions to searchable representations, store them in an efficient index, retrieve only the most relevant transactions for each query, and use those to generate accurate, citation-backed responses. This approach maintains answer quality while dramatically reducing memory usage and query latency at scale.

## Technical Context

**Language/Version**: TypeScript 5+, Node.js 20+ (Next.js 16 runtime)
**Primary Dependencies**: Next.js 16 (API routes), Mongoose 8 (MongoDB ODM), NEEDS CLARIFICATION: embedding library for Vietnamese/English text, NEEDS CLARIFICATION: vector search library for in-memory indexing
**Storage**: MongoDB 7+ for transaction data, in-memory vector index per session (existing session-manager pattern)
**Testing**: NEEDS CLARIFICATION: testing framework not currently visible in project
**Target Platform**: Next.js serverless API routes (Vercel/Node.js deployment)
**Project Type**: Web application (Next.js full-stack with API routes)
**Performance Goals**: Query response <10s for 1M transactions, memory <2GB during query, indexing 100k transactions <60s
**Constraints**: Must preserve existing `/api/ai/query` API contract, must support Vietnamese + English text, must maintain citation accuracy ≥95%
**Scale/Scope**: 1M+ transactions per session, 100 concurrent queries, existing AI session lifecycle (feed-data → query loop)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ I. Data Integrity & AI-Driven Classification
- **Compliant**: RAG retrieval preserves raw transaction data without modification
- **Compliant**: Citations reference specific retrieved transactions maintaining data traceability
- **Compliant**: AI responses grounded in actual retrieved data (not hallucinated)

### ✅ II. Type Safety & Schema Validation
- **Compliant**: Existing TypeScript strict mode continues to apply
- **Compliant**: Transaction schema unchanged, only adding retrieval indexing layer
- **Compliant**: API contracts preserved (`/api/ai/query` interface unchanged per FR-014)

### ⚠️ III. Performance & Scalability
- **GATE CHECK REQUIRED**: Current implementation loads all transactions into LLM context - **violates** scalability principle for large datasets
- **This Feature Resolves**: RAG approach directly addresses this violation by implementing:
  - FR-011: Query response <10s for 1M transactions (vs current approach that would exhaust memory)
  - SC-003: Memory <2GB regardless of transaction count (vs current approach that scales linearly)
  - FR-002: Fast searching across millions of records via indexed representations

**Justification**: This feature is NECESSARY to bring the system into compliance with Constitution III.

### ✅ IV. User Experience & Accessibility
- **Compliant**: No UI changes required (API contract preserved)
- **Compliant**: Maintains citation-based transparency for user trust
- **Compliant**: Vietnamese language support continues through embedding model choice

### ✅ V. AI Integration & Training Control
- **Compliant**: Session-based data feeding model preserved
- **Enhanced**: Retrieval adds transparency - users can see which transactions were used
- **Compliant**: Ollama integration unchanged, maintains configurability

### Summary
**GATE STATUS**: ✅ **PASS** - This feature is required to resolve a Constitution III violation (scalability). No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/002-rag-query-endpoint/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── rag-retrieval-api.yaml  # Internal retrieval service interface
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── ai/
│   │   ├── query-handler.ts          # Modified: integrate RAG retrieval
│   │   ├── session-manager.ts        # Modified: add index lifecycle
│   │   ├── retrieval/                # NEW: RAG components
│   │   │   ├── embedder.ts           # Generate embeddings for transactions/queries
│   │   │   ├── index.ts              # Vector index management
│   │   │   └── retriever.ts          # Semantic search for relevant transactions
│   │   ├── classifier.ts             # Unchanged
│   │   ├── name-shortener.ts         # Unchanged
│   │   └── ollama-client.ts          # Unchanged
│   └── [existing lib structure unchanged]
├── pages/
│   └── api/
│       └── ai/
│           ├── feed-data.ts          # Modified: build index after feeding
│           ├── query.ts              # Modified: use RAG retrieval
│           └── [other endpoints unchanged]
└── [existing src structure unchanged]

tests/                                 # NEW: test structure to be defined in research
├── unit/
│   └── lib/
│       └── ai/
│           └── retrieval/
│               ├── embedder.test.ts
│               ├── index.test.ts
│               └── retriever.test.ts
└── integration/
    └── api/
        └── ai/
            └── rag-query.test.ts
```

**Structure Decision**: Web application (Option 2) - existing Next.js full-stack pattern with API routes. RAG functionality added as new module under `src/lib/ai/retrieval/` following current AI component organization. Tests co-located with source in standard Next.js pattern.

## Complexity Tracking

**No constitutional violations requiring justification.** This feature resolves an existing violation (Constitution III - Performance & Scalability) without introducing new complexity that would violate constitutional principles.
