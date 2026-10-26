import { useEffect, useState } from 'react';
import { searchSchools } from '../lib/neis';
import type { SchoolRef } from '../lib/types';

/** 이 앱은 우리 학교 전용이라 학교를 고정합니다. 나이스 학교 코드는 처음 한 번 이름으로 찾아 기기에 저장합니다. */
export const FIXED_SCHOOL_NAME = '경기모바일과학고등학교';
const CACHE_KEY = 'sf:school:v1';

let pending: Promise<SchoolRef> | null = null;

function readCache(): SchoolRef | null {
  try {
    const s = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as SchoolRef | null;
    return s?.officeCode && s.schoolCode && s.name === FIXED_SCHOOL_NAME ? s : null;
  } catch {
    return null;
  }
}

export function resolveFixedSchool(): Promise<SchoolRef> {
  const hit = readCache();
  if (hit) return Promise.resolve(hit);
  pending ??= searchSchools(FIXED_SCHOOL_NAME)
    .then((list) => {
      const s = list.find((x) => x.name === FIXED_SCHOOL_NAME && x.officeName.includes('경기')) ?? list.find((x) => x.name === FIXED_SCHOOL_NAME);
      if (!s) throw new Error(`나이스에서 ${FIXED_SCHOOL_NAME}를 찾지 못했습니다.`);
      const ref = { officeCode: s.officeCode, schoolCode: s.schoolCode, name: s.name };
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(ref));
      } catch {
        /* 저장 실패는 무시 (다음에 다시 찾음) */
      }
      return ref;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function useSchool() {
  const [school, setSchool] = useState<SchoolRef | null>(readCache);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (school) return;
    let alive = true;
    resolveFixedSchool()
      .then((s) => alive && setSchool(s))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [school]);
  return { school, error };
}
