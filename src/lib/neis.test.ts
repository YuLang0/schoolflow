import { describe, expect, it } from 'vitest';
import { neisRows, parseDishes, schoolWeek, toMeal, toTimetableRows } from './neis';
import { mergeNeisTimetable } from './neisImport';

const ok = (endpoint: string, row: unknown[]) => ({
  [endpoint]: [{ head: [{ list_total_count: row.length }, { RESULT: { CODE: 'INFO-000', MESSAGE: '정상 처리되었습니다.' } }] }, { row }],
});

describe('neisRows', () => {
  it('정상 응답', () => {
    expect(neisRows('schoolInfo', ok('schoolInfo', [{ SCHUL_NM: 'A고' }]))).toEqual([{ SCHUL_NM: 'A고' }]);
  });
  it('데이터 없음은 빈 배열', () => {
    expect(neisRows('schoolInfo', { RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } })).toEqual([]);
  });
  it('오류는 한국어 메시지', () => {
    expect(() => neisRows('schoolInfo', { RESULT: { CODE: 'ERROR-290', MESSAGE: '인증키가 유효하지 않습니다.' } })).toThrow('인증키');
    expect(() => neisRows('schoolInfo', { error: '나이스 서버에 연결하지 못했습니다.' })).toThrow('연결하지 못했습니다');
    expect(() => neisRows('schoolInfo', { foo: 1 })).toThrow('형식');
  });
});

describe('급식', () => {
  it('메뉴와 알레르기 번호 분리', () => {
    expect(parseDishes('쌀밥<br/>된장국 (5.6.13)<br/>제육볶음(10.13.)<br/>깍두기 9.13.<br/>우유*')).toEqual([
      { name: '쌀밥', allergens: [] },
      { name: '된장국', allergens: [5, 6, 13] },
      { name: '제육볶음', allergens: [10, 13] },
      { name: '깍두기', allergens: [9, 13] },
      { name: '우유', allergens: [] },
    ]);
  });
  it('학교마다 다른 앞뒤 기호 정리', () => {
    expect(parseDishes('-발아현미밥<br/>-등뼈감자탕.<br/>백김치<br/>-구이김(선택)<br/>-치즈계란말이. (1.2.5)').map((d) => d.name)).toEqual([
      '발아현미밥', '등뼈감자탕', '백김치', '구이김(선택)', '치즈계란말이',
    ]);
  });
  it('row 변환', () => {
    expect(toMeal({ MLSV_YMD: '20261026', MMEAL_SC_NM: '중식', DDISH_NM: '밥<br/>국 (5)', CAL_INFO: '800.1 Kcal' })).toEqual({
      date: '2026-10-26',
      type: '중식',
      dishes: [{ name: '밥', allergens: [] }, { name: '국', allergens: [5] }],
      calories: '800.1 Kcal',
    });
  });
});

describe('시간표', () => {
  const rows = toTimetableRows([
    { ALL_TI_YMD: '20261026', PERIO: '1', ITRT_CNTNT: '수학Ⅰ' },
    { ALL_TI_YMD: '20261026', PERIO: '2', ITRT_CNTNT: '- 영어' },
    { ALL_TI_YMD: '20261027', PERIO: '8', ITRT_CNTNT: '자율' },
    { ALL_TI_YMD: '20261031', PERIO: '1', ITRT_CNTNT: '토요일' },
    { ALL_TI_YMD: '20261028', PERIO: '1', ITRT_CNTNT: '' },
  ]);
  it('요일·교시 변환, 주말·빈 과목 제외', () => {
    expect(rows).toEqual([
      { date: '2026-10-26', day: 0, period: 1, subject: '수학Ⅰ' },
      { date: '2026-10-26', day: 0, period: 2, subject: '영어' },
      { date: '2026-10-27', day: 1, period: 8, subject: '자율' },
    ]);
  });
  it('합치기: 나이스에 있는 요일만 바꾸고, 같은 과목이면 교실 유지', () => {
    const existing = [
      { id: 'a', day: 0, period: 1, subject: '수학Ⅰ', room: '수학실', teacher: '김' },
      { id: 'b', day: 0, period: 3, subject: '국어', room: '', teacher: '' },
      { id: 'c', day: 3, period: 1, subject: '체육', room: '운동장', teacher: '' },
    ];
    const r = mergeNeisTimetable(existing, rows);
    expect(r.days).toEqual([0, 1]);
    expect(r.maxPeriod).toBe(8);
    expect(r.timetable.find((e) => e.day === 0 && e.period === 1)).toMatchObject({ id: 'a', room: '수학실' });
    expect(r.timetable.some((e) => e.id === 'b')).toBe(false); // 월요일은 나이스 내용으로 교체
    expect(r.timetable.find((e) => e.id === 'c')).toBeTruthy(); // 목요일은 유지
  });
  it('이번 주 (주말이면 다음 주)', () => {
    expect(schoolWeek(new Date(2026, 9, 28))).toEqual({ from: '2026-10-26', to: '2026-10-30' });
    expect(schoolWeek(new Date(2026, 9, 31))).toEqual({ from: '2026-11-02', to: '2026-11-06' });
  });
});

describe('서버 중계 실패 시 직접 연결', () => {
  it('중계가 502면 나이스에 직접 요청하고 이후에도 직접 연결', async () => {
    const { vi } = await import('vitest');
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: string | URL) => {
      const s = String(u);
      urls.push(s);
      if (s.startsWith('/api/neis')) return new Response(JSON.stringify({ error: '나이스 서버 오류 (500)', detail: 'blocked' }), { status: 502 });
      return new Response(JSON.stringify(ok('schoolInfo', [{ ATPT_OFCDC_SC_CODE: 'J10', SD_SCHUL_CODE: '1', SCHUL_NM: '경기고' }])));
    }));
    const { searchSchools, isNeisLimited } = await import('./neis');
    expect((await searchSchools('경기고'))[0].name).toBe('경기고');
    expect(isNeisLimited()).toBe(true);
    expect(urls[1]).toContain('https://open.neis.go.kr/hub/schoolInfo');
    expect(urls[1]).not.toContain('KEY=');
    await searchSchools('경기고');
    expect(urls.filter((u) => u.startsWith('/api/neis'))).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});
