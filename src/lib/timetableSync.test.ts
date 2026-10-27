import { afterEach, describe, expect, it, vi } from 'vitest';
import { needsTimetableSync, syncTimetable } from './timetableSync';
import { emptyData, type AppData } from './types';

afterEach(() => vi.unstubAllGlobals());

const monday = new Date(2026, 9, 26, 9, 0);
const school = { officeCode: 'J10', schoolCode: '1', name: '경기모바일과학고등학교' };

function neisReply(subjects: Record<string, string>) {
  // subjects: { 'YYYYMMDD:교시': 과목 }
  const row = Object.entries(subjects).map(([k, v]) => ({ ALL_TI_YMD: k.split(':')[0], PERIO: k.split(':')[1], ITRT_CNTNT: v }));
  return new Response(JSON.stringify({ hisTimetable: [{ head: [{ list_total_count: row.length }, { RESULT: { CODE: 'INFO-000' } }] }, { row }] }));
}

function withClass(g: string, c: string): AppData {
  const d = emptyData();
  d.settings.gradeNo = g;
  d.settings.classNo = c;
  return d;
}

describe('needsTimetableSync', () => {
  it('학년·반이 없으면 안 함, 이번 주·같은 반으로 이미 했으면 안 함', () => {
    expect(needsTimetableSync(emptyData().settings, monday)).toBe(false);
    const d = withClass('2', '3');
    expect(needsTimetableSync(d.settings, monday)).toBe(true);
    d.settings.ttSyncWeek = '2026-10-26';
    d.settings.ttSyncClass = '2-3';
    expect(needsTimetableSync(d.settings, monday)).toBe(false);
    expect(needsTimetableSync(d.settings, new Date(2026, 10, 2))).toBe(true); // 다음 주
    expect(needsTimetableSync({ ...d.settings, classNo: '4' }, monday)).toBe(true); // 반 변경
  });
});

describe('syncTimetable', () => {
  it('처음: 채우고 동기화 기록', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => neisReply({ '20261026:1': '국어', '20261026:2': '수학' })));
    const r = await syncTimetable(withClass('2', '3'), school, monday);
    expect(r.data?.timetable.map((e) => e.subject)).toEqual(['국어', '수학']);
    expect(r.data?.timetable.every((e) => !e.changedFrom)).toBe(true);
    expect(r.data?.settings).toMatchObject({ ttSyncWeek: '2026-10-26', ttSyncClass: '2-3' });
  });

  it('다음 주 같은 반: 달라진 칸만 변경 표시', async () => {
    const d = withClass('2', '3');
    d.settings.ttSyncWeek = '2026-10-19';
    d.settings.ttSyncClass = '2-3';
    d.timetable = [
      { id: 'a', day: 0, period: 1, subject: '국어', room: '', teacher: '' },
      { id: 'b', day: 0, period: 2, subject: '수학', room: '', teacher: '' },
    ];
    vi.stubGlobal('fetch', vi.fn(async () => neisReply({ '20261026:1': '국어', '20261026:2': '진로' })));
    const r = await syncTimetable(d, school, monday);
    expect(r.data?.timetable.filter((e) => e.changedFrom).map((e) => `${e.subject}<-${e.changedFrom}`)).toEqual(['진로<-수학']);
    expect(r.message).toContain('달라진 수업 1개');
  });

  it('반이 바뀌면 새 반 시간표로 통째로 교체 (변경 표시 없음)', async () => {
    const d = withClass('2', '4');
    d.settings.ttSyncWeek = '2026-10-26';
    d.settings.ttSyncClass = '2-3';
    d.timetable = [{ id: 'a', day: 0, period: 1, subject: '국어', room: '', teacher: '' }, { id: 'z', day: 3, period: 5, subject: '체육', room: '', teacher: '' }];
    vi.stubGlobal('fetch', vi.fn(async () => neisReply({ '20261026:1': '영어' })));
    const r = await syncTimetable(d, school, monday);
    expect(r.data?.timetable).toHaveLength(1);
    expect(r.data?.timetable[0]).toMatchObject({ subject: '영어', changedFrom: null });
    expect(r.data?.settings.ttSyncClass).toBe('2-4');
  });

  it('나이스에 시간표가 없으면 아무것도 바꾸지 않음', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ RESULT: { CODE: 'INFO-200' } }))));
    const r = await syncTimetable(withClass('2', '3'), school, monday);
    expect(r.data).toBeNull();
    expect(r.kind).toBe('info');
  });
});
