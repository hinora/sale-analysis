# Research & Technology Decisions: Export Goods Analysis Application

**Phase**: Phase 0 - Research and Decision Log  
**Created**: 2025-11-20  
**Status**: Complete

## Purpose

This document resolves all technical unknowns from the Technical Context and establishes best practices for the implementation. Each decision is documented with rationale, alternatives considered, and references to constitution principles.

---

## 1. CSV Processing with Streaming

### Decision
Use **papaparse** library with streaming mode to process large CSV files in chunks without loading the entire file into memory.

### Rationale
- Constitution Principle III requires handling files >10MB efficiently with streaming
- papaparse supports Node.js streams and can process row-by-row
- Handles semicolon delimiters (Vietnamese customs format) out of the box
- Built-in support for UTF-8 and special Vietnamese characters
- Wide adoption in Next.js ecosystem with TypeScript support

### Implementation Approach
```typescript
// Pseudo-code pattern
import Papa from 'papaparse';
import { Readable } from 'stream';

// Process CSV in 1000-row chunks
const chunkSize = 1000;
let batch = [];

Papa.parse(fileStream, {
  delimiter: ';',
  header: true,
  encoding: 'UTF-8',
  step: (row) => {
    batch.push(row.data);
    if (batch.length >= chunkSize) {
      await processBatch(batch);
      batch = [];
    }
  },
  complete: () => {
    if (batch.length > 0) {
      await processBatch(batch);
    }
  }
});
```

### Alternatives Considered
- **csv-parser**: Less flexible with custom delimiters, no built-in chunking
- **fast-csv**: Good performance but requires more manual stream handling
- **Native Node.js streams**: Too low-level, requires significant boilerplate

### Constitution Alignment
- ✅ Principle III: Performance & Scalability - streaming prevents memory overflow
- ✅ Principle I: Data Integrity - row-by-row validation maintains data quality

---

## 2. Duplicate Detection Strategy

### Decision
Implement **two-phase duplicate detection** using in-memory Set for within-file duplicates and MongoDB unique index for cross-database duplicates.

### Rationale
- Constitution Principle I requires duplicate detection at two levels
- In-memory Set provides O(1) lookup for same-file duplicates during streaming
- MongoDB unique index on `declarationNumber` field prevents database-level duplicates
- Handles concurrent uploads safely (database constraint prevents race conditions)

### Implementation Approach
```typescript
// Phase 1: Within-file detection
const seenDeclarations = new Set<string>();
const duplicatesInFile: string[] = [];

for (const row of csvRows) {
  if (seenDeclarations.has(row.declarationNumber)) {
    duplicatesInFile.push(row.declarationNumber);
    continue; // Skip duplicate
  }
  seenDeclarations.add(row.declarationNumber);
  validRows.push(row);
}

// Phase 2: Database-level detection via unique index
// Mongoose schema:
{
  declarationNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  }
}

// Insert with duplicate error handling
try {
  await Transaction.insertMany(validRows, { ordered: false });
} catch (error) {
  if (error.code === 11000) {
    // Extract duplicate keys from error
    duplicatesInDatabase = extractDuplicateKeys(error);
  }
}
```

### Alternatives Considered
- **Hash-based detection**: More complex, no significant performance benefit for expected data volume
- **Pre-query all existing declaration numbers**: Inefficient for large databases, doesn't handle concurrency
- **Application-level locking**: Over-engineered, database constraints are more reliable

### Constitution Alignment
- ✅ Principle I: Data Integrity - zero false positives/negatives (SC-002)
- ✅ Principle III: Performance - O(1) in-memory lookups, indexed database queries

---

## 3. AI Classification with Ollama

### Decision
Use **Ollama REST API** with **llama3.1** or **mistral** models for goods classification and name shortening, with local caching of classifications.

### Rationale
- Constitution Principle V requires configurable AI models with Ollama
- llama3.1 (8B parameters) provides good balance of speed and accuracy for classification tasks
- Mistral offers faster responses for simpler name shortening tasks
- Local Ollama instance avoids external API costs and data privacy concerns
- Caching prevents re-classification of known goods (consistency requirement)

### Implementation Approach
```typescript
// Classification prompt structure
const classificationPrompt = `
You are a Vietnamese customs goods classifier.
Classify this good into ONE of these categories: [Frozen Seafood, Agricultural Products, Manufactured Goods, Textiles, Electronics, Other].

Goods name: ${rawGoodsName}
HS Code: ${hsCode}

Respond with ONLY the category name, no explanation.
`;

// Name shortening prompt
const shorteningPrompt = `
Shorten this Vietnamese goods name to maximum 100 characters while preserving key information.

Raw name: ${rawGoodsName}

Respond with ONLY the shortened name, no explanation.
`;

// Client configuration
const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434'
});

// Check cache first (Goods table)
const existingGoods = await Goods.findOne({ rawName: rawGoodsName });
if (existingGoods) {
  return { category: existingGoods.category, shortName: existingGoods.shortName };
}

// Call Ollama for new goods
const response = await ollama.generate({
  model: 'llama3.1',
  prompt: classificationPrompt,
  stream: false
});
```

### Alternatives Considered
- **OpenAI GPT-4**: Expensive, requires external API, data privacy concerns
- **Google Gemini**: Similar issues to OpenAI, plus less control over deployment
- **Rule-based classification**: Inflexible, requires constant manual updates for new goods types
- **Pre-trained Vietnamese NLP models**: Limited domain knowledge for customs/trade goods

### Constitution Alignment
- ✅ Principle I: AI consistency - cache ensures same goods → same category (SC-003)
- ✅ Principle V: AI Integration - configurable models, local control
- ✅ Principle III: Performance - batch classification with progress feedback

---

## 4. MongoDB Schema Design with Mongoose

### Decision
Use **Mongoose ODM** with strict schemas, virtuals for computed fields, and compound indexes for common query patterns.

### Rationale
- Constitution Principle II requires schema validation and type safety
- Mongoose provides runtime validation aligned with TypeScript compile-time types
- Virtuals enable calculated fields (aggregates) without data duplication
- Compound indexes optimize multi-field filter queries
- Decimal128 type preserves currency precision (no floating-point errors)

### Schema Highlights
```typescript
// Transaction schema (primary entity)
const TransactionSchema = new Schema({
  declarationNumber: { type: String, required: true, unique: true, index: true },
  date: { type: Date, required: true, index: true }, // Parsed from Năm/Tháng/Ngày
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  goods: { type: Schema.Types.ObjectId, ref: 'Goods', required: true, index: true },
  hsCode: { type: String, required: true, index: true },
  quantity: { type: Schema.Types.Decimal128, required: true },
  unit: { type: String, required: true },
  unitPriceUSD: { type: Schema.Types.Decimal128, required: true },
  totalValueUSD: { type: Schema.Types.Decimal128, required: true },
  rawData: { type: Object, required: true } // Preserve entire CSV row
});

// Compound indexes for common queries
TransactionSchema.index({ company: 1, date: -1 });
TransactionSchema.index({ goods: 1, date: -1 });
TransactionSchema.index({ date: -1, totalValueUSD: -1 });

// Company schema with virtuals
const CompanySchema = new Schema({
  name: { type: String, required: true, index: 'text' },
  address: { type: String, required: true }
});

// Virtual for aggregated stats (computed on-the-fly)
CompanySchema.virtual('totalImportValue').get(async function() {
  const result = await Transaction.aggregate([
    { $match: { company: this._id } },
    { $group: { _id: null, total: { $sum: '$totalValueUSD' } } }
  ]);
  return result[0]?.total || 0;
});
```

### Alternatives Considered
- **Prisma ORM**: Less flexible with MongoDB, better suited for SQL databases
- **TypeORM**: Similar issues, SQL-first design
- **Raw MongoDB driver**: Too much boilerplate, no schema validation out of the box
- **Embedded documents vs references**: References chosen for normalization and query flexibility

### Constitution Alignment
- ✅ Principle II: Type Safety - schema validation + TypeScript types
- ✅ Principle I: Data Integrity - rawData field preserves original CSV
- ✅ Principle III: Performance - strategic indexes for filter queries <2s (SC-004)

---

## 5. Frontend Table Virtualization

### Decision
Use **react-window** for virtualized table rendering when datasets exceed 100 rows.

### Rationale
- Constitution Principle III requires virtualization for large datasets
- react-window is lightweight (6KB gzipped) compared to alternatives
- Integrates well with Material-UI Table components
- Renders only visible rows (constant performance regardless of dataset size)
- Maintains smooth scrolling even with 100K+ rows

### Implementation Approach
```typescript
import { FixedSizeList } from 'react-window';
import { TableRow, TableCell } from '@mui/material';

// Render only visible rows
<FixedSizeList
  height={600}
  itemCount={transactions.length}
  itemSize={52} // Row height in pixels
  width="100%"
>
  {({ index, style }) => (
    <TableRow style={style}>
      <TableCell>{transactions[index].date}</TableCell>
      <TableCell>{transactions[index].company.name}</TableCell>
      {/* ... other cells */}
    </TableRow>
  )}
</FixedSizeList>
```

### Alternatives Considered
- **react-virtualized**: Heavier (28KB), more complex API, same core functionality
- **tanstack-virtual**: Good alternative but less MUI integration examples
- **Pagination only**: Doesn't meet constitution requirement for virtualization
- **AG Grid / MUI DataGrid Pro**: Overkill for this use case, commercial licensing issues

### Constitution Alignment
- ✅ Principle III: Performance - virtualization for >100 rows
- ✅ Principle IV: User Experience - smooth scrolling, no lag

---

## 6. API Validation with Zod

### Decision
Use **Zod** for runtime validation of API request/response payloads, complementing TypeScript compile-time types.

### Rationale
- Constitution Principle II requires runtime validation beyond TypeScript
- Zod schemas can be inferred to TypeScript types (single source of truth)
- Better error messages than manual validation
- Integrates with Next.js API routes via middleware
- Handles complex validation rules (e.g., date ranges, numeric constraints)

### Implementation Approach
```typescript
import { z } from 'zod';

// Define schema
const TransactionQuerySchema = z.object({
  company: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  category: z.string().optional(),
  sortBy: z.enum(['price', 'quantity', 'totalValue', 'date']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(10).max(100).default(50)
});

// Infer TypeScript type
type TransactionQuery = z.infer<typeof TransactionQuerySchema>;

// Validate in API route
export default async function handler(req, res) {
  try {
    const query = TransactionQuerySchema.parse(req.query);
    // Process validated query...
  } catch (error) {
    return res.status(400).json({ errors: error.errors });
  }
}
```

### Alternatives Considered
- **Joi**: Older library, larger bundle size, less TypeScript integration
- **Yup**: Good for forms but less suited for API validation
- **class-validator**: Requires decorators, more boilerplate
- **Manual validation**: Error-prone, no type inference

### Constitution Alignment
- ✅ Principle II: Type Safety - runtime validation catches invalid inputs
- ✅ Principle IV: User Experience - clear error messages

---

## 7. MUI Theme Configuration

### Decision
Create a **custom MUI theme** with Vietnamese language support, consistent spacing, and accessible color palette.

### Rationale
- Constitution Principle IV requires MUI consistency and Vietnamese labels
- Custom theme ensures brand consistency across all pages
- Accessibility features built into MUI (ARIA labels, keyboard navigation)
- Responsive design patterns for desktop/tablet/mobile

### Theme Configuration
```typescript
import { createTheme, viVN } from '@mui/material/locale';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff'
    }
  },
  typography: {
    fontFamily: '"Roboto", "Segoe UI", "Arial", sans-serif',
    h1: { fontSize: '2rem', fontWeight: 600 },
    body1: { fontSize: '1rem' }
  },
  spacing: 8, // 8px base unit
  components: {
    MuiTable: {
      styleOverrides: {
        root: { minWidth: 650 }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none' } // Remove uppercase transform
      }
    }
  }
}, viVN); // Vietnamese locale
```

### Alternatives Considered
- **Tailwind CSS**: Doesn't provide pre-built complex components (tables, autocomplete)
- **Ant Design**: Less flexible theming, Chinese-centric
- **Chakra UI**: Newer, less enterprise adoption, fewer components
- **Custom CSS**: Too much development time for complex components

### Constitution Alignment
- ✅ Principle IV: User Experience - MUI consistency, Vietnamese support
- ✅ Principle IV: Accessibility - built-in ARIA support

---

## 8. AI Session Management

### Decision
Use **Redis** (or in-memory Map for MVP) to store AI training session state with 30-minute TTL.

### Rationale
- Constitution Principle V requires maintaining AI context throughout session
- Redis provides fast key-value storage for session data
- TTL automatically expires stale sessions (memory management)
- Can scale to multiple server instances if needed
- For MVP, in-memory Map is acceptable for single-server deployment

### Implementation Approach
```typescript
// MVP: In-memory session storage
const aiSessions = new Map<string, AISession>();

interface AISession {
  id: string;
  userId: string;
  trainingData: Transaction[];
  conversationHistory: Message[];
  ollamaContext: string; // Ollama conversation token
  expiresAt: Date;
}

// Create session
const session: AISession = {
  id: uuidv4(),
  userId: req.user.id,
  trainingData: selectedTransactions,
  conversationHistory: [],
  ollamaContext: '',
  expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
};

aiSessions.set(session.id, session);

// Cleanup expired sessions periodically
setInterval(() => {
  const now = new Date();
  for (const [id, session] of aiSessions.entries()) {
    if (session.expiresAt < now) {
      aiSessions.delete(id);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

### Production Enhancement
For production, migrate to Redis:
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Store session
await redis.setex(
  `ai:session:${sessionId}`,
  1800, // 30 minutes TTL
  JSON.stringify(session)
);
```

### Alternatives Considered
- **Database storage**: Too slow for frequent updates (conversation history)
- **Client-side storage**: Security risk, limited by browser storage limits
- **No session management**: Loses context between queries (violates constitution)

### Constitution Alignment
- ✅ Principle V: AI Integration - maintains context throughout session
- ✅ Principle III: Performance - fast read/write for conversation flow

---

## 9. URL Query Parameter Persistence

### Decision
Use **next-router** with query string encoding to persist filter/sort state in URLs for bookmarking and sharing.

### Rationale
- Constitution Principle IV requires persistent filters across navigation
- Query parameters enable shareable filtered views
- Browser back/forward navigation works correctly
- No additional state management library needed

### Implementation Approach
```typescript
import { useRouter } from 'next/router';
import { useEffect } from 'react';

function TransactionsPage() {
  const router = useRouter();
  
  // Parse filters from URL
  const filters = {
    company: router.query.company as string,
    fromDate: router.query.fromDate as string,
    toDate: router.query.toDate as string,
    category: router.query.category as string,
    sortBy: router.query.sortBy as string || 'date',
    sortOrder: router.query.sortOrder as string || 'desc'
  };
  
  // Update URL when filters change
  const updateFilters = (newFilters: Partial<typeof filters>) => {
    router.push({
      pathname: router.pathname,
      query: { ...router.query, ...newFilters }
    }, undefined, { shallow: true }); // Shallow routing (no page reload)
  };
  
  return (
    <FilterBar filters={filters} onChange={updateFilters} />
  );
}
```

### Alternatives Considered
- **Local storage**: Not shareable, no back/forward navigation
- **Redux/Zustand state**: Adds complexity, state doesn't persist on refresh
- **Server-side cookies**: Over-engineered for client-side filters

### Constitution Alignment
- ✅ Principle IV: User Experience - persistent filters, shareable views
- ✅ SC-004: Users can bookmark filtered views

---

## 10. Testing Strategy

### Decision
Implement **three-tier testing** with Jest (unit), Supertest (API integration), and MongoDB Memory Server (database integration).

### Rationale
- Covers all critical paths: CSV import, duplicate detection, AI classification, queries
- MongoDB Memory Server provides isolated test database (no mocking required)
- Supertest enables full API endpoint testing with realistic payloads
- Fast test execution (<30s for full suite)

### Test Structure
```typescript
// Unit test example (deduplicator.test.ts)
describe('Duplicate Detection', () => {
  it('detects duplicates within CSV file', () => {
    const rows = [
      { declarationNumber: '123', /* ... */ },
      { declarationNumber: '123', /* ... */ }, // Duplicate
      { declarationNumber: '456', /* ... */ }
    ];
    const result = detectDuplicates(rows);
    expect(result.duplicates).toEqual(['123']);
    expect(result.unique).toHaveLength(2);
  });
});

// Integration test example (import.test.ts)
describe('POST /api/import/upload', () => {
  it('imports valid CSV and skips duplicates', async () => {
    const response = await request(app)
      .post('/api/import/upload')
      .attach('file', 'tests/fixtures/sample-with-duplicates.csv')
      .expect(200);
    
    expect(response.body.imported).toBe(3);
    expect(response.body.duplicatesInFile).toBe(1);
    expect(response.body.duplicatesInDatabase).toBe(0);
  });
});
```

### Coverage Goals
- Unit tests: 80%+ coverage of lib/ and components/
- Integration tests: 100% coverage of critical user journeys (P1 user stories)
- Manual testing: AI classification quality, UI/UX flows

### Constitution Alignment
- ✅ All success criteria are testable (SC-001 through SC-010)
- ✅ Integration tests validate end-to-end flows from spec

---

## Summary of Key Technologies

| Category | Technology | Rationale |
|----------|-----------|-----------|
| **CSV Processing** | papaparse | Streaming support, semicolon delimiter, Vietnamese UTF-8 |
| **Duplicate Detection** | Set + MongoDB unique index | Two-phase detection per constitution |
| **AI Classification** | Ollama (llama3.1/mistral) | Local deployment, configurable, no API costs |
| **Database** | MongoDB 7 + Mongoose | Schema validation, virtuals, compound indexes |
| **API Validation** | Zod | Runtime validation, TypeScript integration |
| **Frontend Framework** | Next.js 16 Pages Router | Existing setup, integrated backend/frontend |
| **UI Components** | Material-UI v6 | Enterprise-grade, accessible, Vietnamese locale |
| **Table Virtualization** | react-window | Lightweight, MUI integration, constant performance |
| **Session Management** | In-memory Map (MVP), Redis (production) | Fast state storage, TTL support |
| **Testing** | Jest + Supertest + MongoDB Memory Server | Comprehensive coverage, isolated tests |
| **Deployment** | Docker Compose | Zero-dependency setup, service isolation, dev/prod parity |

---

## 11. Deployment Strategy with Docker Compose

### Decision
Use **Docker Compose** to orchestrate Next.js application, MongoDB, and Ollama in isolated containers.

### Rationale
- **Zero dependency installation**: Single `docker-compose up` command starts entire stack
- **Environment parity**: Dev/staging/production environments identical (eliminates "works on my machine")
- **Service isolation**: Each service runs in its own container with defined resource limits
- **Version consistency**: Docker images ensure MongoDB 7, Node.js 18, Ollama versions match across all environments
- **Easy scaling**: Can migrate to Kubernetes later using same container definitions

### Architecture Overview
```
┌─────────────────────────────────────────────┐
│         Docker Compose Network              │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Next.js │  │ MongoDB  │  │  Ollama  │ │
│  │   :3000  │  │  :27017  │  │  :11434  │ │
│  └──────────┘  └──────────┘  └──────────┘ │
│       │              │              │       │
│       └──────────────┴──────────────┘       │
│            Internal Bridge Network          │
└─────────────────────────────────────────────┘
         ↓             ↓             ↓
    localhost     localhost     localhost
      :3000        :27017        :11434
```

### Services Configuration

**1. App Service (Next.js)**
- Multi-stage Dockerfile (development + production targets)
- Development: Volume mounts for src/ enabling hot-reload
- Production: Standalone build with minimal image size (~150MB)
- Health check: HTTP GET on port 3000
- Environment: MONGODB_URI, OLLAMA_HOST from .env.docker

**2. MongoDB Service**
- Official mongo:7 image
- Named volume `mongodb-data` for data persistence
- Health check: mongosh ping command
- Exposed port 27017 for GUI tools (Compass, Studio 3T)

**3. Ollama Service**
- Official ollama/ollama image
- Named volume `ollama-data` for model storage (~4GB per model)
- Optional GPU support for NVIDIA cards (commented in docker-compose.yml)
- Health check: HTTP GET on port 11434

**4. Ollama-Setup Service (one-time)**
- Automatically pulls llama3.1 and mistral models on first run
- Runs once, then exits (restart: "no")
- Depends on ollama service being healthy

### Quick Start Commands
```bash
# Start all services (builds app on first run)
docker-compose up --build

# Start in detached mode (background)
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v

# Rebuild single service
docker-compose up --build app
```

### Volume Management
- **mongodb-data**: Persists database between restarts
- **ollama-data**: Persists downloaded models (~8GB for both models)
- **node_modules**: Anonymous volume prevents host overwrite
- **src/**: Bind mount enables hot-reload in development

### Development Workflow
1. Make code changes in src/
2. Next.js hot-reloads automatically (no restart needed)
3. Database persists between container restarts
4. Models download once, reused on subsequent runs

### Production Considerations
- Use `target: production` in Dockerfile (optimized build)
- Set `NODE_ENV=production` in environment
- Add reverse proxy (nginx) for SSL termination
- Use Docker secrets for sensitive environment variables
- Enable MongoDB authentication
- Consider GPU acceleration for Ollama (faster AI responses)

### Alternatives Considered
1. **Local installation** - Complex setup (Node.js, MongoDB, Ollama), version conflicts, inconsistent environments
2. **Separate Docker containers** - Manual networking setup, harder to orchestrate, no dependency management
3. **Kubernetes** - Overkill for single-server deployment, adds unnecessary complexity and operational overhead
4. **VM-based deployment** - Heavier resource usage, slower startup, more maintenance

### Files Created
- `docker-compose.yml`: Service orchestration with 3 main services + setup service
- `Dockerfile`: Multi-stage build (development with hot-reload, production optimized)
- `.dockerignore`: Excludes node_modules, .next, .git from build context
- `.env.docker`: Environment variables for container networking

### Constitution Alignment
- ✅ Principle III: Performance - containers isolate resource usage, prevent memory leaks
- ✅ Principle IV: User Experience - consistent dev environment reduces bugs
- ✅ All success criteria testable in identical environments

---

## 9. Background Job Architecture for AI Classification

### Decision
Implement **asynchronous background job** using Node.js script that processes goods with fallback classification, updating them with AI-generated categories and short names. Job can be triggered manually via API endpoint or scheduled via cron/system scheduler.

### Rationale
- Separates performance-critical CSV import from slow AI processing (constitution Principle III)
- Allows imports to complete in <2 minutes while AI processing happens asynchronously
- Users get immediate feedback on import success without waiting for AI
- Failed AI classifications can be retried without affecting import success
- Enables batch processing with rate limiting to avoid overwhelming Ollama
- Simple architecture suitable for MVP (no need for Redis queue or worker pools initially)

### Implementation Approach
```typescript
// src/lib/jobs/classify-goods.ts - Background job to classify goods with fallback classification
export async function classifyGoodsJob(options = { batchSize: 10, limit: 100 }) {
  // 1. Query goods where classifiedBy='fallback'
  // 2. Process in batches of 10 to avoid overwhelming Ollama
  // 3. For each goods: classify category + shorten name with AI
  // 4. Update goods record: category, shortName, classifiedBy='llama3.1', classifiedAt
  // 5. Log progress: processed/succeeded/failed counts
  // 6. Rate limit: 1s pause between batches
}

// src/pages/api/jobs/classify-goods.ts - API endpoint to trigger job
let jobRunning = false;
let lastResult: JobResult | null = null;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Return job status
    return res.status(200).json({
      running: jobRunning,
      lastRun: lastResult?.completedAt,
      lastResult: lastResult
    });
  }
  
  if (req.method === 'POST') {
    // Check if job already running (prevent duplicate executions)
    if (jobRunning) {
      return res.status(409).json({ error: 'Job already running' });
    }
    
    // Start job asynchronously (don't await - return 202 Accepted)
    jobRunning = true;
    classifyGoodsJob({ batchSize: 10, limit: 1000 })
      .then(result => {
        lastResult = { ...result, completedAt: new Date() };
      })
      .finally(() => {
        jobRunning = false;
      });
    
    return res.status(202).json({ message: 'Job started', status: 'running' });
  }
}
```

### Frontend Auto-Trigger with Interval Check
```typescript
// src/hooks/useBackgroundJobTrigger.ts - Custom hook for automatic job triggering
import { useEffect, useRef } from 'react';

interface JobStatus {
  running: boolean;
  lastRun?: string;
  lastResult?: {
    processed: number;
    succeeded: number;
    failed: number;
    duration: number;
  };
}

export function useBackgroundJobTrigger(intervalMinutes: number = 5) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const triggerJob = async () => {
      try {
        // Check job status first
        const statusResponse = await fetch('/api/jobs/classify-goods');
        const status: JobStatus = await statusResponse.json();
        
        // If already running, skip trigger
        if (status.running) {
          console.log('[BackgroundJob] Job already running, skipping trigger');
          return;
        }
        
        // Check if there are goods to process (optional optimization)
        const goodsResponse = await fetch('/api/goods/unclassified-count');
        const { count } = await goodsResponse.json();
        
        if (count === 0) {
          console.log('[BackgroundJob] No unclassified goods, skipping trigger');
          return;
        }
        
        // Trigger job
        console.log(`[BackgroundJob] Triggering job for ${count} unclassified goods`);
        const triggerResponse = await fetch('/api/jobs/classify-goods', {
          method: 'POST'
        });
        
        if (triggerResponse.status === 202) {
          console.log('[BackgroundJob] Job triggered successfully');
        } else if (triggerResponse.status === 409) {
          console.log('[BackgroundJob] Job already running (race condition)');
        }
      } catch (error) {
        console.error('[BackgroundJob] Failed to trigger job:', error);
      }
    };

    // Trigger immediately on mount
    triggerJob();

    // Set up interval
    intervalRef.current = setInterval(triggerJob, intervalMinutes * 60 * 1000);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [intervalMinutes]);
}

// Usage in _app.tsx or main layout component
function MyApp({ Component, pageProps }: AppProps) {
  // Auto-trigger background job every 5 minutes
  useBackgroundJobTrigger(5);
  
  return (
    <ThemeProvider theme={theme}>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
```

### Alternative: Polling-Based Trigger in Layout Component
```typescript
// src/components/layout/Navigation.tsx - Add to main navigation component
import { useEffect } from 'react';

export function Navigation() {
  useEffect(() => {
    const checkAndTriggerJob = async () => {
      try {
        // Check status
        const res = await fetch('/api/jobs/classify-goods');
        const { running } = await res.json();
        
        // Only trigger if not running
        if (!running) {
          await fetch('/api/jobs/classify-goods', { method: 'POST' });
        }
      } catch (error) {
        console.error('Failed to trigger background job:', error);
      }
    };

    // Initial trigger
    checkAndTriggerJob();

    // Trigger every 5 minutes
    const interval = setInterval(checkAndTriggerJob, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <AppBar position="static">
      {/* ... navigation items ... */}
    </AppBar>
  );
}
```

### Batch Processing Strategy
1. **Query goods**: `Goods.find({ classifiedBy: 'fallback' }).limit(1000)`
2. **Process in batches**: 10 goods per batch to manage Ollama load
3. **Parallel within batch**: `Promise.allSettled()` for concurrent processing
4. **Rate limiting**: 1-second pause between batches
5. **Error isolation**: Failed classifications logged but don't stop job
6. **Atomic updates**: Each goods record updated independently

### Job Execution Options
```bash
# Option 1: Manual trigger via API
curl -X POST http://localhost:3000/api/jobs/classify-goods

# Option 2: Check job status
curl http://localhost:3000/api/jobs/classify-goods

# Option 3: System cron (add to crontab) - Optional
0 * * * * curl -X POST http://localhost:3000/api/jobs/classify-goods

# Option 4: Frontend auto-trigger (RECOMMENDED)
# Automatic 5-minute interval check via useBackgroundJobTrigger hook
# Runs in browser, checks status before triggering to prevent duplicates
```

### Frontend Auto-Trigger Architecture
- **Hook-based**: `useBackgroundJobTrigger()` custom React hook
- **Check before trigger**: GET /api/jobs/classify-goods to check if running
- **Conditional trigger**: Only POST if not already running
- **Optimization**: Query unclassified goods count to skip unnecessary triggers
- **Error handling**: Graceful failure, logs errors without disrupting UI
- **Cleanup**: Clears interval on component unmount
- **Placement**: Added to _app.tsx or main layout component for global coverage

### Alternatives Considered
1. **Redis + Bull Queue** - Too complex for MVP, adds dependency
2. **AWS Lambda** - Requires cloud deployment, doesn't fit Docker Compose setup
3. **Worker Process Pool** - Overkill for current scale, harder to debug
4. **Inline during import** - Already rejected, blocks imports

### Performance Considerations
- Batch size: 10 goods balances throughput and Ollama capacity
- Rate limiting: 1s pause prevents Ollama overload
- Memory: 1000 goods limit per run prevents memory issues
- Concurrency: Parallel within batch, sequential between batches
- Retries: Failed goods remain in fallback state for next run

### Constitution Alignment
- ✅ Principle I: Data Integrity - atomic updates, fallback preserved until success
- ✅ Principle III: Performance - async processing maintains <2 min import target
- ✅ Principle IV: User Experience - immediate import feedback, gradual improvement
- ✅ Principle V: AI Integration - rate limiting prevents Ollama overload

---

## Open Questions Resolved

All technical unknowns from the Technical Context have been resolved. No [NEEDS CLARIFICATION] markers remain. The architecture is ready for Phase 1 design.
