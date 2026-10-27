import { beforeEach, describe, expect, it } from 'vitest';
import { authErrorMessage, parseAuthRedirect } from './authErrors';
import { localAuth } from './localAuth';
import { looksLikeHangul, newPasswordProblem, passwordProblem } from './password';
import { LocalStore } from './store';

describe('비밀번호 규칙', () => {
  it('길이·영문·숫자·확인', () => {
    expect(passwordProblem('abc123')).toMatch('8자 이상');
    expect(passwordProblem('abcdefgh')).toMatch('영문과 숫자');
    expect(passwordProblem('12345678')).toMatch('영문과 숫자');
    expect(passwordProblem('abcd 1234')).toMatch('공백');
    expect(passwordProblem('abcd1234')).toBeNull();
    expect(newPasswordProblem('abcd1234', 'abcd1235')).toMatch('서로 다릅니다');
    expect(newPasswordProblem('abcd1234', 'abcd1234')).toBeNull();
  });
  it('한글 입력 감지', () => {
    expect(looksLikeHangul('ㅁㅠㅊㅇ1234')).toBe(true);
    expect(looksLikeHangul('abcd1234')).toBe(false);
  });
});

describe('authErrorMessage', () => {
  it('Supabase 오류를 한국어로', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe('이메일 또는 비밀번호가 올바르지 않습니다.');
    expect(authErrorMessage({ message: 'Email not confirmed' })).toMatch('이메일 인증');
    expect(authErrorMessage({ code: 'same_password' })).toMatch('지금 비밀번호와 같습니다');
    expect(authErrorMessage({ message: 'For security purposes, you can only request this after 42 seconds.' })).toBe('보안을 위해 42초 후에 다시 요청할 수 있습니다.');
    expect(authErrorMessage({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' })).toMatch('메일을 너무 자주');
    expect(authErrorMessage(new TypeError('Failed to fetch'))).toMatch('인터넷 연결');
    expect(authErrorMessage({ code: 'wrong_current', message: '현재 비밀번호가 올바르지 않습니다.' })).toBe('현재 비밀번호가 올바르지 않습니다.');
  });
});

describe('parseAuthRedirect', () => {
  it('일반 주소는 null', () => {
    expect(parseAuthRedirect('', '')).toBeNull();
  });
  it('비밀번호 재설정 링크', () => {
    expect(parseAuthRedirect('#access_token=x&refresh_token=y&type=recovery')).toEqual({ type: 'recovery', error: null, errorCode: null });
  });
  it('가입 인증 링크', () => {
    expect(parseAuthRedirect('#access_token=x&type=signup')?.type).toBe('signup');
  });
  it('만료된 링크', () => {
    const r = parseAuthRedirect('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    expect(r?.errorCode).toBe('otp_expired');
    expect(r?.error).toMatch('만료');
  });
});

describe('localAuth (로컬 데모 계정)', () => {
  beforeEach(() => localStorage.clear());

  it('가입 → 로그아웃 → 로그인, 틀린 비밀번호 거부', async () => {
    await localAuth.signUp('Kim@Test.com', 'abcd1234', '김학생');
    expect(localAuth.current()?.name).toBe('김학생');
    localAuth.signOut();
    expect(localAuth.current()).toBeNull();
    await expect(localAuth.signIn('kim@test.com', 'wrong1234')).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect((await localAuth.signIn(' kim@test.com ', 'abcd1234')).email).toBe('kim@test.com');
    expect(localStorage.getItem('sf:local:accounts')).not.toContain('abcd1234');
  });

  it('중복 가입 거부', async () => {
    await localAuth.signUp('a@b.c', 'abcd1234', 'A');
    await expect(localAuth.signUp('A@B.C', 'abcd1234', 'A')).rejects.toMatchObject({ code: 'user_already_exists' });
  });

  it('비밀번호 변경: 현재 비밀번호 확인, 같은 비밀번호 거부', async () => {
    await localAuth.signUp('a@b.c', 'abcd1234', 'A');
    await expect(localAuth.changePassword('a@b.c', 'nope1234', 'new12345')).rejects.toMatchObject({ code: 'wrong_current' });
    await expect(localAuth.changePassword('a@b.c', 'abcd1234', 'abcd1234')).rejects.toMatchObject({ code: 'same_password' });
    await localAuth.changePassword('a@b.c', 'abcd1234', 'new12345');
    await expect(localAuth.signIn('a@b.c', 'abcd1234')).rejects.toBeTruthy();
    await expect(localAuth.signIn('a@b.c', 'new12345')).resolves.toBeTruthy();
  });

  it('비밀번호 찾기(재설정) 후 새 비밀번호로 로그인, 데이터는 유지', async () => {
    const u = await localAuth.signUp('a@b.c', 'abcd1234', 'A');
    const store = new LocalStore(u.email);
    await store.put('notices', { id: 'n1', title: '공지', body: '', date: '2026-10-26', pinned: false, important: false });
    localAuth.signOut();
    await localAuth.resetPassword('A@b.c', 'reset1234');
    await expect(localAuth.signIn('a@b.c', 'reset1234')).resolves.toMatchObject({ id: u.id });
    expect((await new LocalStore('a@b.c').load()).notices).toHaveLength(1);
    await expect(localAuth.resetPassword('none@b.c', 'reset1234')).rejects.toMatchObject({ code: 'user_not_found' });
  });
});

describe('LocalStore', () => {
  beforeEach(() => localStorage.clear());
  it('계정별로 분리 저장, 수정·삭제', async () => {
    const a = new LocalStore('a@x');
    const b = new LocalStore('b@x');
    const item = { id: '1', title: 't', date: '2026-10-26', memo: '' };
    await a.put('events', item);
    await a.put('events', { ...item, title: '수정' });
    expect((await a.load()).events).toEqual([{ ...item, title: '수정' }]);
    expect((await b.load()).events).toEqual([]);
    await a.remove('events', '1');
    expect((await a.load()).events).toEqual([]);
  });
});

describe('교시 시간 고정', () => {
  beforeEach(() => localStorage.clear());
  it('예전에 저장한 교시 시간이 있어도 학교 고정값으로 불러옴', async () => {
    localStorage.setItem('sf:data:old@x', JSON.stringify({ settings: { periodTimes: [{ start: '08:40', end: '09:30' }] } }));
    const s = (await new LocalStore('old@x').load()).settings;
    expect(s.periodTimes.map((p) => p.start)).toEqual(['09:10', '10:10', '11:10', '12:10', '13:50', '14:50', '15:50']);
  });
});
