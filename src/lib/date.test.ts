import { describe, expect, it } from 'vitest';
import { addDays, ddayLabel, diffDays, isDateStr, monthGrid, toDateStr, weekdayIndex } from './date';

describe('date', () => {
  it('현지 날짜 기준으로 문자열을 만든다 (자정 직후에도 하루 밀리지 않음)', () => {
    expect(toDateStr(new Date(2026, 9, 26, 0, 30))).toBe('2026-10-26');
    expect(toDateStr(new Date(2026, 9, 26, 23, 59))).toBe('2026-10-26');
  });
  it('날짜 계산', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(diffDays('2026-10-26', '2026-11-02')).toBe(7);
    expect(diffDays('2026-03-08', '2026-03-09')).toBe(1);
  });
  it('D-day 표시', () => {
    expect(ddayLabel('2026-10-26', '2026-10-26')).toBe('D-DAY');
    expect(ddayLabel('2026-10-26', '2026-10-29')).toBe('D-3');
    expect(ddayLabel('2026-10-26', '2026-10-24')).toBe('D+2');
  });
  it('날짜 형식 검증', () => {
    expect(isDateStr('2026-02-29')).toBe(false);
    expect(isDateStr('2028-02-29')).toBe(true);
    expect(isDateStr('2026-1-1')).toBe(false);
    expect(isDateStr(20261026)).toBe(false);
  });
  it('요일은 월요일=0', () => {
    expect(weekdayIndex(new Date(2026, 9, 26))).toBe(0); // 월
    expect(weekdayIndex(new Date(2026, 9, 25))).toBe(6); // 일
  });
  it('달력은 월요일부터 42칸', () => {
    const g = monthGrid(2026, 9); // 2026년 10월 1일은 목요일
    expect(g).toHaveLength(42);
    expect(g[0]).toBe('2026-09-28');
    expect(g[3]).toBe('2026-10-01');
  });
});
