# Data Model: RAG-based Query Endpoint

**Date**: November 23, 2025
**Feature**: [spec.md](./spec.md) | [plan.md](./plan.md) | [research.md](./research.md)

This document defines the data entities and their relationships for the RAG retrieval system.

---

## Core Entities

### 1. TransactionEmbedding

Represents the searchable vector form of a transaction for semantic retrieval.

**Fields:**
- `transactionId: string` - Reference to original transaction in database
- `embedding: number[]` - 384-dimensional float array from multilingual-e5-small model
- `textRepresentation: string` - Natural language format used to generate embedding
- `createdAt: Date` - Timestamp when embedding was generated

**Validation Rules:**
- `transactionId` must be non-empty and reference valid transaction
- `embedding` must be exactly 384 dimensions
- `textRepresentation` must be non-empty string
- `createdAt` auto-set on creation

**Lifecycle:**
- Created when transaction data is fed to session
- Deleted when session expires
- Regenerated if transaction data changes (via session re-feed)

**Storage:**
- In-memory only (not persisted to MongoDB)
- Managed by vectra index
- Lifecycle tied to AISession

---

### 2. SessionVectorIndex

Represents the searchable index for a specific AI session's transaction data.

**Fields:**
- `sessionId: string` - Links to AISession
- `vectorIndex: VectraIndex` - In-memory vectra index instance
- `transactionCount: number` - Number of transactions indexed
- `embeddingDimensions: number` - Always 384 for multilingual-e5-small
- `indexedAt: Date` - When index was last built/rebuilt
- `status: 'building' | 'ready' | 'failed'` - Index state

**Validation Rules:**
- `sessionId` must reference existing AISession
- `transactionCount` must match length of session transactionData
- `embeddingDimensions` must be 384
- `status` must be valid enum value

**State Transitions:**
- `building` → `ready`: Index build completes successfully
- `building` → `failed`: Embedding generation or index creation fails
- `ready` → `building`: Session data is re-fed (index rebuild)

**Lifecycle:**
- Created when `feed-data` endpoint is called
- Updated when session data changes
- Deleted when session expires (follows AISession lifecycle)

**Storage:**
- In-memory only (not persisted)
- Stored in session-manager alongside AISession
- Memory footprint: ~400MB for 1M transactions

---

### 3. RetrievalResult

Represents the outcome of a semantic search query against the session index.

**Fields:**
- `retrievedTransactions: Transaction[]` - Ordered list of relevant transactions
- `similarityScores: number[]` - Cosine similarity score for each transaction (0-1)
- `query: string` - Original user query
- `queryEmbedding: number[]` - Embedded form of query
- `retrievalCount: number` - Number of transactions retrieved (k)
- `relevanceThreshold: number` - Minimum similarity score used (default 0.6)
- `retrievedAt: Date` - Timestamp of retrieval

**Validation Rules:**
- `retrievedTransactions` length must equal `retrievalCount`
- `similarityScores` length must equal `retrievedTransactions` length
- All `similarityScores` must be >= `relevanceThreshold`
- `queryEmbedding` must be exactly 384 dimensions
- `retrievalCount` must be between 0 and 500

**Relationships:**
- Each `Transaction` in `retrievedTransactions` corresponds to a `TransactionEmbedding` in the index
- Scores are ordered descending (highest similarity first)

**Lifecycle:**
- Created per query request
- Passed to query-handler for response generation
- Not persisted (ephemeral result object)

---

## Modified Existing Entities

### AISession (Enhanced)

**New Fields Added:**
- `vectorIndex?: SessionVectorIndex` - Optional index for RAG retrieval
- `useRAG: boolean` - Flag indicating whether session uses RAG (true for new sessions post-feature)

**Behavior Changes:**
- When `transactionData` is set, if `useRAG === true`, `vectorIndex` is built automatically
- `vectorIndex` lifecycle follows session lifecycle
- Old sessions (created before feature) have `useRAG === false` and continue using old approach

**Backward Compatibility:**
- Existing sessions without `vectorIndex` continue to work with full-data approach
- New sessions automatically get RAG enabled

---

## Data Flow

### 1. Feed Data Flow (Modified)
```
User uploads CSV
  ↓
Import → Parse → Validate → Store in DB
  ↓
Create/Update AISession with transactionData
  ↓
IF useRAG === true:
  Generate TransactionEmbeddings (batch of 100)
    ↓
  Build SessionVectorIndex with vectra
    ↓
  Update session status to 'ready'
```

### 2. Query Flow (New RAG Path)
```
User submits query
  ↓
Validate query
  ↓
Get AISession
  ↓
IF session.useRAG:
  Generate query embedding
    ↓
  Search SessionVectorIndex (cosine similarity)
    ↓
  Create RetrievalResult with top-k transactions
    ↓
  Generate LLM prompt with ONLY retrieved transactions
    ↓
  Call Ollama with compact context
ELSE:
  [Old path: use all transactionData]
  ↓
Return response with citations
```

---

## Indexing Strategy

### Embedding Generation
- **Batch Size**: 100 transactions per batch
- **Parallelization**: Sequential batches to avoid memory spikes
- **Format**: Natural language concatenation of fields
- **Example**:
  ```
  Company: ABC Import Export Corp
  Country: Vietnam
  Category: Electronics
  Product: Smartphone parts - Model XYZ
  Date: 2024-10-15
  Value: $25,000 USD
  Quantity: 500 units at $50 per unit
  ```

### Index Rebuild Triggers
- New data fed to existing session (via re-feed)
- Session explicitly refreshed (future enhancement)
- Never on individual transaction edits (out of scope - FR-013 implementation deferred)

### Index Memory Management
- Maximum 1M transactions per index (constitution scale limit)
- Estimated memory: 400MB for 1M × 384-dim embeddings
- Automatic cleanup on session expiration
- No disk persistence (session-scoped only)

---

## Retrieval Parameters

### Default Values
- **k (retrieval count)**: 100 transactions
- **Relevance threshold**: 0.6 (cosine similarity)
- **Max k**: 500 transactions (hard limit per FR-006)

### Adaptive Retrieval (Future Enhancement)
- Query type detection could adjust k:
  - Aggregation: k=500
  - Specific: k=100
  - Comparison: k=200 per entity
- Not implemented in Phase 1 (out of scope)

---

## TypeScript Interfaces

```typescript
// src/lib/ai/retrieval/types.ts

export interface TransactionEmbedding {
  transactionId: string;
  embedding: number[];  // 384 dimensions
  textRepresentation: string;
  createdAt: Date;
}

export interface SessionVectorIndex {
  sessionId: string;
  vectorIndex: any;  // vectra Index type
  transactionCount: number;
  embeddingDimensions: number;  // Always 384
  indexedAt: Date;
  status: 'building' | 'ready' | 'failed';
}

export interface RetrievalResult {
  retrievedTransactions: Array<Record<string, unknown>>;  // Transaction objects
  similarityScores: number[];
  query: string;
  queryEmbedding: number[];
  retrievalCount: number;
  relevanceThreshold: number;
  retrievedAt: Date;
}

export interface RetrievalConfig {
  k: number;              // Default: 100
  threshold: number;      // Default: 0.6
  maxK: number;          // Hard limit: 500
}
```

---

## Validation & Error Handling

### Embedding Generation Failures
- **Cause**: Model load failure, out of memory, invalid input
- **Handling**: Set `SessionVectorIndex.status = 'failed'`, return error to user, preserve session data
- **Recovery**: User can retry feed-data operation

### Index Build Failures
- **Cause**: Vectra initialization fails, insufficient memory
- **Handling**: Fallback to non-RAG mode for that session, log error, continue operation
- **User Impact**: Query may be slower but still functional

### Retrieval Failures
- **Cause**: Query embedding generation fails, index corrupted
- **Handling**: Return error with clear message, suggest re-feeding data
- **User Impact**: Query cannot proceed, must retry

### Low Relevance Results
- **Cause**: No transactions semantically similar to query (all scores < threshold)
- **Handling**: Return empty retrieval result, inform user "No relevant data found"
- **User Impact**: Transparent communication per FR-009

---

## Schema Evolution

### Version 1 (This Feature)
- Basic RAG with fixed k=100, threshold=0.6
- In-memory storage only
- Rebuild on re-feed

### Future Enhancements (Out of Scope)
- Adaptive k selection based on query type
- Incremental index updates (add/remove single transactions)
- Index persistence to disk for faster session resume
- Hybrid search (keyword + semantic)
- Re-ranking retrieved results
