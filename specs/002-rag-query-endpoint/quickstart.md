# Quickstart Guide: RAG-based Query Endpoint

**Feature**: [spec.md](./spec.md) | [plan.md](./plan.md) | [research.md](./research.md) | [data-model.md](./data-model.md)

This guide provides a practical walkthrough for developers implementing and testing the RAG retrieval system.

---

## Prerequisites

- Node.js 20+ and npm installed
- MongoDB 7+ running locally or accessible
- Ollama installed with a model (e.g., `deepseek-r1:1.5b`)
- Existing sale-analysis project cloned and dependencies installed

---

## Installation

### 1. Install New Dependencies

```bash
npm install @xenova/transformers vectra
npm install --save-dev vitest @vitest/ui @testing-library/react
```

### 2. Configure Vitest

Create `vitest.config.ts` in project root:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/ai/retrieval/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 3. Add Test Scripts to package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

---

## Development Workflow

### Phase 1: Implement Embedder Module

**File**: `src/lib/ai/retrieval/embedder.ts`

```typescript
import { pipeline } from '@xenova/transformers';

// Initialize embedding model (lazy loaded)
let embedder: any = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
  }
  return embedder;
}

export async function generateTransactionEmbedding(transaction: Record<string, unknown>) {
  const text = formatTransactionForEmbedding(transaction);
  const model = await getEmbedder();
  const result = await model(text, { pooling: 'mean', normalize: true });
  
  return {
    transactionId: String(transaction._id || transaction.id),
    embedding: Array.from(result.data),
    textRepresentation: text,
    createdAt: new Date(),
  };
}

function formatTransactionForEmbedding(tx: Record<string, unknown>): string {
  return `Company: ${tx.companyName}
Country: ${tx.importCountry}
Category: ${tx.categoryName}
Product: ${tx.goodsName}
Date: ${tx.date}
Value: $${tx.totalValueUSD} USD
Quantity: ${tx.quantity} ${tx.unit} at $${tx.unitPriceUSD} per unit`;
}
```

**Test**: `tests/unit/lib/ai/retrieval/embedder.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { generateTransactionEmbedding } from '@/lib/ai/retrieval/embedder';

describe('Embedder', () => {
  it('generates 384-dimensional embedding for transaction', async () => {
    const transaction = {
      _id: 'tx-123',
      companyName: 'ABC Corp',
      importCountry: 'Vietnam',
      categoryName: 'Electronics',
      goodsName: 'Smartphone',
      date: '2024-10-15',
      totalValueUSD: 25000,
      quantity: 500,
      unit: 'units',
      unitPriceUSD: 50,
    };
    
    const result = await generateTransactionEmbedding(transaction);
    
    expect(result.embedding).toHaveLength(384);
    expect(result.transactionId).toBe('tx-123');
    expect(result.textRepresentation).toContain('ABC Corp');
  });
});
```

Run test: `npm test embedder.test.ts`

---

### Phase 2: Implement Index Module

**File**: `src/lib/ai/retrieval/index.ts`

```typescript
import { LocalIndex } from 'vectra';
import path from 'path';

// In-memory storage of session indexes
const sessionIndexes = new Map<string, any>();

export async function buildIndex(
  sessionId: string,
  embeddings: Array<{ transactionId: string; embedding: number[] }>
) {
  try {
    // Create in-memory index
    const index = new LocalIndex(path.join(process.cwd(), '.vectra-temp', sessionId));
    
    // Add embeddings to index
    for (const emb of embeddings) {
      await index.insertItem({
        vector: emb.embedding,
        metadata: { transactionId: emb.transactionId },
      });
    }
    
    // Store in memory
    sessionIndexes.set(sessionId, index);
    
    return {
      sessionId,
      status: 'ready' as const,
      transactionCount: embeddings.length,
      embeddingDimensions: 384,
      indexedAt: new Date(),
    };
  } catch (error) {
    return {
      sessionId,
      status: 'failed' as const,
      transactionCount: 0,
      embeddingDimensions: 384,
      indexedAt: new Date(),
      error: String(error),
    };
  }
}

export function getIndex(sessionId: string) {
  return sessionIndexes.get(sessionId) || null;
}

export async function deleteIndex(sessionId: string) {
  const index = sessionIndexes.get(sessionId);
  if (index) {
    sessionIndexes.delete(sessionId);
  }
}
```

**Test**: Run `npm test index.test.ts` after implementation

---

### Phase 3: Implement Retriever Module

**File**: `src/lib/ai/retrieval/retriever.ts`

```typescript
import { getIndex } from './index';

export async function retrieve(
  sessionId: string,
  queryEmbedding: number[],
  k = 100,
  threshold = 0.6
) {
  const index = getIndex(sessionId);
  
  if (!index) {
    throw new Error(`No index found for session ${sessionId}`);
  }
  
  // Query vector index
  const results = await index.queryItems(queryEmbedding, k);
  
  // Filter by threshold
  const filtered = results.filter((r: any) => r.score >= threshold);
  
  // Get transaction IDs
  const transactionIds = filtered.map((r: any) => r.item.metadata.transactionId);
  const scores = filtered.map((r: any) => r.score);
  
  // Fetch actual transactions (from session data or database)
  // This will be implemented in integration with session-manager
  
  return {
    transactionIds,
    scores,
    retrievalCount: transactionIds.length,
  };
}
```

---

### Phase 4: Integrate with Existing System

**Modified File**: `src/lib/ai/session-manager.ts`

Add to AISession interface:

```typescript
export interface AISession {
  // ... existing fields
  vectorIndex?: {
    status: 'building' | 'ready' | 'failed';
    transactionCount: number;
    indexedAt: Date;
  };
  useRAG: boolean;  // Default true for new sessions
}
```

**Modified File**: `src/pages/api/ai/feed-data.ts`

After storing transaction data:

```typescript
// Build RAG index if session uses RAG
if (session.useRAG) {
  updateSessionStatus(sessionId, 'indexing');
  
  // Generate embeddings
  const embeddings = await generateBatchEmbeddings(session.transactionData, 100);
  
  // Build index
  const indexResult = await buildIndex(sessionId, embeddings);
  
  // Update session
  session.vectorIndex = {
    status: indexResult.status,
    transactionCount: indexResult.transactionCount,
    indexedAt: indexResult.indexedAt,
  };
  
  updateSessionStatus(sessionId, 'ready');
}
```

**Modified File**: `src/pages/api/ai/query.ts`

Replace full-data context with RAG retrieval:

```typescript
if (session.useRAG && session.vectorIndex?.status === 'ready') {
  // Generate query embedding
  const queryEmb = await generateQueryEmbedding(question);
  
  // Retrieve relevant transactions
  const retrieval = await retrieve(sessionId, queryEmb.queryEmbedding, 100, 0.6);
  
  // Pass only retrieved transactions to query handler
  const result = await queryHandler.processQueryWithRetrieval(
    retrieval.transactionIds,
    question,
    session
  );
} else {
  // Fallback to old approach
  const result = await queryHandler.processQuery(session, question);
}
```

---

## Testing

### Unit Tests

```bash
npm test                    # Run all tests
npm test:coverage           # Run with coverage report
npm test:ui                 # Open Vitest UI
```

### Integration Test

Create a test session with sample data:

```typescript
// tests/integration/api/ai/rag-query.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

describe('RAG Query Flow', () => {
  let sessionId: string;
  
  beforeAll(async () => {
    // Create session
    const response = await fetch('http://localhost:3000/api/ai/session', {
      method: 'POST',
    });
    const data = await response.json();
    sessionId = data.sessionId;
    
    // Feed data
    await fetch('http://localhost:3000/api/ai/feed-data', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        filters: { /* select test transactions */ },
      }),
    });
    
    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 5000));
  });
  
  it('retrieves relevant transactions and generates answer', async () => {
    const response = await fetch('http://localhost:3000/api/ai/query', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        question: 'Which company imported the most?',
      }),
    });
    
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.answer).toBeDefined();
    expect(data.citations.length).toBeGreaterThan(0);
  });
});
```

---

## Performance Benchmarking

Create a benchmark script:

```typescript
// scripts/benchmark-rag.ts
import { generateBatchEmbeddings } from '../src/lib/ai/retrieval/embedder';
import { buildIndex } from '../src/lib/ai/retrieval/index';
import { retrieve } from '../src/lib/ai/retrieval/retriever';

async function benchmark() {
  const sizes = [1000, 10000, 100000, 1000000];
  
  for (const size of sizes) {
    console.log(`\nBenchmarking ${size} transactions:`);
    
    // Generate mock transactions
    const transactions = generateMockTransactions(size);
    
    // Time embedding generation
    const embedStart = Date.now();
    const embeddings = await generateBatchEmbeddings(transactions, 100);
    console.log(`  Embedding: ${Date.now() - embedStart}ms`);
    
    // Time index build
    const indexStart = Date.now();
    await buildIndex('bench-session', embeddings);
    console.log(`  Index build: ${Date.now() - indexStart}ms`);
    
    // Time retrieval
    const queryEmb = new Array(384).fill(0).map(() => Math.random());
    const retrieveStart = Date.now();
    await retrieve('bench-session', queryEmb, 100, 0.6);
    console.log(`  Retrieval: ${Date.now() - retrieveStart}ms`);
  }
}

benchmark();
```

Run: `tsx scripts/benchmark-rag.ts`

---

## Debugging Tips

### Enable Transformers.js Debug Logging

```typescript
import { env } from '@xenova/transformers';
env.allowLocalModels = false;
env.useBrowserCache = false;
```

### Inspect Index Contents

```typescript
const index = getIndex(sessionId);
console.log('Index stats:', {
  itemCount: await index.listItems(),
  // ... other debugging info
});
```

### Test Single Transaction Embedding

```bash
curl -X POST http://localhost:3000/api/ai/test-embedding \
  -H "Content-Type: application/json" \
  -d '{"transactionId": "some-id"}'
```

---

## Common Issues

### Issue: Model Download Timeout
**Solution**: Pre-download model:
```bash
node -e "const { pipeline } = require('@xenova/transformers'); pipeline('feature-extraction', 'Xenova/multilingual-e5-small').then(() => console.log('Downloaded'))"
```

### Issue: Memory Overflow During Indexing
**Solution**: Reduce batch size in `generateBatchEmbeddings` from 100 to 50

### Issue: Low Retrieval Relevance
**Solution**: Adjust threshold from 0.6 to 0.5 or check embedding quality

---

## Next Steps

1. Implement all three retrieval modules (embedder, index, retriever)
2. Write unit tests for each module
3. Integrate with existing session-manager and query-handler
4. Run integration tests
5. Benchmark with production-scale data
6. Deploy and monitor performance metrics

---

## Reference

- [Transformers.js Docs](https://huggingface.co/docs/transformers.js)
- [Vectra Docs](https://github.com/Stevenic/vectra)
- [Vitest Docs](https://vitest.dev/)
- [Feature Spec](./spec.md)
- [Data Model](./data-model.md)
