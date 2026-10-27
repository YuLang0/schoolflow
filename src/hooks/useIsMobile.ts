import { useEffect, useState } from 'react';

const QUERY = '(max-width: 720px)';

/** 휴대폰 화면 폭인지 (CSS의 모바일 기준과 같은 720px) */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}
