# Feature Specification: Export Goods Analysis Application

**Feature Branch**: `001-export-goods-analysis`  
**Created**: 2025-11-20  
**Status**: Draft  
**Input**: User description: "Build comprehensive export goods analysis application with CSV import, AI classification, transaction display, goods catalog, company analytics, and AI-powered analysis interface"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - CSV Import with Intelligent Duplicate Detection (Priority: P1)

A business analyst receives a new export data CSV file from Vietnamese customs authorities. They need to import this data into the system to begin analysis, but the file may contain duplicate transactions or goods that already exist in the database from previous imports. The system must intelligently detect duplicates, classify new goods using AI, and reuse existing classifications for known goods to maintain consistency.

**Why this priority**: This is the entry point for all data into the system. Without a reliable import mechanism, no other features can function. Data integrity depends on proper duplicate handling and consistent classification.

**Independent Test**: Can be fully tested by uploading a CSV file with various duplicate scenarios (within file and against database) and verifying that duplicates are skipped, new goods are created with fallback classification ("Other" category), existing goods reuse prior categories, and raw names are truncated while preserving original data. Delivers immediate value by populating the database quickly with clean data.

**Acceptance Scenarios**:

1. **Given** an empty database, **When** user uploads a valid CSV file matching the template format, **Then** all transactions are imported, goods are assigned to "Other" category with truncated names for performance, and an import summary shows total records imported
2. **Given** a database with existing transactions, **When** user uploads a CSV containing duplicate declaration numbers (`Số tờ khai`), **Then** duplicate transactions are skipped, only new transactions are imported, and the summary reports X duplicates skipped and Y new records imported
3. **Given** a database with existing goods, **When** user uploads a CSV containing transactions with the same goods names, **Then** the system reuses the existing category and short name, ensuring consistency
4. **Given** user navigates to the import page, **When** user clicks the "Download Template" button, **Then** a CSV file is downloaded that exactly matches the structure of `sale-raw-data-small.csv` with sample data rows
5. **Given** a CSV file with duplicate transactions within the same file, **When** user uploads the file, **Then** only the first occurrence of each unique declaration number is imported, duplicates within the file are identified and skipped
6. **Given** a CSV file with invalid formatting or missing required fields, **When** user uploads the file, **Then** the system displays specific validation errors indicating which rows and fields are problematic, and no data is imported until corrected

---

### User Story 1.5 - Background AI Classification Job (Priority: P1)

A system administrator or automated scheduler needs to process goods that were imported with fallback classification ("Other" category and truncated names) and update them with proper AI-generated categories and short names. This background job runs asynchronously without blocking CSV imports, ensuring that goods eventually receive intelligent classification while maintaining fast import performance.

**Why this priority**: Separates performance-critical import path from slow AI processing. Users get immediate import success, while goods quality improves over time through background processing. Essential for production use with large datasets.

**Independent Test**: Can be fully tested by importing CSV with new goods, verifying they start with "Other" category and truncated names, triggering the background job (manual or scheduled), and confirming goods are updated with proper AI categories and short names without affecting existing transactions.

**Acceptance Scenarios**:

1. **Given** goods imported with fallback classification (classifiedBy = 'fallback'), **When** background job runs, **Then** system queries all goods with classifiedBy='fallback' and processes them in batches
2. **Given** a batch of unclassified goods, **When** background job processes them, **Then** each goods record is updated with AI-generated category (via Ollama llama3.1) and shortName (via Ollama mistral)
3. **Given** background job is processing goods, **When** AI classification succeeds, **Then** goods record is updated with new category, shortName, classifiedBy='llama3.1', and classifiedAt=current timestamp
4. **Given** background job encounters an AI error, **When** classification fails, **Then** goods record remains with fallback classification and error is logged for retry without crashing the job
5. **Given** background job is running, **When** new CSV imports occur simultaneously, **Then** imports complete successfully without blocking on the background job, and newly imported goods are queued for future processing
6. **Given** all goods are processed, **When** background job runs again, **Then** it finds zero goods with classifiedBy='fallback' and completes immediately without unnecessary work
7. **Given** a goods record already has AI classification, **When** background job processes it, **Then** it skips the goods to avoid re-classifying already processed records
8. **Given** user has application open in browser, **When** 5 minutes pass, **Then** frontend automatically checks job status and triggers classification if not already running
9. **Given** background job is already running, **When** frontend auto-trigger attempts to start job, **Then** API returns 409 status and frontend skips trigger without error

---

### User Story 2 - Transaction Query and Analysis (Priority: P1)

A business analyst needs to review historical export transactions to identify patterns, analyze specific time periods, or investigate particular companies or products. They require flexible filtering and sorting capabilities to slice the data in multiple ways and quickly find relevant transactions.

**Why this priority**: Transaction-level visibility is the foundation of all analysis. Users need to verify data quality, investigate specific cases, and perform ad-hoc queries before trusting aggregated reports.

**Independent Test**: Can be fully tested by navigating to the transactions page, applying various filter combinations (company name, date range, goods category, specific goods), sorting by different columns (price, quantity, total value), and verifying that results update correctly. Delivers value by enabling data exploration and verification.

**Acceptance Scenarios**:

1. **Given** the transactions page is loaded, **When** user enters a company name in the filter, **Then** the table displays only transactions from that company
2. **Given** the transactions page is loaded, **When** user selects a date range (from date and to date), **Then** the table displays only transactions within that date range inclusive
3. **Given** the transactions page is loaded, **When** user selects a goods category from a dropdown, **Then** the table displays only transactions containing goods in that category
4. **Given** filtered transactions are displayed, **When** user clicks a column header to sort (e.g., unit price, quantity, total value), **Then** the table re-sorts in ascending order; clicking again sorts descending
5. **Given** a large dataset, **When** the transactions page loads, **Then** results are paginated with 50 records per page by default, and user can navigate between pages or change page size
6. **Given** multiple filters are applied (company + date range + category), **When** user views results, **Then** only transactions matching ALL filter criteria are displayed (AND logic)

---

### User Story 3 - Goods Catalog Management (Priority: P2)

A product manager wants to review all unique goods that have been exported, understand how they are categorized, see which companies are exporting them, and analyze export volumes and values. They need to filter goods by various criteria and see aggregated statistics.

**Why this priority**: The goods catalog provides a product-centric view of the business. It's essential for understanding the product portfolio, identifying top-selling goods, and spotting trends. However, it depends on having transaction data imported first (P1).

**Independent Test**: Can be fully tested by navigating to the goods catalog page, viewing the list of unique goods with their AI-assigned categories and short names, applying filters (company, date range, category), sorting by metrics (price, volume, total exports), and verifying that aggregated totals are accurate. Delivers value by consolidating product intelligence.

**Acceptance Scenarios**:

1. **Given** the goods catalog page is loaded, **When** user views the table, **Then** each row shows a unique good with its short name, raw name, category, and aggregated metrics (total quantity exported, total value, number of transactions, average unit price)
2. **Given** the goods catalog page, **When** user filters by company name, **Then** only goods that have been exported by that company are displayed
3. **Given** the goods catalog page, **When** user filters by date range, **Then** only goods exported during that time period are displayed, and aggregated metrics reflect only that period
4. **Given** the goods catalog page, **When** user sorts by total export value, **Then** goods are ordered from highest to lowest total value (or vice versa on second click)
5. **Given** a goods entry in the table, **When** user clicks on it, **Then** a detail view shows all transactions involving that good, including which companies imported it and when

---

### User Story 4 - Company Intelligence Dashboard (Priority: P2)

A sales executive needs to understand which companies are the most active importers, what products they prefer, their export volumes over time, and identify potential business opportunities. They require a company-centric view with filtering and ranking capabilities.

**Why this priority**: Company intelligence enables strategic business development decisions. Understanding customer behavior and identifying high-value relationships is crucial for sales and marketing. Like the goods catalog, it depends on having transaction data (P1).

**Independent Test**: Can be fully tested by navigating to the company dashboard, viewing the list of importing companies with aggregated statistics, filtering by goods categories or time periods, sorting by various metrics (total import value, quantity, transaction count), and verifying accuracy. Delivers value by consolidating customer intelligence.

**Acceptance Scenarios**:

1. **Given** the company dashboard is loaded, **When** user views the table, **Then** each row shows a company with aggregated metrics (total transactions, total export value, total quantity imported, number of unique goods imported, most recent transaction date)
2. **Given** the company dashboard, **When** user filters by goods category, **Then** only companies that have imported goods in that category are displayed, with metrics reflecting only those transactions
3. **Given** the company dashboard, **When** user filters by date range, **Then** only companies with transactions in that period are displayed, and metrics are calculated for that period only
4. **Given** the company dashboard, **When** user sorts by total import value, **Then** companies are ranked from highest to lowest spenders (or vice versa)
5. **Given** a company entry in the table, **When** user clicks on it, **Then** a detail view shows all transactions for that company, breakdown by goods categories, timeline of activity, and goods they've imported

---

### User Story 5 - AI-Powered Analysis and Insights (Priority: P3)

A business strategist wants to ask complex analytical questions about the export data using natural language, such as "Which company most imported?", "Which goods are trending up?", or "Which companies have potential for frozen seafood products?". They need control over what data the AI analyzes and a conversational interface to explore insights.

**Why this priority**: AI-driven insights provide the most advanced analytical capability, but they depend on having a clean, classified dataset (P1) and understanding of companies and goods (P2). This is a premium feature that differentiates the application but can be deployed after core data management is working.

**Independent Test**: Can be fully tested by navigating to the AI analysis page, selecting data to feed the AI (via filters), clicking "Feed Data to AI", waiting for the training status to show ready, asking natural language questions, and verifying that answers are grounded in actual data with citations. Delivers value by enabling sophisticated analysis without SQL or report-building skills.

**Acceptance Scenarios**:

1. **Given** the AI analysis page is loaded, **When** user selects filters (date range, companies, categories), **Then** a summary shows how many transactions and records will be fed to the AI
2. **Given** user has selected data, **When** user clicks "Feed Data to AI", **Then** a progress indicator shows data being loaded into the AI context, and upon completion, a status indicator shows "AI Ready for Questions"
3. **Given** the AI is ready, **When** user types a question like "Which company most imported?", **Then** the AI responds with the company name, total import value, and percentage of total, citing specific data
4. **Given** the AI is ready, **When** user asks "Which goods most imported?", **Then** the AI responds with the top goods by quantity or value, with specific numbers
5. **Given** the AI is ready, **When** user asks "Which companies have potential for frozen tuna products?", **Then** the AI analyzes companies that have imported similar categories and provides recommendations based on their import patterns
6. **Given** the AI analysis page, **When** user views suggested questions, **Then** clickable prompts are displayed (e.g., "Top 5 importing companies", "Fastest growing goods category", "Seasonal trends"), and clicking one submits that question
7. **Given** a conversation is in progress, **When** user asks follow-up questions, **Then** the AI maintains context from previous questions and the fed data, allowing natural conversation flow

---

### Edge Cases

- **What happens when a CSV file exceeds 100MB or contains 100,000+ rows?** System must stream process the file in chunks to avoid memory issues, show progress during upload/processing, and handle timeouts gracefully
- **What happens when the AI classification service is unavailable or slow?** AI classification has been disabled during CSV import for performance. System uses fallback classification ("Other" category and simple name truncation) to ensure fast import. A background job runs asynchronously to process unclassified goods and update them with proper AI-generated categories and short names.
- **What happens when two users upload CSVs with overlapping data simultaneously?** System must use database-level locking or unique constraints on declaration numbers to prevent race conditions creating duplicates
- **What happens when a goods name in Vietnamese has special characters or is extremely long (>500 characters)?** System must handle UTF-8 Vietnamese characters correctly. Simple truncation shortens names to 100 characters maximum while preserving original raw name.
- **What happens when a company name appears with slight variations (e.g., "CÔNG TY ABC" vs "Cty ABC")?** System treats them as different companies by default; user can manually merge duplicates through a company management interface (future enhancement)
- **What happens when filtering results in zero records?** Display a clear "No results found" message with suggestions to broaden filters
- **What happens when users try to feed 1 million+ transactions to the AI?** System must limit AI training data to a maximum of 10,000 transactions to prevent performance issues, prompting user to narrow their selection if exceeded
- **What happens when a CSV has a different column order or missing optional columns?** System validates required columns are present regardless of order, and treats missing optional columns as null/empty values

## Requirements *(mandatory)*

### Functional Requirements

#### CSV Import Requirements

- **FR-001**: System MUST accept CSV files with semicolon (`;`) as the delimiter, matching the Vietnamese customs export format shown in `sale-raw-data-small.csv`
- **FR-002**: System MUST validate that uploaded CSV files contain all required columns: `Năm, Tháng, Ngày, Tên Cty nhập khẩu, Địa chỉ Cty nhập khẩu, HS code, Tên hàng, Đơn vị tính, Số Lượng, Đơn giá khai báo(USD), Trị giá USD, Nguyên tệ, Số tờ khai` (minimum required fields)
- **FR-003**: System MUST use a composite key of 8 columns to detect duplicate transactions: `Số tờ khai` (declaration number), `HS code`, `Tên hàng` (goods name), `Tên Cty nhập khẩu` (company name), `Trị giá USD` (total value USD), `Tỷ giá USD` (USD rate), `Mã phương thức thanh toán` (payment method), `Điều kiện giao hàng` (delivery terms)
- **FR-004**: System MUST detect duplicate transactions within the uploaded CSV file using the 8-column composite key before processing and skip duplicates, keeping only the first occurrence
- **FR-005**: System MUST detect duplicate transactions against existing database records using the 8-column composite key and skip importing transactions that already exist
- **FR-006**: System MUST preserve all raw data from the CSV exactly as provided, storing original values before any transformations or AI processing
- **FR-007**: System MUST classify goods names (`Tên hàng`) into categories using AI via a background job that processes goods marked with fallback classification
- **FR-008**: System MUST generate a shortened version of each goods name using AI via a background job, while preserving the raw name in the database
- **FR-009**: System MUST check if a goods name already exists in the database and reuse the existing category and short name instead of re-classifying, ensuring consistency across imports
- **FR-010**: System MUST provide a downloadable CSV template file that exactly matches the structure of `sale-raw-data-small.csv` including column headers in Vietnamese and example data rows
- **FR-011**: System MUST display an import summary after processing showing: total rows in file, successful imports, duplicates skipped (within file), duplicates skipped (against database), validation errors, and goods newly classified
- **FR-012**: System MUST process CSV files in streaming chunks of 1000 rows at a time to handle large files efficiently without loading entire file into memory

#### Transaction Display Requirements

- **FR-013**: System MUST display all imported transactions in a paginated table with 50 records per page by default
- **FR-014**: Users MUST be able to filter transactions by company name (partial text match, case-insensitive)
- **FR-015**: Users MUST be able to filter transactions by date range using from-date and to-date inputs (inclusive range)
- **FR-016**: Users MUST be able to filter transactions by goods category using a dropdown populated from all categories in the database
- **FR-017**: Users MUST be able to filter transactions by specific goods using a searchable dropdown or autocomplete input
- **FR-018**: System MUST apply all active filters using AND logic (transaction must match all filter criteria)
- **FR-019**: Users MUST be able to sort transactions by: unit price (USD), quantity, total value (USD), date (ascending or descending)
- **FR-020**: System MUST preserve filter and sort selections in the URL query parameters so users can bookmark or share filtered views
- **FR-021**: Transaction table MUST display key columns: date, company name, goods short name, goods category, HS code, quantity, unit, unit price USD, total value USD, declaration number

#### Goods Catalog Requirements

- **FR-022**: System MUST display all unique goods in a paginated table with aggregated statistics
- **FR-023**: For each good, system MUST calculate and display: total quantity exported (sum across all transactions), total export value (sum), number of transactions, average unit price, date range of exports (earliest to most recent)
- **FR-024**: Users MUST be able to filter goods by company name (show only goods exported by that company)
- **FR-025**: Users MUST be able to filter goods by date range (show only goods exported during that period, with metrics calculated for that period)
- **FR-026**: Users MUST be able to filter goods by category
- **FR-027**: Users MUST be able to sort goods by: total export value, total quantity, average unit price, number of transactions, most recent export date
- **FR-028**: Goods table MUST display: short name, raw name, category, HS code, total quantity, total value, transaction count, average price, date range

#### Company Dashboard Requirements

- **FR-029**: System MUST display all companies that have import transactions in a paginated table with aggregated statistics
- **FR-030**: For each company, system MUST calculate and display: total transactions, total import value (sum across all transactions), total quantity imported, number of unique goods imported, most frequent goods category, date range of activity (earliest to most recent transaction)
- **FR-031**: Users MUST be able to filter companies by goods category (show only companies that imported goods in that category)
- **FR-032**: Users MUST be able to filter companies by date range (show only companies active during that period, with metrics for that period)
- **FR-033**: Users MUST be able to sort companies by: total import value, total quantity, transaction count, number of unique goods, most recent activity
- **FR-034**: Company table MUST display: company name, address, total import value, total quantity, transaction count, unique goods count, top category, date range

#### AI Analysis Requirements

- **FR-035**: System MUST provide a data selection interface with filters: date range, company multi-select, category multi-select, goods multi-select
- **FR-036**: System MUST display a summary showing how many transactions match the current filter selection before feeding to AI
- **FR-037**: System MUST provide a "Feed Data to AI" button that loads the selected transactions into the AI model's context
- **FR-038**: System MUST display a progress indicator while data is being fed to the AI, showing percentage complete and estimated time remaining
- **FR-039**: System MUST limit AI training data to a maximum of 10,000 transactions; if selection exceeds this, prompt user to narrow filters
- **FR-040**: System MUST display the AI status: "No data loaded", "Loading data (X%)", "Ready for questions", "Processing query", "Error"
- **FR-041**: System MUST provide a chat interface with a text input for users to ask natural language questions
- **FR-042**: System MUST maintain conversation history, displaying all questions and AI responses in chronological order
- **FR-043**: System MUST include specific data citations in AI responses (e.g., company names, values, dates, declaration numbers) to ground answers in actual data
- **FR-044**: System MUST provide suggested question templates: "Which company most imported?", "Which goods most imported?", "Which companies have potential for [category] products?", "Show trends over time", "Compare [company A] vs [company B]"
- **FR-045**: Users MUST be able to click suggested questions to automatically submit them
- **FR-046**: System MUST allow users to clear the AI context and start fresh with new data selections

### Key Entities

- **Transaction**: Represents a single export declaration record from the CSV. Attributes include: unique declaration number, date (year/month/day), importing company reference, goods reference, HS code, quantity, unit of measure, unit price in original currency, unit price in USD, total value in USD, original currency type, exchange rates, payment method code, delivery terms, transport mode, exporting country, importing country, customs office, export type category, raw data blob (entire CSV row preserved). Relationships: belongs to one Company, belongs to one Goods item.

- **Company**: Represents a business entity that imports goods. Attributes include: company name (Vietnamese), address, automatically calculated aggregates (total transaction count, total import value, total quantity, unique goods count, most recent activity date). Relationships: has many Transactions.

- **Goods**: Represents a unique product/commodity being exported. Attributes include: raw name (original Vietnamese text from CSV, may be lengthy), short name (AI-generated concise version, max 100 characters), category (AI-assigned classification), HS code, automatically calculated aggregates (total quantity exported, total value, transaction count, average price, date range of exports). Relationships: has many Transactions.

- **Category**: Represents a classification taxonomy for goods, created by the AI during import. Attributes include: category name, description, automatically calculated aggregates (total goods in category, total export value for category). Relationships: has many Goods.

- **AI Training Session**: Represents a specific instance of data being fed to the AI for analysis. Attributes include: session ID, user identifier, creation timestamp, filter criteria used (JSON blob), number of transactions loaded, status (loading/ready/expired), expiration timestamp. Relationships: references multiple Transactions through filter criteria.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can upload a CSV file with 10,000 transactions and complete the import process (including duplicate detection and fallback classification) in under 2 minutes
- **SC-002**: The system correctly identifies and skips 100% of duplicate transactions (using 8-column composite key) both within CSV files and against existing database records, with zero false positives or false negatives
- **SC-003**: AI goods classification maintains 95%+ consistency (same raw name always receives same category) across multiple imports over time
- **SC-004**: Users can apply filters and sort criteria on any data display page (transactions, goods, companies) and see results update within 2 seconds for datasets up to 100,000 records
- **SC-005**: The downloaded CSV template file exactly matches the `sale-raw-data-small.csv` format with 100% column header accuracy (all Vietnamese field names correct)
- **SC-006**: AI-powered analysis responds to natural language queries within 10 seconds and includes specific data citations (company names, values, declaration numbers) in 90%+ of answers
- **SC-007**: The application handles concurrent CSV uploads from 10 users simultaneously without data corruption or duplicate records being created
- **SC-008**: Users can navigate from transaction view to goods detail to company detail (drill-down navigation) in 3 clicks or less
- **SC-009**: The system preserves 100% of raw CSV data integrity, with no data loss or corruption during import, classification, or storage
- **SC-010**: Pagination on all data tables loads new pages in under 1 second, even for result sets with millions of total records

### Assumptions

1. All CSV files will follow the Vietnamese customs export format with semicolon delimiters as shown in `sale-raw-data-small.csv`
2. The combination of 8 key columns (`Số tờ khai`, `HS code`, `Tên hàng`, `Tên Cty nhập khẩu`, `Trị giá USD`, `Tỷ giá USD`, `Mã phương thức thanh toán`, `Điều kiện giao hàng`) is always present and truly unique to identify distinct transactions, as a single declaration number can contain multiple line items
3. An AI service (e.g., Ollama running locally) is available and configured for goods classification and natural language query processing
4. Goods classification by AI will produce reasonable category assignments that align with business understanding of product types (e.g., frozen seafood, agricultural products, manufactured goods)
5. The application will initially support Vietnamese language for field labels and data, with English as secondary language (future enhancement)
6. Users have sufficient technical knowledge to work with CSV files and understand the concept of filtering and sorting data
7. The system will run on infrastructure capable of handling files up to 100MB and databases with up to 1 million transaction records
8. Network connectivity to the AI service is reliable enough for real-time classification during imports
9. Users understand that AI analysis quality depends on the data they select to feed - garbage in, garbage out principle applies
