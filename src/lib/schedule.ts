import { minutesOf, weekdayIndex } from './date';
import type { PeriodTime, TimetableEntry } from './types';

export type ClassStatus =
  | { kind: 'weekend' }
  | { kind: 'before'; next: number }
  | { kind: 'class'; period: number; endsIn: number }
  | { kind: 'break'; next: number; startsIn: number }
  | { kind: 'lunch'; next: number; startsIn: number }
  | { kind: 'after' };

/** 현재 시각이 몇 교시인지. 교시 번호는 1부터 */
export function classStatus(now: Date, times: PeriodTime[]): ClassStatus {
  const day = weekdayIndex(now);
  if (day > 4 || times.length === 0) return { kind: 'weekend' };
  const t = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < times.length; i++) {
    const s = minutesOf(times[i].start);
    const e = minutesOf(times[i].end);
    if (t < s) {
      if (i === 0) return { kind: 'before', next: 1 };
      // 30분 이상 비는 시간은 점심시간
      const gap = s - minutesOf(times[i - 1].end);
      return { kind: gap >= 30 ? 'lunch' : 'break', next: i + 1, startsIn: s - t };
    }
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

const roomKey = (s: string) => s.replace(/\s|호|교실|반/g, '').toLowerCase();

/** 이동수업인지: 직접 표시했거나, 교실이 우리 반 교실과 다르면 */
export function isMovingClass(e: TimetableEntry | undefined, homeRoom: string): boolean {
  if (!e || e.subject === '수업 없음') return false;
  if (e.moving) return true;
  return !!(e.room && homeRoom && roomKey(e.room) !== roomKey(homeRoom));
}

/** 공강: 그날 첫 수업과 마지막 수업 사이에 비어 있는 교시 */
export function freePeriods(timetable: TimetableEntry[], day: number): number[] {
  const filled = timetable.filter((e) => e.day === day && e.subject !== '수업 없음').map((e) => e.period);
  if (filled.length < 2) return [];
  const first = Math.min(...filled);
  const last = Math.max(...filled);
  const out: number[] = [];
  for (let p = first + 1; p < last; p++) if (!filled.includes(p)) out.push(p);
  return out;
}
