import type { TimetableRow } from './neis';
import { newId, type PeriodTime, type TimetableEntry } from './types';

/**
 * 나이스에서 받은 한 주 시간표를 앱 시간표로 합칩니다.
 * - 나이스에 수업이 있는 요일은 나이스 내용으로 바꿉니다.
 * - 공휴일 등으로 나이스에 아무 수업도 없는 요일은 기존 내용을 그대로 둡니다.
 * - 같은 칸에 같은 과목이 있었다면 직접 적어 둔 교실·선생님을 유지합니다.
 */
export function mergeNeisTimetable(existing: TimetableEntry[], rows: TimetableRow[]): { timetable: TimetableEntry[]; days: number[]; maxPeriod: number } {
  const days = [...new Set(rows.map((r) => r.day))].sort();
  const kept = existing.filter((e) => !days.includes(e.day));
  const seen = new Set<string>();
  const imported: TimetableEntry[] = [];
  for (const r of rows) {
    const key = `${r.day}:${r.period}`;
    if (seen.has(key)) continue; // 같은 요일이 두 번 나오면 첫 번째 것만
    seen.add(key);
    const prev = existing.find((e) => e.day === r.day && e.period === r.period);
    const same = prev && prev.subject === r.subject;
    imported.push({ id: same ? prev.id : newId(), day: r.day, period: r.period, subject: r.subject.slice(0, 30), room: same ? prev.room : '', teacher: same ? prev.teacher : '' });
  }
  return { timetable: [...kept, ...imported], days, maxPeriod: Math.max(0, ...rows.map((r) => r.period)) };
}

/** 나이스 시간표가 설정된 교시 수보다 많으면 교시 시간을 이어 붙입니다 (50분 수업, 10분 쉬는 시간) */
export function extendPeriods(times: PeriodTime[], count: number): PeriodTime[] {
  const out = times.map((t) => ({ ...t }));
  const add = (hhmm: string, min: number) => {
    const [h, m] = hhmm.split(':').map(Number);
    const t = Math.min(h * 60 + m + min, 23 * 60 + 59);
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  };
  while (out.length < count) {
    const last = out.at(-1)?.end ?? '08:30';
    const start = add(last, 10);
    out.push({ start, end: add(start, 50) });
  }
  return out;
}
