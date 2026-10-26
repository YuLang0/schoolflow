import { useEffect } from 'react';
import { dueReminders } from '../lib/reminders';
import { toDateStr } from '../lib/date';
import type { AppData, AppUser } from '../lib/types';

const sentKey = (user: AppUser) => `sf:notified:${user.id}`;

function readSent(user: AppUser, today: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(sentKey(user)) || '[]') as string[];
    // 오늘 날짜가 들어간 키만 남겨 저장 공간이 계속 늘지 않게 함
    return new Set(raw.filter((k) => k.includes(today)));
  } catch {
    return new Set();
  }
}

export async function showNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const options = { body, icon: '/icon.svg', badge: '/icon.svg', tag: title };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return void (await reg.showNotification(title, options));
  } catch {
    /* 서비스 워커가 없으면 일반 알림으로 */
  }
  new Notification(title, options);
}

/** 앱이 열려 있는 동안 30초마다 보낼 알림이 있는지 확인 */
export function useReminders(user: AppUser, data: AppData | null) {
  useEffect(() => {
    if (!data?.settings.notifications) return;
    const tick = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const now = new Date();
      const today = toDateStr(now);
      const sent = readSent(user, today);
      for (const r of dueReminders(data, now, sent)) {
        void showNotification(r.title, r.body);
        sent.add(r.key);
      }
      localStorage.setItem(sentKey(user), JSON.stringify([...sent]));
    };
    tick();
    const t = window.setInterval(tick, 30_000);
    return () => window.clearInterval(t);
  }, [user, data]);
}
