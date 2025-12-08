/**
 * Data Validator Module for Iterative AI Query System
 * 
 * Provides functions to assess data quality, completeness, and validity
 * for AI-driven iterative query processing.
 */

import type { 
  DataValidationResult,
  QueryIntent,
} from '../utils/validation';
import type { QueryResult } from './query-handler';

/**
 * Default configuration for data validation
 */
export const DATA_VALIDATION_CONFIG = {
  /** Minimum number of records to consider data sufficient */
  MIN_RECORD_THRESHOLD: 10,
  /** Minimum confidence score to consider validation reliable */
  MIN_VALIDATION_CONFIDENCE: 0.7,
  /** Maximum acceptable ratio of missing fields */
  MAX_MISSING_FIELD_RATIO: 0.3,
  /** Confidence threshold for detecting suspicious patterns */
  SUSPICIOUS_PATTERN_THRESHOLD: 0.6,
};

/**
 * Assess whether the current dataset is sufficient for analysis
 * 
 * @param queryResult - The result from a QueryIntent request
 * @param queryIntent - The original QueryIntent structure
 * @returns Assessment of data sufficiency with recommendations
 */
export function detectDataInsufficiency(
  queryResult: QueryResult,
  queryIntent: QueryIntent
): DataValidationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const missingFields: string[] = [];
  
  // Parse the answer to extract data information
  const recordCount = extractRecordCount(queryResult.answer);
  
  // Check if we have enough records for meaningful analysis
  const hasEnoughRecords = recordCount >= DATA_VALIDATION_CONFIG.MIN_RECORD_THRESHOLD;
  if (!hasEnoughRecords) {
    issues.push(`Only ${recordCount} records found, may be insufficient for comprehensive analysis`);
    suggestions.push('Consider broadening filter criteria or adjusting date ranges');
  }
  
  // Check for aggregation completeness
  if (queryIntent.type === 'aggregation' && queryIntent.aggregations) {
    const hasAggregationData = queryResult.answer.includes('aggregation') || 
                              queryResult.answer.includes('total') ||
                              queryResult.answer.includes('count') ||
                              queryResult.answer.includes('average');
    
    if (!hasAggregationData) {
      issues.push('Aggregation request did not return aggregated data');
      suggestions.push('Verify aggregation fields and operations are valid');
    }
  }
  
  // Check confidence level
  const isHighConfidence = queryResult.confidence === 'high';
  if (!isHighConfidence) {
    issues.push(`Query confidence is ${queryResult.confidence}, may indicate data quality issues`);
    suggestions.push('Consider refining filters or requesting different data perspectives');
  }
  
  // Assess overall sufficiency
  const isSufficient = hasEnoughRecords && 
                      (queryIntent.type !== 'aggregation' || queryResult.answer.length > 50) &&
                      issues.length < 2;
  
  const confidence = calculateValidationConfidence(recordCount, queryResult.confidence, issues.length);
  
  return {
    isSufficient,
    isComplete: missingFields.length === 0,
    isValid: issues.length === 0,
    recordCount,
    missingFields,
    issues,
    suggestions,
    confidence,
  };
}

/**
 * Validate the completeness and quality of received data
 * 
 * @param queryResult - The result from a QueryIntent request
 * @param expectedFields - Fields that should be present in the data
 * @returns Detailed data quality assessment
 */
export function validateDataQuality(
  queryResult: QueryResult,
  expectedFields: string[] = []
): DataValidationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const missingFields: string[] = [];
  
  // Extract record count from the answer
  const recordCount = extractRecordCount(queryResult.answer);
  
  // Check for empty or minimal data
  if (recordCount === 0) {
    issues.push('No data found for the specified criteria');
    suggestions.push('Consider broadening search criteria or checking data availability');
  } else if (recordCount < DATA_VALIDATION_CONFIG.MIN_RECORD_THRESHOLD) {
    issues.push(`Limited data found (${recordCount} records)`);
    suggestions.push('Consider expanding filters or date ranges for more comprehensive analysis');
  }
  
  // Check for required fields (if specified)
  for (const field of expectedFields) {
    if (!queryResult.answer.toLowerCase().includes(field.toLowerCase())) {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length > 0) {
    issues.push(`Missing expected fields: ${missingFields.join(', ')}`);
    suggestions.push('Request data with specific field requirements or modify query intent');
  }
  
  // Check answer quality
  const answerLength = queryResult.answer.length;
  if (answerLength < 20) {
    issues.push('Answer is very brief, may indicate insufficient data processing');
    suggestions.push('Request more detailed analysis or additional data perspectives');
  }
  
  // Check for error indicators in the answer
  const hasErrorIndicators = /error|failed|unable|cannot|invalid/i.test(queryResult.answer);
  if (hasErrorIndicators) {
    issues.push('Response indicates potential processing errors');
    suggestions.push('Verify query intent structure and try alternative approaches');
  }
  
  const confidence = calculateValidationConfidence(recordCount, queryResult.confidence, issues.length);
  const isComplete = missingFields.length === 0;
  const isValid = !hasErrorIndicators && issues.length < 3;
  const isSufficient = recordCount > 0 && isValid && answerLength > 20;
  
  return {
    isSufficient,
    isComplete,
    isValid,
    recordCount,
    missingFields,
    issues,
    suggestions,
    confidence,
  };
}

/**
 * Detect suspicious patterns or contradictions in the data
 * 
 * @param queryResult - The result from a QueryIntent request
 * @param previousResults - Previous query results for comparison
 * @returns Assessment of data validity and potential issues
 */
export function detectSuspiciousPatterns(
  queryResult: QueryResult,
  previousResults: QueryResult[] = []
): DataValidationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const missingFields: string[] = [];
  
  const recordCount = extractRecordCount(queryResult.answer);
  
  // Check for extreme values or unrealistic patterns
  if (queryResult.answer.includes('$0') || queryResult.answer.includes('price: 0')) {
    issues.push('Found zero-value prices, which may indicate data quality issues');
    suggestions.push('Verify data integrity and consider filtering out zero-value transactions');
  }
  
  // Check for suspiciously round numbers (might indicate artificial data)
  const hasRoundNumbers = /\$1,000,000|\$100,000|\$10,000,000/g.test(queryResult.answer);
  if (hasRoundNumbers) {
    issues.push('Found suspiciously round monetary values');
    suggestions.push('Verify if these are actual transaction values or aggregated estimates');
  }
  
  // Check consistency with previous results
  if (previousResults.length > 0) {
    const previousRecordCounts = previousResults.map(r => extractRecordCount(r.answer));
    const avgPreviousCount = previousRecordCounts.reduce((a, b) => a + b, 0) / previousRecordCounts.length;
    
    // Flag if current result is dramatically different
    if (recordCount > 0 && avgPreviousCount > 0) {
      const ratio = recordCount / avgPreviousCount;
      if (ratio > 10 || ratio < 0.1) {
        issues.push(`Record count (${recordCount}) dramatically different from previous queries (avg: ${Math.round(avgPreviousCount)})`);
        suggestions.push('Verify query filters and check for data consistency');
      }
    }
  }
  
  // Check for data format consistency
  const hasInconsistentFormats = checkFormatConsistency(queryResult.answer);
  if (hasInconsistentFormats) {
    issues.push('Detected inconsistent data formats in the response');
    suggestions.push('Consider standardizing data format requirements in query intent');
  }
  
  const confidence = Math.max(
    DATA_VALIDATION_CONFIG.SUSPICIOUS_PATTERN_THRESHOLD,
    calculateValidationConfidence(recordCount, queryResult.confidence, issues.length)
  );
  
  const isValid = issues.length === 0;
  const isComplete = true; // Suspicious pattern detection doesn't check completeness
  const isSufficient = isValid && recordCount > 0;
  
  return {
    isSufficient,
    isComplete,
    isValid,
    recordCount,
    missingFields,
    issues,
    suggestions,
    confidence,
  };
}

/**
 * Enhanced data sufficiency detection for very few transactions scenario (US3)
 */
export function detectMissingFields(
  queryResult: QueryResult,
  requiredFields: string[]
): DataValidationResult {
  const missingFields: string[] = [];
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // Check each required field
  for (const field of requiredFields) {
    const fieldPresent = queryResult.answer.toLowerCase().includes(field.toLowerCase()) ||
                        queryResult.citations.some(citation => 
                          citation.toLowerCase().includes(field.toLowerCase())
                        );
    
    if (!fieldPresent) {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length > 0) {
    issues.push(`Missing required fields: ${missingFields.join(', ')}`);
    suggestions.push(`Request data specifically including: ${missingFields.join(', ')}`);
  }
  
  const recordCount = extractRecordCount(queryResult.answer);
  const confidence = calculateValidationConfidence(recordCount, queryResult.confidence, issues.length);
  
  return {
    isSufficient: missingFields.length === 0 && recordCount > 0,
    isComplete: missingFields.length === 0,
    isValid: true,
    recordCount,
    missingFields,
    issues,
    suggestions,
    confidence,
  };
}

/**
 * Analyze data validity for contradiction detection (US3)
 */
export function analyzeDataValidity(
  queryResult: QueryResult,
  expectedPatterns: string[] = []
): DataValidationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const missingFields: string[] = [];
  
  const recordCount = extractRecordCount(queryResult.answer);
  
  // Check for logical contradictions
  const hasContradictions = checkForContradictions(queryResult.answer);
  if (hasContradictions.length > 0) {
    issues.push(...hasContradictions);
    suggestions.push('Verify data sources and consider requesting clarifying data');
  }
  
  // Check expected patterns
  for (const pattern of expectedPatterns) {
    if (!queryResult.answer.includes(pattern)) {
      issues.push(`Expected pattern not found: ${pattern}`);
      suggestions.push(`Request data that specifically includes ${pattern}`);
    }
  }
  
  const confidence = calculateValidationConfidence(recordCount, queryResult.confidence, issues.length);
  const isValid = issues.length === 0;
  
  return {
    isSufficient: isValid && recordCount > 0,
    isComplete: true,
    isValid,
    recordCount,
    missingFields,
    suggestions,
    issues,
    confidence,
  };
}

// Helper functions

/**
 * Extract record count from query result answer
 */
function extractRecordCount(answer: string): number {
  // Look for patterns like "found 123 records", "123 transactions", etc.
  const countPatterns = [
    /(\d+)\s+(?:records?|transactions?|results?|entries|items)/i,
    /found\s+(\d+)/i,
    /total\s+of\s+(\d+)/i,
    /(\d+)\s+matches?/i,
  ];
  
  for (const pattern of countPatterns) {
    const match = answer.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  // Fallback: estimate based on answer length and content
  if (answer.length < 50) return 0;
  if (answer.includes('no data') || answer.includes('no results')) return 0;
  if (answer.length > 500) return Math.max(10, Math.floor(answer.length / 100));
  
  return 1; // Assume at least some data if we can't determine count
}

/**
 * Calculate validation confidence based on multiple factors
 */
function calculateValidationConfidence(
  recordCount: number, 
  queryConfidence: 'high' | 'medium' | 'low',
  issueCount: number
): number {
  let confidence = 0.5; // Base confidence
  
  // Adjust for record count
  if (recordCount >= DATA_VALIDATION_CONFIG.MIN_RECORD_THRESHOLD) {
    confidence += 0.2;
  } else if (recordCount > 0) {
    confidence += 0.1;
  }
  
  // Adjust for query confidence
  switch (queryConfidence) {
    case 'high':
      confidence += 0.3;
      break;
    case 'medium':
      confidence += 0.2;
      break;
    case 'low':
      confidence += 0.1;
      break;
  }
  
  // Reduce confidence for issues
  confidence -= issueCount * 0.1;
  
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Check for inconsistent data formats
 */
function checkFormatConsistency(answer: string): boolean {
  // Check for mixed date formats
  const dateFormats = [
    /\d{4}-\d{2}-\d{2}/g, // YYYY-MM-DD
    /\d{2}\/\d{2}\/\d{4}/g, // MM/DD/YYYY
    /\d{2}-\d{2}-\d{4}/g, // MM-DD-YYYY
  ];
  
  const formatCounts = dateFormats.map(format => (answer.match(format) || []).length);
  const activeFormats = formatCounts.filter(count => count > 0);
  
  // If more than one date format is present, flag as inconsistent
  return activeFormats.length > 1;
}

/**
 * Check for logical contradictions in the answer
 */
function checkForContradictions(answer: string): string[] {
  const contradictions: string[] = [];
  
  // Check for numerical contradictions
  const totalPattern = /total.*?(\$[\d,]+)/gi;
  const totals = [...answer.matchAll(totalPattern)];
  if (totals.length > 1) {
    const amounts = totals.map(match => match[1]);
    const uniqueAmounts = [...new Set(amounts)];
    if (uniqueAmounts.length !== amounts.length) {
      contradictions.push('Found conflicting total amounts in the same response');
    }
  }
  
  // Check for contradictory statements
  const contradictoryPhrases = [
    ['increase', 'decrease'],
    ['rising', 'falling'],
    ['higher', 'lower'],
    ['more than', 'less than'],
  ];
  
  for (const [phrase1, phrase2] of contradictoryPhrases) {
    if (answer.toLowerCase().includes(phrase1) && answer.toLowerCase().includes(phrase2)) {
      contradictions.push(`Contains both "${phrase1}" and "${phrase2}" which may be contradictory`);
    }
  }
  
  return contradictions;
}