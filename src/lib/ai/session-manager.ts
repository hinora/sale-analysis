/**
 * AI Session Manager
 *
 * Manages in-memory AI analysis sessions with:
 * - Transaction data storage per session
 * - 30-minute TTL for automatic cleanup
 * - Conversation history tracking
 * - Session state management
 */

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
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
