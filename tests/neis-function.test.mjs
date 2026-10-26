import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../netlify/functions/neis.mjs';

afterEach(() => vi.unstubAllGlobals());

describe('나이스 중계 함수', () => {
  it('허용하지 않은 요청은 400', async () => {
    const r = await handler(new Request('http://x/api/neis?endpoint=evil'), {}, {});
    expect(r.status).toBe(400);
  });

  it('인증키를 붙이고 허용된 파라미터만 전달', async () => {
    const fetch = vi.fn(async () => new Response('{"ok":1}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const r = await handler(new Request('http://x/api/neis?endpoint=mealServiceDietInfo&SD_SCHUL_CODE=123&KEY=hack&evil=1'), {}, { NEIS_API_KEY: 'secret' });
    const called = new URL(fetch.mock.calls[0][0]);
    expect(called.origin + called.pathname).toBe('https://open.neis.go.kr/hub/mealServiceDietInfo');
    expect(called.searchParams.get('KEY')).toBe('secret');
    expect(called.searchParams.get('SD_SCHUL_CODE')).toBe('123');
    expect(called.searchParams.get('evil')).toBeNull();
    expect(called.searchParams.get('Type')).toBe('json');
    expect(await r.text()).toBe('{"ok":1}');
    expect(r.headers.get('cache-control')).toContain('max-age=1800');
  });

  it('Netlify처럼 두 번째 인자로 context가 와도 환경변수의 키를 사용', async () => {
    const fetch = vi.fn(async () => new Response('{"ok":1}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('Netlify', { env: { get: (k) => (k === 'NEIS_API_KEY' ? 'from-netlify' : undefined) } });
    await handler(new Request('http://x/api/neis?endpoint=schoolInfo&SCHUL_NM=a'), { site: {}, deploy: {} });
    const called = new URL(fetch.mock.calls[0][0]);
    expect(called.searchParams.get('KEY')).toBe('from-netlify');
    expect(called.searchParams.get('pSize')).toBe('1000');
  });

  it('키가 없으면 KEY 없이 요청, 나이스 장애는 한국어 오류', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
    const r = await handler(new Request('http://x/api/neis?endpoint=schoolInfo&SCHUL_NM=a'), {}, {});
    expect(r.status).toBe(504);
    expect((await r.json()).error).toContain('나이스 서버');
  });
});
