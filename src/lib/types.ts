import { defaultGradeCalc, type GradeCalc } from './gradeCalc';

export type Priority = 'low' | 'normal' | 'high';

export interface TimetableEntry {
  id: string;
  day: number; // 0=월 … 4=금
  period: number; // 1부터
  subject: string;
  room: string;
  teacher: string;
  /** 나이스에서 가져올 때 이전과 과목이 달라졌으면 이전 과목 이름 (직접 고치면 지워짐) */
  changedFrom?: string | null;
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

export interface SchoolRef {
  officeCode: string; // 나이스 시도교육청 코드
  schoolCode: string; // 나이스 학교 코드
  name: string;
}

export interface Settings {
  id: 'settings';
  schoolName: string;
  school: SchoolRef | null; // 나이스에서 고른 학교
  gradeNo: string; // 학년 (예: '2')
  classNo: string; // 반 (예: '3')
  allergies: number[]; // 급식 알레르기 번호 1~19
  ttSyncWeek: string; // 나이스 시간표를 마지막으로 가져온 주의 월요일 (YYYY-MM-DD)
  ttSyncClass: string; // 그때의 학년-반 (예: '2-3')
  gradeCalc: GradeCalc; // 내신 계산기 입력값
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
  /** 테스트 모드: 계정 없이 둘러보기 (이 브라우저에만 저장) */
  test?: boolean;
}

/** 우리 학교 교시 시간 (고정). 4교시와 5교시 사이 13:00~13:50은 점심시간 */
export const DEFAULT_PERIOD_TIMES: PeriodTime[] = [
  { start: '09:10', end: '10:00' },
  { start: '10:10', end: '11:00' },
  { start: '11:10', end: '12:00' },
  { start: '12:10', end: '13:00' },
  { start: '13:50', end: '14:40' },
  { start: '14:50', end: '15:40' },
  { start: '15:50', end: '16:40' },
];
export const LUNCH_TIME: PeriodTime = { start: '13:00', end: '13:50' };
export const PERIOD_COUNT = DEFAULT_PERIOD_TIMES.length;

export function defaultSettings(): Settings {
  return {
    id: 'settings',
    schoolName: '',
    school: null,
    gradeNo: '',
    classNo: '',
    allergies: [],
    ttSyncWeek: '',
    ttSyncClass: '',
    gradeCalc: defaultGradeCalc(),
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
