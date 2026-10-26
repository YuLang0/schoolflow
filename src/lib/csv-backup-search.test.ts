import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup } from './backup';
import { toCSV } from './csv';
import { search } from './search';
import { emptyData } from './types';

describe('toCSV', () => {
  it('BOM, 따옴표·쉼표·줄바꿈 처리, 수식 주입 방지', () => {
    const csv = toCSV(['a', 'b'], [['x,y', 'say "hi"'], ['=SUM(A1)', '줄\n바꿈']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"x,y","say ""hi"""');
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain('"줄\n바꿈"');
  });
});

describe('backup', () => {
  it('내보낸 백업을 그대로 복원', () => {
    const d = emptyData();
    d.assignments.push({ id: 'a', title: '과제', subject: '수학', due: '2026-10-30', priority: 'high', memo: '', done: true, doneAt: '2026-10-26', createdAt: 'x' });
    d.timetable.push({ id: 't', day: 2, period: 3, subject: '과학', room: '', teacher: '' });
    d.settings.remindDays = 3;
    expect(parseBackup(makeBackup(d))).toEqual(d);
  });
  it('잘못된 파일은 한국어 오류', () => {
    expect(() => parseBackup('not json')).toThrow('JSON 파일 형식이 아닙니다.');
    expect(() => parseBackup('{"app":"other","data":{}}')).toThrow('SchoolFlow 백업 파일이 아닙니다.');
    expect(() => parseBackup('{"app":"schoolflow","version":99,"data":{}}')).toThrow('지원하지 않는 백업 버전');
  });
  it('예전 백업의 교시 시간은 무시하고 학교 고정값 사용', () => {
    const d = parseBackup(JSON.stringify({ app: 'schoolflow', version: 1, data: { settings: { periodTimes: [{ start: '08:00', end: '08:50' }] } } }));
    expect(d.settings.periodTimes[0]).toEqual({ start: '09:10', end: '10:00' });
    expect(d.settings.periodTimes).toHaveLength(7);
  });
  it('형식이 틀린 항목은 버리고 값 범위를 맞춤', () => {
    const d = parseBackup(
      JSON.stringify({
        app: 'schoolflow',
        version: 1,
        data: {
          assignments: [{ title: '날짜 없음' }, { title: 'ok', due: '2026-10-30', priority: 'zzz' }],
          timetable: [{ day: 9, period: 1, subject: '국어' }],
          settings: { remindDays: 100 },
        },
      }),
    );
    expect(d.assignments).toHaveLength(1);
    expect(d.assignments[0].priority).toBe('normal');
    expect(d.timetable[0].day).toBe(4);
    expect(d.settings.remindDays).toBe(7);
  });
});

describe('search', () => {
  it('대소문자 무시, 여러 종류 검색', () => {
    const d = emptyData();
    d.assignments.push({ id: 'a', title: 'English essay', subject: '영어', due: '2026-10-30', priority: 'normal', memo: '', done: false, doneAt: null, createdAt: '' });
    d.timetable.push({ id: 't', day: 0, period: 1, subject: '영어', room: '어학실', teacher: '' });
    expect(search(d, 'english').map((h) => h.kind)).toEqual(['assignments']);
    expect(search(d, '영어').map((h) => h.kind)).toEqual(['assignments', 'timetable']);
    expect(search(d, '  ')).toEqual([]);
  });
});
