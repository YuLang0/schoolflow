// 나이스 교육정보 개방 포털(open.neis.go.kr) 중계 함수.
// 브라우저에서 바로 부르면 인증키가 노출되므로 Netlify 함수에서 키를 붙여 대신 요청합니다.
// 인증키는 Netlify 환경변수 NEIS_API_KEY에 넣습니다. (없으면 나이스 샘플 제한: 한 번에 5건)

const ENDPOINTS = {
  schoolInfo: ['SCHUL_NM', 'ATPT_OFCDC_SC_CODE', 'SD_SCHUL_CODE', 'SCHUL_KND_SC_NM'],
  classInfo: ['ATPT_OFCDC_SC_CODE', 'SD_SCHUL_CODE', 'AY', 'GRADE'],
  hisTimetable: ['ATPT_OFCDC_SC_CODE', 'SD_SCHUL_CODE', 'AY', 'SEM', 'GRADE', 'CLASS_NM', 'TI_FROM_YMD', 'TI_TO_YMD'],
  mealServiceDietInfo: ['ATPT_OFCDC_SC_CODE', 'SD_SCHUL_CODE', 'MLSV_YMD', 'MLSV_FROM_YMD', 'MLSV_TO_YMD'],
  SchoolSchedule: ['ATPT_OFCDC_SC_CODE', 'SD_SCHUL_CODE', 'AA_YMD', 'AA_FROM_YMD', 'AA_TO_YMD'],
};

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...extra } });

// Netlify는 두 번째 인자로 context를 넘깁니다. 환경변수는 Netlify.env / process.env에서 읽습니다.
// (세 번째 인자는 테스트·개발 서버용)
export default async function handler(req, _context, env) {
  const key = env?.NEIS_API_KEY ?? globalThis.Netlify?.env?.get('NEIS_API_KEY') ?? globalThis.process?.env?.NEIS_API_KEY ?? '';
  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint') ?? '';
  const allowed = ENDPOINTS[endpoint];
  if (!allowed) return json({ error: '지원하지 않는 요청입니다.' }, 400);

  const out = new URL(`https://open.neis.go.kr/hub/${endpoint}`);
  out.searchParams.set('Type', 'json');
  out.searchParams.set('pIndex', '1');
  out.searchParams.set('pSize', key ? '1000' : '100');
  if (key) out.searchParams.set('KEY', key);
  for (const name of allowed) {
    const v = url.searchParams.get(name);
    if (v !== null && v !== '') out.searchParams.set(name, v.slice(0, 50));
  }

  try {
    const res = await fetch(out, {
      headers: { accept: 'application/json, text/plain, */*', 'user-agent': 'Mozilla/5.0 (compatible; SchoolFlow/1.1; +https://schoolflow-yulang.netlify.app)' },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    if (!res.ok || !text.trimStart().startsWith('{')) {
      // Netlify 함수 로그(Logs → Functions)에서 원인을 볼 수 있게 남깁니다. 인증키는 남기지 않습니다.
      console.error('NEIS upstream', res.status, endpoint, text.slice(0, 300));
      return json({ error: `나이스 서버 오류 (${res.status})`, upstream: res.status, detail: text.replace(/\s+/g, ' ').slice(0, 120) }, 502);
    }
    // 학교 검색은 자주 바뀌지 않고, 급식·시간표도 짧게 캐시해 나이스 호출 수를 줄입니다.
    const maxAge = endpoint === 'schoolInfo' || endpoint === 'classInfo' ? 86400 : endpoint === 'SchoolSchedule' ? 21600 : 1800;
    return new Response(text, {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}` },
    });
  } catch (e) {
    console.error('NEIS fetch failed', endpoint, String(e));
    return json({ error: '나이스 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 504);
  }
}

export const config = { path: '/api/neis' };
