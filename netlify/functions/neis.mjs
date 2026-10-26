// 나이스 교육정보 개방 포털(open.neis.go.kr) 중계 함수.
// 브라우저에서 바로 부르면 인증키가 노출되므로 Netlify 함수에서 키를 붙여 대신 요청합니다.
// 인증키는 Netlify 환경변수 NEIS_API_KEY에 넣습니다. (없으면 나이스 샘플 제한: 한 번에 5건)

const ENDPOINTS = {
  schoolInfo: ['SCHUL_NM', 'ATPT_OFCDC_SC_CODE', 'SD_SCHUL_CODE', 'SCHUL_KND_SC_NM'],
  classInfo: ['ATPT_OFCDC_SC_CODE', 'SD_SCHUL_CODE', 'AY', 'GRADE'],
  hisTimetable: ['ATPT_OFCDC_SC_CODE', 'SD_SCHUL_CODE', 'AY', 'SEM', 'GRADE', 'CLASS_NM', 'TI_FROM_YMD', 'TI_TO_YMD'],
  mealServiceDietInfo: ['ATPT_OFCDC_SC_CODE', 'SD_SCHUL_CODE', 'MLSV_YMD', 'MLSV_FROM_YMD', 'MLSV_TO_YMD'],
};

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...extra } });

export default async function handler(req, env = globalThis.process?.env ?? {}) {
  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint') ?? '';
  const allowed = ENDPOINTS[endpoint];
  if (!allowed) return json({ error: '지원하지 않는 요청입니다.' }, 400);

  const out = new URL(`https://open.neis.go.kr/hub/${endpoint}`);
  out.searchParams.set('Type', 'json');
  out.searchParams.set('pIndex', '1');
  out.searchParams.set('pSize', env.NEIS_API_KEY ? '1000' : '100');
  if (env.NEIS_API_KEY) out.searchParams.set('KEY', env.NEIS_API_KEY);
  for (const name of allowed) {
    const v = url.searchParams.get(name);
    if (v !== null && v !== '') out.searchParams.set(name, v.slice(0, 50));
  }

  try {
    const res = await fetch(out, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    const text = await res.text();
    if (!res.ok) return json({ error: `나이스 서버 오류 (${res.status})` }, 502);
    // 학교 검색은 자주 바뀌지 않고, 급식·시간표도 짧게 캐시해 나이스 호출 수를 줄입니다.
    const maxAge = endpoint === 'schoolInfo' || endpoint === 'classInfo' ? 86400 : 1800;
    return new Response(text, {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}` },
    });
  } catch {
    return json({ error: '나이스 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 504);
  }
}

export const config = { path: '/api/neis' };
