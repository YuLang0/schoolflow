interface AuthLikeError {
  message?: string;
  code?: string;
  status?: number;
}

/** Supabase/로컬 인증 오류를 사용자에게 보여 줄 한국어 문장으로 */
export function authErrorMessage(err: unknown): string {
  const e = (err ?? {}) as AuthLikeError;
  const code = e.code ?? '';
  const msg = e.message ?? String(err ?? '');

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg))
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg))
    return '이메일 인증이 아직 끝나지 않았습니다. 메일함(스팸함 포함)에서 인증 링크를 눌러 주세요.';
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered/i.test(msg))
    return '이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해 주세요.';
  if (code === 'same_password' || /should be different from the old password/i.test(msg))
    return '새 비밀번호가 지금 비밀번호와 같습니다. 다른 비밀번호를 정해 주세요.';
  if (code === 'weak_password' || /password should be at least/i.test(msg))
    return '비밀번호가 너무 약합니다. 8자 이상, 영문과 숫자를 섞어 주세요.';
  if (code === 'over_email_send_rate_limit' || /email rate limit/i.test(msg))
    return '메일을 너무 자주 요청했습니다. 잠시 후(최대 1시간) 다시 시도해 주세요.';
  const wait = msg.match(/after (\d+) seconds?/i);
  if (wait) return `보안을 위해 ${wait[1]}초 후에 다시 요청할 수 있습니다.`;
  if (code === 'over_request_rate_limit' || e.status === 429)
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  if (code === 'session_not_found' || code === 'session_expired' || /auth session missing/i.test(msg))
    return '로그인 상태가 만료되었습니다. 다시 로그인하거나 비밀번호 찾기 메일을 다시 받아 주세요.';
  if (code === 'validation_failed' && /email/i.test(msg)) return '이메일 형식이 올바르지 않습니다.';
  if (/failed to fetch|network|load failed/i.test(msg))
    return '서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.';
  return msg && /[가-힣]/.test(msg) ? msg : `처리 중 오류가 발생했습니다. (${msg || '알 수 없는 오류'})`;
}

export interface AuthRedirect {
  type: string | null; // signup, recovery, magiclink, email_change, invite …
  error: string | null; // 사용자에게 보여 줄 문장
  errorCode: string | null;
}

/** 이메일 링크로 돌아왔을 때 주소의 #... / ?... 부분을 해석 */
export function parseAuthRedirect(hash: string, search = ''): AuthRedirect | null {
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  const q = new URLSearchParams(search.replace(/^\?/, ''));
  const get = (k: string) => h.get(k) ?? q.get(k);
  const type = get('type');
  const errorCode = get('error_code') ?? get('error');
  if (!type && !errorCode && !h.has('access_token')) return null;

  let error: string | null = null;
  if (errorCode) {
    error =
      errorCode === 'otp_expired'
        ? '링크가 만료되었거나 이미 사용되었습니다. 메일을 다시 요청해 주세요.'
        : `링크를 처리하지 못했습니다: ${get('error_description') ?? errorCode}`;
  }
  return { type, error, errorCode };
}
