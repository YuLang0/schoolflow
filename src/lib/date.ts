// 날짜는 모두 사용자 기기의 "현지 날짜" 기준 YYYY-MM-DD 문자열로 다룹니다.
// toISOString()은 UTC로 바뀌어 한국 시간 오전 9시 전에는 하루 전 날짜가 되므로 쓰지 않습니다.

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isDateStr(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toDateStr(parseDateStr(s)) === s;
}

export function addDays(s: string, n: number): string {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** b - a (일 단위). 서머타임 영향 없이 계산 */
export function diffDays(a: string, b: string): number {
  const utc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(b) - utc(a)) / 86400000);
}

export function ddayLabel(today: string, target: string): string {
  const n = diffDays(today, target);
  if (n === 0) return 'D-DAY';
  return n > 0 ? `D-${n}` : `D+${-n}`;
}

/** 월=0 … 일=6 */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function formatKoreanDate(s: string): string {
  const d = parseDateStr(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`;
}

/** 달력용: 해당 월을 덮는 6주(42칸) 날짜 목록, 월요일 시작 */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - weekdayIndex(first));
  const out: string[] = [];
  for (let i = 0; i < 42; i++) {
    out.push(toDateStr(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  }
  return out;
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
