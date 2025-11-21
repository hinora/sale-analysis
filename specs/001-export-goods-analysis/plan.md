# Implementation Plan: Export Goods Analysis Application

**Branch**: `001-export-goods-analysis` | **Date**: 2025-11-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-export-goods-analysis/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a comprehensive export goods analysis application that imports Vietnamese customs data from CSV files using fast fallback classification (AI disabled during import for performance) while maintaining data integrity through duplicate detection, provides flexible querying across transactions/goods/companies with filtering and sorting, and enables AI-powered natural language analysis with user-controlled training data selection. The system must handle large datasets efficiently, preserve all raw data, and provide intuitive Vietnamese-language interfaces for business analysts.

## Technical Context

**Language/Version**: TypeScript 5+ (strict mode enabled)  
**Primary Dependencies**: Next.js 16+ (Pages Router), React 19+, Material-UI v6+, Mongoose ODM, Ollama SDK  
**Storage**: MongoDB 7+ with schema validation and indexes  
**Testing**: Jest with React Testing Library (frontend), Supertest (API routes), MongoDB Memory Server (integration)  
**Target Platform**: Web application (browser-based), Node.js 18+ runtime  
**Project Type**: Web (frontend + backend in single Next.js monorepo)  
**Deployment**: Docker Compose with 3 services (Next.js app, MongoDB, Ollama)  
**Performance Goals**: CSV import 10K rows <2 min (AI disabled), filter queries <2s, pagination <1s, AI responses <10s  
**Constraints**: Streaming CSV processing (no full file in memory), database indexing on filter fields, table virtualization >100 rows  
**Scale/Scope**: Support 1M+ transaction records, 100MB CSV files, 10 concurrent users, 10K AI training data limit

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Data Integrity & Fallback Classification ✅
- **Unique identifier**: `Số tờ khai` (declaration number) as primary key - COMPLIANT
- **Duplicate detection**: Two-level (within file + database) - COMPLIANT
- **Raw data preservation**: Store original CSV row blob - COMPLIANT
- **Classification consistency**: Reuse existing classifications - COMPLIANT
- **Reversible transformations**: Keep raw alongside processed - COMPLIANT
- **Performance priority**: AI disabled during import, use fallback ("Other" category + simple truncation) - COMPLIANT
- **Background processing**: Async job processes fallback goods with AI classification after import - COMPLIANT

### Principle II: Type Safety & Schema Validation ✅
- **TypeScript strict mode**: Enabled throughout - COMPLIANT
- **Schema validation**: Mongoose schemas with runtime validation - COMPLIANT
- **API contracts**: TypeScript interfaces with Zod validation - COMPLIANT
- **Enums for fixed values**: Payment methods, transport types, etc. - COMPLIANT
- **ISO 8601 dates**: Consistent format - COMPLIANT
- **Precision**: Use Decimal128 for currency values - COMPLIANT

### Principle III: Performance & Scalability ✅
- **Streaming CSV**: Process in 1000-row chunks - COMPLIANT
- **Database indexing**: On company, dates, HS codes, categories - COMPLIANT
- **Pagination**: 50 records default, configurable - COMPLIANT
- **Fast import**: AI disabled during CSV import for performance - COMPLIANT
- **Table virtualization**: react-window for large datasets - COMPLIANT
- **Response times**: 3s standard, 10s complex queries - COMPLIANT

### Principle IV: User Experience & Accessibility ✅
- **MUI consistency**: Unified theming - COMPLIANT
- **Vietnamese labels**: Match CSV conventions - COMPLIANT
- **Progress indicators**: For imports and AI processing - COMPLIANT
- **URL query params**: Persistent filters/sorts - COMPLIANT
- **CSV template download**: Exact match to sample - COMPLIANT

### Principle V: AI Integration & Training Control ✅
- **User control**: Explicit data selection for AI - COMPLIANT
- **Filter support**: Date, company, category, goods - COMPLIANT
- **Context maintenance**: Session-based conversation - COMPLIANT
- **Data citations**: Grounded responses - COMPLIANT
- **Configurable models**: Ollama model selection - COMPLIANT
- **Status visibility**: Training progress indicators - COMPLIANT
- **Suggested prompts**: Pre-built analytical questions - COMPLIANT

**Result**: All constitution principles satisfied. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-export-goods-analysis/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── import-api.yaml
│   ├── transactions-api.yaml
│   ├── goods-api.yaml
│   ├── companies-api.yaml
│   ├── jobs-api.yaml
│   └── ai-analysis-api.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Web application structure (Next.js monorepo with frontend + backend)
src/
├── pages/
│   ├── _app.tsx                    # App wrapper with MUI theme
│   ├── _document.tsx               # Document structure
│   ├── index.tsx                   # Dashboard/home page
│   ├── import.tsx                  # CSV import page (P1)
│   ├── transactions.tsx            # Transaction query page (P1)
│   ├── goods.tsx                   # Goods catalog page (P2)
│   ├── companies.tsx               # Company dashboard page (P2)
│   ├── ai-analysis.tsx             # AI analysis page (P3)
│   └── api/
│       ├── import/
│       │   ├── upload.ts           # Handle CSV file upload
│       │   ├── validate.ts         # Validate CSV structure
│       │   ├── process.ts          # Process and import records
│       │   └── template.ts         # Download template file
│       ├── transactions/
│       │   ├── list.ts             # Query transactions with filters
│       │   └── export.ts           # Export filtered results
│       ├── goods/
│       │   ├── list.ts             # Query goods catalog
│       │   └── [id].ts             # Get goods detail with transactions
│       ├── companies/
│       │   ├── list.ts             # Query companies
│       │   └── [id].ts             # Get company detail with transactions
│       ├── jobs/
│       │   └── classify-goods.ts   # Trigger background AI classification job
│       └── ai/
│           ├── feed-data.ts        # Load data into AI context
│           ├── query.ts            # Process natural language queries
│           └── session.ts          # Manage AI session state
├── components/
│   ├── layout/
│   │   ├── Navigation.tsx          # Main navigation menu
│   │   └── PageHeader.tsx          # Reusable page header
│   ├── import/
│   │   ├── FileUpload.tsx          # Drag-drop CSV upload
│   │   ├── ImportProgress.tsx      # Progress bar with stats
│   │   └── ImportSummary.tsx       # Results summary display
│   ├── tables/
│   │   ├── DataTable.tsx           # Reusable virtualized table
│   │   ├── FilterBar.tsx           # Filter controls component
│   │   └── SortHeader.tsx          # Sortable column headers
│   ├── ai/
│   │   ├── DataSelector.tsx        # Filter UI for AI data selection
│   │   ├── ChatInterface.tsx       # Conversation interface
│   │   ├── SuggestedQueries.tsx    # Clickable question prompts
│   │   └── AIStatus.tsx            # Training/ready indicator
│   └── common/
│       ├── DateRangePicker.tsx     # Date range filter
│       ├── CompanyAutocomplete.tsx # Company search input
│       └── CategorySelect.tsx      # Category dropdown
├── lib/
│   ├── db/
│   │   ├── connection.ts           # MongoDB connection management
│   │   ├── models/
│   │   │   ├── Transaction.ts      # Transaction Mongoose schema
│   │   │   ├── Company.ts          # Company schema with virtuals
│   │   │   ├── Goods.ts            # Goods schema with virtuals
│   │   │   ├── Category.ts         # Category schema
│   │   │   └── AISession.ts        # AI training session schema
│   │   └── indexes.ts              # Database index definitions
│   ├── csv/
│   │   ├── parser.ts               # Stream CSV parsing (papaparse)
│   │   ├── validator.ts            # CSV schema validation
│   │   └── deduplicator.ts         # Duplicate detection logic
│   ├── ai/
│   │   ├── ollama-client.ts        # Ollama API wrapper
│   │   ├── classifier.ts           # Goods classification logic
│   │   ├── name-shortener.ts       # Name shortening with AI
│   │   └── query-handler.ts        # Natural language query processing
│   ├── jobs/
│   │   └── classify-goods.ts       # Background job for AI classification
│   ├── hooks/
│   │   └── useBackgroundJobTrigger.ts  # React hook for auto-triggering background job
│   ├── utils/
│   │   ├── validation.ts           # Zod schemas for API validation
│   │   ├── formatting.ts           # Number/date formatting utilities
│   │   └── vietnamese.ts           # Vietnamese text handling
│   └── types/
│       ├── csv.ts                  # CSV row type definitions
│       ├── api.ts                  # API request/response types
│       └── entities.ts             # Domain entity interfaces
└── styles/
    ├── globals.css                 # Global styles
    ├── theme.ts                    # MUI theme configuration
    └── Home.module.css             # Home page styles

tests/
├── integration/
│   ├── import.test.ts              # Full CSV import workflow
│   ├── transactions.test.ts        # Transaction query scenarios
│   ├── goods.test.ts               # Goods catalog scenarios
│   ├── companies.test.ts           # Company dashboard scenarios
│   └── ai-analysis.test.ts         # AI training and query scenarios
├── unit/
│   ├── csv-parser.test.ts          # CSV parsing logic
│   ├── deduplicator.test.ts        # Duplicate detection logic
│   ├── classifier.test.ts          # AI classification logic
│   └── formatters.test.ts          # Utility functions
└── fixtures/
    ├── sample-data.csv             # Test CSV files
    ├── sample-with-duplicates.csv
    └── mock-ollama-responses.json

public/
├── templates/
│   └── export-data-template.csv   # Downloadable CSV template
└── locales/
    └── vi.json                     # Vietnamese translations

data-example/
└── sale-raw-data-small.csv        # Source of truth template (existing)

# Docker configuration
docker-compose.yml                  # Multi-service orchestration
Dockerfile                          # Next.js app container
.dockerignore                       # Docker build exclusions
.env.docker                         # Docker environment variables
```

**Structure Decision**: Using Next.js Pages Router web application structure (Option 2 variant) with backend API routes and frontend pages in a single monorepo. This aligns with the existing Next.js setup and constitution requirements. The `src/pages/api/` directory serves as the backend, while `src/pages/` contains the React frontend pages. Shared code lives in `src/lib/` and `src/components/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**No violations identified** - all constitution principles are satisfied by the proposed architecture.

---

## Phase 0: Research & Decision Log

*See [research.md](./research.md) for detailed findings.*

## Phase 1: Design Artifacts

*See the following files for design specifications:*

- **[data-model.md](./data-model.md)** - Database schemas and entity relationships
- **[contracts/](./contracts/)** - API endpoint specifications (OpenAPI format)
- **[quickstart.md](./quickstart.md)** - Developer setup and getting started guide

---

## Planning Complete ✅

### Phase 0: Research (Complete)
All technical unknowns resolved. Key decisions documented:
- CSV processing: papaparse with streaming
- Duplicate detection: Two-phase (Set + MongoDB unique index)
- AI integration: Ollama with llama3.1/mistral models
- Database: MongoDB 7 + Mongoose with strategic indexes
- Frontend virtualization: react-window for large datasets
- API validation: Zod for runtime type checking
- Session management: In-memory Map (MVP), Redis (production)
- URL persistence: next-router with query params
- **Deployment: Docker Compose with 3-service architecture** *(added 2025-11-20)*

### Phase 1: Design (Complete)
All design artifacts generated:
- **5 Mongoose schemas** defined with validations and indexes
- **6 API contract files** (OpenAPI 3.0.3 format) covering all endpoints including background jobs
- **Developer quickstart guide** with Docker setup instructions *(updated 2025-11-20)*
- **Agent context updated** for GitHub Copilot
- **Background job architecture** documented in research.md *(added 2025-11-21)*

### Docker Configuration (Added 2025-11-20)
Complete Docker deployment setup:
- ✅ **docker-compose.yml** - Multi-service orchestration (app, mongodb, ollama, ollama-setup)
- ✅ **Dockerfile** - Multi-stage build (development + production targets)
- ✅ **.dockerignore** - Optimized build context
- ✅ **.env.docker** - Container environment template
- ✅ **DOCKER.md** - Comprehensive deployment guide
- ✅ **next.config.ts** - Updated with standalone output for production
- ✅ **quickstart.md** - Updated with Docker Compose instructions

### Constitution Re-evaluation (Complete)
Post-design constitution check confirms 100% compliance:
- ✅ Data Integrity & AI Classification
- ✅ Type Safety & Schema Validation  
- ✅ Performance & Scalability
- ✅ User Experience & Accessibility
- ✅ AI Integration & Training Control

No violations. No complexity justifications required.

### Docker Compose Configuration

The application uses Docker Compose to orchestrate three services:

**Services**:
1. **app** - Next.js application (Node.js 18+)
2. **mongodb** - MongoDB 7+ database with persistent volume
3. **ollama** - Ollama AI service with llama3.1 and mistral models

**Quick Start with Docker**:
```bash
# Build and start all services
docker-compose up --build

# Application available at http://localhost:3000
# MongoDB available at mongodb://localhost:27017
# Ollama available at http://localhost:11434
```

**Container Configuration**:
- **app**: Hot-reload enabled for development, volume mounts for src/
- **mongodb**: Named volume for data persistence, exposed port 27017
- **ollama**: GPU support optional, models auto-downloaded on first run

**Environment Variables**: Configured in `.env.docker` for container networking

**Documentation**: See [DOCKER.md](../../../DOCKER.md) for detailed deployment guide

### Next Steps

The planning phase is complete. To continue with implementation:

1. **Review artifacts**:
   - Read [spec.md](./spec.md) for requirements
   - Review [data-model.md](./data-model.md) for schema details
   - Check API contracts in [contracts/](./contracts/)
   - Follow [quickstart.md](./quickstart.md) for setup (Docker or local)
   - Review [DOCKER.md](../../../DOCKER.md) for deployment details

2. **Generate tasks** (Phase 2):
   ```bash
   # Run task generation command
   /speckit.tasks
   ```

3. **Start implementation**:
   - Set up development environment per quickstart.md (Docker recommended)
   - Begin with P1 user stories (CSV import, transaction queries)
   - Follow TDD approach with unit/integration tests
   - Reference constitution for compliance during development

---

**Planning Status**: ✅ **COMPLETE** (Updated with Docker deployment + Background Jobs)  
**Branch**: `001-export-goods-analysis`  
**Date Completed**: 2025-11-20  
**Last Updated**: 2025-11-21 (Background AI classification job added)
