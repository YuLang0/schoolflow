export type Priority = 'low' | 'normal' | 'high';

export interface TimetableEntry {
  id: string;
  day: number; // 0=월 … 4=금
  period: number; // 1부터
  subject: string;
  room: string;
  teacher: string;
}

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  due: string; // YYYY-MM-DD
  priority: Priority;
  memo: string;
  done: boolean;
  doneAt: string | null; // YYYY-MM-DD
  createdAt: string;
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  date: string;
  time: string; // HH:MM 또는 ''
  scope: string;
  memo: string;
  score: number | null;
}

export interface CalEvent {
  id: string;
  title: string;
  date: string;
  memo: string;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  date: string;
  pinned: boolean;
  important: boolean;
}

export interface PeriodTime {
  start: string; // HH:MM
  end: string;
}

export interface Settings {
  id: 'settings';
  schoolName: string;
  grade: string;
  periodTimes: PeriodTime[];
  notifications: boolean;
  remindDays: number; // 마감 며칠 전부터 알릴지
  classReminder: boolean; // 수업 5분 전 알림
}

export interface AppData {
  timetable: TimetableEntry[];
  assignments: Assignment[];
  exams: Exam[];
  events: CalEvent[];
  notices: Notice[];
  settings: Settings;
}

export type ListCollection = 'timetable' | 'assignments' | 'exams' | 'events' | 'notices';
export type Collection = ListCollection | 'settings';

export interface AppUser {
  id: string;
  email: string;
  name: string;
}

export const DEFAULT_PERIOD_TIMES: PeriodTime[] = [
  { start: '08:40', end: '09:30' },
  { start: '09:40', end: '10:30' },
  { start: '10:40', end: '11:30' },
  { start: '11:40', end: '12:30' },
  { start: '13:30', end: '14:20' },
  { start: '14:30', end: '15:20' },
  { start: '15:30', end: '16:20' },
];

export function defaultSettings(): Settings {
  return {
    id: 'settings',
    schoolName: '',
    grade: '',
    periodTimes: DEFAULT_PERIOD_TIMES.map((p) => ({ ...p })),
    notifications: false,
    remindDays: 1,
    classReminder: false,
  };
}

export function emptyData(): AppData {
  return { timetable: [], assignments: [], exams: [], events: [], notices: [], settings: defaultSettings() };
}

export const DAY_NAMES = ['월', '화', '수', '목', '금'];

export function newId(): string {
  return crypto.randomUUID();
}
