# Quickstart Guide: Multi-Stage Adaptive Query System

**Feature**: 002-multi-stage-adaptive-query  
**Purpose**: Developer guide for implementing intelligent in-memory filtering and session management  
**Audience**: Frontend and backend developers working on AI analysis features

## Overview

This feature adds:
1. **Smart in-memory filtering** - Filter loaded transactions with case-insensitive, contains matching, Vietnamese normalization, fuzzy matching
2. **In-memory aggregations** - Compute count/sum/average/top-N without database queries for 80% token reduction
3. **Multi-session management** - Create, switch, view, delete AI analysis sessions with UI controls
4. **Query intent classification** - Route questions to optimal data processing (aggregations vs details)

## Prerequisites

- Node.js 18+ with npm
- TypeScript 5+ familiarity
- Next.js 16+ Pages Router knowledge
- MongoDB running locally or remote
- Ollama installed (for AI integration testing)

## Installation

### 1. Install New Dependencies

```bash
npm install --save fast-levenshtein remove-accents
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest @types/jest
```

### 2. Configure Jest (if not already configured)

Create `jest.config.js`:
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

Create `jest.setup.js`:
```javascript
import '@testing-library/jest-dom';
```

Add test script to `package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### 3. Create Synonym Configuration

Create `src/lib/ai/synonyms.json`:
```json
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

## Project Structure

```
src/
├── lib/
│   ├── ai/
│   │   ├── session-manager.ts          # MODIFY: Add multi-session support
│   │   ├── query-handler.ts            # MODIFY: Add filter extraction
│   │   ├── filter-engine.ts            # NEW: Filter execution
│   │   ├── aggregation-engine.ts       # NEW: In-memory aggregations
│   │   ├── text-normalizer.ts          # NEW: Smart text matching
│   │   └── synonyms.json               # NEW: Country/company synonyms
│   ├── db/models/
│   │   └── AISession.ts                # MODIFY: Add metadata fields
│   └── utils/
│       └── validation.ts               # MODIFY: Add Zod schemas
├── components/ai/
│   ├── SessionManager.tsx              # NEW: Session UI controls
│   ├── SessionDetails.tsx              # NEW: Session data modal
│   └── FilterMetadata.tsx              # NEW: Filter results display
├── pages/
│   ├── ai-analysis.tsx                 # MODIFY: Multi-session integration
│   └── api/ai/
│       ├── sessions.ts                 # NEW: Session CRUD endpoints
│       ├── filter.ts                   # NEW: Filter API
│       ├── aggregate.ts                # NEW: Aggregation API
│       ├── feed-data.ts                # MODIFY: Session-specific loading
│       └── chat.ts                     # MODIFY: Add filtering/aggregation
└── tests/
    ├── unit/
    │   ├── filter-engine.test.ts
    │   ├── aggregation-engine.test.ts
    │   └── text-normalizer.test.ts
    └── integration/
        ├── query-handler.test.ts
        └── session-manager.test.ts
```

## Implementation Steps

### Step 1: Text Normalization (Core Utility)

**File**: `src/lib/ai/text-normalizer.ts`

```typescript
import removeAccents from 'remove-accents';
import { levenshtein } from 'fast-levenshtein';
import synonymsConfig from './synonyms.json';

export interface NormalizationOptions {
  caseSensitive?: boolean;
  trimWhitespace?: boolean;
  matchStrategy?: 'exact' | 'contains' | 'startsWith' | 'fuzzy';
  removeDiacritics?: boolean;
  synonyms?: Record<string, string[]>;
  fuzzyThreshold?: number;
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

const vietnameseCharMap: Record<string, string> = {
  'đ': 'd',
  'Đ': 'D',
};

export function removeDiacritics(text: string): string {
  let result = removeAccents(text);
  
  for (const [accented, plain] of Object.entries(vietnameseCharMap)) {
    result = result.replace(new RegExp(accented, 'g'), plain);
  }
  
  return result;
}

export function checkSynonyms(
  value1: string,
  value2: string,
  synonyms?: Record<string, string[]>
): boolean {
  const synonymMap = synonyms || { ...synonymsConfig.countries, ...synonymsConfig.companies };
  
  for (const variants of Object.values(synonymMap)) {
    if (variants.includes(value1) && variants.includes(value2)) {
      return true;
    }
  }
  
  return false;
}

export function matchesFilter(
  dataValue: string,
  filterValue: string,
  options: NormalizationOptions
): boolean {
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
      return levenshtein(normalizedData, normalizedFilter) <= (options.fuzzyThreshold || 2);
    default:
      return normalizedData.includes(normalizedFilter);
  }
}
```

**Test**: `tests/unit/text-normalizer.test.ts`

```typescript
import { normalizeText, matchesFilter, removeDiacritics, checkSynonyms } from '@/lib/ai/text-normalizer';

describe('text-normalizer', () => {
  test('normalizes case', () => {
    expect(normalizeText('ABC Company', { caseSensitive: false })).toBe('abc company');
  });
  
  test('trims whitespace', () => {
    expect(normalizeText('  ABC  Company  ', { trimWhitespace: true })).toBe('ABC Company');
  });
  
  test('removes Vietnamese diacritics', () => {
    expect(removeDiacritics('điện tử')).toBe('dien tu');
    expect(removeDiacritics('Hà Nội')).toBe('Ha Noi');
  });
  
  test('matches with contains strategy', () => {
    expect(matchesFilter('CÔNG TY ABC', 'ABC', { matchStrategy: 'contains', caseSensitive: false })).toBe(true);
  });
  
  test('matches synonyms', () => {
    const synonyms = { 'United States': ['US', 'USA', 'United States'] };
    expect(checkSynonyms('US', 'United States', synonyms)).toBe(true);
  });
});
```

### Step 2: Filter Engine

**File**: `src/lib/ai/filter-engine.ts`

```typescript
import type { Transaction } from '@/lib/db/models/Transaction';
import { matchesFilter, type NormalizationOptions } from './text-normalizer';

export interface FilterExpression {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'greaterThan' | 'lessThan' | 'between' | 'in';
  value: string | number | string[];
  matchStrategy?: 'exact' | 'fuzzy' | 'case-insensitive' | 'normalized';
  fuzzyThreshold?: number;
  logicalOperator?: 'AND' | 'OR';
}

export interface FilterOptions {
  removeDiacritics?: boolean;
  synonyms?: Record<string, string[]>;
  logExecution?: boolean;
}

export function executeFilters(
  transactions: Transaction[],
  filters: FilterExpression[],
  options?: FilterOptions
): Transaction[] {
  let result = transactions;
  
  for (const filter of filters) {
    result = applyFilter(result, filter, options);
  }
  
  return result;
}

export function applyFilter(
  transactions: Transaction[],
  filter: FilterExpression,
  options?: FilterOptions
): Transaction[] {
  return transactions.filter(txn => matchesFilterExpression(txn, filter, options));
}

function matchesFilterExpression(
  transaction: Transaction,
  filter: FilterExpression,
  options?: FilterOptions
): boolean {
  const fieldValue = transaction[filter.field];
  
  // Handle different operators
  switch (filter.operator) {
    case 'equals':
      return fieldValue === filter.value;
    case 'contains':
    case 'startsWith':
      if (typeof fieldValue !== 'string' || typeof filter.value !== 'string') {
        return false;
      }
      const normOptions: NormalizationOptions = {
        caseSensitive: filter.matchStrategy === 'exact',
        trimWhitespace: true,
        matchStrategy: filter.operator,
        removeDiacritics: options?.removeDiacritics,
        synonyms: options?.synonyms,
        fuzzyThreshold: filter.fuzzyThreshold,
      };
      return matchesFilter(fieldValue, filter.value, normOptions);
    case 'greaterThan':
      return Number(fieldValue) > Number(filter.value);
    case 'lessThan':
      return Number(fieldValue) < Number(filter.value);
    case 'between':
      const [min, max] = filter.value as [number, number];
      return Number(fieldValue) >= min && Number(fieldValue) <= max;
    case 'in':
      return (filter.value as unknown[]).includes(fieldValue);
    default:
      return false;
  }
}
```

### Step 3: Aggregation Engine

**File**: `src/lib/ai/aggregation-engine.ts`

See `contracts/aggregation-engine.ts` for full API. Key function:

```typescript
export function computeAggregation(
  transactions: Transaction[],
  spec: AggregationSpec
): AggregationResult {
  const startTime = Date.now();
  
  if (spec.groupBy) {
    const grouped = groupBy(transactions, spec.groupBy, spec.field, spec.operation);
    return {
      type: 'groupBy',
      field: spec.field,
      groupByField: spec.groupBy,
      data: Array.from(grouped.values()),
      totalCount: transactions.length,
      computedAt: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime,
    };
  } else {
    return computeTotal(transactions, spec.field, spec.operation);
  }
}

function groupBy(
  transactions: Transaction[],
  groupByField: string,
  aggregateField: string,
  operation: 'count' | 'sum' | 'average' | 'min' | 'max'
): Map<string, AggregationDataPoint> {
  const groups = new Map<string, AggregationDataPoint>();
  
  for (const txn of transactions) {
    const key = String(txn[groupByField]);
    const existing = groups.get(key) || { key, count: 0 };
    
    existing.count++;
    
    if (operation === 'sum' || operation === 'average') {
      existing.sum = (existing.sum || 0) + Number(txn[aggregateField]);
    }
    // ... handle min, max
    
    groups.set(key, existing);
  }
  
  // Compute averages
  if (operation === 'average') {
    for (const dataPoint of groups.values()) {
      if (dataPoint.sum !== undefined) {
        dataPoint.average = dataPoint.sum / dataPoint.count;
      }
    }
  }
  
  return groups;
}
```

### Step 4: Session Manager Enhancements

**File**: `src/lib/ai/session-manager.ts` (MODIFY existing)

Add multi-session support:

```typescript
// Add to existing session-manager.ts

export interface SessionMetadata {
  sessionId: string;
  createdAt: string;
  lastActivityAt: string;
  transactionCount: number;
  dataSourceInfo: {
    dateRange?: { from: string; to: string };
    topCompanies?: string[];
    topCategories?: string[];
    totalValue?: number;
  };
}

// In-memory session storage (server-side)
const sessions = new Map<string, ContextState>();

export function createSession(): SessionMetadata {
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const metadata: SessionMetadata = {
    sessionId,
    createdAt: now,
    lastActivityAt: now,
    transactionCount: 0,
    dataSourceInfo: {},
  };
  
  sessions.set(sessionId, {
    sessionId,
    loadedTransactions: [],
    currentFilterView: [],
    conversationHistory: [],
    appliedFilters: [],
    status: 'empty',
  });
  
  return metadata;
}

export function getActiveSessions(): SessionMetadata[] {
  // Return metadata for all sessions
  return Array.from(sessions.values()).map(ctx => ({
    sessionId: ctx.sessionId,
    createdAt: ctx.createdAt || new Date().toISOString(),
    lastActivityAt: ctx.lastActivityAt || new Date().toISOString(),
    transactionCount: ctx.loadedTransactions.length,
    dataSourceInfo: ctx.dataSourceInfo || {},
  }));
}

export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}
```

### Step 5: Session UI Components

**File**: `src/components/ai/SessionManager.tsx` (NEW)

```typescript
import { useState, useEffect } from 'react';
import { Box, Button, Select, MenuItem, IconButton, Dialog } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';

interface SessionMetadata {
  sessionId: string;
  createdAt: string;
  lastActivityAt: string;
  transactionCount: number;
}

export function SessionManager() {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  useEffect(() => {
    loadSessions();
  }, []);
  
  async function loadSessions() {
    const res = await fetch('/api/ai/sessions');
    const data = await res.json();
    setSessions(data.sessions);
    setActiveSessionId(data.activeSessionId);
  }
  
  async function createNewSession() {
    const res = await fetch('/api/ai/sessions', { method: 'POST' });
    const data = await res.json();
    setSessions([...sessions, data.session]);
    setActiveSessionId(data.session.sessionId);
  }
  
  async function deleteCurrentSession() {
    if (!activeSessionId) return;
    
    const confirmed = window.confirm('Delete this session? This cannot be undone.');
    if (!confirmed) return;
    
    await fetch(`/api/ai/sessions/${activeSessionId}`, { method: 'DELETE' });
    loadSessions();
  }
  
  return (
    <Box display="flex" gap={2} alignItems="center">
      <Select
        value={activeSessionId || ''}
        onChange={(e) => setActiveSessionId(e.target.value)}
        displayEmpty
        size="small"
      >
        {sessions.map(s => (
          <MenuItem key={s.sessionId} value={s.sessionId}>
            Session {s.transactionCount} txns - {new Date(s.lastActivityAt).toLocaleDateString()}
          </MenuItem>
        ))}
      </Select>
      
      <Button startIcon={<AddIcon />} onClick={createNewSession} size="small">
        New Session
      </Button>
      
      <IconButton onClick={() => setShowDetails(true)} size="small">
        <InfoIcon />
      </IconButton>
      
      <IconButton onClick={deleteCurrentSession} size="small" color="error">
        <DeleteIcon />
      </IconButton>
    </Box>
  );
}
```

### Step 6: API Routes

**File**: `src/pages/api/ai/sessions.ts` (NEW)

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { createSession, getActiveSessions, deleteSession } from '@/lib/ai/session-manager';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const sessions = getActiveSessions();
    return res.status(200).json({ success: true, sessions });
  }
  
  if (req.method === 'POST') {
    const session = createSession();
    return res.status(201).json({ success: true, session });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
```

**File**: `src/pages/api/ai/sessions/[sessionId].ts` (NEW)

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, deleteSession } from '@/lib/ai/session-manager';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { sessionId } = req.query;
  
  if (req.method === 'GET') {
    const session = getSession(sessionId as string);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.status(200).json({ success: true, session });
  }
  
  if (req.method === 'DELETE') {
    const deleted = deleteSession(sessionId as string);
    if (!deleted) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.status(200).json({ success: true, deletedSessionId: sessionId });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
```

## Testing

### Run Unit Tests

```bash
npm test
```

### Run with Coverage

```bash
npm run test:coverage
```

### Test Checklist

- [ ] Text normalization handles Vietnamese diacritics
- [ ] Filter engine supports case-insensitive matching
- [ ] Filter engine supports contains matching
- [ ] Filter engine supports fuzzy matching (typos)
- [ ] Synonym matching works for countries (US/USA/United States)
- [ ] Aggregation engine computes correct group-by results
- [ ] Aggregation engine handles 10,000+ transactions in <100ms
- [ ] Session create/delete works without errors
- [ ] Session list persists across page refresh
- [ ] Multiple sessions maintain independent state

## Performance Validation

Use these benchmarks to validate implementation:

```typescript
// tests/integration/performance.test.ts
import { executeFilters } from '@/lib/ai/filter-engine';
import { computeAggregation } from '@/lib/ai/aggregation-engine';

test('filter 10,000 transactions in <100ms', () => {
  const transactions = generateMockTransactions(10000);
  const filter = { field: 'importCountry', operator: 'contains', value: 'US' };
  
  const start = Date.now();
  const result = executeFilters(transactions, [filter]);
  const elapsed = Date.now() - start;
  
  expect(elapsed).toBeLessThan(100);
  expect(result.length).toBeGreaterThan(0);
});

test('aggregate 10,000 transactions in <100ms', () => {
  const transactions = generateMockTransactions(10000);
  const spec = {
    field: 'totalValueUSD',
    operation: 'sum',
    groupBy: 'companyName'
  };
  
  const start = Date.now();
  const result = computeAggregation(transactions, spec);
  const elapsed = Date.now() - start;
  
  expect(elapsed).toBeLessThan(100);
  expect(result.data.length).toBeGreaterThan(0);
});
```

## Troubleshooting

### Filters Not Matching Vietnamese Text

Ensure `removeDiacritics` option is enabled:
```typescript
const options = { removeDiacritics: true };
```

### Fuzzy Matching Too Loose

Lower the fuzzy threshold:
```typescript
const filter = { fuzzyThreshold: 1 }; // Only 1 character difference allowed
```

### Aggregations Slow

Check if aggregation cache is being used:
```typescript
// Build cache once after data load
const cache = buildAggregationCache(transactions);
// Query cache for fast results
const topCompanies = queryCacheTopN(cache, 'company', 10, 'totalValue');
```

## Next Steps

1. **Implement Zod validation schemas** for all request types
2. **Add filter expression parser** for AI-generated filter strings
3. **Create SessionDetails.tsx modal** for viewing session data
4. **Integrate with AI chat flow** in `pages/api/ai/chat.ts`
5. **Add filter metadata display** in UI after each query

## References

- [spec.md](./spec.md) - Full feature specification
- [data-model.md](./data-model.md) - Entity definitions
- [contracts/](./contracts/) - API contracts
- [research.md](./research.md) - Technical research and decisions
