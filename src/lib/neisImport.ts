import { cleanSubject, type TimetableRow } from './neis';
import { newId, type TimetableEntry } from './types';

/**
 * 나이스에서 받은 한 주 시간표를 앱 시간표로 합칩니다.
 * - 나이스에 수업이 있는 요일은 나이스 내용으로 바꿉니다.
 * - 공휴일 등으로 나이스에 아무 수업도 없는 요일은 기존 내용을 그대로 둡니다.
 * - 같은 칸에 같은 과목이 있었다면 직접 적어 둔 교실·선생님을 유지합니다.
 * - 같은 칸의 과목이 이전과 다르면 changedFrom에 이전 과목을 남겨 화면에서 강조합니다.
 */
export function mergeNeisTimetable(
  existing: TimetableEntry[],
  rows: TimetableRow[],
): { timetable: TimetableEntry[]; days: number[]; maxPeriod: number; changed: number } {
  const days = [...new Set(rows.map((r) => r.day))].sort();
  const kept = existing.filter((e) => !days.includes(e.day));
  const seen = new Set<string>();
  const imported: TimetableEntry[] = [];
  for (const r of rows) {
    const key = `${r.day}:${r.period}`;
    if (seen.has(key)) continue; // 같은 요일이 두 번 나오면 첫 번째 것만
    seen.add(key);
    const prev = existing.find((e) => e.day === r.day && e.period === r.period);
    const subject = r.subject.slice(0, 30);
    // 예전에 '* 화면 구현'처럼 표시가 붙은 채 저장된 과목도 같은 과목으로 봅니다
    const same = prev && cleanSubject(prev.subject) === subject;
    imported.push({
      id: same ? prev.id : newId(),
      day: r.day,
      period: r.period,
      subject,
      room: same ? prev.room : '',
      teacher: same ? prev.teacher : '',
      changedFrom: prev && !same ? prev.subject : null,
    });
  }
  // 이전엔 수업이 있었는데 나이스에서 빠진 칸은 '(수업 없음)'으로 바뀐 것으로 표시
  for (const prev of existing) {
    if (!days.includes(prev.day) || seen.has(`${prev.day}:${prev.period}`)) continue;
    imported.push({ id: newId(), day: prev.day, period: prev.period, subject: '수업 없음', room: '', teacher: '', changedFrom: prev.subject });
  }
  return {
    timetable: [...kept, ...imported],
    days,
    maxPeriod: Math.max(0, ...rows.map((r) => r.period)),
    changed: imported.filter((e) => e.changedFrom).length,
  };
}
