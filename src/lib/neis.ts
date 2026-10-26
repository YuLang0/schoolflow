// 나이스 교육정보 개방 포털 API (학교 검색, 시간표, 급식)
// 요청은 /api/neis (Netlify 함수, netlify/functions/neis.mjs)를 거칩니다.
import { addDays, toDateStr, weekdayIndex } from './date';

export interface NeisSchool {
  officeCode: string; // ATPT_OFCDC_SC_CODE (시도교육청)
  schoolCode: string; // SD_SCHUL_CODE
  name: string;
  officeName: string;
  kind: string; // 고등학교 등
  address: string;
}

export interface Dish {
  name: string;
  allergens: number[];
}

export interface Meal {
  date: string; // YYYY-MM-DD
  type: string; // 조식 / 중식 / 석식
  dishes: Dish[];
  calories: string;
}

export interface TimetableRow {
  date: string;
  day: number; // 0=월
  period: number;
  subject: string;
}

export const ALLERGENS = [
  '난류', '우유', '메밀', '땅콩', '대두', '밀', '고등어', '게', '새우', '돼지고기',
  '복숭아', '토마토', '아황산류', '호두', '닭고기', '쇠고기', '오징어', '조개류', '잣',
];

type Row = Record<string, string>;

export const ymd = (date: string) => date.replace(/-/g, '');
export const fromYmd = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

/** 나이스 응답에서 row 목록을 꺼냄. 데이터 없음(INFO-200)은 빈 배열 */
export function neisRows(endpoint: string, body: unknown): Row[] {
  const b = body as Record<string, unknown>;
  if (b && typeof b === 'object' && 'error' in b && typeof b.error === 'string') throw new Error(b.error);
  const result = (b?.RESULT ?? null) as { CODE?: string; MESSAGE?: string } | null;
  if (result) {
    if (result.CODE === 'INFO-200') return [];
    throw new Error(neisErrorMessage(result.CODE, result.MESSAGE));
  }
  const sections = b?.[endpoint] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(sections)) throw new Error('나이스 응답 형식이 올바르지 않습니다.');
  const head = sections.find((s) => Array.isArray(s.head))?.head as Array<Record<string, unknown>> | undefined;
  const r = head?.find((h) => h.RESULT)?.RESULT as { CODE?: string; MESSAGE?: string } | undefined;
  if (r && r.CODE !== 'INFO-000') {
    if (r.CODE === 'INFO-200') return [];
    throw new Error(neisErrorMessage(r.CODE, r.MESSAGE));
  }
  return (sections.find((s) => Array.isArray(s.row))?.row as Row[]) ?? [];
}

function neisErrorMessage(code?: string, message?: string): string {
  if (code === 'ERROR-290') return '나이스 인증키가 올바르지 않습니다. 관리자에게 알려 주세요.';
  if (code === 'INFO-300' || code === 'ERROR-337') return '나이스 이용 한도를 넘었습니다. 잠시 후 다시 시도해 주세요.';
  return `나이스 오류: ${message ?? code ?? '알 수 없음'}`;
}

let directMode = false; // 서버 중계가 막혀 브라우저에서 나이스로 바로 연결 중인지

/** 서버 중계가 실패해 나이스에 직접 연결했는지 (이때는 인증키 없이 한 번에 최대 5건) */
export const isNeisLimited = () => directMode;

async function viaProxy(endpoint: string, params: Record<string, string>): Promise<unknown> {
  // v=2: 인증키 없이 5건만 받던 예전 응답이 브라우저 캐시에 남아 있지 않도록
  const res = await fetch(`/api/neis?${new URLSearchParams({ endpoint, ...params, v: '2' })}`);
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) throw new Error(`나이스 정보를 가져오지 못했습니다. (서버 응답 오류 ${res.status})`);
  if (!res.ok && typeof body.error === 'string') {
    throw Object.assign(new Error(body.error), { proxyFailed: true, detail: body.detail });
  }
  return body;
}

/** 서버 중계가 안 될 때: 사용자의 브라우저(국내 인터넷)에서 나이스로 바로 요청. 인증키는 쓰지 않음 */
async function direct(endpoint: string, params: Record<string, string>): Promise<unknown> {
  const u = new URL(`https://open.neis.go.kr/hub/${endpoint}`);
  u.search = new URLSearchParams({ Type: 'json', pIndex: '1', pSize: '100', ...params }).toString();
  const res = await fetch(u);
  return res.json();
}

async function call(endpoint: string, params: Record<string, string>): Promise<Row[]> {
  let body: unknown;
  try {
    body = directMode ? await direct(endpoint, params) : await viaProxy(endpoint, params);
  } catch (e) {
    const err = e as Error & { proxyFailed?: boolean; detail?: string };
    if (directMode) throw new Error('나이스 정보를 가져오지 못했습니다. 인터넷 연결을 확인해 주세요.');
    // 서버 중계 실패 → 브라우저에서 직접 시도
    try {
      body = await direct(endpoint, params);
      directMode = true;
      console.warn('나이스 서버 중계 실패, 직접 연결로 전환:', err.message, err.detail ?? '');
    } catch {
      throw new Error(`${err.message}${err.detail ? ` — ${err.detail}` : ''}`);
    }
  }
  return neisRows(endpoint, body);
}

export function toSchool(r: Row): NeisSchool {
  return {
    officeCode: r.ATPT_OFCDC_SC_CODE,
    schoolCode: r.SD_SCHUL_CODE,
    name: r.SCHUL_NM,
    officeName: r.ATPT_OFCDC_SC_NM ?? '',
    kind: r.SCHUL_KND_SC_NM ?? '',
    address: r.ORG_RDNMA ?? '',
  };
}

export async function searchSchools(name: string): Promise<NeisSchool[]> {
  const q = name.trim();
  if (q.length < 2) throw new Error('학교 이름을 두 글자 이상 입력해 주세요.');
  return (await call('schoolInfo', { SCHUL_NM: q })).map(toSchool);
}

/** "쌀밥<br/>된장국 (5.6.13)" → [{name:'쌀밥',allergens:[]},{name:'된장국',allergens:[5,6,13]}] */
export function parseDishes(raw: string): Dish[] {
  return raw
    .split(/<br\s*\/?>/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      // 끝에 붙은 "(5.6.13)", "(5)", "5.6.13." 형태의 알레르기 번호
      const m = s.match(/\s*(?:\(\s*(\d{1,2}(?:\.\d{1,2})*\.?)\s*\)|((?:\d{1,2}\.)+\d{0,2}))\s*$/);
      const nums = m ? (m[1] ?? m[2]) : '';
      const allergens = nums ? nums.split('.').filter(Boolean).map(Number).filter((n) => n >= 1 && n <= 19) : [];
      // 학교마다 붙이는 앞쪽 "-", "·" 와 끝의 "*", "." 정리
      const name = (m ? s.slice(0, m.index) : s)
        .replace(/^[-·•*\s]+/, '')
        .replace(/[*#.\s]+$/, '')
        .trim();
      return { name, allergens };
    })
    .filter((d) => d.name);
}

export function toMeal(r: Row): Meal {
  return { date: fromYmd(r.MLSV_YMD), type: r.MMEAL_SC_NM ?? '중식', dishes: parseDishes(r.DDISH_NM ?? ''), calories: r.CAL_INFO ?? '' };
}

const MEAL_ORDER: Record<string, number> = { 조식: 0, 중식: 1, 석식: 2 };

export async function fetchMeals(school: Pick<NeisSchool, 'officeCode' | 'schoolCode'>, from: string, to: string): Promise<Meal[]> {
  const rows = await call('mealServiceDietInfo', {
    ATPT_OFCDC_SC_CODE: school.officeCode,
    SD_SCHUL_CODE: school.schoolCode,
    MLSV_FROM_YMD: ymd(from),
    MLSV_TO_YMD: ymd(to),
  });
  return rows.map(toMeal).sort((a, b) => a.date.localeCompare(b.date) || (MEAL_ORDER[a.type] ?? 9) - (MEAL_ORDER[b.type] ?? 9));
}

export function toTimetableRows(rows: Row[]): TimetableRow[] {
  return rows
    .map((r) => {
      const date = fromYmd(r.ALL_TI_YMD);
      const [y, m, d] = date.split('-').map(Number);
      return { date, day: weekdayIndex(new Date(y, m - 1, d)), period: Number(r.PERIO), subject: (r.ITRT_CNTNT ?? '').replace(/^-\s*/, '').trim() };
    })
    .filter((r) => r.day <= 4 && r.period >= 1 && r.period <= 12 && r.subject);
}

export async function fetchTimetable(school: Pick<NeisSchool, 'officeCode' | 'schoolCode'>, grade: string, classNm: string, from: string, to: string): Promise<TimetableRow[]> {
  const rows = await call('hisTimetable', {
    ATPT_OFCDC_SC_CODE: school.officeCode,
    SD_SCHUL_CODE: school.schoolCode,
    GRADE: grade,
    CLASS_NM: classNm,
    TI_FROM_YMD: ymd(from),
    TI_TO_YMD: ymd(to),
  });
  return toTimetableRows(rows);
}

/** 이번 주 월~금 (주말이면 다음 주) */
export function schoolWeek(now: Date): { from: string; to: string } {
  const today = toDateStr(now);
  const wd = weekdayIndex(now);
  const monday = wd >= 5 ? addDays(today, 7 - wd) : addDays(today, -wd);
  return { from: monday, to: addDays(monday, 4) };
}
