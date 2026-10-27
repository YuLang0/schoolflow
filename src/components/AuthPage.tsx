import { useEffect, useState, type FormEvent } from 'react';
import { authMode, enterTestMode, requestPasswordReset, resendConfirmation, signIn, signUp } from '../lib/auth';
import { authErrorMessage } from '../lib/authErrors';
import { localAuth } from '../lib/localAuth';
import { newPasswordProblem } from '../lib/password';
import type { AppUser } from '../lib/types';
import { Banner, Field, PasswordInput } from './ui';

type View = 'login' | 'signup' | 'forgot';
type Msg = { kind: 'error' | 'success' | 'info'; text: string } | null;

/** 메일 재발송 버튼 대기 시간 */
function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  return [left, () => setLeft(60)] as const;
}

export function AuthPage({ onSignedIn, notice }: { onSignedIn: (u: AppUser) => void; notice?: Msg }) {
  const [view, setView] = useState<View>(notice?.kind === 'error' && /링크/.test(notice.text) ? 'forgot' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(notice ?? null);
  const [unconfirmed, setUnconfirmed] = useState(false); // 인증 메일 재발송 버튼 표시
  const [cooldown, startCooldown] = useCooldown();

  const go = (v: View) => {
    setView(v);
    setMsg(null);
    setUnconfirmed(false);
    setPassword('');
    setPassword2('');
  };

  async function guard(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      const code = (e as { code?: string }).code;
      setUnconfirmed(code === 'email_not_confirmed' || /email not confirmed/i.test((e as Error).message ?? ''));
      setMsg({ kind: 'error', text: authErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const onLogin = (e: FormEvent) => {
    e.preventDefault();
    void guard(async () => onSignedIn(await signIn(email, password)));
  };

  const onSignup = (e: FormEvent) => {
    e.preventDefault();
    const problem = newPasswordProblem(password, password2);
    if (!name.trim()) return setMsg({ kind: 'error', text: '이름(별명)을 입력해 주세요.' });
    if (problem) return setMsg({ kind: 'error', text: problem });
    void guard(async () => {
      const r = await signUp(email, password, name);
      if (r.user) return onSignedIn(r.user);
      setView('login');
      setPassword('');
      setPassword2('');
      setUnconfirmed(true);
      startCooldown();
      setMsg({
        kind: 'success',
        text: `${email.trim()}(으)로 인증 메일을 보냈습니다. 메일의 링크를 누르면 자동으로 로그인됩니다. 메일이 안 보이면 스팸함도 확인해 주세요.`,
      });
    });
  };

  const onResend = () =>
    guard(async () => {
      await resendConfirmation(email);
      startCooldown();
      setUnconfirmed(true);
      setMsg({ kind: 'success', text: '인증 메일을 다시 보냈습니다. 가장 최근에 받은 메일의 링크를 눌러 주세요.' });
    });

  const onForgot = (e: FormEvent) => {
    e.preventDefault();
    if (authMode === 'cloud') {
      void guard(async () => {
        await requestPasswordReset(email);
        startCooldown();
        setMsg({
          kind: 'success',
          text: '가입된 이메일이면 비밀번호 재설정 메일이 발송됩니다. 메일의 링크를 누르면 새 비밀번호를 정하는 화면이 열립니다. 스팸함도 확인해 주세요.',
        });
      });
      return;
    }
    const problem = newPasswordProblem(password, password2);
    if (problem) return setMsg({ kind: 'error', text: problem });
    void guard(async () => {
      await localAuth.resetPassword(email, password);
      go('login');
      setMsg({ kind: 'success', text: '비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.' });
    });
  };

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <img src="/icon.svg" alt="" width={56} height={56} />
        <h1>SchoolFlow</h1>
        <p>시간표 · 과제 · 시험 · 공지를 한곳에서</p>
      </div>

      <div className="card auth-card">
        {view !== 'forgot' ? (
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={view === 'login'} className={view === 'login' ? 'on' : ''} onClick={() => go('login')}>
              로그인
            </button>
            <button role="tab" aria-selected={view === 'signup'} className={view === 'signup' ? 'on' : ''} onClick={() => go('signup')}>
              회원가입
            </button>
          </div>
        ) : (
          <div className="auth-title">
            <h2>비밀번호 찾기</h2>
            <p className="muted">
              {authMode === 'cloud'
                ? '가입한 이메일을 입력하면 비밀번호를 다시 정할 수 있는 링크를 보내 드립니다.'
                : '로컬 데모 계정은 이 기기에만 저장되어 있어 메일 대신 이 화면에서 바로 새 비밀번호를 정합니다.'}
            </p>
          </div>
        )}

        <form onSubmit={view === 'login' ? onLogin : view === 'signup' ? onSignup : onForgot} noValidate={false}>
          {view === 'signup' && (
            <Field label="이름(별명)" required>
              {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoComplete="nickname" required />}
            </Field>
          )}
          <Field label="이메일" required>
            {(id) => <input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />}
          </Field>

          {view === 'login' && (
            <Field label="비밀번호" required>
              {(id) => <PasswordInput id={id} value={password} onChange={setPassword} autoComplete="current-password" />}
            </Field>
          )}

          {(view === 'signup' || (view === 'forgot' && authMode === 'local')) && (
            <>
              <Field label={view === 'signup' ? '비밀번호' : '새 비밀번호'} required hint="8자 이상, 영문과 숫자를 섞어 주세요.">
                {(id) => <PasswordInput id={id} value={password} onChange={setPassword} autoComplete="new-password" />}
              </Field>
              <Field label="비밀번호 확인" required>
                {(id) => <PasswordInput id={id} value={password2} onChange={setPassword2} autoComplete="new-password" />}
              </Field>
            </>
          )}

          {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

          <button className="btn primary block" disabled={busy || (view === 'forgot' && authMode === 'cloud' && cooldown > 0)}>
            {busy
              ? '처리 중…'
              : view === 'login'
                ? '로그인'
                : view === 'signup'
                  ? '가입하기'
                  : authMode === 'cloud'
                    ? cooldown > 0
                      ? `재설정 메일 다시 보내기 (${cooldown}초)`
                      : '재설정 메일 보내기'
                    : '새 비밀번호 저장'}
          </button>
        </form>

        {view === 'login' && unconfirmed && authMode === 'cloud' && (
          <button className="btn ghost block" onClick={onResend} disabled={busy || cooldown > 0 || !email}>
            {cooldown > 0 ? `인증 메일 다시 보내기 (${cooldown}초)` : '인증 메일 다시 보내기'}
          </button>
        )}

        <div className="auth-links">
          {view === 'login' && (
            <>
              <button className="link" onClick={() => go('forgot')}>
                비밀번호를 잊으셨나요?
              </button>
              <button className="btn ghost block test-mode-btn" onClick={() => onSignedIn(enterTestMode())}>
                🧪 테스트 모드로 둘러보기
              </button>
              <p className="tiny muted">가입 없이 모든 기능을 써 볼 수 있습니다. 입력한 내용은 이 브라우저에만 저장됩니다.</p>
            </>
          )}
          {view === 'forgot' && (
            <button className="link" onClick={() => go('login')}>
              ← 로그인으로 돌아가기
            </button>
          )}
        </div>
      </div>

      <div className={`card mode-card ${authMode}`}>
        <span aria-hidden>{authMode === 'cloud' ? '☁️' : '💾'}</span>
        <div>
          <strong>{authMode === 'cloud' ? '계정 동기화 모드' : '로컬 데모 모드'}</strong>
          <p>
            {authMode === 'cloud'
              ? '데이터가 Supabase 서버에 계정별로 저장됩니다. 다른 기기에서 같은 계정으로 로그인하면 같은 데이터를 볼 수 있습니다.'
              : '데이터가 이 브라우저에만 저장됩니다. 다른 기기나 브라우저에서는 보이지 않습니다.'}
          </p>
        </div>
      </div>
      <p className="tiny muted">수집 정보: 이메일, 이름(별명), 직접 입력한 학교 생활 데이터</p>
    </div>
  );
}
