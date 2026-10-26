import { minutesOf, weekdayIndex } from './date';
import type { PeriodTime, TimetableEntry } from './types';

export type ClassStatus =
  | { kind: 'weekend' }
  | { kind: 'before'; next: number }
  | { kind: 'class'; period: number; endsIn: number }
  | { kind: 'break'; next: number; startsIn: number }
  | { kind: 'after' };

/** 현재 시각이 몇 교시인지. 교시 번호는 1부터 */
export function classStatus(now: Date, times: PeriodTime[]): ClassStatus {
  const day = weekdayIndex(now);
  if (day > 4 || times.length === 0) return { kind: 'weekend' };
  const t = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < times.length; i++) {
    const s = minutesOf(times[i].start);
    const e = minutesOf(times[i].end);
    if (t < s) return i === 0 ? { kind: 'before', next: 1 } : { kind: 'break', next: i + 1, startsIn: s - t };
    if (t < e) return { kind: 'class', period: i + 1, endsIn: e - t };
  }
  return { kind: 'after' };
}

export function entryAt(timetable: TimetableEntry[], day: number, period: number): TimetableEntry | undefined {
  return timetable.find((e) => e.day === day && e.period === period);
}

export function todayClasses(timetable: TimetableEntry[], now: Date): TimetableEntry[] {
  const day = weekdayIndex(now);
  return timetable.filter((e) => e.day === day).sort((a, b) => a.period - b.period);
}
