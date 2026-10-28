import { describe, expect, it, vi } from 'vitest';
import handler, { VAPID_PUBLIC_KEY } from '../netlify/functions/push-cron.mjs';
import { classMessage, dishNames, examMessages, favoriteMessage, kstNow, periodStartingIn5, PERIOD_STARTS } from '../netlify/lib/pushPlan.mjs';
import { DEFAULT_PERIOD_TIMES } from '../src/lib/types';
import { VAPID_PUBLIC_KEY as CLIENT_KEY } from '../src/lib/push';

// 한국 시간 → UTC Date
const kst = (y, mo, d, h, mi) => new Date(Date.UTC(y, mo - 1, d, h - 9, mi));

describe('알림 계획 (순수 함수)', () => {
  it('교시 시간·VAPID 공개키가 앱과 같음', () => {
    expect(PERIOD_STARTS).toEqual(DEFAULT_PERIOD_TIMES.map((p) => p.start));
    expect(VAPID_PUBLIC_KEY).toBe(CLIENT_KEY);
  });
  it('한국 시간 변환과 5분 전 교시 (평일만)', () => {
    expect(kstNow(kst(2026, 10, 28, 9, 5))).toEqual({ ymd: '2026-10-28', day: 2, minutes: 545 });
    expect(periodStartingIn5(kstNow(kst(2026, 10, 28, 9, 5)))).toBe(1);
    expect(periodStartingIn5(kstNow(kst(2026, 10, 28, 13, 45)))).toBe(5);
    expect(periodStartingIn5(kstNow(kst(2026, 10, 28, 9, 6)))).toBe(0);
    expect(periodStartingIn5(kstNow(kst(2026, 10, 31, 9, 5)))).toBe(0); // 토요일
    expect(kstNow(kst(2026, 10, 28, 0, 30)).ymd).toBe('2026-10-28'); // 한국 자정 직후 날짜
  });
  it('메시지 만들기', () => {
    expect(classMessage([{ day: 2, period: 1, subject: '화면 구현', room: '실습실' }], 2, 1)).toMatchObject({ title: '1교시 화면 구현 5분 전', body: '장소: 실습실' });
    expect(classMessage([{ day: 2, period: 1, subject: '수업 없음' }], 2, 1)).toBeNull();
    expect(examMessages([{ id: 'a', date: '2026-10-29', title: '기말', subject: '국어' }, { id: 'b', date: '2026-11-20', title: '먼 시험' }], 1, '2026-10-28').map((m) => m.title)).toEqual(['시험 내일']);
    expect(favoriteMessage(['쌀밥', '양념 치킨', '치킨무'], ['치킨'])?.title).toBe('⭐ 오늘 급식에 양념 치킨 외 1개!');
    expect(favoriteMessage(['쌀밥'], ['치킨'])).toBeNull();
    expect(dishNames('-발아현미밥<br/>-제육볶음 (10.13.)<br/>깍두기.')).toEqual(['발아현미밥', '제육볶음', '깍두기']);
  });
});

// 가짜 Supabase·나이스
function fakeFetch({ settings, timetable = [], exams = [], holiday = false, lunch = '' }) {
  const patches = [];
  const ok = (ep, row) => ({ [ep]: [{ head: [{ list_total_count: row.length }, { RESULT: { CODE: 'INFO-000' } }] }, { row }] });
  const fn = vi.fn(async (u, init = {}) => {
    const url = String(u);
    const json = (b) => new Response(JSON.stringify(b));
    if (url.includes('/rest/v1/')) {
      if (init.method === 'PATCH') {
        patches.push({ url, body: JSON.parse(init.body) });
        return json([]);
      }
      if (url.includes('collection=eq.settings')) return json(settings);
      if (url.includes('collection=eq.timetable')) return json(timetable);
      if (url.includes('collection=eq.exams')) return json(exams);
    }
    if (url.includes('/hub/schoolInfo')) return json(ok('schoolInfo', [{ SCHUL_NM: '경기모바일과학고등학교', ATPT_OFCDC_SC_NM: '경기도교육청', ATPT_OFCDC_SC_CODE: 'J10', SD_SCHUL_CODE: '1' }]));
    if (url.includes('/hub/SchoolSchedule')) return json(holiday ? ok('SchoolSchedule', [{ EVENT_NM: '개교기념일', SBTR_DD_SC_NM: '휴업일' }]) : { RESULT: { CODE: 'INFO-200' } });
    if (url.includes('/hub/mealServiceDietInfo')) return json(ok('mealServiceDietInfo', [{ MMEAL_SC_NM: '중식', DDISH_NM: lunch }]));
    return json({});
  });
  return { fn, patches };
}
const env = (k) => ({ VITE_SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc', VAPID_PRIVATE_KEY: 'priv', NEIS_API_KEY: 'n' })[k] ?? '';
const sub = (n) => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: 'p', auth: 'a' } });

describe('push-cron 함수', () => {
  it('보낼 시각이 아니면 아무 요청도 하지 않음', async () => {
    const { fn } = fakeFetch({ settings: [] });
    const r = await handler(null, {}, { now: kst(2026, 10, 28, 9, 30), fetch: fn, env, send: vi.fn() });
    expect(await r.text()).toBe('idle');
    expect(fn).not.toHaveBeenCalled();
  });

  it('수업 5분 전: 수업 알림 켠 사람에게만, 그 교시 과목으로', async () => {
    const { fn } = fakeFetch({
      settings: [
        { user_id: 'u1', data: { classReminder: true, pushSubs: [sub(1)] } },
        { user_id: 'u2', data: { classReminder: false, pushSubs: [sub(2)] } },
        { user_id: 'u3', data: { classReminder: true, pushSubs: [] } },
      ],
      timetable: [{ user_id: 'u1', data: { day: 2, period: 1, subject: '화면 구현', room: '' } }],
    });
    const send = vi.fn(async () => {});
    await handler(null, {}, { now: kst(2026, 10, 28, 9, 5), fetch: fn, env, send });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].endpoint).toBe('https://push.example/1');
    expect(JSON.parse(send.mock.calls[0][1]).title).toBe('1교시 화면 구현 5분 전');
  });

  it('휴업일에는 수업 알림을 보내지 않음', async () => {
    const { fn } = fakeFetch({
      settings: [{ user_id: 'u1', data: { classReminder: true, pushSubs: [sub(1)] } }],
      timetable: [{ user_id: 'u1', data: { day: 2, period: 1, subject: '국어' } }],
      holiday: true,
    });
    const send = vi.fn(async () => {});
    await handler(null, {}, { now: kst(2026, 10, 28, 9, 5), fetch: fn, env, send });
    expect(send).not.toHaveBeenCalled();
  });

  it('아침 7:30: 시험·좋아하는 메뉴 알림, 해지된 기기는 목록에서 뺌', async () => {
    const { fn, patches } = fakeFetch({
      settings: [{ user_id: 'u1', data: { notifications: true, remindDays: 1, favoriteFoods: ['치킨'], pushSubs: [sub(1), sub(2)] } }],
      exams: [{ user_id: 'u1', data: { id: 'e', date: '2026-10-29', title: '기말고사', subject: '국어' } }],
      lunch: '쌀밥<br/>-양념치킨 (5.6.)',
    });
    const send = vi.fn(async (s) => {
      if (s.endpoint.endsWith('/2')) throw Object.assign(new Error('gone'), { statusCode: 410 });
    });
    const r = await handler(null, {}, { now: kst(2026, 10, 28, 7, 30), fetch: fn, env, send });
    const titles = send.mock.calls.filter((c) => c[0].endpoint.endsWith('/1')).map((c) => JSON.parse(c[1]).title);
    expect(titles).toEqual(['시험 내일', '⭐ 오늘 급식에 양념치킨!']);
    expect(patches).toHaveLength(1);
    expect(patches[0].body.data.pushSubs).toEqual([sub(1)]);
    expect((await r.json()).sent).toBe(2);
  });

  it('환경변수가 없으면 500', async () => {
    const r = await handler(null, {}, { now: kst(2026, 10, 28, 7, 30), fetch: vi.fn(), env: () => '', send: vi.fn() });
    expect(r.status).toBe(500);
  });
});
