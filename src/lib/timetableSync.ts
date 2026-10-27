import { formatKoreanDate } from './date';
import { fetchTimetable, isNeisLimited, schoolWeek } from './neis';
import { mergeNeisTimetable } from './neisImport';
import { DAY_NAMES, PERIOD_COUNT, type AppData, type SchoolRef, type Settings } from './types';

export const classKeyOf = (s: Pick<Settings, 'gradeNo' | 'classNo'>) => `${s.gradeNo}-${s.classNo}`;

/** 이번 주 시간표를 아직 이 반 기준으로 가져오지 않았으면 true */
export function needsTimetableSync(s: Settings, now: Date): boolean {
  if (!s.gradeNo || !s.classNo) return false;
  return s.ttSyncWeek !== schoolWeek(now).from || s.ttSyncClass !== classKeyOf(s);
}

export interface SyncResult {
  data: AppData | null; // 저장할 새 데이터 (가져올 게 없으면 null)
  kind: 'success' | 'info';
  message: string;
}

/**
 * 나이스에서 이번 주 우리 반 시간표를 가져와 합칩니다.
 * - 반이 바뀌었으면 기존 시간표를 버리고 새 반 시간표로 채웁니다 (변경 표시 없음).
 * - 같은 반이면 지난번과 달라진 칸을 변경 표시합니다.
 */
export async function syncTimetable(data: AppData, school: SchoolRef, now: Date): Promise<SyncResult> {
  const s = data.settings;
  const week = schoolWeek(now);
  const key = classKeyOf(s);
  const all = await fetchTimetable(school, s.gradeNo, s.classNo, week.from, week.to);
  const rows = all.filter((r) => r.period <= PERIOD_COUNT); // 우리 학교는 7교시까지
  if (rows.length === 0) {
    return {
      data: null,
      kind: 'info',
      message: `나이스에 ${formatKoreanDate(week.from)} 주 ${s.gradeNo}학년 ${s.classNo}반 시간표가 아직 없습니다. 방학이거나 학교가 아직 올리지 않았을 수 있습니다.`,
    };
  }
  const classChanged = !!s.ttSyncClass && s.ttSyncClass !== key;
  const merged = mergeNeisTimetable(classChanged ? [] : data.timetable, rows);
  const dayNames = merged.days.map((d) => DAY_NAMES[d]).join('·');
  const extra = all.length - rows.length;
  return {
    data: { ...data, timetable: merged.timetable, settings: { ...s, ttSyncWeek: week.from, ttSyncClass: key } },
    kind: 'success',
    message:
      `${s.gradeNo}학년 ${s.classNo}반 ${formatKoreanDate(week.from)} 주 시간표 ${rows.length}개 수업을 나이스에서 가져왔습니다. (${dayNames})` +
      (merged.changed > 0 ? ` 지난번과 달라진 수업 ${merged.changed}개는 주황색으로 표시했습니다.` : '') +
      (extra > 0 ? ` (8교시 이후 ${extra}개는 제외)` : '') +
      (isNeisLimited() ? ' ※ 서버 연결이 막혀 5개까지만 받아 왔습니다.' : ''),
  };
}
