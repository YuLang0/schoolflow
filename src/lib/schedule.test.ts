import { describe, expect, it } from 'vitest';
import { classStatus } from './schedule';
import { DEFAULT_PERIOD_TIMES } from './types';

const at = (h: number, m: number, day = 26) => new Date(2026, 9, day, h, m); // 2026-10-26 월요일

describe('classStatus', () => {
  it('수업 전/중/쉬는시간/종료/주말', () => {
    expect(classStatus(at(7, 0), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'before', next: 1 });
    expect(classStatus(at(8, 40), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'class', period: 1, endsIn: 50 });
    expect(classStatus(at(9, 29), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'class', period: 1, endsIn: 1 });
    expect(classStatus(at(9, 30), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'break', next: 2, startsIn: 10 });
    expect(classStatus(at(12, 45), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'break', next: 5, startsIn: 45 });
    expect(classStatus(at(16, 20), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'after' });
    expect(classStatus(at(10, 0, 31), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'weekend' });
  });
});
