import { useState, type FormEvent } from 'react';
import { setNewPassword, signOut } from '../lib/auth';
import { authErrorMessage } from '../lib/authErrors';
import { newPasswordProblem } from '../lib/password';
import { Banner, Field, PasswordInput } from './ui';

/** 비밀번호 재설정 메일의 링크로 들어왔을 때 보이는 화면 */
export function ResetPasswordPage({ email, onDone, onCancel }: { email: string; onDone: () => void; onCancel: () => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = newPasswordProblem(pw, pw2);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await setNewPassword(pw);
      onDone();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <img src="/icon.svg" alt="" width={56} height={56} />
        <h1>새 비밀번호 설정</h1>
        <p>{email}</p>
      </div>
      <form className="card auth-card" onSubmit={submit}>
        <Field label="새 비밀번호" required hint="8자 이상, 영문과 숫자를 섞어 주세요.">
          {(id) => <PasswordInput id={id} value={pw} onChange={setPw} autoComplete="new-password" />}
        </Field>
        <Field label="새 비밀번호 확인" required>
          {(id) => <PasswordInput id={id} value={pw2} onChange={setPw2} autoComplete="new-password" />}
        </Field>
        {error && <Banner kind="error">{error}</Banner>}
        <button className="btn primary block" disabled={busy}>
          {busy ? '저장 중…' : '비밀번호 저장'}
        </button>
        <button
          type="button"
          className="btn ghost block"
          onClick={async () => {
            await signOut();
            onCancel();
          }}
        >
          취소하고 로그아웃
        </button>
      </form>
    </div>
  );
}
