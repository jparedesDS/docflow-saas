import {
  formatDate,
  formatDateISO,
  formatDateTime,
  timeAgo,
  diasDesde,
  diffDaysFromNow,
} from '../dates';

describe('formatDate', () => {
  test('formats a valid ISO date string', () => {
    const result = formatDate('2026-03-15');
    expect(typeof result).toBe('string');
    expect(result).toBeTruthy();
    // Should contain year
    expect(result).toContain('2026');
  });

  test('returns empty string for null/undefined/empty', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('')).toBe('');
  });

  test('returns the original string if date is invalid', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  test('handles Date object-like ISO string', () => {
    const result = formatDate('2026-01-01T12:00:00Z');
    expect(result).toContain('2026');
  });
});

describe('formatDateISO', () => {
  test('returns ISO date part from ISO datetime string', () => {
    expect(formatDateISO('2026-03-15T10:30:00Z')).toBe('2026-03-15');
  });

  test('returns the string as-is if no T separator', () => {
    expect(formatDateISO('2026-03-15')).toBe('2026-03-15');
  });

  test('returns em dash for null/undefined/empty', () => {
    expect(formatDateISO(null)).toBe('\u2014');
    expect(formatDateISO(undefined)).toBe('\u2014');
    expect(formatDateISO('')).toBe('\u2014');
  });

  test('handles numeric input by converting to string', () => {
    const result = formatDateISO(12345);
    expect(typeof result).toBe('string');
  });
});

describe('formatDateTime', () => {
  test('formats a valid ISO datetime string', () => {
    const result = formatDateTime('2026-03-15T10:30:00Z');
    expect(typeof result).toBe('string');
    expect(result).toBeTruthy();
  });

  test('returns empty string for null/undefined/empty', () => {
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime(undefined)).toBe('');
    expect(formatDateTime('')).toBe('');
  });
});

describe('timeAgo', () => {
  test('returns "ahora" for very recent dates', () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe('ahora');
  });

  test('returns minutes format for dates within an hour', () => {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const result = timeAgo(tenMinsAgo);
    expect(result).toMatch(/^hace \d+m$/);
  });

  test('returns hours format for dates within a day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const result = timeAgo(threeHoursAgo);
    expect(result).toMatch(/^hace \d+h$/);
  });

  test('returns days format for dates over 24 hours ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const result = timeAgo(twoDaysAgo);
    expect(result).toMatch(/^hace \d+d$/);
  });

  test('returns empty string for null/undefined/empty', () => {
    expect(timeAgo(null)).toBe('');
    expect(timeAgo(undefined)).toBe('');
    expect(timeAgo('')).toBe('');
  });
});

describe('diasDesde', () => {
  test('returns a non-negative number for a past date', () => {
    const result = diasDesde('2026-03-01');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test('returns 0 for today', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(diasDesde(today)).toBe(0);
  });

  test('returns null for null/undefined/empty', () => {
    expect(diasDesde(null)).toBeNull();
    expect(diasDesde(undefined)).toBeNull();
    expect(diasDesde('')).toBeNull();
  });

  test('returns null for invalid date strings', () => {
    expect(diasDesde('not-a-date')).toBeNull();
  });

  test('handles ISO datetime strings by stripping time part', () => {
    const result = diasDesde('2026-03-01T10:30:00Z');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe('diffDaysFromNow', () => {
  test('is an alias for diasDesde', () => {
    expect(diffDaysFromNow).toBe(diasDesde);
  });
});
