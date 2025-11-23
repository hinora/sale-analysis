/**
 * AI Session Manager
 *
 * Manages in-memory AI analysis sessions with:
 * - Transaction data storage per session
 * - 30-minute TTL for automatic cleanup
 * - Conversation history tracking
 * - Session state management
 */

import type { FilterExpression } from "./filter-engine";
import type { AggregationCache } from "./aggregation-engine";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

/**
 * Context state tracking for iterative refinement
 */
export interface ContextState {
  loadedTransactions: Array<Record<string, unknown>>;
  currentFilterView: Array<Record<string, unknown>>;
  appliedFilters: FilterExpression[];
  iterationCount: number;
  lastFilterTimestamp?: Date;
  aggregationCache?: AggregationCache;
  filterLogs: Array<{
    timestamp: string;
    filterExpression: FilterExpression;
    matchedCount: number;
    totalCount: number;
    executionTimeMs: number;
    criteria: string;
  }>;
}

export interface AISession {
  id: string;
  transactionData: Array<Record<string, unknown>>;
  conversationHistory: AIMessage[];
  status: "idle" | "feeding" | "ready" | "querying" | "error";
  createdAt: Date;
  lastAccessedAt: Date;
  expiresAt: Date;
  metadata: {
    transactionCount: number;
    dataSize: number;
    filters?: Record<string, unknown>;
  };
  contextState?: ContextState;
}

/**
 * In-memory session storage
 * Key: session ID
 * Value: AISession
 */
const sessions = new Map<string, AISession>();

/**
 * Session TTL in milliseconds (30 minutes)
 */
const SESSION_TTL = 30 * 60 * 1000;

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `ai-session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new AI session
 */
export function createSession(): AISession {
  const now = new Date();
  const sessionId = generateSessionId();

  const session: AISession = {
    id: sessionId,
    transactionData: [],
    conversationHistory: [],
    status: "idle",
    createdAt: now,
    lastAccessedAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL),
    metadata: {
      transactionCount: 0,
      dataSize: 0,
    },
  };

  sessions.set(sessionId, session);

  // Schedule automatic cleanup
  setTimeout(() => {
    if (sessions.has(sessionId)) {
      const currentSession = sessions.get(sessionId);
      if (currentSession && new Date() > currentSession.expiresAt) {
        deleteSession(sessionId);
      }
    }
  }, SESSION_TTL);

  return session;
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): AISession | null {
  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Check if session expired
  if (new Date() > session.expiresAt) {
    deleteSession(sessionId);
    return null;
  }

  // Update last accessed time and extend expiration
  session.lastAccessedAt = new Date();
  session.expiresAt = new Date(Date.now() + SESSION_TTL);

  return session;
}

/**
 * Update session data
 */
export function updateSession(
  sessionId: string,
  updates: Partial<Omit<AISession, "id" | "createdAt">>,
): AISession | null {
  const session = getSession(sessionId);

  if (!session) {
    return null;
  }

  // Apply updates
  Object.assign(session, updates);

  // Update last accessed time
  session.lastAccessedAt = new Date();
  session.expiresAt = new Date(Date.now() + SESSION_TTL);

  return session;
}

/**
 * Add transaction data to session
 */
export function addTransactionData(
  sessionId: string,
  transactions: Array<Record<string, unknown>>,
  filters?: Record<string, unknown>,
): AISession | null {
  const session = getSession(sessionId);

  if (!session) {
    return null;
  }

  // Calculate data size (rough estimate in bytes)
  const dataSize = JSON.stringify(transactions).length;

  session.transactionData = transactions;
  session.metadata = {
    transactionCount: transactions.length,
    dataSize,
    filters,
  };
  session.status = "ready";
  session.lastAccessedAt = new Date();
  session.expiresAt = new Date(Date.now() + SESSION_TTL);

  return session;
}

/**
 * Add message to conversation history
 */
export function addMessage(
  sessionId: string,
  role: "user" | "assistant" | "system",
  content: string,
): AISession | null {
  const session = getSession(sessionId);

  if (!session) {
    return null;
  }

  session.conversationHistory.push({
    role,
    content,
    timestamp: new Date(),
  });

  session.lastAccessedAt = new Date();
  session.expiresAt = new Date(Date.now() + SESSION_TTL);

  return session;
}

/**
 * Update session status
 */
export function updateSessionStatus(
  sessionId: string,
  status: AISession["status"],
): AISession | null {
  return updateSession(sessionId, { status });
}

/**
 * Update filter view with new filters (iterative refinement)
 * Tracks iteration count with maximum limit of 10
 */
export function updateFilterView(
  sessionId: string,
  filteredTransactions: Array<Record<string, unknown>>,
  filters: FilterExpression[],
): AISession | null {
  const session = getSession(sessionId);

  if (!session) {
    return null;
  }

  // Initialize contextState if not exists
  if (!session.contextState) {
    session.contextState = {
      loadedTransactions: session.transactionData,
      currentFilterView: session.transactionData,
      appliedFilters: [],
      iterationCount: 0,
      filterLogs: [],
    };
  }

  // Check iteration limit (max 10 per specification)
  if (session.contextState.iterationCount >= 10) {
    console.warn(
      `[SessionManager] Session ${sessionId} reached max iteration limit (10)`,
    );
    return session;
  }

  // Update context state
  session.contextState.currentFilterView = filteredTransactions;
  session.contextState.appliedFilters = filters;
  session.contextState.iterationCount += 1;
  session.contextState.lastFilterTimestamp = new Date();

  session.lastAccessedAt = new Date();
  session.expiresAt = new Date(Date.now() + SESSION_TTL);

  console.log(
    `[SessionManager] Updated filter view: ${session.transactionData.length} → ${filteredTransactions.length} transactions (iteration ${session.contextState.iterationCount}/10)`,
  );

  return session;
}

/**
 * Add filter log entry to session context state
 */
export function addFilterLog(
  sessionId: string,
  filterExpression: FilterExpression,
  matchedCount: number,
  totalCount: number,
  executionTimeMs: number,
): AISession | null {
  const session = getSession(sessionId);

  if (!session) {
    return null;
  }

  // Initialize contextState if not exists
  if (!session.contextState) {
    session.contextState = {
      loadedTransactions: session.transactionData,
      currentFilterView: session.transactionData,
      appliedFilters: [],
      iterationCount: 0,
      filterLogs: [],
    };
  }

  // Create criteria string for display
  const criteria = `${filterExpression.field} ${filterExpression.operator} ${
    Array.isArray(filterExpression.value)
      ? `[${filterExpression.value.join(", ")}]`
      : filterExpression.value
  }`;

  // Add filter log entry
  session.contextState.filterLogs.push({
    timestamp: new Date().toISOString(),
    filterExpression,
    matchedCount,
    totalCount,
    executionTimeMs,
    criteria,
  });

  return session;
}

/**
 * Delete session
 */
export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): number {
  const now = new Date();
  let cleanedCount = 0;

  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
      cleanedCount++;
    }
  }

  return cleanedCount;
}

/**
 * Get all active sessions (for debugging/monitoring)
 */
export function getActiveSessions(): AISession[] {
  cleanupExpiredSessions();
  return Array.from(sessions.values());
}

/**
 * Get session count
 */
export function getSessionCount(): number {
  cleanupExpiredSessions();
  return sessions.size;
}
