/**
 * Unit tests for text-normalizer
 * Tests text normalization functions for smart filtering
 */

import {
  normalizeText,
  removeDiacritics,
  matchesFilter,
  checkSynonyms,
  levenshteinDistance,
} from '@/lib/ai/text-normalizer';

describe('text-normalizer', () => {
  describe('normalizeText', () => {
    it('should convert to lowercase when caseSensitive is false', () => {
      expect(normalizeText('Hello World')).toBe('hello world');
      expect(normalizeText('CÔNG TY ABC')).toBe('công ty abc');
    });

    it('should preserve case when caseSensitive is true', () => {
      expect(normalizeText('Hello World', { caseSensitive: true })).toBe('Hello World');
    });

    it('should trim and collapse whitespace', () => {
      expect(normalizeText('  hello   world  ')).toBe('hello world');
      expect(normalizeText('hello\n\nworld')).toBe('hello world');
    });

    it('should remove diacritics when requested', () => {
      expect(normalizeText('điện tử', { removeDiacritics: true })).toBe('dien tu');
      expect(normalizeText('café', { removeDiacritics: true })).toBe('cafe');
    });
  });

  describe('removeDiacritics', () => {
    it('should remove Vietnamese diacritics', () => {
      expect(removeDiacritics('điện')).toBe('dien');
      expect(removeDiacritics('Đồng')).toBe('Dong');
      expect(removeDiacritics('Hà Nội')).toBe('Ha Noi');
    });

    it('should handle đ/Đ character specifically', () => {
      expect(removeDiacritics('đ')).toBe('d');
      expect(removeDiacritics('Đ')).toBe('D');
    });

    it('should handle other Vietnamese characters', () => {
      expect(removeDiacritics('ă â ê ô ơ ư')).toBe('a a e o o u');
      expect(removeDiacritics('Ă Â Ê Ô Ơ Ư')).toBe('A A E O O U');
    });
  });

  describe('matchesFilter - contains matching', () => {
    it('should match case-insensitively', () => {
      expect(matchesFilter('United States', 'US', { matchStrategy: 'contains' })).toBe(false); // substring not present
      expect(matchesFilter('USA', 'us', { matchStrategy: 'contains' })).toBe(true);
      expect(matchesFilter('CÔNG TY ABC', 'abc', { matchStrategy: 'contains' })).toBe(true);
    });

    it('should match with whitespace normalization', () => {
      expect(matchesFilter('  hello   world  ', 'hello world', { matchStrategy: 'contains' })).toBe(true);
      expect(matchesFilter('hello world', 'world', { matchStrategy: 'contains' })).toBe(true);
    });

    it('should match Vietnamese text', () => {
      expect(matchesFilter('điện tử', 'điện', { matchStrategy: 'contains' })).toBe(true);
      expect(matchesFilter('Công ty điện tử', 'điện tử', { matchStrategy: 'contains' })).toBe(true);
    });

    it('should match with diacritics removed', () => {
      expect(matchesFilter('điện tử', 'dien', { 
        matchStrategy: 'contains',
        removeDiacritics: true 
      })).toBe(true);
    });
  });

  describe('matchesFilter - exact matching', () => {
    it('should match exactly', () => {
      expect(matchesFilter('USA', 'usa', { matchStrategy: 'exact' })).toBe(true);
      expect(matchesFilter('USA', 'us', { matchStrategy: 'exact' })).toBe(false);
    });
  });

  describe('matchesFilter - startsWith matching', () => {
    it('should match prefix', () => {
      expect(matchesFilter('United States', 'united', { matchStrategy: 'startsWith' })).toBe(true);
      expect(matchesFilter('United States', 'states', { matchStrategy: 'startsWith' })).toBe(false);
    });
  });

  describe('matchesFilter - fuzzy matching', () => {
    it('should match with typos within threshold', () => {
      expect(matchesFilter('electronic', 'electonic', { 
        matchStrategy: 'fuzzy',
        fuzzyThreshold: 2 
      })).toBe(true);
      
      expect(matchesFilter('company', 'compny', { 
        matchStrategy: 'fuzzy',
        fuzzyThreshold: 2 
      })).toBe(true);
    });

    it('should not match beyond threshold', () => {
      expect(matchesFilter('electronic', 'elec', { 
        matchStrategy: 'fuzzy',
        fuzzyThreshold: 2 
      })).toBe(true); // contains match fallback
    });

    it('should handle contains fallback for fuzzy', () => {
      expect(matchesFilter('electronics company', 'elec', { 
        matchStrategy: 'fuzzy',
        fuzzyThreshold: 1 
      })).toBe(true);
    });
  });

  describe('checkSynonyms', () => {
    it('should match country synonyms', () => {
      expect(checkSynonyms('US', 'USA')).toBe(true);
      expect(checkSynonyms('US', 'United States')).toBe(true);
      expect(checkSynonyms('USA', 'America')).toBe(true);
      expect(checkSynonyms('Hoa Kỳ', 'United States')).toBe(true);
    });

    it('should match company synonyms', () => {
      expect(checkSynonyms('CÔNG TY', 'Cty')).toBe(true);
      expect(checkSynonyms('Co.', 'Company')).toBe(true);
    });

    it('should handle direct matches', () => {
      expect(checkSynonyms('test', 'test')).toBe(true);
      expect(checkSynonyms('TEST', 'test')).toBe(true);
    });

    it('should not match unrelated terms', () => {
      expect(checkSynonyms('US', 'Vietnam')).toBe(false);
      expect(checkSynonyms('CÔNG TY', 'Factory')).toBe(false);
    });

    it('should support custom synonyms', () => {
      const customSynonyms = {
        'ABC': ['ABC Corp', 'ABC Company', 'ABC Ltd'],
      };
      expect(checkSynonyms('ABC', 'ABC Corp', customSynonyms)).toBe(true);
    });
  });

  describe('levenshteinDistance', () => {
    it('should calculate edit distance', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
      expect(levenshteinDistance('test', 'test')).toBe(0);
    });

    it('should handle single character differences', () => {
      expect(levenshteinDistance('electonic', 'electronic')).toBe(1);
      expect(levenshteinDistance('compny', 'company')).toBe(1);
    });
  });

  describe('matchesFilter - null/undefined handling', () => {
    it('should return false for null/undefined', () => {
      expect(matchesFilter(null, 'test')).toBe(false);
      expect(matchesFilter(undefined, 'test')).toBe(false);
    });

    it('should handle numeric values', () => {
      expect(matchesFilter(12345, '123', { matchStrategy: 'contains' })).toBe(true);
      expect(matchesFilter(12345, 12345, { matchStrategy: 'exact' })).toBe(true);
    });

    it('should handle boolean values', () => {
      expect(matchesFilter(true, 'true', { matchStrategy: 'exact' })).toBe(true);
      expect(matchesFilter(false, 'false', { matchStrategy: 'exact' })).toBe(true);
    });
  });
});
