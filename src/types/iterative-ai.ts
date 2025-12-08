/**
 * TypeScript interfaces for Iterative AI Query System
 * 
 * These interfaces define the data structures used for AI-application
 * communication during iterative data exploration sessions.
 */

import type { QueryIntent } from '../lib/utils/validation';
import type { QueryResult } from '../lib/ai/query-handler';

/**
 * Assessment of received data quality including completeness, validity, and sufficiency indicators
 */
export interface DataValidationResult {
  /** Whether the data is sufficient for analysis */
  isSufficient: boolean;
  /** Whether the data contains all expected fields */
  isComplete: boolean;
  /** Whether the data appears valid and consistent */
  isValid: boolean;
  /** Number of records in the dataset */
  recordCount: number;
  /** Fields that are missing or have issues */
  missingFields: string[];
  /** Issues detected in the data */
  issues: string[];
  /** Suggestions for improving the query */
  suggestions: string[];
  /** Confidence score for the validation (0-1) */
  confidence: number;
}

/**
 * Audit trail of all QueryIntent requests, responses, and AI decision points 
 * during iterative querying process
 */
export interface DataRequestLog {
  /** Unique identifier for this request */
  requestId: string;
  /** Timestamp when the request was made */
  timestamp: Date;
  /** The QueryIntent structure sent to the application */
  queryIntent: QueryIntent;
  /** The response received from the application */
  response: QueryResult;
  /** Data validation results for this request */
  validationResult: DataValidationResult;
  /** AI's reasoning for making this request */
  reasoning: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Any errors that occurred during processing */
  error?: string;
}

/**
 * Tracking structure for multiple QueryIntent requests within a single 
 * user question processing session
 */
export interface IterativeQuerySession {
  /** Unique identifier for this session */
  sessionId: string;
  /** The original user question */
  userQuestion: string;
  /** Timestamp when the session started */
  startTime: Date;
  /** Timestamp when the session ended (null if still active) */
  endTime: Date | null;
  /** Current iteration count */
  iterationCount: number;
  /** Maximum allowed iterations for this session */
  maxIterations: number;
  /** Log of all data requests made in this session */
  requestLog: DataRequestLog[];
  /** Current session status */
  status: 'active' | 'completed' | 'failed' | 'timeout';
  /** Final answer or current progress */
  result?: string;
  /** Reason for session completion/failure */
  completionReason?: string;
  /** Total processing time in milliseconds */
  totalProcessingTimeMs: number;
}

/**
 * System settings controlling maximum request limits, timeout behaviors, 
 * and error handling policies for QueryIntent cycles
 */
export interface IterationConfiguration {
  /** Maximum number of QueryIntent requests per session */
  maxIterations: number;
  /** Maximum total processing time per session in milliseconds */
  maxSessionTimeMs: number;
  /** Whether to enable automatic iteration loop detection */
  enableLoopDetection: boolean;
  /** Minimum data validation confidence required to proceed */
  minValidationConfidence: number;
  /** Whether to log all requests for debugging */
  enableRequestLogging: boolean;
  /** Whether to validate data quality on each response */
  enableDataValidation: boolean;
  /** Threshold for detecting insufficient data (minimum record count) */
  minRecordThreshold: number;
  /** Whether to allow empty query results as valid data */
  allowEmptyResults: boolean;
}

/**
 * Error types that can occur during iterative query processing
 */
export type IterativeQueryError = 
  | 'invalid_query_intent'
  | 'max_iterations_reached'
  | 'session_timeout'
  | 'data_validation_failed'
  | 'application_error'
  | 'infinite_loop_detected';

/**
 * Response structure for iterative query requests
 */
export interface IterativeQueryResponse {
  /** Whether the request was successful */
  success: boolean;
  /** Session information */
  session: IterativeQuerySession;
  /** Current data validation result */
  validation: DataValidationResult;
  /** Whether more iterations are needed */
  needsMoreData: boolean;
  /** Final answer if session is complete */
  answer?: string;
  /** Error information if request failed */
  error?: {
    type: IterativeQueryError;
    message: string;
    details?: unknown;
  };
}