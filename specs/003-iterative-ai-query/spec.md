# Feature Specification: Iterative AI Query System

**Feature Branch**: `003-iterative-ai-query`  
**Created**: 2025-11-28  
**Status**: Draft  
**Input**: User description: "In current AI analysis. We process and user question in 3 phases - Based on the user question. Compute the query intent use AI - Based on the intent we filter, aggregations the data to limit the transaction and compute the final data - Give the final data to the AI to get the question I want to improve this follow, Now i want - We have a query intent query struct as a tool for AI to query the data. We will let the AI know the tool and how to use it - Based on the user question, the AI should let the application know which data the AI want. - The AI able to ask the application to query the data multiple times util the AI think it's enough data - When the AI get the invalid data or AI think the data should not like that. They should able to detect it and might ask the application provide data again - The AI and application communicate use query intent. Because the application just know only query intent. - Keep the current query intent function. No change"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - AI Iteratively Refines Data Requests (Priority: P1)

An AI system processing a complex user question needs to gather and validate data through multiple requests to the application, iterating until it has sufficient and valid data to provide a comprehensive answer.

**Why this priority**: This is the core capability that enables autonomous data exploration by AI, allowing it to handle complex queries that require multiple data perspectives without human intervention.

**Independent Test**: Can be fully tested by asking the AI a complex question (e.g., "Compare electronics import trends between US and China companies with analysis of pricing patterns") and verifying the AI makes multiple data requests with different query intents until it gathers sufficient data for analysis.

**Acceptance Scenarios**:

1. **Given** a complex user question requiring multiple data perspectives, **When** the AI processes the initial question, **Then** it should generate an appropriate QueryIntent structure to request initial data from the application
2. **Given** the AI receives initial data from the application, **When** it analyzes the data and determines more information is needed, **Then** it should generate additional QueryIntent requests with different filters or aggregations
3. **Given** the AI receives data that appears invalid or insufficient, **When** it detects data quality issues, **Then** it should generate new QueryIntent requests with modified parameters to obtain better data

---

### User Story 2 - Application Responds to Dynamic Query Intents (Priority: P1)

The application receives structured QueryIntent requests from the AI and provides corresponding data, enabling the AI to dynamically explore the dataset without requiring predefined query patterns.

**Why this priority**: This enables the application to serve as a flexible data provider for AI exploration, essential for the iterative communication pattern.

**Independent Test**: Can be tested by sending various QueryIntent structures to the application and verifying it returns appropriate filtered/aggregated data according to the intent specifications.

**Acceptance Scenarios**:

1. **Given** a QueryIntent with specific filters, **When** the application processes the intent, **Then** it should return filtered transaction data matching the criteria
2. **Given** a QueryIntent with aggregation requirements, **When** the application processes the intent, **Then** it should return aggregated results (counts, sums, averages) according to the specifications
3. **Given** a QueryIntent with invalid or unsupported parameters, **When** the application processes the intent, **Then** it should return an error message explaining the limitations

---

### User Story 3 - AI Validates Data Quality and Requests Refinement (Priority: P2)

When the AI receives data from the application, it validates the data quality and completeness, and can request different data if the current dataset is insufficient for answering the user's question.

**Why this priority**: This ensures the AI can autonomously detect and handle data quality issues, improving answer accuracy and user satisfaction.

**Independent Test**: Can be tested by providing incomplete or invalid data to the AI and verifying it detects the issues and requests better data through modified QueryIntent structures.

**Acceptance Scenarios**:

1. **Given** the AI receives data with very few transactions, **When** it assesses data sufficiency, **Then** it should request broader criteria through a modified QueryIntent
2. **Given** the AI receives data missing key fields, **When** it validates data completeness, **Then** it should request additional fields or different aggregation through new QueryIntent
3. **Given** the AI receives contradictory or suspicious data patterns, **When** it analyzes data validity, **Then** it should request verification data through alternative QueryIntent approaches

---

### Edge Cases

- **Infinite Loop Prevention**: System enforces configurable maximum iteration limit (default: 20 requests per user question) to prevent endless QueryIntent cycles
- **No Matching Data**: When QueryIntent criteria return empty results, application provides this empty dataset to AI as valid data for analysis
- **Application Processing Errors**: System distinguishes between invalid QueryIntent format (inform AI for correction) vs unknown system errors (respond error to user)
- **Timeout Handling**: AI waits for application response without timeout limits, allowing complex data processing to complete

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: AI MUST be able to generate QueryIntent structures as tools to request specific data from the application based on user questions
- **FR-002**: Application MUST respond to QueryIntent requests with filtered and/or aggregated transaction data according to the intent specifications
- **FR-003**: AI MUST be able to make multiple sequential QueryIntent requests until it determines sufficient data has been gathered
- **FR-004**: AI MUST validate received data quality and completeness before proceeding with answer generation
- **FR-005**: AI MUST detect invalid, insufficient, or suspicious data patterns and request alternative data through modified QueryIntent structures
- **FR-006**: System MUST preserve existing QueryIntent classification functionality without any changes to current implementation
- **FR-007**: Application MUST communicate exclusively through QueryIntent structures - no direct data access by AI
- **FR-008**: AI MUST have knowledge of available QueryIntent tool structure and how to construct valid requests through embedded schema documentation
- **FR-012**: System MUST log all QueryIntent requests and responses for debugging and optimization purposes
- **FR-013**: System MUST enforce configurable maximum iteration limit (default 20) to prevent infinite QueryIntent request loops
- **FR-009**: System MUST provide clear error messages when QueryIntent requests cannot be fulfilled
- **FR-010**: AI MUST be able to refine QueryIntent parameters (filters, aggregations, limits) based on received data analysis
- **FR-011**: Application MUST return empty datasets as valid responses when QueryIntent criteria match no data
- **FR-012**: System MUST distinguish between invalid QueryIntent errors (return to AI for correction) and unknown system errors (display error to user)
- **FR-013**: AI MUST wait indefinitely for application QueryIntent responses without implementing timeout mechanisms

### Key Entities

- **QueryIntent**: Structured data request containing filters, aggregations, limits, and ordering specifications used for AI-application communication
- **DataValidationResult**: Assessment of received data quality including completeness, validity, and sufficiency indicators  
- **IterativeQuerySession**: Tracking structure for multiple QueryIntent requests within a single user question processing session
- **DataRequestLog**: Audit trail of all QueryIntent requests, responses, and AI decision points during iterative querying process
- **IterationConfiguration**: System settings controlling maximum request limits, timeout behaviors, and error handling policies for QueryIntent cycles

## AI Tool Documentation *(implementation reference)*

### QueryIntent Tool Schema

The AI system uses QueryIntent structures to request data from the application. Based on the transaction analysis system implementation:

**Available Transaction Fields**:
```
1. declarationNumber: string (e.g., "DEC-2024-001", "VN123456")
2. date: string (YYYY-MM-DD format, e.g., "2024-01-15")
3. importCompanyName: string (e.g., "CÔNG TY ABC", "XYZ Corporation")
4. importCompanyAddress: string (e.g., "123 Main St, Hanoi")
5. importCountry: string (e.g., "United States", "Vietnam", "China")
6. goodsName: string (e.g., "Laptop Dell Inspiron 15")
7. quantity: number (e.g., 100, 500)
8. unit: string (e.g., "pcs", "kg", "cái", "chiếc")
9. unitPriceUSD: number (e.g., 299.99, 1500.50)
10. totalValueUSD: number (e.g., 50000.00, 125000.00)
```

**QueryIntent Structure**:
```typescript
{
  type: "aggregation" | "detail" | "trend" | "comparison" | "recommendation" | "ranking",
  filters: FilterExpression[],
  aggregations?: AggregationSpec[],
  limit?: number,
  orderBy?: string,
  confidence: number // 0-1
}
```

**FilterExpression Structure**:
```typescript
{
  field: string,
  operator: "equals" | "contains" | "startsWith" | "greaterThan" | "lessThan" | "between" | "in",
  value: string | number | Array<string | number>,
  matchStrategy?: "exact" | "fuzzy" | "case-insensitive" | "normalized",
  fuzzyThreshold?: number, // 0-5 for fuzzy matching
  logicalOperator?: "AND" | "OR" // default: AND
}
```

**Filter Operations by Field Type**:
- **String fields**: equals, contains, startsWith, in
- **Number fields**: equals, greaterThan, lessThan, between, in  
- **Date fields**: equals, greaterThan, lessThan, between

**Match Strategies** (for string fields):
- **exact**: Case-sensitive exact match
- **case-insensitive**: Ignore case differences
- **normalized**: Remove diacritics, trim whitespace, ignore case
- **fuzzy**: Allow spelling variations (fuzzyThreshold 0-5)

**Logical Operators**:
- **AND**: All filters must match (default)
- **OR**: Any filter can match

**Aggregation Operations**:
- **count**: Count records (any field)
- **sum, average, min, max**: Numeric fields only (quantity, unitPriceUSD, totalValueUSD)
- **groupBy**: Group results by importCompanyName, importCountry, month, year

**AI Tool Usage Examples**:

*Initial broad data request:*
```json
{
  "type": "aggregation",
  "filters": [],
  "aggregations": [{"field": "totalValueUSD", "operation": "sum", "groupBy": "importCountry"}],
  "limit": 10,
  "confidence": 0.8
}
```

*Refined specific filter request:*
```json
{
  "type": "detail", 
  "filters": [
    {
      "field": "goodsName", 
      "operator": "contains", 
      "value": "Laptop",
      "matchStrategy": "case-insensitive"
    },
    {
      "field": "totalValueUSD", 
      "operator": "greaterThan", 
      "value": 50000
    }
  ],
  "limit": 50,
  "confidence": 0.9
}
```

*Validation follow-up request:*
```json
{
  "type": "aggregation",
  "filters": [
    {
      "field": "importCountry", 
      "operator": "equals", 
      "value": "United States",
      "matchStrategy": "normalized"
    }
  ],
  "aggregations": [{"field": "importCompanyName", "operation": "count"}],
  "confidence": 0.7
}
```

*Complex filter with OR logic:*
```json
{
  "type": "detail",
  "filters": [
    {
      "field": "importCountry",
      "operator": "equals", 
      "value": "United States",
      "logicalOperator": "OR"
    },
    {
      "field": "importCountry",
      "operator": "equals",
      "value": "China"
    }
  ],
  "limit": 100,
  "confidence": 0.8
}
```

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: AI can successfully process complex queries requiring multiple data perspectives through iterative QueryIntent requests in under 30 seconds
- **SC-002**: System supports up to 10 sequential QueryIntent requests per user question without performance degradation  
- **SC-003**: AI achieves 90% accuracy in detecting insufficient or invalid data and requesting appropriate refinements
- **SC-004**: Application processes QueryIntent requests and returns filtered/aggregated data within 2 seconds per request
- **SC-005**: System prevents infinite iteration loops by enforcing maximum request limits with 100% reliability
- **SC-006**: AI successfully gathers sufficient data for complex analysis in 3-5 QueryIntent iterations on average
- **SC-007**: All QueryIntent communication between AI and application is successfully logged and auditable for debugging purposes
- **SC-008**: AI successfully handles empty query results as valid data in 100% of cases without requesting alternative data
- **SC-009**: System correctly categorizes and routes 95% of application errors (invalid QueryIntent vs system errors) to appropriate handlers

## Assumptions

- The current QueryIntent structure and classification functions are mature and stable, requiring no modifications
- The existing transaction dataset contains sufficient variety and volume to support iterative exploration
- The AI model has adequate context window to maintain conversation state across multiple QueryIntent interactions
- Network latency between AI and application components is minimal (under 100ms) for responsive iteration
- Users expect AI to autonomously explore data without requiring detailed query specification knowledge
- System administrators can configure iteration limits with reasonable defaults to prevent resource exhaustion
- Empty query results are considered valid data scenarios that AI should handle gracefully
- Application response times may vary significantly based on query complexity and data volume

## Clarifications

### Session 2025-11-28

- Q: How should the AI receive knowledge of available QueryIntent tool structure? → A: Embedded schema documentation - The AI receives the QueryIntent structure definition and usage examples as part of its system prompt, allowing it to construct valid requests consistently.
