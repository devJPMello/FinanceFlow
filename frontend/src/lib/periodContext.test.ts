import { describe, it, expect } from 'vitest';
import {
  dashboardFocusMonth,
  isValidMonthKey,
  monthKeyToDateRangeLocal,
  formatMonthKeyPt,
} from './periodContext';

describe('periodContext', () => {
  it('dashboardFocusMonth usa dezembro para ano passado', () => {
    const y = new Date().getFullYear();
    expect(dashboardFocusMonth(y - 1)).toBe(`${y - 1}-12`);
  });

  it('isValidMonthKey', () => {
    expect(isValidMonthKey('2026-04')).toBe(true);
    expect(isValidMonthKey('2026-13')).toBe(false);
    expect(isValidMonthKey(null)).toBe(false);
  });

  it('monthKeyToDateRangeLocal cobre o mês civil inteiro', () => {
    expect(monthKeyToDateRangeLocal('2026-02')).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });
  });

  it('formatMonthKeyPt', () => {
    expect(formatMonthKeyPt('2026-04')).toMatch(/abril.*2026/);
  });
});
