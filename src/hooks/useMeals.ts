import { useEffect, useState } from 'react';
import { fetchMeals, type Meal } from '../lib/neis';
import type { SchoolRef } from '../lib/types';

const TTL = 3 * 60 * 60 * 1000; // 3시간

function cacheKey(school: SchoolRef, from: string, to: string) {
  return `sf:meals:v2:${school.officeCode}:${school.schoolCode}:${from}:${to}`;
}

/** 급식 정보 (이 기기에 3시간 동안 저장해 나이스 호출을 줄임) */
export function useMeals(school: SchoolRef | null, from: string, to: string) {
  const [meals, setMeals] = useState<Meal[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!school) return;
    let alive = true;
    const key = cacheKey(school, from, to);
    try {
      const hit = JSON.parse(localStorage.getItem(key) || 'null') as { at: number; meals: Meal[] } | null;
      if (hit && Date.now() - hit.at < TTL && nonce === 0) {
        setMeals(hit.meals);
        setError(null);
        return;
      }
    } catch {
      /* 캐시가 깨졌으면 새로 받음 */
    }
    setLoading(true);
    setError(null);
    fetchMeals(school, from, to)
      .then((m) => {
        if (!alive) return;
        setMeals(m);
        try {
          localStorage.setItem(key, JSON.stringify({ at: Date.now(), meals: m }));
        } catch {
          /* 저장 공간 부족은 무시 */
        }
      })
      .catch((e: Error) => alive && (setError(e.message), setMeals(null)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [school?.officeCode, school?.schoolCode, from, to, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  return { meals, loading, error, refresh: () => setNonce((n) => n + 1) };
}
