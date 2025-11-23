/**
 * Filter Engine - In-memory transaction filtering with smart matching
 * 
 * Provides filtering capabilities for loaded transactions using smart text matching,
 * supporting multiple operators and logical connectors (AND/OR).
 */

import {
  normalizeText,
  matchesFilter as textMatchesFilter,
  checkSynonyms,
  type NormalizationOptions,
} from './text-normalizer';
import type { FilterExpression, FilterOptions } from '../utils/validation';

// Re-export types for convenience
export type { FilterExpression, FilterOptions };

/**
 * Execute filter expressions on in-memory transaction array.
 * 
 * @param transactions - Array of loaded transactions
 * @param filters - Array of filter expressions (combined with AND/OR logic)
 * @param options - Normalization options
 * @returns Filtered transaction array
 */
export function executeFilters<T extends Record<string, unknown>>(
  transactions: T[],
  filters: FilterExpression[],
  options: FilterOptions = {}
): T[] {
  if (filters.length === 0) {
    return transactions;
  }

  return transactions.filter(transaction => {
    let result = true;
    let currentLogicalOp: 'AND' | 'OR' = 'AND';

    for (const filter of filters) {
      const matches = matchesFilterExpression(transaction, filter, options);

      if (currentLogicalOp === 'AND') {
        result = result && matches;
      } else {
        result = result || matches;
      }

      // Set logical operator for next iteration
      currentLogicalOp = filter.logicalOperator || 'AND';

      // Short-circuit optimization
      if (!result && currentLogicalOp === 'AND') {
        return false;
      }
    }

    return result;
  });
}

/**
 * Apply single filter expression to transactions.
 * 
 * @param transactions - Array to filter
 * @param filter - Single filter expression
 * @param options - Normalization options
 * @returns Filtered array
 */
export function applyFilter<T extends Record<string, unknown>>(
  transactions: T[],
  filter: FilterExpression,
  options: FilterOptions = {}
): T[] {
  return transactions.filter(transaction => 
    matchesFilterExpression(transaction, filter, options)
  );
}

/**
 * Check if transaction matches filter expression with smart text matching.
 * 
 * @param transaction - Transaction to test
 * @param filter - Filter expression
 * @param options - Normalization options
 * @returns true if transaction matches filter
 */
function matchesFilterExpression<T extends Record<string, unknown>>(
  transaction: T,
  filter: FilterExpression,
  options: FilterOptions = {}
): boolean {
  const { field, operator, value, matchStrategy = 'normalized', fuzzyThreshold = 2 } = filter;
  const fieldValue = transaction[field];

  // Handle null/undefined
  if (fieldValue == null) {
    return false;
  }

  // Build normalization options
  const normOptions: NormalizationOptions = {
    caseSensitive: false,
    trimWhitespace: true,
    matchStrategy: matchStrategy === 'normalized' ? 'contains' : 
                   matchStrategy === 'case-insensitive' ? 'contains' : 
                   matchStrategy,
    removeDiacritics: options.removeDiacritics,
    synonyms: options.synonyms,
    fuzzyThreshold,
  };

  // Handle different operators
  switch (operator) {
    case 'equals': {
      if (typeof value === 'string' && typeof fieldValue === 'string') {
        // Check synonyms first
        if (checkSynonyms(fieldValue, value, options.synonyms)) {
          return true;
        }
        // Fall back to normalized comparison
        return normalizeText(fieldValue, normOptions) === normalizeText(value, normOptions);
      }
      return fieldValue === value;
    }

    case 'contains': {
      if (typeof value === 'string') {
        const fieldStr = String(fieldValue);
        // Check synonyms first
        if (checkSynonyms(fieldStr, value, options.synonyms)) {
          return true;
        }
        return textMatchesFilter(fieldStr, value, normOptions);
      }
      return String(fieldValue).includes(String(value));
    }

    case 'startsWith': {
      if (typeof value === 'string') {
        const fieldStr = String(fieldValue);
        return textMatchesFilter(fieldStr, value, { ...normOptions, matchStrategy: 'startsWith' });
      }
      return String(fieldValue).startsWith(String(value));
    }

    case 'greaterThan': {
      const numValue = Number(value);
      const numField = Number(fieldValue);
      if (Number.isNaN(numValue) || Number.isNaN(numField)) {
        return false;
      }
      return numField > numValue;
    }

    case 'lessThan': {
      const numValue = Number(value);
      const numField = Number(fieldValue);
      if (Number.isNaN(numValue) || Number.isNaN(numField)) {
        return false;
      }
      return numField < numValue;
    }

    case 'between': {
      if (!Array.isArray(value) || value.length !== 2) {
        return false;
      }
      const numField = Number(fieldValue);
      const min = Number(value[0]);
      const max = Number(value[1]);
      if (Number.isNaN(numField) || Number.isNaN(min) || Number.isNaN(max)) {
        return false;
      }
      return numField >= min && numField <= max;
    }

    case 'in': {
      if (!Array.isArray(value)) {
        return false;
      }
      
      // Check if fieldValue matches any value in the array
      return value.some(v => {
        if (typeof v === 'string' && typeof fieldValue === 'string') {
          // Check synonyms
          if (checkSynonyms(fieldValue, v, options.synonyms)) {
            return true;
          }
          // Check normalized match
          return normalizeText(fieldValue, normOptions) === normalizeText(v, normOptions);
        }
        return fieldValue === v;
      });
    }

    default:
      return false;
  }
}
