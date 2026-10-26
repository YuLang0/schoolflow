import { useEffect, useState } from 'react';
import { AuthPage } from './components/AuthPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { Shell } from './components/Shell';
import { getCurrentUser, toAppUser } from './lib/auth';
import { cleanAuthUrl, initialRedirect, supabase } from './lib/supabase';
import type { AppUser } from './lib/types';

type Notice = { kind: 'error' | 'success' | 'info'; text: string };
type Phase =
  | { k: 'loading' }
  | { k: 'out'; notice?: Notice }
  | { k: 'recovery'; user: AppUser }
  | { k: 'in'; user: AppUser; notice?: Notice };

export default function App() {
  const [phase, setPhase] = useState<Phase>({ k: 'loading' });

  useEffect(() => {
    let alive = true;
    const sub = supabase?.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY' && session) setPhase({ k: 'recovery', user: toAppUser(session.user) });
      else if (event === 'SIGNED_OUT') setPhase((p) => (p.k === 'out' ? p : { k: 'out' }));
    });

    void getCurrentUser().then((user) => {
      if (!alive) return;
      const r = initialRedirect;
      cleanAuthUrl();
      if (r?.error) return setPhase(user ? { k: 'in', user, notice: { kind: 'error', text: r.error } } : { k: 'out', notice: { kind: 'error', text: r.error } });
      if (!user) return setPhase((p) => (p.k === 'loading' ? { k: 'out' } : p));
      if (r?.type === 'recovery') return setPhase({ k: 'recovery', user });
      const notice: Notice | undefined =
        r?.type === 'signup' || r?.type === 'email'
          ? { kind: 'success', text: '이메일 인증이 완료되어 로그인되었습니다. SchoolFlow에 오신 것을 환영합니다!' }
          : r?.type === 'email_change'
            ? { kind: 'success', text: '이메일 변경이 확인되었습니다.' }
            : undefined;
      setPhase((p) => (p.k === 'recovery' ? p : { k: 'in', user, notice }));
    });

    return () => {
      alive = false;
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  switch (phase.k) {
    case 'loading':
      return <div className="splash">불러오는 중…</div>;
    case 'out':
      return <AuthPage notice={phase.notice} onSignedIn={(user) => setPhase({ k: 'in', user })} />;
    case 'recovery':
      return (
        <ResetPasswordPage
          email={phase.user.email}
          onDone={() => setPhase({ k: 'in', user: phase.user, notice: { kind: 'success', text: '비밀번호를 바꿨습니다. 다음부터 새 비밀번호로 로그인하세요.' } })}
          onCancel={() => setPhase({ k: 'out' })}
        />
      );
    case 'in':
      return (
        <Shell
          user={phase.user}
          initialNotice={phase.notice}
          onUserChange={(user) => setPhase({ k: 'in', user })}
          onSignedOut={() => setPhase({ k: 'out' })}
        />
      );
  }
}
