// 앱을 닫아도 오는 알림: 정해진 시각에 실행되어 보낼 알림이 있을 때만 일합니다.
// - 평일 수업 시작 5분 전: 그 교시 과목 (학교 휴업일이면 보내지 않음)
// - 매일 07:30: 다가오는 시험, 오늘 급식의 좋아하는 메뉴
// 필요한 Netlify 환경변수(Secret): SUPABASE_SERVICE_ROLE_KEY, VAPID_PRIVATE_KEY (+ 이미 있는 VITE_SUPABASE_URL, NEIS_API_KEY)
import webpush from 'web-push';
import { classMessage, dishNames, examMessages, favoriteMessage, isMorning, kstNow, periodStartingIn5, SCHOOL_NAME } from '../lib/pushPlan.mjs';

export const VAPID_PUBLIC_KEY = 'BMb5qu7QyCYglYtbnJwBj0JbEEf1QbIjjmqLo71uRaiIiCq2qKzQqf0OzsOfdMhYQ3AtkEDB8puN123Qew29Vas';
const SUBJECT = 'https://schoolflow-yulang.netlify.app';
const UA = 'Mozilla/5.0 (compatible; SchoolFlow/1.1; +https://schoolflow-yulang.netlify.app)';

const envOf = (k) => globalThis.Netlify?.env?.get(k) ?? globalThis.process?.env?.[k] ?? '';

async function neis(endpoint, params, key, fetchImpl) {
  const u = new URL(`https://open.neis.go.kr/hub/${endpoint}`);
  u.search = new URLSearchParams({ Type: 'json', pIndex: '1', pSize: '100', ...(key ? { KEY: key } : {}), ...params }).toString();
  const res = await fetchImpl(u, { headers: { 'user-agent': UA, accept: 'application/json' } });
  const body = await res.json();
  return body?.[endpoint]?.find((s) => Array.isArray(s.row))?.row ?? [];
}

async function schoolCodes(key, fetchImpl) {
  const rows = await neis('schoolInfo', { SCHUL_NM: SCHOOL_NAME }, key, fetchImpl);
  const s = rows.find((r) => r.SCHUL_NM === SCHOOL_NAME && String(r.ATPT_OFCDC_SC_NM).includes('경기')) ?? rows[0];
  return s ? { ATPT_OFCDC_SC_CODE: s.ATPT_OFCDC_SC_CODE, SD_SCHUL_CODE: s.SD_SCHUL_CODE } : null;
}

/**
 * deps는 테스트용: { now, fetch, send, env }
 */
export default async function handler(_req, _context, deps = {}) {
  const now = deps.now ?? new Date();
  const fetchImpl = deps.fetch ?? fetch;
  const env = deps.env ?? envOf;
  const kst = kstNow(now);
  const period = periodStartingIn5(kst);
  const morning = isMorning(kst);
  if (!period && !morning) return new Response('idle');

  const url = env('VITE_SUPABASE_URL') || env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPrivate = env('VAPID_PRIVATE_KEY');
  if (!url || !serviceKey || !vapidPrivate) {
    console.error('push-cron: 환경변수 없음', { url: !!url, serviceKey: !!serviceKey, vapidPrivate: !!vapidPrivate });
    return new Response('not configured', { status: 500 });
  }
  const send =
    deps.send ??
    ((sub, payload) => {
      webpush.setVapidDetails(SUBJECT, VAPID_PUBLIC_KEY, vapidPrivate);
      return webpush.sendNotification(sub, payload, { TTL: 900, urgency: 'high' });
    });
  const sb = (path, init = {}) =>
    fetchImpl(`${url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        // 예전 service_role 키(JWT)만 Authorization에 넣고, 새 sb_secret_ 키는 apikey 헤더만으로 인증
        ...(serviceKey.startsWith('eyJ') ? { authorization: `Bearer ${serviceKey}` } : {}),
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

  const settingsRows = await (await sb('schoolflow_items?collection=eq.settings&select=user_id,data')).json();
  const users = (Array.isArray(settingsRows) ? settingsRows : []).filter((r) => Array.isArray(r.data?.pushSubs) && r.data.pushSubs.length);
  if (!users.length) return new Response('no subscribers');

  const neisKey = env('NEIS_API_KEY');
  const messages = new Map(); // user_id → 메시지 목록
  const add = (uid, m) => m && messages.set(uid, [...(messages.get(uid) ?? []), m]);
  let codes;
  const getCodes = async () => (codes ??= await schoolCodes(neisKey, fetchImpl));

  if (period) {
    const want = users.filter((u) => u.data.classReminder);
    let holiday = false;
    if (want.length) {
      try {
        const c = await getCodes();
        const ev = c ? await neis('SchoolSchedule', { ...c, AA_YMD: kst.ymd.replace(/-/g, '') }, neisKey, fetchImpl) : [];
        holiday = ev.some((r) => String(r.SBTR_DD_SC_NM ?? '').includes('휴업') || /방학|공휴일|대체/.test(String(r.EVENT_NM ?? '')));
      } catch (e) {
        console.error('push-cron: 학사일정 확인 실패', String(e));
      }
    }
    if (want.length && !holiday) {
      const ids = want.map((u) => u.user_id).join(',');
      const rows = await (await sb(`schoolflow_items?collection=eq.timetable&user_id=in.(${ids})&select=user_id,data`)).json();
      const byUser = new Map();
      for (const r of Array.isArray(rows) ? rows : []) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.data]);
      for (const u of want) add(u.user_id, classMessage(byUser.get(u.user_id), kst.day, period));
    }
  }

  if (morning) {
    const examUsers = users.filter((u) => u.data.notifications);
    if (examUsers.length) {
      const ids = examUsers.map((u) => u.user_id).join(',');
      const rows = await (await sb(`schoolflow_items?collection=eq.exams&user_id=in.(${ids})&select=user_id,data`)).json();
      const byUser = new Map();
      for (const r of Array.isArray(rows) ? rows : []) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.data]);
      for (const u of examUsers) for (const m of examMessages(byUser.get(u.user_id), u.data.remindDays, kst.ymd)) add(u.user_id, m);
    }
    const favUsers = users.filter((u) => u.data.favoriteAlert !== false && Array.isArray(u.data.favoriteFoods) && u.data.favoriteFoods.length);
    if (favUsers.length && kst.day <= 4) {
      try {
        const c = await getCodes();
        const meals = c ? await neis('mealServiceDietInfo', { ...c, MLSV_YMD: kst.ymd.replace(/-/g, '') }, neisKey, fetchImpl) : [];
        const lunch = meals.find((m) => m.MMEAL_SC_NM === '중식') ?? meals[0];
        const dishes = lunch ? dishNames(lunch.DDISH_NM) : [];
        for (const u of favUsers) add(u.user_id, favoriteMessage(dishes, u.data.favoriteFoods));
      } catch (e) {
        console.error('push-cron: 급식 확인 실패', String(e));
      }
    }
  }

  let sent = 0;
  for (const u of users) {
    const list = messages.get(u.user_id);
    if (!list?.length) continue;
    const dead = new Set();
    for (const sub of u.data.pushSubs) {
      for (const m of list) {
        try {
          await send(sub, JSON.stringify(m));
          sent++;
        } catch (e) {
          // 앱 삭제·권한 해제 등으로 더 이상 받을 수 없는 기기는 목록에서 뺌
          if (e?.statusCode === 404 || e?.statusCode === 410) dead.add(sub.endpoint);
          else console.error('push-cron: 보내기 실패', e?.statusCode ?? String(e));
          break;
        }
      }
    }
    if (dead.size) {
      const data = { ...u.data, pushSubs: u.data.pushSubs.filter((s) => !dead.has(s.endpoint)) };
      await sb(`schoolflow_items?user_id=eq.${u.user_id}&collection=eq.settings&id=eq.settings`, { method: 'PATCH', body: JSON.stringify({ data }) });
    }
  }
  return new Response(JSON.stringify({ period, morning, users: users.length, sent }), { headers: { 'content-type': 'application/json' } });
}

// Netlify 크레딧을 아끼려고 1분마다가 아니라 보낼 수 있는 시각에만 실행합니다 (하루 24번).
// UTC 기준: 매시 5·30·45분, 0~6시와 22시 = 한국 시간 9:05·10:05·11:05·12:05(수업 5분 전),
// 13:45·14:45·15:45(5~7교시 5분 전), 07:30(아침 알림). 맞지 않는 시각에는 바로 끝냅니다.
export const config = { schedule: '5,30,45 0-6,22 * * *' };
