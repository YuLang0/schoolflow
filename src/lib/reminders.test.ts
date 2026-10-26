import { describe, expect, it } from 'vitest';
import { dueReminders } from './reminders';
import { emptyData, type AppData } from './types';

function data(): AppData {
  const d = emptyData();
  d.settings.notifications = true;
  d.settings.remindDays = 1;
  d.assignments = [
    { id: 'a1', title: '수학 숙제', subject: '수학', due: '2026-10-27', priority: 'normal', memo: '', done: false, doneAt: null, createdAt: '' },
    { id: 'a2', title: '완료한 숙제', subject: '', due: '2026-10-26', priority: 'normal', memo: '', done: true, doneAt: '2026-10-25', createdAt: '' },
    { id: 'a3', title: '먼 숙제', subject: '', due: '2026-11-10', priority: 'normal', memo: '', done: false, doneAt: null, createdAt: '' },
  ];
  d.exams = [{ id: 'e1', title: '중간고사', subject: '국어', date: '2026-10-26', time: '09:00', scope: '', memo: '', score: null }];
  d.timetable = [{ id: 't1', day: 0, period: 2, subject: '영어', room: '2-3', teacher: '' }];
  return d;
}

const now = new Date(2026, 9, 26, 9, 36); // 월요일, 2교시(09:40) 4분 전

describe('dueReminders', () => {
  it('알림이 꺼져 있으면 없음', () => {
    const d = data();
    d.settings.notifications = false;
    expect(dueReminders(d, now, new Set())).toEqual([]);
  });
  it('마감 임박 과제·시험만, 완료한 과제는 제외', () => {
    const r = dueReminders(data(), now, new Set());
    expect(r.map((x) => x.title)).toEqual(['과제 마감 내일', '시험 오늘']);
  });
  it('이미 보낸 알림은 다시 보내지 않음', () => {
    const r = dueReminders(data(), now, new Set(['a:a1:2026-10-26']));
    expect(r.map((x) => x.key)).toEqual(['e:e1:2026-10-26']);
  });
  it('수업 5분 전 알림', () => {
    const d = data();
    d.settings.classReminder = true;
    const r = dueReminders(d, now, new Set());
    expect(r.at(-1)).toMatchObject({ key: 'c:2026-10-26:2', title: '2교시 영어 4분 전' });
    expect(dueReminders(d, new Date(2026, 9, 26, 9, 30), new Set()).some((x) => x.key.startsWith('c:'))).toBe(false);
  });
});
