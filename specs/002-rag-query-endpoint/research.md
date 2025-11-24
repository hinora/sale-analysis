# Research: RAG-based Query Endpoint

**Date**: November 23, 2025
**Feature**: [spec.md](./spec.md) | [plan.md](./plan.md)

This document resolves NEEDS CLARIFICATION items from the Technical Context to enable Phase 1 design.

---

## Research Task 1: Embedding Library for Vietnamese/English Text

**Question**: Which embedding library should we use to generate searchable representations that work well with both Vietnamese and English transaction data?

### Decision: `@xenova/transformers` (Transformers.js)

**Rationale**:
- **Browser and Node.js Compatible**: Runs in Next.js serverless functions without external services
- **Multilingual Support**: Provides access to multilingual models like `Xenova/multilingual-e5-small` that handle Vietnamese and English
- **Zero External Dependencies**: No need for Python runtime, external API calls, or additional infrastructure
- **TypeScript Native**: First-class TypeScript support aligns with project standards
- **Memory Efficient**: Small models (under 100MB) suitable for serverless deployment
- **Active Maintenance**: Well-maintained library with regular updates and community support

### Alternatives Considered:

1. **OpenAI Embeddings API**
   - **Rejected**: Requires external API calls, adds latency and cost, introduces network dependency that violates self-contained design

2. **Ollama Embeddings**
   - **Rejected**: While Ollama is already in use for LLM, embedding generation requires separate model management and the project already runs Ollama for chat completions. Adding embedding workload could interfere with query processing.

3. **TensorFlow.js with Universal Sentence Encoder**
   - **Rejected**: Heavier runtime, less optimized for multilingual use cases, more complex model loading

### Implementation Notes:
- Model: `Xenova/multilingual-e5-small` (384 dimensions, ~80MB)
- Embedding generation: 50-100ms per transaction on average hardware
- Batch processing: Generate embeddings in chunks of 100 transactions for efficiency

---

## Research Task 2: Vector Search Library for In-Memory Indexing

**Question**: Which vector search library should we use for in-memory indexing that can handle millions of transaction embeddings efficiently?

### Decision: `vectra` (Lightweight TypeScript Vector Database)

**Rationale**:
- **Pure TypeScript**: No native bindings, fully compatible with Next.js serverless
- **Local/In-Memory**: Supports both file-based and in-memory indexes matching session storage pattern
- **Cosine Similarity Search**: Proper semantic similarity matching for embeddings
- **Simple API**: Minimal learning curve, straightforward integration
- **Session-Scoped**: Designed for application-embedded use cases (not enterprise vector DB)
- **Metadata Support**: Can store transaction IDs alongside vectors for citation retrieval
- **Performance**: Handles 100k+ vectors in memory with sub-second query times

### Alternatives Considered:

1. **hnswlib-node**
   - **Rejected**: Requires native C++ compilation, problematic for serverless deployment, more complex build pipeline

2. **Faiss (Facebook AI Similarity Search)**
   - **Rejected**: Python-first library, would require Python subprocess or separate service, violates TypeScript-first architecture

3. **Pinecone / Weaviate / Milvus**
   - **Rejected**: External managed services or heavy infrastructure, contradicts "in-memory per session" requirement from assumptions

4. **Custom Implementation (Brute Force)**
   - **Rejected**: For 1M vectors × 384 dims, brute force cosine similarity would be too slow (>30s per query), fails SC-001 requirement

### Implementation Notes:
- Index creation: ~2-3 seconds for 100k transaction embeddings
- Query time: <100ms for top-k retrieval (k=100-500)
- Memory: ~400MB for 1M transactions (384-dim embeddings as float32)

---

## Research Task 3: Testing Framework and Approach

**Question**: What testing framework should we use, and what testing strategy is appropriate for RAG components?

### Decision: Vitest + Testing Library

**Rationale**:
- **Vitest**: Fast, Vite-powered test runner with excellent TypeScript support
- **Next.js Compatible**: Works seamlessly with Next.js 16+ projects
- **Jest-Compatible API**: Familiar API for developers coming from Jest
- **Fast Execution**: Native ESM support, parallel test execution
- **Built-in Coverage**: Integrated coverage reporting via c8/istanbul
- **Snapshot Testing**: Useful for testing embedding consistency and retrieval results

### Testing Strategy:

#### Unit Tests (`tests/unit/lib/ai/retrieval/`)

1. **embedder.test.ts**
   - Test embedding generation for sample transactions
   - Verify dimension consistency (384 dims)
   - Test batch processing logic
   - Test error handling for invalid input

2. **index.test.ts**
   - Test index creation and transaction addition
   - Verify metadata storage (transaction IDs)
   - Test index rebuild on data changes
   - Test memory cleanup on session expiry

3. **retriever.test.ts**
   - Test semantic search with known queries
   - Verify top-k retrieval accuracy
   - Test relevance threshold filtering
   - Test empty result handling

#### Integration Tests (`tests/integration/api/ai/`)

1. **rag-query.test.ts**
   - Test full query flow: feed data → build index → query → retrieve → generate response
   - Verify citation accuracy (retrieved transactions appear in response)
   - Test performance benchmarks (query time, memory usage)
   - Test conversation context handling

### Alternatives Considered:

1. **Jest**
   - **Rejected**: Slower than Vitest, requires more configuration for ESM/TypeScript in Next.js

2. **No Testing (Manual QA only)**
   - **Rejected**: Constitution II (Type Safety) implies systematic quality assurance, RAG correctness critical for user trust

### Implementation Notes:
- Add `vitest` and `@testing-library/react` to devDependencies
- Create `vitest.config.ts` at project root
- Use test fixtures for sample transaction data
- Mock Ollama client in integration tests to isolate RAG components

---

## Research Task 4: Best Practices for RAG Retrieval in Transaction Analysis

**Question**: What are the best practices for implementing RAG retrieval specifically for structured transaction data?

### Key Findings:

#### 1. Transaction Embedding Strategy
**Best Practice**: Concatenate structured fields into natural language format before embedding

```
Example format for embedding:
"Company: ABC Import Export Corp, Country: Vietnam, Category: Electronics, 
Product: Smartphone parts, Date: 2024-10-15, Value: $25,000 USD, 
Quantity: 500 units at $50 per unit"
```

**Rationale**: Embedding models trained on natural language perform better with readable text than JSON or CSV formats. This approach captures semantic relationships between fields.

#### 2. Retrieval Count (k) Selection
**Best Practice**: Use adaptive k based on query type
- Aggregation queries (sums, averages): k=500 (need more data for accuracy)
- Specific lookups (company X, product Y): k=100 (narrow focus)
- Comparative queries: k=200 per entity being compared

**Rationale**: Different analytical questions require different amounts of context. Starting with k=100 default, adjustable per FR-006.

#### 3. Query Enhancement
**Best Practice**: Expand user query with conversation history context before embedding

```
Original: "What about Company B?"
Enhanced: "What about Company B? [Previous context: discussing top importers in electronics category]"
```

**Rationale**: Improves retrieval relevance for follow-up questions (US3, SC-008).

#### 4. Citation Mapping
**Best Practice**: Store transaction IDs in vector metadata, return them with similarity scores

**Rationale**: Enables FR-008 (citations), allows ranking transactions by relevance for answer generation.

#### 5. Fallback Strategy
**Best Practice**: If top retrieved transactions have similarity < 0.6, inform user rather than answering

**Rationale**: Prevents hallucination (FR-009), maintains data integrity (Constitution I).

---

## Summary: All Clarifications Resolved

| Item | Resolution |
|------|-----------|
| Embedding Library | `@xenova/transformers` with `multilingual-e5-small` model |
| Vector Search Library | `vectra` for in-memory TypeScript vector indexing |
| Testing Framework | Vitest + Testing Library for unit and integration tests |
| RAG Best Practices | Natural language formatting, adaptive k, query enhancement, citation mapping, fallback strategy |

**Ready for Phase 1**: Design can now proceed with concrete technology choices and implementation patterns.
