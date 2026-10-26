export const PASSWORD_MIN = 8;

/** 새 비밀번호 규칙 검사. 문제가 없으면 null */
export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`;
  if (pw.length > 72) return '비밀번호는 72자 이하로 정해 주세요.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return '비밀번호에 영문과 숫자를 모두 넣어 주세요.';
  if (/\s/.test(pw)) return '비밀번호에 공백은 쓸 수 없습니다.';
  return null;
}

/** 새 비밀번호 + 확인 입력 검사 */
export function newPasswordProblem(pw: string, confirm: string): string | null {
  return passwordProblem(pw) ?? (pw !== confirm ? '새 비밀번호와 확인 입력이 서로 다릅니다.' : null);
}

/** 한글 자판 상태로 입력했을 가능성 (로그인 실패 안내용) */
export function looksLikeHangul(pw: string): boolean {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(pw);
}
