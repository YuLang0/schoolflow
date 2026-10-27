import { useEffect, useState } from 'react';
import { fetchSchoolEvents, type SchoolEvent } from '../lib/neis';
import { useSchool } from './useSchool';

const TTL = 6 * 60 * 60 * 1000; // 6시간

/** 학사일정 (기기에 6시간 저장) */
export function useSchoolEvents(gradeNo: string, from: string, to: string) {
  const { school } = useSchool();
  const [events, setEvents] = useState<SchoolEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!school) return;
    let alive = true;
    const key = `sf:events:v1:${school.schoolCode}:${gradeNo}:${from}:${to}`;
    try {
      const hit = JSON.parse(localStorage.getItem(key) || 'null') as { at: number; events: SchoolEvent[] } | null;
      if (hit && Date.now() - hit.at < TTL) {
        setEvents(hit.events);
        setError(null);
        return;
      }
    } catch {
      /* 캐시가 깨졌으면 새로 받음 */
    }
    fetchSchoolEvents(school, gradeNo, from, to)
      .then((ev) => {
        if (!alive) return;
        setEvents(ev);
        setError(null);
        try {
          localStorage.setItem(key, JSON.stringify({ at: Date.now(), events: ev }));
        } catch {
          /* 저장 공간 부족은 무시 */
        }
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [school, gradeNo, from, to]);

  return { events, error };
}
