<!--
SYNC IMPACT REPORT
==================
Version Change: Initial → 1.0.0
Created: 2025-11-20

New Constitution for Export Goods Analysis Application
This is the initial constitution establishing core principles and governance.

Principles Established:
1. Data Integrity & AI-Driven Classification (NEW)
2. Type Safety & Schema Validation (NEW)
3. Performance & Scalability (NEW)
4. User Experience & Accessibility (NEW)
5. AI Integration & Training Control (NEW)

Templates Status:
- No template files currently exist in .specify/templates/
- Templates will be created in future to align with these principles

Follow-up Actions:
- Create plan, spec, and task templates aligned with these principles
- Establish testing standards and CI/CD pipeline
- Document AI training data format and protocols
-->

# Export Goods Analysis Application Constitution

## Core Principles

### I. Data Integrity & AI-Driven Classification (NON-NEGOTIABLE)

**Data integrity MUST be maintained throughout the import, processing, and analysis pipeline.**

- All CSV imports MUST detect and prevent duplicate records based on unique transaction identifiers (`Số tờ khai` as primary key)
- Duplicate detection MUST occur at two levels: within the uploaded CSV file and against existing database records
- Raw data MUST be preserved in its original form before any AI processing or normalization
- AI classification MUST leverage historical categorizations for consistency (same goods → same category)
- Goods name shortening via AI MUST maintain semantic accuracy while reducing verbosity
- All data transformations MUST be reversible to raw source format

**Rationale**: Export goods data represents critical business intelligence and regulatory compliance records. Loss of data fidelity or introduction of duplicates would corrupt analytics and decision-making. AI consistency ensures reliable categorization over time.

### II. Type Safety & Schema Validation

**All data structures MUST be strongly typed using TypeScript interfaces with runtime validation.**

- CSV column mappings MUST be validated against expected schema before import processing begins
- Database models MUST enforce required fields, data types, and constraints via MongoDB schema validation
- API contracts MUST use TypeScript interfaces for request/response payloads with validation middleware
- Enum types MUST be used for fixed-value fields (e.g., payment methods, transport types, customs types)
- Date fields MUST follow ISO 8601 format (YYYY-MM-DD) consistently across system
- Currency and numeric fields MUST preserve precision (no floating-point rounding errors in financial calculations)

**Rationale**: Export goods data contains complex Vietnamese customs fields with specific formats and terminology. Type safety prevents runtime errors and ensures data consistency across the full stack (Next.js frontend/backend, MongoDB, Ollama AI).

### III. Performance & Scalability

**The application MUST handle large datasets efficiently without degrading user experience.**

- CSV import MUST process files in streaming chunks to avoid memory overflow on large files (>10MB)
- Database queries MUST use proper indexing on frequently filtered fields (company, date ranges, HS codes, categories)
- Pagination MUST be implemented for all data display pages with configurable page sizes (default 50 records)
- AI classification MUST process goods in batches with progress feedback to users
- Frontend table rendering MUST use virtualization for datasets exceeding 100 rows
- API endpoints MUST respond within 3 seconds for standard queries, 10 seconds for complex aggregations

**Rationale**: Export data files can contain thousands of transactions. Poor performance would render the application unusable for real-world business analysis scenarios.

### IV. User Experience & Accessibility

**All user interfaces MUST be intuitive, responsive, and accessible.**

- Material-UI (MUI) components MUST be used consistently across all pages with unified theming
- All forms MUST provide inline validation feedback and clear error messages in Vietnamese
- Import progress MUST be visible via progress indicators with percentage completion and estimated time
- Filter and sort controls MUST be persistent across page navigation (saved in URL query params)
- Export capabilities MUST be provided for filtered/sorted datasets (CSV, Excel formats)
- The example CSV template download MUST exactly match the expected import format from `sale-raw-data-small.csv`
- Vietnamese language labels and field names MUST match source data conventions (e.g., "Tên Cty nhập khẩu", "HS code")

**Rationale**: Users are business analysts working with Vietnamese customs data. The interface must accommodate domain terminology and support efficient data exploration workflows without technical barriers.

### V. AI Integration & Training Control

**AI functionality MUST be controllable, transparent, and grounded in actual business data.**

- Users MUST have explicit control over which database records are fed to the AI for training/context
- AI training data selection MUST support filtering by date ranges, companies, categories, and goods
- The AI conversation interface MUST maintain context from fed data throughout the session
- AI responses MUST cite specific data points when answering analytical questions (e.g., "Company X imported Y kg in period Z")
- Ollama model selection MUST be configurable (e.g., llama2, mistral, codellama)
- AI processing status MUST be visible (data loading, training, ready for questions)
- Common analytical queries MUST have suggested prompts (e.g., "Which company most imported?", "Which goods most imported?", "Potential customers for [product type]")

**Rationale**: AI-driven insights are a core differentiator. Users need transparency into what data the AI is using and confidence that recommendations are grounded in actual business records, not hallucinations.

## Technology Stack Standards

### Required Technologies

- **Frontend Framework**: Next.js 16+ (Pages Router) with React 19+
- **UI Library**: Material-UI (MUI) v6+ with consistent theming
- **Backend Runtime**: Next.js API Routes (serverless functions)
- **Database**: MongoDB 7+ with Mongoose ODM for schema management
- **AI Engine**: Ollama running locally or via API for LLM inference
- **Language**: TypeScript 5+ throughout entire stack (strict mode enabled)
- **Code Quality**: Biome for linting and formatting (already configured)

### Data Schema Standards

The application MUST model the following core entities based on the CSV structure:

1. **Transaction** (export record):
   - Date fields: year, month, day
   - Company: name, address
   - Goods: HS code, raw name, short name (AI-generated), category (AI-classified)
   - Financial: unit, quantity, unit price (original currency), unit price USD, total value USD
   - Logistics: currency, exchange rates, payment method, delivery terms, transport mode
   - Regulatory: exporting country, importing country, customs office, export type, declaration number (unique key)

2. **Company**:
   - Aggregated from transactions with computed totals and analytics

3. **Goods**:
   - Unique goods catalog with AI-assigned categories and short names
   - Historical category mapping for consistency

4. **Category**:
   - AI-generated taxonomy of goods types

## Development Workflow

### Import Pipeline Requirements

The CSV import feature MUST implement the following workflow:

1. **File Upload**: Accept CSV files with semicolon delimiter matching `sale-raw-data-small.csv` format
2. **Template Download**: Provide exact template file for users to structure their data correctly
3. **Validation**: Check headers, data types, required fields before processing
4. **Duplicate Detection**: Hash or index `Số tờ khai` (declaration number) to identify duplicates within file and database
5. **AI Classification**:
   - For new goods: Use Ollama to assign category and generate short name
   - For existing goods: Retrieve category and short name from database based on raw name matching
6. **Batch Insert**: Commit valid records to MongoDB with transaction support
7. **Report**: Display summary of imported records, duplicates skipped, errors encountered

### Query & Filter Requirements

All data display pages (Transactions, Goods, Companies) MUST support:

- **Filters**: Company name, date range (from/to), goods category, specific goods, HS code
- **Sorting**: Price, unit, quantity, total value, date (ascending/descending)
- **Search**: Full-text search on company names and goods names
- **Aggregation**: Total quantities, total values, record counts per group

### AI Training Page Requirements

The AI analysis page MUST implement:

1. **Data Selection UI**: Multi-step filter to select training dataset (checkboxes, date pickers, dropdowns)
2. **Feed Data Action**: Explicit button to load selected data into Ollama context
3. **Training Status**: Indicator showing data loading progress and model readiness
4. **Chat Interface**: Text input for natural language queries with conversation history
5. **Response Display**: Formatted AI responses with data citations and visualizations where applicable
6. **Suggested Queries**: Pre-built analytical questions users can click to execute

## Governance

This constitution supersedes all ad-hoc development decisions and establishes non-negotiable standards for the Export Goods Analysis Application. All features, database schemas, API endpoints, and UI components MUST comply with the principles outlined above.

### Amendment Process

1. Proposed changes MUST be documented with justification and impact analysis
2. Version number MUST be incremented following semantic versioning:
   - **MAJOR**: Removal or incompatible change to core principles
   - **MINOR**: Addition of new principles or significant guidance expansions
   - **PATCH**: Clarifications, wording improvements, non-semantic corrections
3. Amendments MUST include migration plan for existing code not in compliance
4. Constitution version MUST be referenced in all planning and specification documents

### Compliance Verification

- All code reviews MUST verify adherence to data integrity and type safety principles
- Performance benchmarks MUST be validated against standards before production deployment
- AI integration features MUST be tested with real data samples to verify accuracy and transparency

**Version**: 1.0.0 | **Ratified**: 2025-11-20 | **Last Amended**: 2025-11-20
