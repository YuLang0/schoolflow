import { describe, expect, it } from 'vitest';
import { classStatus } from './schedule';
import { DEFAULT_PERIOD_TIMES } from './types';

const at = (h: number, m: number, day = 26) => new Date(2026, 9, day, h, m); // 2026-10-26 월요일

describe('classStatus (우리 학교 고정 시간표)', () => {
  it('수업 전/중/쉬는시간/점심/종료/주말', () => {
    expect(classStatus(at(8, 30), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'before', next: 1 });
    expect(classStatus(at(9, 10), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'class', period: 1, endsIn: 50 });
    expect(classStatus(at(9, 59), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'class', period: 1, endsIn: 1 });
    expect(classStatus(at(10, 0), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'break', next: 2, startsIn: 10 });
    expect(classStatus(at(12, 59), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'class', period: 4, endsIn: 1 });
    expect(classStatus(at(13, 0), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'lunch', next: 5, startsIn: 50 });
    expect(classStatus(at(13, 49), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'lunch', next: 5, startsIn: 1 });
    expect(classStatus(at(13, 50), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'class', period: 5, endsIn: 50 });
    expect(classStatus(at(14, 45), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'break', next: 6, startsIn: 5 });
    expect(classStatus(at(16, 39), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'class', period: 7, endsIn: 1 });
    expect(classStatus(at(16, 40), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'after' });
    expect(classStatus(at(10, 0, 31), DEFAULT_PERIOD_TIMES)).toEqual({ kind: 'weekend' });
  });
});
