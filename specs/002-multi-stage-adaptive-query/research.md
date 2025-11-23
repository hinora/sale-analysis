# Phase 0: Research & Technical Decisions

**Feature**: Multi-Stage Adaptive Query System  
**Phase**: 0 - Outline & Research  
**Date**: 2025-11-23

## Research Tasks

This document consolidates research findings for all "NEEDS CLARIFICATION" items from Technical Context and key technical decisions required for implementation.

---

## 1. Text Normalization Algorithms

### Decision: Multi-Strategy Matching Pipeline

**Problem**: Vietnamese customs data has inconsistent formats - "US" vs "USA" vs "United States" vs "Hoa Kỳ", company names with mixed case/whitespace, typos from manual entry.

**Rationale**: Single matching strategy insufficient. Need layered approach:
1. **Case-insensitive comparison** (baseline): Convert both filter value and data value to lowercase
2. **Whitespace normalization**: Trim leading/trailing spaces, collapse internal whitespace to single space
3. **Contains matching** (default for text fields): Substring search instead of exact match - "ABC" matches anywhere in "CÔNG TY ABC Corp Ltd"
4. **Synonym matching**: Configurable equivalence map - "US" → ["USA", "United States", "Hoa Kỳ"]
5. **Vietnamese diacritics**: Optional accent removal - "điện tử" matches "dien tu"
6. **Fuzzy matching** (Levenshtein distance): Handle typos - "electonic" matches "electronics" within threshold distance

**Implementation Approach**:
```typescript
// text-normalizer.ts
export interface NormalizationOptions {
  caseSensitive?: boolean;
  trimWhitespace?: boolean;
  matchStrategy?: 'exact' | 'contains' | 'startsWith' | 'fuzzy';
  removeDiacritics?: boolean;
  synonyms?: Record<string, string[]>;
  fuzzyThreshold?: number; // Levenshtein distance (0-3 recommended)
}

export function normalizeText(text: string, options: NormalizationOptions): string {
  let normalized = text;
  
  if (!options.caseSensitive) {
    normalized = normalized.toLowerCase();
  }
  
  if (options.trimWhitespace) {
    normalized = normalized.trim().replace(/\s+/g, ' ');
  }
  
  if (options.removeDiacritics) {
    normalized = removeDiacritics(normalized);
  }
  
  return normalized;
}

export function matchesFilter(dataValue: string, filterValue: string, options: NormalizationOptions): boolean {
  const normalizedData = normalizeText(dataValue, options);
  const normalizedFilter = normalizeText(filterValue, options);
  
  // Check synonyms first
  if (options.synonyms && checkSynonyms(normalizedData, normalizedFilter, options.synonyms)) {
    return true;
  }
  
  // Apply match strategy
  switch (options.matchStrategy) {
    case 'exact':
      return normalizedData === normalizedFilter;
    case 'contains':
      return normalizedData.includes(normalizedFilter);
    case 'startsWith':
      return normalizedData.startsWith(normalizedFilter);
    case 'fuzzy':
      return levenshteinDistance(normalizedData, normalizedFilter) <= (options.fuzzyThreshold || 2);
    default:
      return normalizedData.includes(normalizedFilter); // Default to contains
  }
}
```

**Libraries Considered**:
- **fuse.js**: Full fuzzy search library (140KB) - REJECTED (too heavy for simple text matching)
- **fast-levenshtein**: Lightweight Levenshtein distance (2KB) - ACCEPTED (add to dependencies)
- **remove-accents**: Vietnamese diacritics removal (5KB) - ACCEPTED (add to dependencies)

**Alternatives Considered**:
- Regular expressions: REJECTED (complex to maintain, poor performance for large datasets)
- Full-text search (MongoDB indexes): REJECTED (data already in memory, adds complexity)
- Exact matching only: REJECTED (fails on real-world data quality issues per spec requirements)

**Success Metric**: >95% recall on raw data variations (SC-015)

---

## 2. Session Persistence Strategies

### Decision: Hybrid localStorage + Server Memory

**Problem**: Need to persist session list across page refreshes while supporting 10,000+ transactions per session without localStorage size limits.

**Rationale**: 
- **localStorage** for session list metadata only (session IDs, creation times, transaction counts) - survives page refresh, minimal size (~5KB for 10 sessions)
- **Server memory** (in-memory Map in Next.js API routes) for full transaction data per session - supports large datasets, fast access, no browser limits
- **No database persistence** for session data - sessions are temporary analysis workspaces, not permanent storage

**Implementation Approach**:
```typescript
// Client-side (localStorage)
interface SessionListItem {
  sessionId: string;
  createdAt: string;
  lastActivityAt: string;
  transactionCount: number;
}

function getSessionList(): SessionListItem[] {
  const list = localStorage.getItem('ai-session-list');
  return list ? JSON.parse(list) : [];
}

function saveSessionList(sessions: SessionListItem[]): void {
  localStorage.setItem('ai-session-list', JSON.stringify(sessions));
}

// Server-side (API routes memory)
const sessionStore = new Map<string, AISession>();

export function storeSession(session: AISession): void {
  sessionStore.set(session.sessionId, session);
}

export function getSession(sessionId: string): AISession | null {
  return sessionStore.get(sessionId) || null;
}
```

**Alternatives Considered**:
- IndexedDB for full session data: REJECTED (complex API, async operations add latency, 50MB limit insufficient for 10K transactions)
- SessionStorage: REJECTED (lost on tab close, same size limits as localStorage)
- Database persistence: REJECTED (adds latency, unnecessary for temporary analysis sessions, creates storage bloat)
- Redis/external cache: REJECTED (deployment complexity, feature doesn't require persistence beyond page refresh)

**Constraints**:
- localStorage limit: ~5-10MB per origin (sufficient for metadata list of 100+ sessions)
- Server memory: Limited by Node.js heap (~2GB default) - 10 sessions × 10K transactions × 2KB avg = ~200MB (acceptable)
- Session expiration: Implement cleanup after 24 hours of inactivity (FR-007 mentions iteration limit, extend to session lifecycle)

**Success Metrics**: SC-013 (persistence across refresh), SC-011 (10+ concurrent sessions), SC-012 (<200ms list display)

---

## 3. In-Memory Aggregation Optimization

### Decision: Precomputed Aggregation Cache with Incremental Updates

**Problem**: Aggregation queries ("Which company imports the most?") need sub-100ms performance on 10,000+ transactions.

**Rationale**:
- **Naive approach**: Re-aggregate on every query (O(n) for 10K transactions = ~50-100ms) - ACCEPTABLE but not optimal
- **Optimized approach**: Cache common aggregations (company totals, item counts) after data load, update incrementally on filter changes
- **Trade-off**: Memory overhead (~100KB for aggregation cache) vs CPU savings (10x faster for repeated queries)

**Implementation Approach**:
```typescript
// aggregation-engine.ts
export interface AggregationCache {
  byCompany: Map<string, { count: number; totalValue: number }>;
  byGoodsName: Map<string, { count: number; totalValue: number }>;
  byCategory: Map<string, { count: number; totalValue: number }>;
  byMonth: Map<string, { count: number; totalValue: number }>;
  totalValue: number;
  totalCount: number;
  lastUpdated: number;
}

export function buildAggregationCache(transactions: Transaction[]): AggregationCache {
  const cache: AggregationCache = {
    byCompany: new Map(),
    byGoodsName: new Map(),
    byCategory: new Map(),
    byMonth: new Map(),
    totalValue: 0,
    totalCount: transactions.length,
    lastUpdated: Date.now(),
  };
  
  for (const txn of transactions) {
    // Group by company
    const companyStats = cache.byCompany.get(txn.companyName) || { count: 0, totalValue: 0 };
    companyStats.count++;
    companyStats.totalValue += txn.totalValueUSD;
    cache.byCompany.set(txn.companyName, companyStats);
    
    // Group by goods name
    const goodsStats = cache.byGoodsName.get(txn.goodsName) || { count: 0, totalValue: 0 };
    goodsStats.count++;
    goodsStats.totalValue += txn.totalValueUSD;
    cache.byGoodsName.set(txn.goodsName, goodsStats);
    
    // Similar for category, month...
    cache.totalValue += txn.totalValueUSD;
  }
  
  return cache;
}

export function filterCache(cache: AggregationCache, filteredTransactions: Transaction[]): AggregationCache {
  // Rebuild cache from filtered subset (still fast - O(n) where n is filtered count)
  return buildAggregationCache(filteredTransactions);
}

export function getTopN<K>(map: Map<K, { count: number; totalValue: number }>, n: number, sortBy: 'count' | 'totalValue'): Array<[K, number]> {
  const entries = Array.from(map.entries());
  entries.sort((a, b) => b[1][sortBy] - a[1][sortBy]);
  return entries.slice(0, n).map(([key, stats]) => [key, stats[sortBy]]);
}
```

**Performance Analysis**:
- Initial cache build: O(n) = ~20ms for 10K transactions (one-time cost)
- Filtered re-aggregation: O(m) where m = filtered count (~5ms for 500 US transactions)
- Top-N retrieval: O(k log k) where k = unique keys (~1ms for 100 companies)
- Total: <30ms end-to-end (meets <100ms requirement with 70ms margin)

**Alternatives Considered**:
- Materialized views in MongoDB: REJECTED (data already in memory, adds database dependency)
- Web Workers for parallel aggregation: REJECTED (message passing overhead > computation time for <10K records)
- SQL-style query planner: REJECTED (over-engineered for in-memory JavaScript arrays)

**Success Metrics**: SC-002 (<100ms aggregations), SC-006 (80% token reduction)

---

## 4. Filter Expression Parsing

### Decision: TypeScript Zod Schema Validation (No Custom Parser)

**Problem**: Need to validate AI-generated filter expressions before execution to prevent invalid queries.

**Rationale**:
- **No custom DSL parser needed**: AI generates structured JSON objects (FilterExpression interface), not string DSL
- **Zod validation**: Runtime type checking + input sanitization for filter expressions
- **Type safety**: Compile-time TypeScript interfaces + runtime Zod schemas ensure correctness

**Implementation Approach**:
```typescript
// validation.ts (extend existing file)
import { z } from 'zod';

export const FilterOperatorSchema = z.enum([
  'equals',
  'contains',
  'startsWith',
  'greaterThan',
  'lessThan',
  'between',
  'in',
]);

export const MatchStrategySchema = z.enum([
  'exact',
  'fuzzy',
  'case-insensitive',
  'normalized',
]);

export const FilterExpressionSchema = z.object({
  field: z.string(),
  operator: FilterOperatorSchema,
  value: z.union([z.string(), z.number(), z.array(z.string())]),
  matchStrategy: MatchStrategySchema.optional(),
  fuzzyThreshold: z.number().min(0).max(5).optional(),
});

export const QueryIntentSchema = z.object({
  type: z.enum(['aggregation', 'detail', 'trend', 'comparison', 'recommendation', 'ranking']),
  filters: z.array(FilterExpressionSchema),
  aggregations: z.array(z.object({
    field: z.string(),
    operation: z.enum(['count', 'sum', 'average', 'min', 'max']),
    groupBy: z.string().optional(),
  })).optional(),
  limit: z.number().optional(),
  orderBy: z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']),
  }).optional(),
});

export type FilterExpression = z.infer<typeof FilterExpressionSchema>;
export type QueryIntent = z.infer<typeof QueryIntentSchema>;
```

**Why Not Custom Parser**:
- AI already generates structured JSON (OpenAI/Ollama function calling or JSON mode)
- String parsing (e.g., "FILTER country=US AND category=Electronics") adds complexity
- Zod provides better error messages than hand-written parser
- Type inference from Zod schemas eliminates duplicate TypeScript interfaces

**Alternatives Considered**:
- PEG parser (peggy): REJECTED (overkill for simple filter expressions)
- SQL parser (node-sql-parser): REJECTED (wrong abstraction - filters are not SQL)
- String template literals: REJECTED (no validation, vulnerable to injection)

**Success Metrics**: FR-012 (metadata validation), User Story 7 scenario 5 (invalid syntax handling)

---

## 5. Testing Framework Recommendation

### Decision: Jest + React Testing Library

**Problem**: No test framework currently configured. Need unit tests for filter engine, aggregations, text normalization.

**Rationale**:
- **Jest**: Industry standard for TypeScript/React, fast, built-in mocking, snapshot testing
- **React Testing Library**: Component testing with user-centric queries (aligns with UX focus in constitution)
- **@testing-library/jest-dom**: Custom matchers for DOM assertions

**Installation**:
```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest @types/jest
```

**Configuration** (`jest.config.js`):
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/pages/_app.tsx',
    '!src/pages/_document.tsx',
  ],
  coverageThresholds: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
  },
};
```

**Test Structure**:
```
tests/
├── unit/
│   ├── filter-engine.test.ts        # Filter matching, edge cases
│   ├── aggregation-engine.test.ts   # Group-by, sum, count, top-N
│   ├── text-normalizer.test.ts      # Vietnamese, fuzzy, case-insensitive
│   └── query-intent.test.ts         # Intent classification accuracy
├── integration/
│   ├── query-handler.test.ts        # End-to-end filter + aggregation
│   └── session-manager.test.ts      # Multi-session CRUD
├── components/
│   ├── SessionManager.test.tsx      # UI interactions (create/switch/delete)
│   └── SessionDetails.test.tsx      # Modal rendering, metadata display
└── fixtures/
    └── sample-transactions.json      # Test data with Vietnamese variations
```

**Alternatives Considered**:
- Vitest: REJECTED (newer, less ecosystem support, no compelling advantage over Jest)
- Mocha + Chai: REJECTED (more setup, less batteries-included than Jest)
- No tests: REJECTED (violates constitution's quality standards, complex logic needs tests)

**Success Metrics**: 80% code coverage for filter-engine, aggregation-engine, text-normalizer modules

---

## 6. Vietnamese Text Handling Libraries

### Decision: Custom Implementation + remove-accents

**Problem**: Need to handle Vietnamese diacritics (á, ă, â, đ, etc.) for optional accent-insensitive matching.

**Rationale**:
- **remove-accents** library (5KB): Handles most cases - "điện" → "dien", "Hà Nội" → "Ha Noi"
- **Custom mappings** for Vietnamese-specific characters: đ → d, Đ → D (not covered by remove-accents)
- **Trade-off**: 5KB library + 50 lines custom code vs 500+ line full implementation

**Implementation**:
```typescript
import removeAccents from 'remove-accents';

const vietnameseCharMap: Record<string, string> = {
  'đ': 'd',
  'Đ': 'D',
  // Additional mappings if needed
};

export function removeDiacritics(text: string): string {
  let result = removeAccents(text);
  
  // Handle Vietnamese-specific characters
  for (const [accented, plain] of Object.entries(vietnameseCharMap)) {
    result = result.replace(new RegExp(accented, 'g'), plain);
  }
  
  return result;
}
```

**Alternatives Considered**:
- Full Vietnamese normalization library (vn-text-normalize): REJECTED (30KB, too heavy)
- Unicode NFD decomposition: REJECTED (doesn't handle all Vietnamese characters correctly)
- Regex-only approach: REJECTED (hard to maintain, incomplete coverage)

**Success Metrics**: Handle all Vietnamese diacritics in sample data (á, à, ả, ã, ạ, ă, ắ, ằ, ẳ, ẵ, ặ, â, ấ, ầ, ẩ, ẫ, ậ, đ, é, è, ẻ, ẽ, ẹ, ê, ế, ề, ể, ễ, ệ, í, ì, ỉ, ĩ, ị, ó, ò, ỏ, õ, ọ, ô, ố, ồ, ổ, ỗ, ộ, ơ, ớ, ờ, ở, ỡ, ợ, ú, ù, ủ, ũ, ụ, ư, ứ, ừ, ử, ữ, ự, ý, ỳ, ỷ, ỹ, ỵ)

---

## 7. Synonym Matching Configuration

### Decision: JSON Configuration File

**Problem**: Need configurable country/company name synonyms without hardcoding in source.

**Rationale**:
- **JSON config file**: Easy to edit without code changes, supports versioning, can be updated by non-developers
- **Location**: `src/lib/ai/synonyms.json`
- **Structure**: Canonical form → synonym list

**Implementation**:
```json
// src/lib/ai/synonyms.json
{
  "countries": {
    "United States": ["US", "USA", "United States", "Hoa Kỳ", "America"],
    "Vietnam": ["VN", "Vietnam", "Việt Nam", "Viet Nam"],
    "China": ["CN", "China", "Trung Quốc", "PRC"],
    "Japan": ["JP", "Japan", "Nhật Bản", "Nhat Ban"]
  },
  "companies": {
    "CÔNG TY": ["CÔNG TY", "Cty", "CTY", "Co.", "Company"]
  }
}
```

```typescript
// text-normalizer.ts
import synonymsConfig from './synonyms.json';

export function checkSynonyms(dataValue: string, filterValue: string, synonyms?: Record<string, string[]>): boolean {
  const synonymMap = synonyms || loadDefaultSynonyms();
  
  for (const [canonical, variants] of Object.entries(synonymMap)) {
    if (variants.includes(dataValue) && variants.includes(filterValue)) {
      return true;
    }
  }
  
  return false;
}

function loadDefaultSynonyms(): Record<string, string[]> {
  return {
    ...synonymsConfig.countries,
    ...synonymsConfig.companies,
  };
}
```

**Alternatives Considered**:
- Hardcoded in TypeScript: REJECTED (requires code changes for new synonyms)
- Database table: REJECTED (adds query latency, overkill for static config)
- Environment variables: REJECTED (poor for structured data, no easy editing)

**Success Metrics**: FR-004 (synonym matching for US/USA/United States/Hoa Kỳ), SC-015 (>95% recall on variations)

---

## Summary of Research Decisions

| Area | Decision | Key Technology | Rationale |
|------|----------|----------------|-----------|
| Text Normalization | Multi-strategy pipeline | fast-levenshtein, remove-accents | Handles case, whitespace, diacritics, typos, synonyms |
| Session Persistence | Hybrid localStorage + server memory | Native localStorage API | Metadata survives refresh, full data in fast memory |
| Aggregation | Precomputed cache with O(n) rebuild | Native Map/Array | Sub-100ms performance on 10K transactions |
| Filter Parsing | Zod schema validation | Zod 3.22 | Type-safe, runtime validation, no custom parser needed |
| Testing | Jest + React Testing Library | Jest, @testing-library/react | Industry standard, 80% coverage target |
| Vietnamese Text | Custom + remove-accents | remove-accents (5KB) | Handles diacritics with minimal overhead |
| Synonym Config | JSON file | Native JSON import | Easy editing, no code changes needed |

All "NEEDS CLARIFICATION" items from Technical Context are now resolved. Proceeding to Phase 1 design.
