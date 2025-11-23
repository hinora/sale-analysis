/**
 * Text Normalizer - Smart text matching utilities
 *
 * Provides case-insensitive, whitespace-normalized, Vietnamese diacritics handling,
 * and fuzzy matching for filtering transactions.
 */

import removeAccents from "remove-accents";
import levenshtein from "fast-levenshtein";
import synonymsData from "./synonyms.json";

export interface NormalizationOptions {
  caseSensitive?: boolean; // Default: false
  trimWhitespace?: boolean; // Default: true
  matchStrategy?: "exact" | "contains" | "startsWith" | "fuzzy"; // Default: 'contains'
  removeDiacritics?: boolean; // Default: false (opt-in for Vietnamese)
  synonyms?: Record<string, string[]>; // Canonical form → variants
  fuzzyThreshold?: number; // Levenshtein distance (0-5), default 2
}

// Vietnamese character map for đ/Đ character handling
const vietnameseCharMap: Record<string, string> = {
  đ: "d",
  Đ: "D",
  ă: "a",
  Ă: "A",
  â: "a",
  Â: "A",
  ê: "e",
  Ê: "E",
  ô: "o",
  Ô: "O",
  ơ: "o",
  Ơ: "O",
  ư: "u",
  Ư: "U",
};

/**
 * Remove Vietnamese diacritics from text.
 *
 * @param text - Input text with diacritics
 * @returns Text with diacritics removed
 *
 * Example: "điện tử" → "dien tu"
 */
export function removeDiacritics(text: string): string {
  // First handle Vietnamese-specific characters
  let normalized = text;
  for (const [char, replacement] of Object.entries(vietnameseCharMap)) {
    normalized = normalized.replace(new RegExp(char, "g"), replacement);
  }

  // Then use remove-accents library for remaining diacritics
  return removeAccents(normalized);
}

/**
 * Normalize text for comparison (case, whitespace, diacritics).
 *
 * @param text - Input text
 * @param options - Normalization options
 * @returns Normalized text
 */
export function normalizeText(
  text: string,
  options: NormalizationOptions = {},
): string {
  const {
    caseSensitive = false,
    trimWhitespace = true,
    removeDiacritics: shouldRemoveDiacritics = false,
  } = options;

  let normalized = text;

  // Trim whitespace
  if (trimWhitespace) {
    normalized = normalized.trim().replace(/\s+/g, " ");
  }

  // Remove diacritics if requested
  if (shouldRemoveDiacritics) {
    normalized = removeDiacritics(normalized);
  }

  // Case normalization
  if (!caseSensitive) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings (typo tolerance).
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance (0 = identical)
 *
 * Example: levenshteinDistance("electonic", "electronic") → 1
 */
export function levenshteinDistance(str1: string, str2: string): number {
  return levenshtein.get(str1, str2);
}

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
export function checkSynonyms(
  value1: string,
  value2: string,
  synonyms: Record<string, string[]> = {},
): boolean {
  const normalizedValue1 = normalizeText(value1);
  const normalizedValue2 = normalizeText(value2);

  // Check direct match first
  if (normalizedValue1 === normalizedValue2) {
    return true;
  }

  // Load default synonyms
  const allSynonyms = {
    ...synonymsData.countries,
    ...synonymsData.companies,
    ...synonyms,
  };

  // Check if values are in the same synonym group
  for (const variants of Object.values(allSynonyms)) {
    const normalizedVariants = variants.map((v) => normalizeText(v));
    const hasValue1 = normalizedVariants.some(
      (v) =>
        v === normalizedValue1 ||
        normalizedValue1.includes(v) ||
        v.includes(normalizedValue1),
    );
    const hasValue2 = normalizedVariants.some(
      (v) =>
        v === normalizedValue2 ||
        normalizedValue2.includes(v) ||
        v.includes(normalizedValue2),
    );

    if (hasValue1 && hasValue2) {
      return true;
    }
  }

  return false;
}

/**
 * Check if transaction field matches filter value with smart text matching.
 *
 * @param fieldValue - Field value from transaction
 * @param filterValue - Filter value to match against
 * @param options - Normalization and matching options
 * @returns true if field matches filter
 */
export function matchesFilter(
  fieldValue: string | number | boolean | null | undefined,
  filterValue: string | number,
  options: NormalizationOptions = {},
): boolean {
  // Handle null/undefined
  if (fieldValue == null) {
    return false;
  }

  // Convert to string for text matching
  const fieldStr = String(fieldValue);
  const filterStr = String(filterValue);

  const { matchStrategy = "contains", fuzzyThreshold = 2 } = options;

  // Normalize both values
  const normalizedField = normalizeText(fieldStr, options);
  const normalizedFilter = normalizeText(filterStr, options);

  // Apply match strategy
  switch (matchStrategy) {
    case "exact":
      return normalizedField === normalizedFilter;

    case "contains":
      return normalizedField.includes(normalizedFilter);

    case "startsWith":
      return normalizedField.startsWith(normalizedFilter);

    case "fuzzy": {
      // Check if Levenshtein distance is within threshold
      const distance = levenshteinDistance(normalizedField, normalizedFilter);
      if (distance <= fuzzyThreshold) {
        return true;
      }

      // Also check contains match for fuzzy
      if (
        normalizedField.includes(normalizedFilter) ||
        normalizedFilter.includes(normalizedField)
      ) {
        return true;
      }

      return false;
    }

    default:
      return false;
  }
}
