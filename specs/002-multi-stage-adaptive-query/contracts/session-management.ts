/**
 * API Contract: Session Management
 *
 * Manages multiple AI analysis sessions with CRUD operations,
 * localStorage persistence, and session metadata tracking.
 */

// Note: Transaction type will be imported from actual model in implementation
type Transaction = Record<string, unknown>;

// ============================================================================
// Request/Response Types
// ============================================================================

export interface CreateSessionRequest {
  initialData?: {
    transactions?: Transaction[];
    filters?: Record<string, unknown>;
  };
}

export interface CreateSessionResponse {
  success: boolean;
  session: SessionMetadata;
  error?: string;
}

export interface GetSessionRequest {
  sessionId: string;
}

export interface GetSessionResponse {
  success: boolean;
  session: SessionMetadata;
  context: ContextState;
  error?: string;
}

export interface ListSessionsResponse {
  success: boolean;
  sessions: SessionMetadata[];
  activeSessionId?: string;
}

export interface UpdateSessionRequest {
  sessionId: string;
  updates: {
    lastActivityAt?: string;
    transactionCount?: number;
    dataSourceInfo?: Partial<DataSourceInfo>;
  };
}

export interface UpdateSessionResponse {
  success: boolean;
  session: SessionMetadata;
  error?: string;
}

export interface DeleteSessionRequest {
  sessionId: string;
  switchToSessionId?: string; // Optional: switch to this session after deletion
}

export interface DeleteSessionResponse {
  success: boolean;
  deletedSessionId: string;
  activeSessionId?: string; // Session switched to (if any)
  error?: string;
}

// ============================================================================
// Core Data Types
// ============================================================================

export interface SessionMetadata {
  sessionId: string; // UUID
  createdAt: string; // ISO 8601
  lastActivityAt: string; // ISO 8601
  transactionCount: number;
  dataSourceInfo: DataSourceInfo;
}

export interface DataSourceInfo {
  dateRange?: {
    from: string;
    to: string;
  };
  topCompanies?: string[]; // Top 3 by transaction count
  topCategories?: string[]; // Top 3 by transaction count
  totalValue?: number; // Sum of totalValueUSD
}

export interface ContextState {
  sessionId: string;
  loadedTransactions: Transaction[];
  currentFilterView: Transaction[];
  conversationHistory: ConversationMessage[];
  appliedFilters: FilterLog[];
  aggregationCache?: AggregationCache;
  status: "empty" | "loading" | "ready" | "filtering" | "error";
  errorMessage?: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  metadata?: {
    queryIntent?: QueryIntent;
    filterResults?: FilterMetadata;
    aggregationResults?: AggregationResult;
  };
}

export interface FilterLog {
  timestamp: string;
  sessionId: string;
  filterExpression: FilterExpression;
  matchedCount: number;
  totalCount: number;
  executionTimeMs: number;
  resultSample?: Transaction[]; // First 5 for debugging
}

export interface AggregationCache {
  byCompany: Map<string, { count: number; totalValue: number }>;
  byGoodsName: Map<string, { count: number; totalValue: number }>;
  byCategory: Map<string, { count: number; totalValue: number }>;
  byMonth: Map<string, { count: number; totalValue: number }>;
  totalValue: number;
  totalCount: number;
  lastUpdated: number;
}

export interface QueryIntent {
  type:
    | "aggregation"
    | "detail"
    | "trend"
    | "comparison"
    | "recommendation"
    | "ranking";
  filters: FilterExpression[];
  aggregations?: AggregationSpec[];
  limit?: number;
  orderBy?: {
    field: string;
    direction: "asc" | "desc";
  };
  confidence: number;
}

export interface FilterExpression {
  field: string;
  operator:
    | "equals"
    | "contains"
    | "startsWith"
    | "greaterThan"
    | "lessThan"
    | "between"
    | "in";
  value: string | number | string[];
  matchStrategy?: "exact" | "fuzzy" | "case-insensitive" | "normalized";
  fuzzyThreshold?: number;
  logicalOperator?: "AND" | "OR";
}

export interface AggregationSpec {
  field: string;
  operation: "count" | "sum" | "average" | "min" | "max";
  groupBy?: string;
}

export interface FilterMetadata {
  matchedCount: number;
  totalCount: number;
  executionTimeMs: number;
  appliedFilters: FilterExpression[];
  filterLogId?: string;
}

export interface AggregationResult {
  type: "groupBy" | "topN" | "timeSeries" | "total";
  field: string;
  groupByField?: string;
  data: AggregationDataPoint[];
  totalCount: number;
  computedAt: string;
  executionTimeMs: number;
}

export interface AggregationDataPoint {
  key: string;
  count: number;
  sum?: number;
  average?: number;
  min?: number;
  max?: number;
}

// ============================================================================
// API Endpoints (Next.js API Routes)
// ============================================================================

/**
 * POST /api/ai/sessions
 *
 * Create a new AI analysis session.
 *
 * Request Body: CreateSessionRequest
 * Response: CreateSessionResponse (201) or Error (400/500)
 *
 * Example:
 * ```
 * POST /api/ai/sessions
 * {
 *   "initialData": {}
 * }
 * ```
 *
 * Response:
 * ```
 * {
 *   "success": true,
 *   "session": {
 *     "sessionId": "a1b2c3d4-...",
 *     "createdAt": "2024-11-23T10:30:00.000Z",
 *     "lastActivityAt": "2024-11-23T10:30:00.000Z",
 *     "transactionCount": 0,
 *     "dataSourceInfo": {}
 *   }
 * }
 * ```
 */

/**
 * GET /api/ai/sessions/:sessionId
 *
 * Get session metadata and full context state.
 *
 * Response: GetSessionResponse (200) or Error (404/500)
 *
 * Example:
 * ```
 * GET /api/ai/sessions/a1b2c3d4-...
 * ```
 *
 * Response:
 * ```
 * {
 *   "success": true,
 *   "session": { ... },
 *   "context": {
 *     "sessionId": "a1b2c3d4-...",
 *     "loadedTransactions": [...],
 *     "currentFilterView": [...],
 *     "conversationHistory": [...],
 *     "appliedFilters": [...],
 *     "status": "ready"
 *   }
 * }
 * ```
 */

/**
 * GET /api/ai/sessions
 *
 * List all sessions for current user.
 *
 * Response: ListSessionsResponse (200) or Error (500)
 *
 * Example:
 * ```
 * GET /api/ai/sessions
 * ```
 *
 * Response:
 * ```
 * {
 *   "success": true,
 *   "sessions": [
 *     {
 *       "sessionId": "a1b2c3d4-...",
 *       "createdAt": "2024-11-23T10:30:00.000Z",
 *       "lastActivityAt": "2024-11-23T12:45:00.000Z",
 *       "transactionCount": 5247,
 *       "dataSourceInfo": { ... }
 *     }
 *   ],
 *   "activeSessionId": "a1b2c3d4-..."
 * }
 * ```
 */

/**
 * PATCH /api/ai/sessions/:sessionId
 *
 * Update session metadata (activity time, transaction count, data info).
 *
 * Request Body: UpdateSessionRequest
 * Response: UpdateSessionResponse (200) or Error (400/404/500)
 *
 * Example:
 * ```
 * PATCH /api/ai/sessions/a1b2c3d4-...
 * {
 *   "sessionId": "a1b2c3d4-...",
 *   "updates": {
 *     "lastActivityAt": "2024-11-23T12:50:00.000Z",
 *     "transactionCount": 5300
 *   }
 * }
 * ```
 */

/**
 * DELETE /api/ai/sessions/:sessionId
 *
 * Delete session and optionally switch to another session.
 *
 * Query Params: ?switchTo=<sessionId> (optional)
 * Response: DeleteSessionResponse (200) or Error (404/500)
 *
 * Example:
 * ```
 * DELETE /api/ai/sessions/a1b2c3d4-...?switchTo=b2c3d4e5-...
 * ```
 *
 * Response:
 * ```
 * {
 *   "success": true,
 *   "deletedSessionId": "a1b2c3d4-...",
 *   "activeSessionId": "b2c3d4e5-..."
 * }
 * ```
 */

// ============================================================================
// Session Management Functions (lib/ai/session-manager.ts)
// ============================================================================

/**
 * Create a new session with empty state.
 *
 * @returns New session metadata
 */
export declare function createSession(): SessionMetadata;

/**
 * Get session metadata by ID.
 *
 * @param sessionId - Session UUID
 * @returns Session metadata or null if not found
 */
export declare function getSession(sessionId: string): SessionMetadata | null;

/**
 * Get full context state for session.
 *
 * @param sessionId - Session UUID
 * @returns Complete context state or null
 */
export declare function getSessionContext(
  sessionId: string,
): ContextState | null;

/**
 * Get list of all active sessions.
 *
 * @returns Array of session metadata, sorted by lastActivityAt desc
 */
export declare function getActiveSessions(): SessionMetadata[];

/**
 * Update session metadata fields.
 *
 * @param sessionId - Session UUID
 * @param updates - Partial session metadata updates
 * @returns Updated session metadata
 */
export declare function updateSession(
  sessionId: string,
  updates: Partial<SessionMetadata>,
): SessionMetadata;

/**
 * Delete session from memory and localStorage.
 *
 * @param sessionId - Session UUID
 * @returns true if deleted, false if not found
 */
export declare function deleteSession(sessionId: string): boolean;

/**
 * Load transactions into session.
 *
 * @param sessionId - Session UUID
 * @param transactions - Transaction array to load
 */
export declare function loadSessionData(
  sessionId: string,
  transactions: Transaction[],
): void;

/**
 * Cleanup expired sessions (>24 hours inactive).
 *
 * @returns Number of sessions deleted
 */
export declare function cleanupExpiredSessions(): number;

// ============================================================================
// LocalStorage Functions (client-side only)
// ============================================================================

/**
 * Get session list from localStorage.
 *
 * @returns Array of session metadata
 */
export declare function getSessionListFromStorage(): SessionMetadata[];

/**
 * Save session list to localStorage.
 *
 * @param sessions - Array of session metadata
 */
export declare function saveSessionListToStorage(
  sessions: SessionMetadata[],
): void;

/**
 * Get active session ID from localStorage.
 *
 * @returns Active session UUID or null
 */
export declare function getActiveSessionId(): string | null;

/**
 * Set active session ID in localStorage.
 *
 * @param sessionId - Session UUID
 */
export declare function setActiveSessionId(sessionId: string): void;

// ============================================================================
// Error Types
// ============================================================================

export class SessionError extends Error {
  constructor(
    message: string,
    public code:
      | "NOT_FOUND"
      | "ALREADY_EXISTS"
      | "INVALID_STATE"
      | "STORAGE_ERROR",
    public details?: unknown,
  ) {
    super(message);
    this.name = "SessionError";
  }
}

// ============================================================================
// Performance Targets
// ============================================================================

/**
 * Performance Requirements (from spec):
 * - Session create: <100ms
 * - Session list display: <200ms
 * - Session switch: <500ms
 * - Session delete: <100ms
 *
 * Success Criteria:
 * - SC-011: Support 10+ concurrent sessions, switch in <500ms
 * - SC-012: Session list display in <200ms
 * - SC-013: Persistence across page refresh
 * - SC-014: Deletion in <100ms with auto-switch
 */
