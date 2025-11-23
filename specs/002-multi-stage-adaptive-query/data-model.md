# Phase 1: Data Model

**Feature**: Multi-Stage Adaptive Query System  
**Phase**: 1 - Design & Contracts  
**Date**: 2025-11-23

## Entity Relationship Overview

```
SessionMetadata (localStorage)
    ↓ 1:1
ContextState (server memory)
    ↓ 1:N
Transaction[] (loaded data)
    ↓ processed by
QueryIntent → FilterExpression[] → AggregationResult
    ↓ tracked in
FilterLog[]
```

---

## Core Entities

### 1. QueryIntent

**Purpose**: Classification of user question to determine data processing strategy.

**Fields**:
```typescript
interface QueryIntent {
  type: 'aggregation' | 'detail' | 'trend' | 'comparison' | 'recommendation' | 'ranking';
  filters: FilterExpression[];
  aggregations?: AggregationSpec[];
  limit?: number;
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  confidence: number; // 0.0-1.0, AI's confidence in classification
}

interface AggregationSpec {
  field: string;
  operation: 'count' | 'sum' | 'average' | 'min' | 'max';
  groupBy?: string;
}
```

**Examples**:
```typescript
// "Which company imports the most?"
{
  type: 'aggregation',
  filters: [],
  aggregations: [{
    field: 'totalValueUSD',
    operation: 'sum',
    groupBy: 'companyName'
  }],
  orderBy: { field: 'totalValueUSD', direction: 'desc' },
  limit: 10,
  confidence: 0.95
}

// "Show me top 5 US electronics transactions"
{
  type: 'detail',
  filters: [
    { field: 'importCountry', operator: 'contains', value: 'US', matchStrategy: 'case-insensitive' },
    { field: 'categoryName', operator: 'contains', value: 'electronics', matchStrategy: 'case-insensitive' }
  ],
  limit: 5,
  orderBy: { field: 'totalValueUSD', direction: 'desc' },
  confidence: 0.92
}

// "What is the import trend over time?"
{
  type: 'trend',
  filters: [],
  aggregations: [{
    field: 'totalValueUSD',
    operation: 'sum',
    groupBy: 'month'
  }],
  orderBy: { field: 'month', direction: 'asc' },
  confidence: 0.88
}
```

**Validation**: `QueryIntentSchema` (Zod, see research.md)

**Related Requirements**: FR-003 (query intent classification), SC-007 (>90% classification accuracy)

---

### 2. FilterExpression

**Purpose**: AI-generated filter specification applied to in-memory transactions.

**Fields**:
```typescript
interface FilterExpression {
  field: string; // Transaction field name (e.g., 'companyName', 'importCountry')
  operator: 'equals' | 'contains' | 'startsWith' | 'greaterThan' | 'lessThan' | 'between' | 'in';
  value: string | number | string[]; // Filter value or array for 'in'/'between'
  matchStrategy?: 'exact' | 'fuzzy' | 'case-insensitive' | 'normalized';
  fuzzyThreshold?: number; // Levenshtein distance threshold (0-5)
  logicalOperator?: 'AND' | 'OR'; // For combining with next filter
}
```

**Match Strategies**:
- **exact**: Case-sensitive exact match
- **fuzzy**: Levenshtein distance within threshold (typo tolerance)
- **case-insensitive** (default): Lowercase comparison, contains matching
- **normalized**: Lowercase + whitespace trim + diacritics removal + synonym matching

**Examples**:
```typescript
// Simple country filter with smart matching
{
  field: 'importCountry',
  operator: 'contains',
  value: 'US',
  matchStrategy: 'normalized' // Matches "US", "USA", "United States", "Hoa Kỳ"
}

// Company name with fuzzy matching for typos
{
  field: 'companyName',
  operator: 'contains',
  value: 'electonic', // User typo
  matchStrategy: 'fuzzy',
  fuzzyThreshold: 2 // Matches "electronic", "electronics"
}

// Date range filter
{
  field: 'date',
  operator: 'between',
  value: ['2024-01-01', '2024-03-31'] // Q1 2024
}

// Category filter with OR logic
{
  field: 'categoryName',
  operator: 'in',
  value: ['Electronics', 'Electrical Equipment', 'Computer Hardware']
}
```

**Execution**: `filter-engine.ts` applies expressions to `Transaction[]` array

**Validation**: `FilterExpressionSchema` (Zod, see research.md)

**Related Requirements**: FR-001, FR-001a-c (smart matching), FR-004 (filter execution engine)

---

### 3. SessionMetadata

**Purpose**: Persistent session information stored in localStorage, used for session list UI.

**Fields**:
```typescript
interface SessionMetadata {
  sessionId: string; // UUID
  createdAt: string; // ISO 8601 timestamp
  lastActivityAt: string; // ISO 8601 timestamp (updated on every AI interaction)
  transactionCount: number; // Number of transactions loaded in session
  dataSourceInfo: {
    dateRange?: { from: string; to: string }; // Min/max dates in loaded data
    topCompanies?: string[]; // Top 3 company names by transaction count
    topCategories?: string[]; // Top 3 categories by transaction count
    totalValue?: number; // Sum of all totalValueUSD in loaded transactions
  };
}
```

**Storage**: localStorage key `ai-session-list`, value is `SessionMetadata[]`

**Example**:
```typescript
{
  sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  createdAt: '2024-11-23T10:30:00.000Z',
  lastActivityAt: '2024-11-23T12:45:00.000Z',
  transactionCount: 5247,
  dataSourceInfo: {
    dateRange: { from: '2024-01-01', to: '2024-12-31' },
    topCompanies: ['CÔNG TY ABC', 'XYZ Corporation', 'DEF Import Ltd'],
    topCategories: ['Electronics', 'Machinery', 'Textiles'],
    totalValue: 12500000 // $12.5M
  }
}
```

**Operations**:
- **Create**: Generate UUID, set timestamps, transactionCount = 0, save to localStorage
- **Update**: Modify lastActivityAt, transactionCount, dataSourceInfo on data load/filter
- **Delete**: Remove from localStorage array, update UI
- **List**: Read from localStorage, sort by lastActivityAt desc

**Related Requirements**: FR-006b (localStorage persistence), FR-006c (metadata display), SC-012 (<200ms list display)

---

### 4. ContextState

**Purpose**: Complete session state including loaded transactions, conversation history, filter operations. Stored in server memory (Next.js API routes).

**Fields**:
```typescript
interface ContextState {
  sessionId: string; // Links to SessionMetadata
  loadedTransactions: Transaction[]; // Full transaction array loaded into session
  currentFilterView: Transaction[]; // Subset after applying filters
  conversationHistory: ConversationMessage[];
  appliedFilters: FilterLog[]; // History of all filter operations
  aggregationCache?: AggregationCache; // Precomputed aggregations (see research.md)
  status: 'empty' | 'loading' | 'ready' | 'filtering' | 'error';
  errorMessage?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    queryIntent?: QueryIntent;
    filterResults?: FilterMetadata;
    aggregationResults?: AggregationResult;
  };
}

interface Transaction {
  // Existing fields from 001 feature
  _id: string;
  declarationNumber: string; // Số tờ khai (unique key)
  date: string; // ISO 8601
  companyName: string;
  companyAddress: string;
  hsCode: string;
  goodsName: string;
  goodsNameShort: string;
  categoryName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  unitPriceUSD: number;
  totalValueUSD: number;
  currency: string;
  exchangeRate: number;
  paymentMethod: string;
  deliveryTerms: string;
  transportMode: string;
  exportingCountry: string;
  importingCountry: string;
  customsOffice: string;
  exportType: string;
}
```

**Storage**: In-memory Map in API routes (e.g., `const sessions = new Map<string, ContextState>()`)

**Lifecycle**:
1. **Create session**: Empty ContextState with status='empty'
2. **Load data**: Fetch transactions from MongoDB, populate loadedTransactions, build aggregationCache, status='ready'
3. **Apply filter**: Execute FilterExpression on loadedTransactions, update currentFilterView, add FilterLog entry
4. **AI query**: Extract QueryIntent, apply filters, compute aggregations, add to conversationHistory
5. **Delete session**: Remove from Map, trigger garbage collection

**Related Requirements**: FR-006 (session state tracking), FR-002 (iterative refinement), SC-005 (10,000+ transactions)

---

### 5. AggregationResult

**Purpose**: Computed statistics from in-memory transactions, formatted for AI consumption.

**Fields**:
```typescript
interface AggregationResult {
  type: 'groupBy' | 'topN' | 'timeSeries' | 'total';
  field: string; // Aggregated field (e.g., 'totalValueUSD')
  groupByField?: string; // Grouping dimension (e.g., 'companyName')
  data: AggregationDataPoint[];
  totalCount: number; // Number of transactions included
  computedAt: string; // ISO 8601 timestamp
  executionTimeMs: number;
}

interface AggregationDataPoint {
  key: string; // Group key (e.g., company name, month)
  count: number;
  sum?: number;
  average?: number;
  min?: number;
  max?: number;
}
```

**Examples**:
```typescript
// "Which company imports the most?"
{
  type: 'topN',
  field: 'totalValueUSD',
  groupByField: 'companyName',
  data: [
    { key: 'CÔNG TY ABC', count: 450, sum: 2500000 },
    { key: 'XYZ Corporation', count: 380, sum: 1800000 },
    { key: 'DEF Import Ltd', count: 320, sum: 1200000 }
  ],
  totalCount: 5247,
  computedAt: '2024-11-23T12:45:00.000Z',
  executionTimeMs: 45
}

// "What is the import trend over time?"
{
  type: 'timeSeries',
  field: 'totalValueUSD',
  groupByField: 'month',
  data: [
    { key: '2024-01', count: 450, sum: 500000 },
    { key: '2024-02', count: 480, sum: 650000 },
    { key: '2024-03', count: 520, sum: 720000 }
  ],
  totalCount: 1450,
  computedAt: '2024-11-23T12:46:00.000Z',
  executionTimeMs: 38
}

// "What is the total export value?"
{
  type: 'total',
  field: 'totalValueUSD',
  data: [
    { key: 'total', count: 5247, sum: 12500000 }
  ],
  totalCount: 5247,
  computedAt: '2024-11-23T12:47:00.000Z',
  executionTimeMs: 15
}
```

**AI Context Format** (token-optimized):
```
Aggregation: Company Rankings by Total Value
- CÔNG TY ABC: 450 transactions, $2.5M total
- XYZ Corporation: 380 transactions, $1.8M total
- DEF Import Ltd: 320 transactions, $1.2M total
(Total: 5,247 transactions, $12.5M, computed in 45ms)
```

**Related Requirements**: FR-005 (in-memory aggregations), SC-002 (<100ms computation), SC-006 (80% token reduction)

---

### 6. FilterLog

**Purpose**: Audit trail of filter operations for debugging and performance analysis.

**Fields**:
```typescript
interface FilterLog {
  timestamp: string; // ISO 8601
  sessionId: string;
  filterExpression: FilterExpression;
  matchedCount: number; // Number of transactions matching filter
  totalCount: number; // Total transactions in session
  executionTimeMs: number;
  resultSample?: Transaction[]; // First 5 matched transactions (for debugging)
}
```

**Example**:
```typescript
{
  timestamp: '2024-11-23T12:45:00.000Z',
  sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  filterExpression: {
    field: 'importCountry',
    operator: 'contains',
    value: 'US',
    matchStrategy: 'normalized'
  },
  matchedCount: 487,
  totalCount: 5247,
  executionTimeMs: 12,
  resultSample: [/* first 5 US transactions */]
}
```

**Storage**: Array in ContextState (memory only, not persisted)

**Usage**:
- Performance monitoring (identify slow filters)
- Debugging incorrect filter results
- UI display (show user what filters were applied)

**Related Requirements**: FR-009 (logging), FR-012 (filter metadata)

---

## AggregationCache (Internal)

**Purpose**: Precomputed aggregations for fast repeated queries (see research.md for details).

**Fields**:
```typescript
interface AggregationCache {
  byCompany: Map<string, { count: number; totalValue: number }>;
  byGoodsName: Map<string, { count: number; totalValue: number }>;
  byCategory: Map<string, { count: number; totalValue: number }>;
  byMonth: Map<string, { count: number; totalValue: number }>;
  totalValue: number;
  totalCount: number;
  lastUpdated: number; // Unix timestamp
}
```

**Lifecycle**:
1. Build on data load: O(n) = ~20ms for 10K transactions
2. Rebuild on filter: O(m) = ~5ms for 500 filtered transactions
3. Query top-N: O(k log k) = ~1ms for 100 unique companies

**Not exposed in API**: Internal optimization in aggregation-engine.ts

---

## Entity Relationships

### Session Lifecycle

```
1. Create Session
   SessionMetadata (localStorage) ← created with UUID
   ContextState (server) ← created with status='empty'

2. Load Data
   ContextState.loadedTransactions ← fetch from MongoDB
   ContextState.aggregationCache ← build from loadedTransactions
   SessionMetadata.transactionCount ← update count
   SessionMetadata.dataSourceInfo ← compute summaries

3. User Query
   User input → AI analysis → QueryIntent
   QueryIntent.filters → FilterExpression[]
   FilterExpression[] → filter-engine → currentFilterView
   currentFilterView → aggregation-engine → AggregationResult
   All operations → FilterLog entries
   Result → ConversationMessage

4. Switch Session
   Load SessionMetadata from localStorage
   Fetch ContextState from server Map
   Update UI with currentFilterView

5. Delete Session
   Remove SessionMetadata from localStorage
   Remove ContextState from server Map
   Switch to another active session or create new
```

### Data Flow: Query Execution

```
User Question
  ↓
AI Analysis (query-handler.ts)
  ↓
QueryIntent extraction
  ↓
FilterExpression[] generation
  ↓
filter-engine.ts applies to loadedTransactions
  ↓
currentFilterView (filtered subset)
  ↓
[Branch based on QueryIntent.type]
  ↓ aggregation     ↓ detail
aggregation-engine  format transactions
  ↓                   ↓
AggregationResult   Transaction[]
  ↓                   ↓
Format for AI context (200 bytes vs 50KB)
  ↓
AI generates response
  ↓
ConversationMessage (save to history)
```

---

## Schema Validation Summary

All entities have corresponding Zod schemas for runtime validation:

- `QueryIntentSchema` (query-handler.ts)
- `FilterExpressionSchema` (validation.ts)
- `SessionMetadataSchema` (validation.ts)
- `AggregationResultSchema` (aggregation-engine.ts)

TypeScript interfaces provide compile-time type safety, Zod schemas provide runtime validation.

**Related Requirements**: FR-001 through FR-012, Constitution Principle II (Type Safety & Schema Validation)
