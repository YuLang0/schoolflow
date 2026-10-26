import { isDateStr, toDateStr } from './date';
import { defaultSettings, type AppData, type Priority } from './types';

export const BACKUP_APP = 'schoolflow';
export const BACKUP_VERSION = 1;

export function makeBackup(data: AppData, now = new Date()): string {
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data }, null, 2);
}

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
const id = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 100 ? v : crypto.randomUUID());
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];
const time = (v: unknown) => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : '');

/** 백업 파일을 검증해 AppData로 변환. 형식이 틀리면 한국어 오류 메시지로 throw */
export function parseBackup(text: string): AppData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('JSON 파일 형식이 아닙니다.');
  }
  const root = raw as Record<string, unknown>;
  if (!root || root.app !== BACKUP_APP || typeof root.data !== 'object' || !root.data) {
    throw new Error('SchoolFlow 백업 파일이 아닙니다.');
  }
  if (typeof root.version !== 'number' || root.version > BACKUP_VERSION) {
    throw new Error('지원하지 않는 백업 버전입니다. 앱을 최신으로 새로고침해 주세요.');
  }
  const d = root.data as Record<string, unknown>;

  const timetable = arr(d.timetable)
    .filter((e) => Number.isInteger(e.day) && Number.isInteger(e.period))
    .map((e) => ({
      id: id(e.id),
      day: Math.min(4, Math.max(0, e.day as number)),
      period: Math.min(12, Math.max(1, e.period as number)),
      subject: str(e.subject, 50),
      room: str(e.room, 50),
      teacher: str(e.teacher, 50),
    }))
    .filter((e) => e.subject);

  const assignments = arr(d.assignments)
    .filter((a) => isDateStr(a.due) && str(a.title))
    .map((a) => ({
      id: id(a.id),
      title: str(a.title, 200),
      subject: str(a.subject, 50),
      due: a.due as string,
      priority: (['low', 'normal', 'high'].includes(a.priority as string) ? a.priority : 'normal') as Priority,
      memo: str(a.memo),
      done: a.done === true,
      doneAt: a.done === true && isDateStr(a.doneAt) ? (a.doneAt as string) : null,
      createdAt: str(a.createdAt, 40) || new Date().toISOString(),
    }));

  const exams = arr(d.exams)
    .filter((e) => isDateStr(e.date) && str(e.title))
    .map((e) => ({
      id: id(e.id),
      title: str(e.title, 200),
      subject: str(e.subject, 50),
      date: e.date as string,
      time: time(e.time),
      scope: str(e.scope),
      memo: str(e.memo),
      score: typeof e.score === 'number' && Number.isFinite(e.score) ? e.score : null,
    }));

  const events = arr(d.events)
    .filter((e) => isDateStr(e.date) && str(e.title))
    .map((e) => ({ id: id(e.id), title: str(e.title, 200), date: e.date as string, memo: str(e.memo) }));

  const notices = arr(d.notices)
    .filter((n) => str(n.title))
    .map((n) => ({
      id: id(n.id),
      title: str(n.title, 200),
      body: str(n.body, 5000),
      date: isDateStr(n.date) ? (n.date as string) : toDateStr(new Date()),
      pinned: n.pinned === true,
      important: n.important === true,
    }));

  const base = defaultSettings();
  const s = (d.settings && typeof d.settings === 'object' ? d.settings : {}) as Record<string, unknown>;
  const periodTimes = arr(s.periodTimes)
    .map((p) => ({ start: time(p.start), end: time(p.end) }))
    .filter((p) => p.start && p.end);
  const settings = {
    ...base,
    schoolName: str(s.schoolName, 100),
    grade: str(s.grade, 20),
    periodTimes: periodTimes.length ? periodTimes.slice(0, 12) : base.periodTimes,
    notifications: s.notifications === true,
    remindDays: typeof s.remindDays === 'number' ? Math.min(7, Math.max(0, Math.round(s.remindDays))) : base.remindDays,
    classReminder: s.classReminder === true,
  };

  return { timetable, assignments, exams, events, notices, settings };
}
