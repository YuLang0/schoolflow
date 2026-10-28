import { diffDays, minutesOf, toDateStr, weekdayIndex } from './date';
import type { AppData } from './types';

export interface Reminder {
  key: string; // 같은 알림을 두 번 보내지 않기 위한 고유 키
  title: string;
  body: string;
}

function whenLabel(n: number): string {
  return n === 0 ? '오늘' : n === 1 ? '내일' : `${n}일 후`;
}

/** 지금 보내야 할 알림 목록 (이미 보낸 키는 제외) */
export function dueReminders(data: AppData, now: Date, sent: Set<string>): Reminder[] {
  const s = data.settings;
  if (!s.notifications) return [];
  const today = toDateStr(now);
  const out: Reminder[] = [];

  for (const e of data.exams) {
    const n = diffDays(today, e.date);
    if (n < 0 || n > s.remindDays) continue;
    out.push({
      key: `e:${e.id}:${today}`,
      title: `시험 ${whenLabel(n)}`,
      body: `${e.subject ? `[${e.subject}] ` : ''}${e.title}${e.time ? ` ${e.time}` : ''}`,
    });
  }

  if (s.classReminder) {
    const day = weekdayIndex(now);
    const t = now.getHours() * 60 + now.getMinutes();
    s.periodTimes.forEach((p, i) => {
      const startsIn = minutesOf(p.start) - t;
      if (startsIn < 0 || startsIn > 5) return;
      const entry = data.timetable.find((x) => x.day === day && x.period === i + 1);
      if (!entry) return;
      out.push({
        key: `c:${today}:${i + 1}`,
        title: `${i + 1}교시 ${entry.subject} ${startsIn === 0 ? '시작' : `${startsIn}분 전`}`,
        body: entry.room ? `장소: ${entry.room}` : '곧 수업이 시작됩니다.',
      });
    });
  }

  return out.filter((r) => !sent.has(r.key));
}
