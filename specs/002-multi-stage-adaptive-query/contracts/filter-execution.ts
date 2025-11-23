/**
 * API Contract: Filter Execution Engine
 * 
 * Provides in-memory filtering of loaded transactions with smart text matching
 * (case-insensitive, contains, Vietnamese normalization, fuzzy matching).
 */

// Note: Transaction type will be imported from actual model in implementation
type Transaction = Record<string, unknown>;

// ============================================================================
// Request/Response Types
// ============================================================================

export interface FilterRequest {
  sessionId: string;
  filters: FilterExpression[];
  options?: FilterOptions;
}

export interface FilterExpression {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'greaterThan' | 'lessThan' | 'between' | 'in';
  value: string | number | string[];
  matchStrategy?: 'exact' | 'fuzzy' | 'case-insensitive' | 'normalized';
  fuzzyThreshold?: number; // 0-5, default 2
  logicalOperator?: 'AND' | 'OR'; // For combining with next filter
}

export interface FilterOptions {
  removeDiacritics?: boolean; // Vietnamese text normalization
  synonyms?: Record<string, string[]>; // Custom synonym mappings
  logExecution?: boolean; // Save to FilterLog
}

export interface FilterResponse {
  success: boolean;
  sessionId: string;
  matchedTransactions: Transaction[];
  metadata: FilterMetadata;
  error?: string;
}

export interface FilterMetadata {
  matchedCount: number;
  totalCount: number;
  executionTimeMs: number;
  appliedFilters: FilterExpression[];
  filterLogId?: string; // Reference to FilterLog entry
}

// ============================================================================
// Text Normalization Types
// ============================================================================

export interface NormalizationOptions {
  caseSensitive?: boolean; // Default: false
  trimWhitespace?: boolean; // Default: true
  matchStrategy?: 'exact' | 'contains' | 'startsWith' | 'fuzzy'; // Default: 'contains'
  removeDiacritics?: boolean; // Default: false (opt-in for Vietnamese)
  synonyms?: Record<string, string[]>; // Canonical form → variants
  fuzzyThreshold?: number; // Levenshtein distance (0-5), default 2
}

// ============================================================================
// API Endpoints (Next.js API Routes)
// ============================================================================

/**
 * POST /api/ai/filter
 * 
 * Apply filters to loaded transactions in session.
 * 
 * Request Body: FilterRequest
 * Response: FilterResponse (200) or Error (400/404/500)
 * 
 * Example:
 * ```
 * POST /api/ai/filter
 * {
 *   "sessionId": "a1b2c3d4-...",
 *   "filters": [
 *     {
 *       "field": "importCountry",
 *       "operator": "contains",
 *       "value": "US",
 *       "matchStrategy": "normalized"
 *     }
 *   ],
 *   "options": {
 *     "logExecution": true
 *   }
 * }
 * ```
 * 
 * Response:
 * ```
 * {
 *   "success": true,
 *   "sessionId": "a1b2c3d4-...",
 *   "matchedTransactions": [...],
 *   "metadata": {
 *     "matchedCount": 487,
 *     "totalCount": 5247,
 *     "executionTimeMs": 12,
 *     "appliedFilters": [...]
 *   }
 * }
 * ```
 */

// ============================================================================
// Filter Execution Functions (lib/ai/filter-engine.ts)
// ============================================================================

/**
 * Execute filter expressions on in-memory transaction array.
 * 
 * @param transactions - Array of loaded transactions
 * @param filters - Array of filter expressions (combined with AND/OR logic)
 * @param options - Normalization options
 * @returns Filtered transaction array
 */
export declare function executeFilters(
  transactions: Transaction[],
  filters: FilterExpression[],
  options?: FilterOptions
): Transaction[];

/**
 * Apply single filter expression to transactions.
 * 
 * @param transactions - Array to filter
 * @param filter - Single filter expression
 * @param options - Normalization options
 * @returns Filtered array
 */
export declare function applyFilter(
  transactions: Transaction[],
  filter: FilterExpression,
  options?: FilterOptions
): Transaction[];

/**
 * Check if transaction matches filter expression with smart text matching.
 * 
 * @param transaction - Transaction to test
 * @param filter - Filter expression
 * @param options - Normalization options
 * @returns true if transaction matches filter
 */
export declare function matchesFilter(
  transaction: Transaction,
  filter: FilterExpression,
  options?: FilterOptions
): boolean;

// ============================================================================
// Text Normalization Functions (lib/ai/text-normalizer.ts)
// ============================================================================

/**
 * Normalize text for comparison (case, whitespace, diacritics).
 * 
 * @param text - Input text
 * @param options - Normalization options
 * @returns Normalized text
 */
export declare function normalizeText(
  text: string,
  options: NormalizationOptions
): string;

/**
 * Remove Vietnamese diacritics from text.
 * 
 * @param text - Input text with diacritics
 * @returns Text with diacritics removed
 * 
 * Example: "điện tử" → "dien tu"
 */
export declare function removeDiacritics(text: string): string;

/**
 * Check if two strings match using synonym mappings.
 * 
 * @param value1 - First value
 * @param value2 - Second value
 * @param synonyms - Synonym mappings (canonical → variants)
 * @returns true if values are synonyms
 * 
 * Example: checkSynonyms("US", "United States", countrySynonyms) → true
 */
export declare function checkSynonyms(
  value1: string,
  value2: string,
  synonyms: Record<string, string[]>
): boolean;

/**
 * Calculate Levenshtein distance between two strings (typo tolerance).
 * 
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance (0 = identical)
 * 
 * Example: levenshteinDistance("electonic", "electronic") → 1
 */
export declare function levenshteinDistance(str1: string, str2: string): number;

// ============================================================================
// Configuration (lib/ai/synonyms.json)
// ============================================================================

/**
 * Default synonym mappings loaded from synonyms.json.
 * 
 * Structure:
 * {
 *   "countries": {
 *     "United States": ["US", "USA", "United States", "Hoa Kỳ", "America"]
 *   },
 *   "companies": {
 *     "CÔNG TY": ["CÔNG TY", "Cty", "CTY", "Co.", "Company"]
 *   }
 * }
 */
export declare const defaultSynonyms: {
  countries: Record<string, string[]>;
  companies: Record<string, string[]>;
};

// ============================================================================
// Error Types
// ============================================================================

export class FilterExecutionError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_FILTER' | 'SESSION_NOT_FOUND' | 'NO_DATA_LOADED' | 'EXECUTION_FAILED',
    public details?: unknown
  ) {
    super(message);
    this.name = 'FilterExecutionError';
  }
}

// ============================================================================
// Performance Targets
// ============================================================================

/**
 * Performance Requirements (from spec):
 * - Filter execution: <100ms for 10,000 transactions
 * - Smart matching overhead: <10ms per filter expression
 * - Fuzzy matching: <50ms for 10,000 string comparisons
 * 
 * Success Criteria:
 * - SC-001: Filter 5,000 → 500 transactions in <100ms
 * - SC-015: >95% recall on data variations
 */
