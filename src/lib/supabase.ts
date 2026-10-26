import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseAuthRedirect, type AuthRedirect } from './authErrors';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase 설정이 있으면 계정 동기화 모드, 없으면 로컬 데모 모드 */
export const cloudEnabled = !!(url && key && /^https:\/\//.test(url));

// supabase-js가 주소의 #access_token… 을 처리하고 지우기 전에 먼저 읽어 둡니다.
export const initialRedirect: AuthRedirect | null =
  typeof window !== 'undefined' ? parseAuthRedirect(window.location.hash, window.location.search) : null;

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
    })
  : null;

/** 인증 처리 후 주소창의 토큰·오류 문자열을 지웁니다 */
export function cleanAuthUrl() {
  if (window.location.hash || /[?&](error|code|type)=/.test(window.location.search)) {
    window.history.replaceState(null, '', window.location.pathname);
  }
}

export const appUrl = () => `${window.location.origin}/`;
