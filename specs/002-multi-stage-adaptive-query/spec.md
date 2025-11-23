# Feature Specification: Multi-Stage Adaptive Query System

**Feature Branch**: `002-multi-stage-adaptive-query`  
**Created**: 2025-11-23  
**Status**: Draft  
**Input**: User request for intelligent, multi-stage query system where AI analyzes questions to determine needed data, fetches only relevant subsets, and iteratively refines context through multiple API calls.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Intelligent In-Memory Filtering (Priority: P1)

User asks a question about specific subset of data (e.g., "Which US companies imported the most electronics?"), and the AI automatically determines filters needed (country=US, category=Electronics), filters the already-loaded transactions in memory, and provides focused context to answer the question efficiently.

**Why this priority**: Core value proposition - maximizes use of already-loaded data, eliminates redundant database queries, and allows AI to work with precise subsets without reloading.

**Independent Test**: Can be fully tested by loading 5,000 transactions into session, then asking filtered questions and verifying only matching subset is passed to AI context (e.g., ask about "US companies" and verify only US transactions included in prompt). Delivers immediate value: faster responses, lower token usage, no context overflow.

**Acceptance Scenarios**:

1. **Given** session has 5,000 loaded transactions from multiple countries with variations like "US", "USA", "United States", **When** user asks "Show me US companies", **Then** AI analyzes query, applies smart filter (case-insensitive, contains match) on importCountry field (~500 transactions), provides answer using only US subset
2. **Given** session has transactions across all categories with raw data variations, **When** AI processes "Which company imported most electronics?", **Then** system applies fuzzy filter (lowercase, contains "electronic" OR "điện tử") to categoryName, analyzes matched subset
3. **Given** session has full-year data, **When** query mentions "Q1 2024", **Then** AI filters in-memory transactions by date range (Jan-Mar 2024) and works with that subset
4. **Given** session has multi-company data with name variations (e.g., "CÔNG TY ABC", "Cty ABC", "ABC Corp"), **When** query mentions "ABC", **Then** AI applies case-insensitive contains filter, matches all company name variations
5. **Given** ambiguous query with typos or partial text, **When** AI extracts filter criteria, **Then** system applies fuzzy matching (lowercase, trim whitespace, contains match) to find relevant transactions

---

### User Story 2 - Iterative Context Refinement (Priority: P1)

AI makes initial analysis with filtered subset of loaded data, determines if different/broader subset is needed, re-filters the in-memory transactions, and continues until confident answer is reached - supporting multiple refinement iterations within the loaded dataset.

**Why this priority**: Enables complex multi-step reasoning by intelligently selecting subsets from already-loaded data. Critical for token efficiency and scalability.

**Independent Test**: Load 5,000 transactions into session, ask multi-faceted question (e.g., "Compare top 3 companies' performance across all categories"). AI should work with different filtered views of the same loaded data without reloading from database.

**Acceptance Scenarios**:

1. **Given** user asks "Which company imported most?", **When** AI first analyzes aggregated statistics from loaded data, **Then** AI identifies top 3 companies, filters to only their transactions, provides detailed answer
2. **Given** AI needs verification, **When** initial analysis suggests CompanyX is top, **Then** AI re-filters loaded transactions to CompanyX + top 5 competitors for detailed comparison
3. **Given** multi-faceted question, **When** user asks "Analyze trends by category and country", **Then** AI makes 3-4 filtered views: filter by category, filter by country, filter by time periods - all from same loaded dataset
4. **Given** insufficient loaded data, **When** AI recognizes loaded transactions don't cover query scope (e.g., asking about 2023 data when only 2024 loaded), **Then** system requests user to reload session with broader filters
5. **Given** refinement loop limit, **When** AI has made 5 filtering iterations without high confidence, **Then** system provides best-effort answer with confidence disclaimer

---

### User Story 3 - Query Intent Analysis (Priority: P1)

System automatically classifies user questions into query types (aggregation-only, detail-required, trend-analysis, comparison, recommendation) and routes to appropriate data processing strategy to optimize token usage.

**Why this priority**: Foundation for intelligent routing - determines whether to use aggregations (50 bytes) or full transaction details (50KB). Prevents wasteful token usage.

**Independent Test**: Submit different question types and verify system uses correct strategy with appropriate data format.

**Acceptance Scenarios**:

1. **Given** aggregation question, **When** user asks "Which company imports the most?" or "What is the total export value?", **Then** AI recognizes as aggregation query, computes in-memory group-by/sum, passes only summary stats to AI (e.g., "CompanyA: $2.5M, CompanyB: $1.8M, CompanyC: $1.2M")
2. **Given** detail question, **When** user asks "Show me the top 5 transactions", **Then** AI recognizes need for full transaction details, includes complete records with all fields in context
3. **Given** trend question, **When** user asks "What is the import trend over time?", **Then** AI recognizes time-series analysis, computes monthly/quarterly aggregations in memory, provides trend data (e.g., "Jan: $500K, Feb: $650K, Mar: $720K...")
4. **Given** ranking question, **When** user asks "Which item is sold the most?" or "Which company has the most transactions?", **Then** AI groups by item/company, sorts by count, passes top-N summary to AI
5. **Given** recommendation question, **When** user asks "I want to export to the US, please suggest me some potential companies?", **Then** AI filters to US companies, aggregates by import volume/frequency, provides ranked recommendations with supporting data
6. **Given** value-based question, **When** user asks "Which item is the most valuable?", **Then** AI groups by item, aggregates total value, sorts by sum(totalValueUSD), passes top items with values to AI

---

### User Story 4 - Smart Context Window Management (Priority: P2)

System intelligently manages which subset of loaded transactions to include in AI context based on query relevance, keeping token usage within limits while maintaining conversation continuity.

**Why this priority**: Improves efficiency by using loaded data smartly - includes only relevant transactions in each AI prompt rather than always using full dataset.

**Independent Test**: Load 5,000 transactions into session, have multi-turn conversation where each question focuses on different aspects. Verify AI context includes only relevant subset for each query (e.g., first question about US → only US transactions in context, second question about electronics → only electronics in context).

**Acceptance Scenarios**:

1. **Given** session has 5,000 loaded transactions across multiple companies, **When** user asks about CompanyX, **Then** AI context includes only CompanyX's ~200 transactions, not all 5,000
2. **Given** user narrows focus, **When** conversation starts with "US companies" then asks "electronics only", **Then** system filters to intersection (US + electronics), uses only that subset in AI prompt
3. **Given** user broadens scope, **When** user asks about "all categories" after focusing on electronics, **Then** AI context expands to include all loaded transactions (up to token limit)
4. **Given** context size limit, **When** filtered subset still exceeds token budget, **Then** system applies smart sampling (top N by value, recent dates, diverse categories)
5. **Given** session reset, **When** user explicitly says "start fresh" in chat, **Then** system clears conversation history but retains loaded transactions for new queries

---

### User Story 5 - In-Memory Aggregations (Priority: P2)

System computes aggregations (count, sum, average, top-N, group-by) directly from loaded transactions in memory for statistical questions, passing only summary statistics to AI instead of full transaction details.

**Why this priority**: Performance optimization - "Which company imports the most?" can be answered with in-memory aggregation (200 bytes summary) vs loading all transaction details into AI context (500KB). 80% token reduction for common queries.

**Independent Test**: Load 5,000 transactions into session, ask statistics question and verify AI receives only aggregated summary (e.g., "CompanyA: $500K, CompanyB: $300K") not full transaction list.

**Acceptance Scenarios**:

1. **Given** count question, **When** user asks "Which company has the most transactions?", **Then** system groups by companyName, counts transactions per company, passes top companies with counts to AI (e.g., "CompanyA: 450 transactions, CompanyB: 380 transactions")
2. **Given** value question, **When** user asks "Which company imports the most?" or "What is the total export value?", **Then** system computes sum(totalValueUSD) grouped by company or total, passes aggregated values to AI
3. **Given** item-based question, **When** user asks "Which item is sold the most?" or "Which item has the most transactions?", **Then** system groups by goodsName, counts/sums metrics, passes top items ranked by count or value
4. **Given** value-ranking question, **When** user asks "Which item is the most valuable?", **Then** system groups by goodsName, sums totalValueUSD, sorts descending, passes top items with total values
5. **Given** time-series question, **When** user asks "What is the import trend over time?", **Then** system groups by month/quarter, aggregates totals per period, provides chronological trend data to AI
6. **Given** recommendation query, **When** user asks "I want to export to the US, please suggest me some potential companies?", **Then** system filters to importCountry='US', groups by company, aggregates import frequency/volume, passes ranked US companies with supporting metrics

---

### User Story 6 - Filter Expression Language (Priority: P3)

AI can express filter intent using structured format (e.g., "FILTER country=US AND category=Electronics AND date>=2024-01-01"), and system translates this into JavaScript filter logic applied to loaded transactions in memory.

**Why this priority**: Infrastructure for adaptive querying - allows AI to specify exactly what subset it needs using declarative syntax instead of having to analyze and filter manually.

**Independent Test**: Load 5,000 transactions, have AI generate filter expression, verify correct subset is selected from memory (e.g., filter "country=US" selects only 500 US transactions).

**Acceptance Scenarios**:

1. **Given** simple filter expression, **When** AI generates `FILTER importCountry=US`, **Then** system applies case-insensitive contains filter, matches "US", "USA", "United States" in importCountry field
2. **Given** multiple filters, **When** AI generates `FILTER importCountry=US AND categoryName=Electronics AND date>=2024-01-01`, **Then** system applies AND logic with smart matching: case-insensitive contains for text fields, standard comparison for dates
3. **Given** aggregation expression, **When** AI generates `AGGREGATE groupBy=companyName, sum=totalValueUSD, orderBy=sum DESC, limit=5`, **Then** system computes aggregation from loaded transactions and returns top 5 summary
4. **Given** sorting + limit, **When** AI generates `FILTER categoryName=Electronics ORDER BY totalValueUSD DESC LIMIT 10`, **Then** system filters and sorts loaded transactions, returns top 10
5. **Given** invalid syntax, **When** AI provides malformed expression, **Then** system returns validation error and AI can retry with corrected syntax

---

### Edge Cases

- What happens when AI makes 10+ filtering iterations in single query (infinite loop prevention)?
- How does system handle contradictory filters in conversation (e.g., first "US companies" then "Vietnamese companies" - mutually exclusive)?
- What if user asks question requiring data outside loaded session (e.g., asking about 2023 when only 2024 loaded)?
- How does system behave when in-memory filter returns empty result set (e.g., no transactions match "CompanyX AND Electronics")?
- What if raw data has inconsistent formats (e.g., "US", "USA", "United States", "Hoa Kỳ" all mean USA)?
- How to handle partial filter matches with typos (e.g., user searches "electonic" but data has "electronics")?
- How does system handle Vietnamese text filtering (diacritics, accented characters)?
- What if company names have extra whitespace, mixed case, or abbreviations (e.g., "CÔNG TY" vs "Cty" vs "CTY")?
- What happens if filtered subset is still too large for token budget (e.g., 3,000 US transactions exceed 64K context)?
- How does system prioritize which transactions to include when filtered subset exceeds token limit (sampling strategy)?
- What if loaded transactions are already filtered (e.g., user loaded only electronics) and AI tries to filter by different category?
- How to handle queries that need data not yet loaded (trigger re-load or inform user)?
- What happens to loaded transaction data when browser is refreshed or tab is closed? (Answer: Data remains in server memory until session expires; conversation history is lost)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: AI MUST analyze user question to extract filters (country, category, company, date range, value thresholds) that will be applied to already-loaded transactions using smart matching
- **FR-001a**: Filter matching MUST apply smart techniques for raw data: case-insensitive comparison (convert to lowercase), trim whitespace, contains match (substring search), normalize Vietnamese text (optional diacritics handling)
- **FR-001b**: String filters MUST support multiple matching strategies: exact match, contains match, starts-with match, fuzzy match (Levenshtein distance for typos)
- **FR-001c**: System MUST normalize filter values and data values before comparison: lowercase conversion, whitespace trimming, special character handling
- **FR-002**: System MUST support iterative refinement where AI can request different filtered views of loaded data through multiple filtering operations in single user query
- **FR-003**: System MUST classify query intent into types: aggregation-only, detail-required, trend-analysis, comparison, recommendation, ranking to determine optimal data presentation
- **FR-004**: System MUST provide filter execution engine that accepts structured filter specifications from AI and applies them to in-memory transactions (JavaScript filter functions) with smart matching:
  - Case-insensitive string comparison for all text fields
  - Contains matching by default (not exact match) for company names, categories, goods names
  - Trim whitespace from both filter values and data values
  - Support synonym matching (e.g., "US" matches "USA", "United States", "Hoa Kỳ")
  - Handle Vietnamese text with or without diacritics (optional normalization)
- **FR-005**: System MUST compute aggregations (count, sum, average, top-N, group-by, ranking) directly from loaded transactions in memory for statistical queries including:
  - Company rankings by value: "Which company imports the most?"
  - Transaction counts: "Which company has the most transactions?"
  - Item popularity: "Which item is sold the most?" / "Which item has the most transactions?"
  - Item value: "Which item is the most valuable?"
  - Time-series trends: "What is the import trend over time?"
  - Total aggregations: "What is the total export value?"
  - Filtered recommendations: "I want to export to the US, suggest companies"
- **FR-006**: System MUST maintain session state tracking what transactions are loaded and what filters have been applied in conversation (single active session per user)
- **FR-007**: System MUST enforce filtering iteration limit (maximum 10 filter operations per user question) to prevent infinite loops
- **FR-008**: AI MUST estimate confidence based on available data coverage and automatically request different filter view or inform user if loaded data insufficient
- **FR-009**: System MUST log all filter operations and aggregations for debugging and performance analysis
- **FR-010**: System MUST support both narrowing filters (reduce working set) and broadening filters (expand to full loaded dataset)
- **FR-011**: System MUST handle ambiguous queries by using smart defaults (e.g., "recent" = last 6 months of loaded data) or asking for clarification
- **FR-012**: System MUST return metadata with each filter operation: transactions matched, transactions total in session, filter execution time, filter criteria applied

### Key Entities *(include if feature involves data)*

- **QueryIntent**: Classification of user question type (aggregation, detail, trend, comparison, recommendation, ranking), extracted filter criteria, required data scope relative to loaded transactions, examples:
  - Aggregation: "Which company imports the most?", "What is the total export value?"
  - Ranking: "Which item is sold the most?", "Which company has the most transactions?"
  - Trend: "What is the import trend over time?"
  - Recommendation: "I want to export to the US, suggest companies"
- **FilterExpression**: AI-generated specification for in-memory filtering (field, operator, value, logical connectors, match strategy), JavaScript filter function generator with smart matching support:
  - Operators: equals, contains, startsWith, greaterThan, lessThan, between, in
  - Match strategies: exact, fuzzy, case-insensitive, normalized (whitespace trim)
  - Text normalization: lowercase conversion, Vietnamese diacritics handling, special character removal
- **SessionMetadata**: Session state information (session ID, creation time, last activity time, transaction count, data summary), used for tracking current session state
- **ContextState**: Tracks loaded transactions in session (transaction array, metadata, current filter view), maintains conversation history with filter operations, linked to session ID
- **AggregationResult**: In-memory computed statistics (counts, sums, averages, top-N lists, group-by results, rankings), formatted summaries for AI consumption, supports multiple aggregation types:
  - Company rankings by value/count
  - Item popularity by transaction count
  - Item value rankings by total revenue
  - Time-series aggregations by period
  - Filtered recommendations with supporting metrics
- **FilterLog**: Audit trail of filter operations (timestamp, filter expression, transactions matched, execution time), used for debugging and optimization

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: AI can answer filtered questions (e.g., "US companies in Q1") by working with filtered subset of loaded data (target: pass only 500 relevant transactions to AI context from 5,000 loaded), smart filtering catches 95%+ variations (e.g., "US", "USA", "United States" all matched)
- **SC-002**: In-memory aggregation queries (count, sum, top-N) compute in <100ms and pass only summary (50-500 bytes) to AI instead of full transaction details
- **SC-003**: Multi-turn conversations reuse loaded data efficiently - 2nd question applies new filter to same in-memory dataset in <200ms (no database reload)
- **SC-004**: AI reaches high-confidence answers (>80%) within 3 filtering iterations for 90% of queries (measured: filter count per query)
- **SC-005**: System handles large loaded datasets - successfully filters and aggregates 10,000+ transactions in memory without performance degradation
- **SC-006**: Token usage reduced by 80% for statistical questions compared to current implementation (measured: tokens per query using aggregations vs full transaction details)
- **SC-007**: Query intent classification achieves >90% accuracy (measured: AI correctly identifies whether aggregation-only vs detail-required)
- **SC-008**: Zero context truncation errors with loaded data - filtered subsets always fit within 64K token budget (measured: no "prompt too long" failures)
- **SC-015**: Smart filtering achieves >95% recall on raw data variations - catches common misspellings, case variations, whitespace issues, abbreviations (measured: manual test with known variations)
- **SC-009**: System prevents infinite loops - no query exceeds 10 filtering iterations (measured: filter operation count per query)
- **SC-010**: Users can work with realistic session sizes (up to 10,000 transactions loaded) and AI intelligently filters to relevant subsets for each question
