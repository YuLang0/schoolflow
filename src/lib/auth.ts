// 로그인·가입·비밀번호 관련 동작을 두 저장 모드(로컬 데모 / Supabase)에 맞춰 하나로 묶습니다.
import type { User } from '@supabase/supabase-js';
import { localAuth } from './localAuth';
import { appUrl, cloudEnabled, supabase } from './supabase';
import type { AppUser } from './types';

export const authMode: 'cloud' | 'local' = cloudEnabled ? 'cloud' : 'local';

export function toAppUser(u: User): AppUser {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  return { id: u.id, email: u.email ?? '', name: typeof meta.name === 'string' ? meta.name : '' };
}

// 테스트 모드: 계정 없이 앱을 둘러보는 용도. 탭을 닫으면 끝나고, 입력한 내용은 이 브라우저에만 남습니다.
const TEST_KEY = 'sf:testmode';
export const TEST_USER: AppUser = { id: 'test-mode', email: 'test@schoolflow.local', name: '테스트', test: true };

/** 테스트 모드는 2학년 3반으로 시작해 바로 시간표가 채워지게 합니다 (학년·반을 안 정했을 때만) */
function seedTestClass() {
  const key = `sf:data:${TEST_USER.email}`;
  let raw: { settings?: Record<string, unknown> } & Record<string, unknown> = {};
  try {
    raw = JSON.parse(localStorage.getItem(key) || '{}') ?? {};
  } catch {
    raw = {};
  }
  if (raw.settings?.gradeNo && raw.settings?.classNo) return;
  raw.settings = { ...(raw.settings ?? {}), gradeNo: '2', classNo: '3' };
  localStorage.setItem(key, JSON.stringify(raw));
}

export function enterTestMode(): AppUser {
  sessionStorage.setItem(TEST_KEY, '1');
  seedTestClass();
  return TEST_USER;
}

/** 테스트 모드에서 입력한 내용 지우기 (2학년 3반 설정은 다시 채움) */
export function clearTestData() {
  for (const k of Object.keys(localStorage)) {
    if (k === `sf:data:${TEST_USER.email}` || k.startsWith(`sf:notified:${TEST_USER.id}`)) localStorage.removeItem(k);
  }
  for (const k of Object.keys(sessionStorage)) if (k.startsWith(`sf:ttsync:${TEST_USER.id}`)) sessionStorage.removeItem(k);
  seedTestClass();
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if (sessionStorage.getItem(TEST_KEY)) return TEST_USER;
  if (!supabase) return localAuth.current();
  const { data } = await supabase.auth.getSession();
  return data.session ? toAppUser(data.session.user) : null;
}

export async function signIn(email: string, password: string): Promise<AppUser> {
  if (!supabase) return localAuth.signIn(email, password);
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return toAppUser(data.user);
}

/** needsConfirm=true면 인증 메일을 확인해야 로그인할 수 있음 */
export async function signUp(email: string, password: string, name: string): Promise<{ user: AppUser | null; needsConfirm: boolean }> {
  if (!supabase) return { user: await localAuth.signUp(email, password, name), needsConfirm: false };
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name: name.trim() }, emailRedirectTo: appUrl() },
  });
  if (error) throw error;
  // 이미 가입된 이메일이면 Supabase는 오류 대신 identities가 빈 사용자를 돌려줍니다.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    throw Object.assign(new Error('User already registered'), { code: 'user_already_exists' });
  }
  return { user: data.session ? toAppUser(data.user!) : null, needsConfirm: !data.session };
}

export async function signOut() {
  sessionStorage.removeItem('sf:view'); // 다음 로그인은 홈 화면부터
  if (sessionStorage.getItem(TEST_KEY)) return sessionStorage.removeItem(TEST_KEY);
  if (!supabase) return localAuth.signOut();
  await supabase.auth.signOut();
}

export async function resendConfirmation(email: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: appUrl() } });
  if (error) throw error;
}

/** 비밀번호 찾기 메일 발송 (계정 동기화 모드) */
export async function requestPasswordReset(email: string) {
  if (!supabase) throw new Error('로컬 데모 모드에서는 메일을 보낼 수 없습니다.');
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
  if (error) throw error;
}

/** 재설정 링크로 들어온 상태에서 새 비밀번호 저장 */
export async function setNewPassword(password: string) {
  if (!supabase) throw new Error('로컬 데모 모드에서는 사용할 수 없습니다.');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/** 로그인한 상태에서 현재 비밀번호를 확인하고 변경 */
export async function changePassword(user: AppUser, current: string, next: string) {
  if (!supabase) return localAuth.changePassword(user.email, current, next);
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (check.error) {
    const invalid = check.error.code === 'invalid_credentials' || /invalid login credentials/i.test(check.error.message);
    throw invalid ? Object.assign(new Error('현재 비밀번호가 올바르지 않습니다.'), { code: 'wrong_current' }) : check.error;
  }
  if (current === next) throw Object.assign(new Error('same'), { code: 'same_password' });
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) throw error;
}

export async function updateName(user: AppUser, name: string) {
  if (!supabase) return localAuth.updateName(user.email, name);
  const { error } = await supabase.auth.updateUser({ data: { name: name.trim() } });
  if (error) throw error;
}
