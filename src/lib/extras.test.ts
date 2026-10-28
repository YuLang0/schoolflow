import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup } from './backup';
import { favoriteDishes, favoriteMatch } from './favorites';
import { mergeNeisTimetable } from './neisImport';
import { freePeriods, isMovingClass } from './schedule';
import { emptyData, type TimetableEntry } from './types';

const t = (day: number, period: number, subject: string, room = '', extra: Partial<TimetableEntry> = {}): TimetableEntry => ({
  id: `${day}-${period}`, day, period, subject, room, teacher: '', ...extra,
});

describe('이동수업·공강', () => {
  it('직접 표시했거나 교실이 우리 반과 다르면 이동수업', () => {
    expect(isMovingClass(t(0, 1, '체육', '운동장'), '2-3')).toBe(true);
    expect(isMovingClass(t(0, 1, '국어', '2-3'), '2-3')).toBe(false);
    expect(isMovingClass(t(0, 1, '국어', '2-3반'), '2-3')).toBe(false); // '반' 같은 표기 차이는 무시
    expect(isMovingClass(t(0, 1, '국어', '203호'), '203')).toBe(false);
    expect(isMovingClass(t(0, 1, '국어', '과학실'), '')).toBe(false); // 우리 반 교실을 모르면 자동 판단 안 함
    expect(isMovingClass(t(0, 1, '국어', '', { moving: true }), '')).toBe(true);
    expect(isMovingClass(undefined, '2-3')).toBe(false);
  });
  it('공강은 첫 수업과 마지막 수업 사이의 빈 교시', () => {
    const tt = [t(0, 1, 'a'), t(0, 2, 'b'), t(0, 5, 'c'), t(0, 6, '수업 없음'), t(1, 3, 'x')];
    expect(freePeriods(tt, 0)).toEqual([3, 4]);
    expect(freePeriods(tt, 1)).toEqual([]);
  });
  it('나이스 강의실을 가져오고, 같은 과목이면 직접 적은 교실·이동 표시 유지', () => {
    const rows = [
      { date: '2026-10-26', day: 0, period: 1, subject: '체육', room: '체육관' },
      { date: '2026-10-26', day: 0, period: 2, subject: '국어', room: '' },
    ];
    const r = mergeNeisTimetable([t(0, 2, '국어', '도서관', { moving: true })], rows);
    expect(r.timetable.find((e) => e.period === 1)).toMatchObject({ room: '체육관' });
    expect(r.timetable.find((e) => e.period === 2)).toMatchObject({ room: '도서관', moving: true });
  });
});

describe('좋아하는 메뉴', () => {
  it('띄어쓰기 무시하고 포함되면 표시', () => {
    expect(favoriteMatch('양념 치킨', ['치킨'])).toBe('치킨');
    expect(favoriteMatch('치즈돈가스', ['돈 가스'])).toBe('돈 가스');
    expect(favoriteMatch('된장국', ['치킨'])).toBeNull();
    expect(favoriteDishes({ date: '2026-10-26', type: '중식', calories: '', dishes: [{ name: '쌀밥', allergens: [] }, { name: '마라탕', allergens: [] }] }, ['마라'])).toEqual(['마라탕']);
  });
});

describe('백업: D-day·좋아하는 메뉴·우리 반 교실', () => {
  it('그대로 복원하고 잘못된 값은 버림', () => {
    const d = emptyData();
    d.settings.homeRoom = '2-3';
    d.settings.ddays = [{ id: 'x', name: '수능', date: '2026-11-19' }];
    d.settings.favoriteFoods = ['치킨'];
    expect(parseBackup(makeBackup(d)).settings).toMatchObject({ homeRoom: '2-3', ddays: d.settings.ddays, favoriteFoods: ['치킨'] });
    const bad = parseBackup(JSON.stringify({ app: 'schoolflow', version: 1, data: { settings: { ddays: [{ name: 'a', date: 'nope' }], favoriteFoods: ['', '피자', '피자'] } } }));
    expect(bad.settings.ddays).toEqual([]);
    expect(bad.settings.favoriteFoods).toEqual(['피자']);
  });
});
