/**
 * Iterative Session Management Module
 * 
 * Manages session lifecycle, tracks multiple QueryIntent requests,
 * and implements iteration control logic for AI-driven data exploration.
 */

import type { 
  IterativeQuerySession,
  DataRequestLog,
  IterationConfiguration,
  DataValidationResult,
  IterativeQueryError,
} from '../../types/iterative-ai';
import type { QueryIntent } from '../utils/validation';
import type { QueryResult } from './query-handler';
import { v4 as uuidv4 } from 'uuid';

/**
 * Default iteration configuration constants
 */
export const DEFAULT_ITERATION_CONFIG: IterationConfiguration = {
  /** Maximum number of QueryIntent requests per session */
  maxIterations: 20,
  /** Maximum total processing time per session (30 seconds) */
  maxSessionTimeMs: 30000,
  /** Enable automatic iteration loop detection */
  enableLoopDetection: true,
  /** Minimum data validation confidence required to proceed */
  minValidationConfidence: 0.7,
  /** Enable request logging for debugging */
  enableRequestLogging: true,
  /** Enable data validation on each response */
  enableDataValidation: true,
  /** Minimum record threshold for sufficient data */
  minRecordThreshold: 10,
  /** Allow empty query results as valid data */
  allowEmptyResults: true,
};

/**
 * In-memory storage for active sessions
 * In production, this would be replaced with persistent storage (Redis/MongoDB)
 */
const activeSessions = new Map<string, IterativeQuerySession>();

/**
 * Create a new iterative query session
 * 
 * @param userQuestion - The original user question
 * @param config - Optional iteration configuration overrides
 * @returns New session instance
 */
export function createIterativeSession(
  userQuestion: string,
  config: Partial<IterationConfiguration> = {}
): IterativeQuerySession {
  const sessionId = uuidv4();
  const startTime = new Date();
  
  const sessionConfig: IterationConfiguration = {
    ...DEFAULT_ITERATION_CONFIG,
    ...config,
  };
  
  const session: IterativeQuerySession = {
    sessionId,
    userQuestion,
    startTime,
    endTime: null,
    iterationCount: 0,
    maxIterations: sessionConfig.maxIterations,
    requestLog: [],
    status: 'active',
    totalProcessingTimeMs: 0,
  };
  
  // Store session in memory
  activeSessions.set(sessionId, session);
  
  console.log(`[IterativeSession] Created new session: ${sessionId}`);
  return session;
}

/**
 * Track a QueryIntent request and its response in the session log
 * 
 * @param sessionId - Target session ID
 * @param queryIntent - The QueryIntent structure sent
 * @param response - The response received from the application
 * @param validationResult - Data validation assessment
 * @param reasoning - AI's reasoning for making this request
 * @param processingTimeMs - Processing time for this request
 * @returns Updated session or null if session not found
 */
export function trackQueryRequest(
  sessionId: string,
  queryIntent: QueryIntent,
  response: QueryResult,
  validationResult: DataValidationResult,
  reasoning: string,
  processingTimeMs: number
): IterativeQuerySession | null {
  const session = activeSessions.get(sessionId);
  if (!session) {
    console.error(`[IterativeSession] Session not found: ${sessionId}`);
    return null;
  }
  
  // Create request log entry
  const logEntry: DataRequestLog = {
    requestId: uuidv4(),
    timestamp: new Date(),
    queryIntent,
    response,
    validationResult,
    reasoning,
    processingTimeMs,
  };
  
  // Update session
  session.requestLog.push(logEntry);
  session.iterationCount++;
  session.totalProcessingTimeMs += processingTimeMs;
  
  console.log(
    `[IterativeSession] Tracked request ${logEntry.requestId} in session ${sessionId} (iteration ${session.iterationCount})`
  );
  
  return session;
}

/**
 * Determine whether the session should continue iterating
 * 
 * @param sessionId - Target session ID
 * @param currentValidation - Current data validation result
 * @param config - Iteration configuration
 * @returns Decision object with continue flag and reason
 */
export function shouldContinueIteration(
  sessionId: string,
  currentValidation: DataValidationResult,
  config: IterationConfiguration = DEFAULT_ITERATION_CONFIG
): {
  shouldContinue: boolean;
  reason: string;
  error?: IterativeQueryError;
} {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return {
      shouldContinue: false,
      reason: `Session ${sessionId} not found`,
      error: 'application_error',
    };
  }
  
  // Check iteration limit
  if (session.iterationCount >= config.maxIterations) {
    return {
      shouldContinue: false,
      reason: `Maximum iterations reached (${config.maxIterations})`,
      error: 'max_iterations_reached',
    };
  }
  
  // Check session timeout
  const sessionDurationMs = Date.now() - session.startTime.getTime();
  if (sessionDurationMs >= config.maxSessionTimeMs) {
    return {
      shouldContinue: false,
      reason: `Session timeout reached (${config.maxSessionTimeMs}ms)`,
      error: 'session_timeout',
    };
  }
  
  // Check data sufficiency
  if (currentValidation.isSufficient && 
      currentValidation.confidence >= config.minValidationConfidence) {
    return {
      shouldContinue: false,
      reason: 'Data is sufficient and meets confidence threshold',
    };
  }
  
  // Check infinite loop detection
  if (config.enableLoopDetection && detectInfiniteLoop(session)) {
    return {
      shouldContinue: false,
      reason: 'Infinite loop detected - similar queries repeated',
      error: 'infinite_loop_detected',
    };
  }
  
  // Check if empty results are acceptable
  if (!config.allowEmptyResults && currentValidation.recordCount === 0) {
    return {
      shouldContinue: false,
      reason: 'Empty results not allowed by configuration',
      error: 'data_validation_failed',
    };
  }
  
  // Continue if we haven't met sufficient criteria
  return {
    shouldContinue: true,
    reason: 'Data insufficient - need more information',
  };
}

/**
 * Get session by ID
 * 
 * @param sessionId - Target session ID
 * @returns Session instance or null if not found
 */
export function getSession(sessionId: string): IterativeQuerySession | null {
  return activeSessions.get(sessionId) || null;
}

/**
 * Complete a session with final result
 * 
 * @param sessionId - Target session ID
 * @param result - Final answer or result
 * @param reason - Reason for completion
 * @returns Updated session or null if session not found
 */
export function completeSession(
  sessionId: string,
  result: string,
  reason: string
): IterativeQuerySession | null {
  const session = activeSessions.get(sessionId);
  if (!session) {
    console.error(`[IterativeSession] Cannot complete - session not found: ${sessionId}`);
    return null;
  }
  
  session.endTime = new Date();
  session.status = 'completed';
  session.result = result;
  session.completionReason = reason;
  
  console.log(`[IterativeSession] Completed session ${sessionId}: ${reason}`);
  return session;
}

/**
 * Fail a session with error information
 * 
 * @param sessionId - Target session ID
 * @param error - Error message
 * @param reason - Reason for failure
 * @returns Updated session or null if session not found
 */
export function failSession(
  sessionId: string,
  error: string,
  reason: string
): IterativeQuerySession | null {
  const session = activeSessions.get(sessionId);
  if (!session) {
    console.error(`[IterativeSession] Cannot fail - session not found: ${sessionId}`);
    return null;
  }
  
  session.endTime = new Date();
  session.status = 'failed';
  session.completionReason = `${reason}: ${error}`;
  
  console.log(`[IterativeSession] Failed session ${sessionId}: ${reason} - ${error}`);
  return session;
}

/**
 * Clean up completed or failed sessions
 * 
 * @param olderThanMs - Remove sessions older than this duration (default: 1 hour)
 * @returns Number of sessions cleaned up
 */
export function cleanupSessions(olderThanMs: number = 3600000): number {
  const cutoff = Date.now() - olderThanMs;
  let cleaned = 0;
  
  for (const sessionEntry of Array.from(activeSessions.entries())) {
    const [sessionId, session] = sessionEntry;
    const sessionEndTime = session.endTime?.getTime() || Date.now();
    
    if (sessionEndTime < cutoff && session.status !== 'active') {
      activeSessions.delete(sessionId);
      cleaned++;
      console.log(`[IterativeSession] Cleaned up old session: ${sessionId}`);
    }
  }
  
  console.log(`[IterativeSession] Cleaned up ${cleaned} sessions`);
  return cleaned;
}

/**
 * Get all active sessions (for monitoring)
 * 
 * @returns Array of active session metadata
 */
export function getActiveSessions(): IterativeQuerySession[] {
  return Array.from(activeSessions.values()).filter(session => session.status === 'active');
}

/**
 * Get session statistics for monitoring
 * 
 * @returns Session statistics object
 */
export function getSessionStats(): {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
  averageIterations: number;
  averageProcessingTime: number;
} {
  const allSessions = Array.from(activeSessions.values());
  const active = allSessions.filter(s => s.status === 'active');
  const completed = allSessions.filter(s => s.status === 'completed');
  const failed = allSessions.filter(s => s.status === 'failed');
  
  const totalIterations = allSessions.reduce((sum, s) => sum + s.iterationCount, 0);
  const totalProcessingTime = allSessions.reduce((sum, s) => sum + s.totalProcessingTimeMs, 0);
  
  return {
    totalSessions: allSessions.length,
    activeSessions: active.length,
    completedSessions: completed.length,
    failedSessions: failed.length,
    averageIterations: allSessions.length ? totalIterations / allSessions.length : 0,
    averageProcessingTime: allSessions.length ? totalProcessingTime / allSessions.length : 0,
  };
}

// Helper functions

/**
 * Detect infinite loop by analyzing recent queries
 * 
 * @param session - Target session
 * @returns True if infinite loop detected
 */
function detectInfiniteLoop(session: IterativeQuerySession): boolean {
  const recentRequests = session.requestLog.slice(-5); // Look at last 5 requests
  
  if (recentRequests.length < 3) {
    return false; // Not enough data to detect loops
  }
  
  // Check for identical queries
  const queryHashes = recentRequests.map(req => 
    JSON.stringify({
      type: req.queryIntent.type,
      filters: req.queryIntent.filters,
      aggregations: req.queryIntent.aggregations,
    })
  );
  
  // Detect if more than 50% of recent queries are identical
  const uniqueHashes = new Set(queryHashes);
  const duplicateRatio = 1 - (uniqueHashes.size / queryHashes.length);
  
  if (duplicateRatio > 0.5) {
    console.warn(`[IterativeSession] Infinite loop detected in session ${session.sessionId}: ${duplicateRatio * 100}% duplicate queries`);
    return true;
  }
  
  // Check for oscillating patterns (A->B->A->B)
  if (queryHashes.length >= 4) {
    const pattern = [queryHashes[0], queryHashes[1]];
    const isOscillating = queryHashes.slice(2).every((hash, index) => 
      hash === pattern[index % 2]
    );
    
    if (isOscillating) {
      console.warn(`[IterativeSession] Oscillating pattern detected in session ${session.sessionId}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Generate iteration summary for debugging
 * 
 * @param sessionId - Target session ID
 * @returns Summary string or null if session not found
 */
export function getIterationSummary(sessionId: string): string | null {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return null;
  }
  
  const summary = [
    `Session: ${sessionId}`,
    `Question: ${session.userQuestion}`,
    `Status: ${session.status}`,
    `Iterations: ${session.iterationCount}/${session.maxIterations}`,
    `Total Processing: ${session.totalProcessingTimeMs}ms`,
    `Requests:`,
  ];
  
  session.requestLog.forEach((log, index) => {
    summary.push(
      `  ${index + 1}. ${log.queryIntent.type} (${log.processingTimeMs}ms) - ${log.validationResult.recordCount} records - ${log.reasoning}`
    );
  });
  
  if (session.completionReason) {
    summary.push(`Completion: ${session.completionReason}`);
  }
  
  return summary.join('\n');
}