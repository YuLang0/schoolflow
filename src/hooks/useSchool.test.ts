import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIXED_SCHOOL_NAME, resolveFixedSchool } from './useSchool';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const reply = (rows: unknown[]) =>
  new Response(JSON.stringify({ schoolInfo: [{ head: [{ list_total_count: rows.length }, { RESULT: { CODE: 'INFO-000' } }] }, { row: rows }] }));

describe('학교 고정', () => {
  it('이름으로 찾아 경기도 학교를 고르고 기기에 저장, 다음엔 다시 찾지 않음', async () => {
    const fetch = vi.fn(async () =>
      reply([
        { ATPT_OFCDC_SC_CODE: 'B10', ATPT_OFCDC_SC_NM: '서울특별시교육청', SD_SCHUL_CODE: '1', SCHUL_NM: '경기모바일과학고등학교분교' },
        { ATPT_OFCDC_SC_CODE: 'J10', ATPT_OFCDC_SC_NM: '경기도교육청', SD_SCHUL_CODE: '7531234', SCHUL_NM: FIXED_SCHOOL_NAME },
      ]),
    );
    vi.stubGlobal('fetch', fetch);
    expect(await resolveFixedSchool()).toEqual({ officeCode: 'J10', schoolCode: '7531234', name: FIXED_SCHOOL_NAME });
    expect(await resolveFixedSchool()).toMatchObject({ schoolCode: '7531234' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
