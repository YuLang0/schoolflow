// 앱을 닫아도 오는 알림(웹 푸시) 구독. 구독 정보는 설정(settings.pushSubs)에 저장되어
// 서버의 예약 함수(netlify/functions/push-cron.mjs)가 읽어 알림을 보냅니다.
import type { PushSub } from './types';

/** netlify/functions/push-cron.mjs의 VAPID_PUBLIC_KEY와 같아야 함 */
export const VAPID_PUBLIC_KEY = 'BMb5qu7QyCYglYtbnJwBj0JbEEf1QbIjjmqLo71uRaiIiCq2qKzQqf0OzsOfdMhYQ3AtkEDB8puN123Qew29Vas';
const LOCAL_KEY = 'sf:pushEndpoint';

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushSupport = 'ok' | 'no-sw' | 'no-push' | 'ios-browser';

export function pushSupport(): PushSupport {
  if (!('serviceWorker' in navigator)) return 'no-sw';
  if (!('PushManager' in window) || !('Notification' in window)) {
    // 아이폰은 홈 화면에 추가한 앱에서만 웹 푸시를 지원
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = globalThis.matchMedia?.('(display-mode: standalone)').matches ?? false;
    return ios && !standalone ? 'ios-browser' : 'no-push';
  }
  return 'ok';
}

/** 이 기기에서 구독한 엔드포인트 (다른 기기 구독과 구분) */
export const thisDeviceEndpoint = () => {
  try {
    return localStorage.getItem(LOCAL_KEY);
  } catch {
    return null;
  }
};

export async function subscribeThisDevice(): Promise<PushSub> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('알림 권한이 허용되지 않았습니다. 브라우저 설정에서 알림을 허용해 주세요.');
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error('앱 준비가 아직 끝나지 않았습니다. 페이지를 새로고침한 뒤 다시 켜 주세요.');
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON();
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) throw new Error('알림 구독 정보를 만들지 못했습니다.');
  try {
    localStorage.setItem(LOCAL_KEY, j.endpoint);
  } catch {
    /* 저장 실패는 무시 */
  }
  return {
    endpoint: j.endpoint,
    keys: { p256dh: j.keys.p256dh, auth: j.keys.auth },
    device: /iphone|ipad/i.test(navigator.userAgent) ? '아이폰' : /android/i.test(navigator.userAgent) ? '안드로이드' : '컴퓨터',
    at: new Date().toISOString(),
  };
}

export async function unsubscribeThisDevice(): Promise<string | null> {
  const endpoint = thisDeviceEndpoint();
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch {
    /* 이미 해제된 경우 */
  }
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* 무시 */
  }
  return endpoint;
}
