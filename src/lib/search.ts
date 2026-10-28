import { DAY_NAMES, type AppData } from './types';

export interface SearchHit {
  kind: 'exams' | 'events' | 'notices' | 'timetable';
  id: string;
  title: string;
  detail: string;
}

export const KIND_LABEL: Record<SearchHit['kind'], string> = {
  exams: '시험',
  events: '일정',
  notices: '공지',
  timetable: '시간표',
};

export function search(data: AppData, query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const has = (...fields: string[]) => fields.some((f) => f.toLowerCase().includes(q));
  const hits: SearchHit[] = [];
  for (const e of data.exams)
    if (has(e.title, e.subject, e.scope, e.memo))
      hits.push({ kind: 'exams', id: e.id, title: e.title, detail: `${e.subject} · ${e.date}` });
  for (const e of data.events)
    if (has(e.title, e.memo)) hits.push({ kind: 'events', id: e.id, title: e.title, detail: e.date });
  for (const n of data.notices)
    if (has(n.title, n.body)) hits.push({ kind: 'notices', id: n.id, title: n.title, detail: n.date });
  for (const t of data.timetable)
    if (has(t.subject, t.room, t.teacher))
      hits.push({ kind: 'timetable', id: t.id, title: t.subject, detail: `${DAY_NAMES[t.day]}요일 ${t.period}교시${t.room ? ` · ${t.room}` : ''}` });
  return hits;
}
