# Feature Specification: RAG-based Query Endpoint

**Feature Branch**: `002-rag-query-endpoint`  
**Created**: November 23, 2025  
**Status**: Draft  
**Input**: User description: "currently, the query endpoint will get all the transactions and call to AI to query one time. It's not scale for milion of transactions. I want to update it to RAG instead."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Query Large Datasets Efficiently (Priority: P1)

An analyst needs to ask questions about transaction data when the dataset contains millions of records. The system retrieves only the most relevant transactions to answer each question, rather than loading all data into memory and processing it at once. This allows queries to return accurate answers within seconds, even with datasets that would otherwise exceed system capacity.

**Why this priority**: Core value proposition - enables the system to scale from thousands to millions of transactions without performance degradation or memory overflow. Without this, the system becomes unusable at scale.

**Independent Test**: Can be fully tested by loading 1 million transaction records, asking analytical questions (e.g., "Which company imported the most in Q4 2024?"), and verifying the system returns accurate answers within 10 seconds while using reasonable memory.

**Acceptance Scenarios**:

1. **Given** a session with 1 million transaction records, **When** an analyst asks "What is the total export value?", **Then** the system retrieves relevant aggregated data and returns an accurate answer within 10 seconds
2. **Given** a session with 500,000 transaction records, **When** an analyst asks "Which top 5 companies have the highest import volumes?", **Then** the system identifies and retrieves only the relevant company transactions and provides accurate rankings
3. **Given** a session with 2 million transaction records, **When** an analyst asks about a specific date range or category, **Then** the system filters and retrieves only transactions matching those criteria before processing the query

---

### User Story 2 - Maintain Query Accuracy with Citations (Priority: P2)

An analyst receives answers to queries with proper citations referencing the source transactions. The system retrieves relevant transactions using similarity search, then grounds its responses in the actual retrieved data. All answers include references to specific transactions that support the conclusions.

**Why this priority**: Ensures trust and verifiability - users need to validate AI answers against source data. Citations are critical for business decisions based on analysis.

**Independent Test**: Can be tested by asking specific questions, verifying the answer accuracy against the database, and confirming that all claims in the response cite specific transaction IDs or ranges.

**Acceptance Scenarios**:

1. **Given** a query about a specific company, **When** the system retrieves relevant transactions for that company, **Then** the answer cites specific transaction numbers that can be verified
2. **Given** a query requiring calculations, **When** the system retrieves data and performs aggregations, **Then** the response shows the calculation steps and references the transaction groups used
3. **Given** insufficient data to answer a question, **When** no relevant transactions are found, **Then** the system explicitly states "No relevant data found to answer this question" rather than guessing

---

### User Story 3 - Handle Conversational Query Context (Priority: P3)

An analyst can ask follow-up questions that reference previous queries in the same session. The system maintains conversation context and retrieves additional relevant transactions as needed for each new question, understanding references like "what about last month?" or "compare that to the previous company."

**Why this priority**: Enables natural conversation flow for iterative analysis. Users shouldn't need to repeat full context for each question. Enhances user experience but not critical for basic functionality.

**Independent Test**: Can be tested by conducting a multi-turn conversation (e.g., "Who are the top importers?" → "What categories does the first company import?" → "Show their trend over time"), verifying each answer is contextually appropriate.

**Acceptance Scenarios**:

1. **Given** a previous query about "top 5 companies", **When** the analyst asks "What are their main product categories?", **Then** the system retrieves transaction data for those 5 companies and analyzes their categories
2. **Given** a conversation about Company X, **When** the analyst asks "How does that compare to Company Y?", **Then** the system retrieves data for both companies and provides a comparative analysis
3. **Given** multiple questions in a session, **When** the analyst asks "summarize what we've discussed", **Then** the system references the conversation history and retrieved data across all queries

---

### Edge Cases

- What happens when the query would require retrieving more data than the system can process in one request (e.g., asking for details on 100,000 specific transactions)?
- How does the system handle queries where the semantic search returns no relevant results or very low relevance scores?
- What happens when the transaction data has been updated or deleted since it was indexed for retrieval?
- How does the system behave when the vector database or embedding service is unavailable?
- What happens with queries that are ambiguous or could match many different transaction patterns?
- How does the system handle extremely long conversations where context accumulates beyond model limits?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create searchable representations of transaction records that capture the meaning and relationships between transaction attributes (company, product, category, date, value, country)
- **FR-002**: System MUST store transaction representations in a structure that enables fast searching across millions of records
- **FR-003**: System MUST convert user queries into searchable format using the same method as transaction data
- **FR-004**: System MUST retrieve the most relevant transactions for each query based on semantic meaning match between the query and transaction records
- **FR-005**: System MUST include only retrieved relevant transactions as context when generating AI responses, rather than including all transactions
- **FR-006**: System MUST limit retrieved context to a size that can be processed efficiently while maintaining answer quality
- **FR-007**: System MUST update searchable transaction index whenever new data is added to the session to maintain search accuracy
- **FR-008**: System MUST provide citations in responses that reference the specific retrieved transactions used to formulate the answer
- **FR-009**: System MUST handle queries when no relevant transactions are found by informing the user rather than generating unsupported answers
- **FR-010**: System MUST maintain conversation history and use it to improve retrieval relevance for follow-up questions
- **FR-011**: System MUST return query results within 10 seconds for datasets up to 1 million transactions
- **FR-012**: System MUST handle failures in creating searchable representations gracefully without crashing the query endpoint
- **FR-013**: System MUST support updating the search index when transaction data is modified or deleted
- **FR-014**: System MUST preserve existing query API interface so clients don't require changes

### Key Entities

- **Transaction Search Representation**: Searchable form of a transaction capturing semantic meaning of its attributes (company name, product category, import country, quantity, price, date). Used for matching relevant transactions to queries.
- **Transaction Search Index**: Searchable structure storing all transaction representations with references to original transaction records. Enables fast searching for relevant transactions across millions of records.
- **Retrieved Transaction Set**: Subset of transactions retrieved for a specific query based on relevance to the question. Contains the most relevant transactions that will be used to answer the query.
- **Query Search Representation**: Searchable form of a user's natural language question. Used to find matching transaction representations in the index.
- **Session Search Index**: Association between an AI session and its transaction search index. Each session maintains its own index of the transaction data that was fed into it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: System can process queries on datasets containing 1 million transactions within 10 seconds per query
- **SC-002**: Query response accuracy (measured by citation correctness) maintains 95% or higher when compared to responses from the current full-data approach for datasets under 10,000 transactions
- **SC-003**: Memory usage during query processing remains under 2GB regardless of total transaction count in the session
- **SC-004**: System successfully retrieves and uses relevant transactions for 90% of queries (10% may legitimately have no relevant data)
- **SC-005**: 95% of queries return with proper citations referencing specific retrieved transactions
- **SC-006**: System handles 100 concurrent query requests without performance degradation beyond 15 seconds response time
- **SC-007**: Indexing time for 100,000 new transactions completes within 60 seconds
- **SC-008**: Follow-up questions in a conversation retrieve contextually relevant additional data in 85% of cases

## Assumptions

1. **Search Representation Method**: The system will use a standard method for converting text to searchable format that works well with Vietnamese and English text. The specific technique is an implementation detail.

2. **Relevance Threshold**: A minimum relevance score will be used to filter retrieved transactions, ensuring only sufficiently relevant data is used. This threshold may need tuning based on system characteristics.

3. **Retrieval Count**: A default number of most relevant transactions will be retrieved to provide sufficient context for most queries. This can be adjusted for complex queries requiring more context.

4. **Indexing Strategy**: Initial implementation will rebuild the entire search index when new data is added. Optimization for partial updates can be added later if needed.

5. **Storage Approach**: Transaction search representations will be stored per session, similar to how transaction data is currently stored. For production scale beyond millions of records, alternative storage approaches may be needed, but that's outside this feature scope.

6. **Session Lifecycle**: Search indexes follow the same lifecycle as session data - created when data is fed, expire with session timeout.

7. **Storage Requirements**: Each transaction's searchable representation will require additional storage beyond the original transaction data, but within reasonable memory limits for the system.

8. **Query Language**: System will continue to support queries in Vietnamese (primary) and English, with the search mechanism capable of handling both.

9. **Data Format**: Transaction attributes will be organized into a searchable text format that captures key information like company, category, country, date, and value.

10. **Backward Compatibility**: Existing sessions and their data will continue to work with the current approach until they expire naturally. New sessions will use the new retrieval-based approach.

## Out of Scope

- External database integration for search index storage (keeping session-based storage for this iteration)
- Custom training of search models
- Multi-language search optimization beyond basic support
- Real-time partial index updates (will rebuild on data changes)
- Query result caching or optimization
- Advanced search strategies beyond basic relevance matching
- Data compression techniques
- Distributed query processing across multiple servers
- Migration of existing active sessions to use new retrieval approach
