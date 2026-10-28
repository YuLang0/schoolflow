// 앱을 닫아도 오는 알림(웹 푸시)에서 "언제 무엇을 보낼지" 정하는 순수 함수들.
// netlify/functions 폴더에는 함수 파일만 두어야 해서 여기에 둡니다.

/** 교시 시작 시각 (src/lib/types.ts의 DEFAULT_PERIOD_TIMES와 같아야 함 — 테스트로 확인) */
export const PERIOD_STARTS = ['09:10', '10:10', '11:10', '12:10', '13:50', '14:50', '15:50'];
/** 아침 알림(시험·좋아하는 메뉴) 보내는 시각 */
export const MORNING = '07:30';
export const SCHOOL_NAME = '경기모바일과학고등학교';

export const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** 한국 시간 기준 날짜·요일(월=0)·분 */
export function kstNow(date) {
  const k = new Date(date.getTime() + 9 * 3600 * 1000);
  return { ymd: k.toISOString().slice(0, 10), day: (k.getUTCDay() + 6) % 7, minutes: k.getUTCHours() * 60 + k.getUTCMinutes() };
}

/** 지금이 몇 교시 시작 5분 전인지 (평일만, 아니면 0) */
export function periodStartingIn5(kst) {
  if (kst.day > 4) return 0;
  const i = PERIOD_STARTS.findIndex((s) => toMin(s) - kst.minutes === 5);
  return i + 1;
}

export const isMorning = (kst) => kst.minutes === toMin(MORNING);

const diffDays = (a, b) => {
  const u = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((u(b) - u(a)) / 86400000);
};

/** 수업 5분 전 알림 */
export function classMessage(timetable, day, period) {
  const e = (timetable ?? []).find((x) => x && x.day === day && x.period === period);
  if (!e || !e.subject || e.subject === '수업 없음') return null;
  return {
    title: `${period}교시 ${e.subject} 5분 전`,
    body: e.room ? `장소: ${e.room}` : '곧 수업이 시작됩니다.',
    tag: `class-${period}`,
  };
}

/** 아침 시험 알림 (설정한 며칠 전부터 당일까지) */
export function examMessages(exams, remindDays, today) {
  return (exams ?? [])
    .filter((e) => e && typeof e.date === 'string')
    .map((e) => ({ e, n: diffDays(today, e.date) }))
    .filter(({ n }) => n >= 0 && n <= (remindDays ?? 1))
    .sort((a, b) => a.n - b.n)
    .map(({ e, n }) => ({
      title: `시험 ${n === 0 ? '오늘' : n === 1 ? '내일' : `${n}일 후`}`,
      body: `${e.subject ? `[${e.subject}] ` : ''}${e.title ?? ''}${e.time ? ` ${e.time}` : ''}`,
      tag: `exam-${e.id}`,
    }));
}

/** 오늘 급식에 좋아하는 메뉴가 있으면 알림 */
export function favoriteMessage(dishes, favorites) {
  const norm = (s) => String(s).replace(/\s/g, '');
  const hits = (dishes ?? []).filter((d) => (favorites ?? []).some((f) => f && norm(d).includes(norm(f))));
  if (!hits.length) return null;
  return { title: `⭐ 오늘 급식에 ${hits[0]}${hits.length > 1 ? ` 외 ${hits.length - 1}개` : ''}!`, body: hits.join(', '), tag: 'meal-fav' };
}

/** 나이스 급식 메뉴 문자열 → 메뉴 이름 목록 (src/lib/neis.ts parseDishes와 같은 규칙) */
export function dishNames(raw) {
  return String(raw ?? '')
    .split(/<br\s*\/?>/i)
    .map((s) =>
      s
        .replace(/\s*(?:\(\s*\d{1,2}(?:\.\d{1,2})*\.?\s*\)|(?:\d{1,2}\.)+\d{0,2})\s*$/, '')
        .replace(/^[-·•*\s]+/, '')
        .replace(/[*#.\s]+$/, '')
        .trim(),
    )
    .filter(Boolean);
}
