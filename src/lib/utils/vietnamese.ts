/**
 * Vietnamese text utilities for UTF-8 handling and text processing
 * Handles diacritics, normalization, and search optimization
 */

/**
 * Remove Vietnamese diacritics for search purposes
 * Converts "Tôm đông lạnh" → "Tom dong lanh"
 */
export function removeVietnameseDiacritics(text: string): string {
  const diacriticsMap: Record<string, string> = {
    à: "a",
    á: "a",
    ả: "a",
    ã: "a",
    ạ: "a",
    ă: "a",
    ằ: "a",
    ắ: "a",
    ẳ: "a",
    ẵ: "a",
    ặ: "a",
    â: "a",
    ầ: "a",
    ấ: "a",
    ẩ: "a",
    ẫ: "a",
    ậ: "a",
    đ: "d",
    è: "e",
    é: "e",
    ẻ: "e",
    ẽ: "e",
    ẹ: "e",
    ê: "e",
    ề: "e",
    ế: "e",
    ể: "e",
    ễ: "e",
    ệ: "e",
    ì: "i",
    í: "i",
    ỉ: "i",
    ĩ: "i",
    ị: "i",
    ò: "o",
    ó: "o",
    ỏ: "o",
    õ: "o",
    ọ: "o",
    ô: "o",
    ồ: "o",
    ố: "o",
    ổ: "o",
    ỗ: "o",
    ộ: "o",
    ơ: "o",
    ờ: "o",
    ớ: "o",
    ở: "o",
    ỡ: "o",
    ợ: "o",
    ù: "u",
    ú: "u",
    ủ: "u",
    ũ: "u",
    ụ: "u",
    ư: "u",
    ừ: "u",
    ứ: "u",
    ử: "u",
    ữ: "u",
    ự: "u",
    ỳ: "y",
    ý: "y",
    ỷ: "y",
    ỹ: "y",
    ỵ: "y",
  };

  return text
    .toLowerCase()
    .split("")
    .map((char) => diacriticsMap[char] || char)
    .join("");
}

/**
 * Normalize Vietnamese text for consistent comparison
 * Handles multiple spaces, trim, and Unicode normalization
 */
export function normalizeVietnameseText(text: string): string {
  return text
    .normalize("NFC") // Canonical decomposition, then canonical composition
    .trim()
    .replace(/\s+/g, " "); // Multiple spaces → single space
}

/**
 * Create search-friendly version of text
 * Removes diacritics and normalizes
 */
export function createSearchableText(text: string): string {
  return removeVietnameseDiacritics(normalizeVietnameseText(text));
}

/**
 * Fuzzy match Vietnamese text (case-insensitive, diacritic-insensitive)
 */
export function fuzzyMatchVietnamese(text: string, query: string): boolean {
  const normalizedText = createSearchableText(text);
  const normalizedQuery = createSearchableText(query);
  return normalizedText.includes(normalizedQuery);
}

/**
 * Truncate Vietnamese text to specified length
 * Ensures we don't cut in the middle of a combining character
 */
export function truncateVietnameseText(
  text: string,
  maxLength: number,
  suffix = "...",
): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Normalize first to handle combining characters
  const normalized = text.normalize("NFC");

  // Find the nearest space before maxLength
  const truncated = normalized.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.8) {
    // If space is close enough, truncate at space
    return truncated.slice(0, lastSpace) + suffix;
  }

  return truncated + suffix;
}

/**
 * Capitalize first letter of each word (Vietnamese-aware)
 */
export function capitalizeVietnameseWords(text: string): string {
  return text
    .split(" ")
    .map((word) => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Extract keywords from Vietnamese text
 * Removes common Vietnamese stop words
 */
export function extractVietnameseKeywords(
  text: string,
  minLength = 3,
): string[] {
  const stopWords = new Set([
    "và",
    "hoặc",
    "nhưng",
    "của",
    "cho",
    "với",
    "từ",
    "trong",
    "ngoài",
    "trên",
    "dưới",
    "về",
    "theo",
    "để",
    "đến",
    "đang",
    "đã",
    "sẽ",
    "có",
    "là",
    "các",
    "những",
    "này",
    "đó",
    "kia",
    "một",
    "hai",
    "ba",
  ]);

  return normalizeVietnameseText(text)
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= minLength && !stopWords.has(word));
}

/**
 * Compare two Vietnamese strings for sorting
 * Uses locale-aware comparison
 */
export function compareVietnameseStrings(a: string, b: string): number {
  return a.localeCompare(b, "vi-VN", { sensitivity: "base" });
}
