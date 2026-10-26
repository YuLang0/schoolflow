// 로컬 데모 모드 계정: 이 브라우저(localStorage)에만 저장됩니다.
// 비밀번호는 PBKDF2로 해시해 저장하고 원문은 저장하지 않습니다.
import type { AppUser } from './types';

interface LocalAccount {
  id: string;
  name: string;
  salt: string;
  hash: string;
  createdAt: string;
}

const ACCOUNTS_KEY = 'sf:local:accounts';
const SESSION_KEY = 'sf:local:session';

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100_000, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(bits);
}

function readAccounts(): Record<string, LocalAccount> {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAccounts(a: Record<string, LocalAccount>) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a));
}

const norm = (email: string) => email.trim().toLowerCase();
const toUser = (email: string, a: LocalAccount): AppUser => ({ id: a.id, email, name: a.name });
const fail = (code: string, message: string) => Object.assign(new Error(message), { code });

export const localAuth = {
  current(): AppUser | null {
    const email = localStorage.getItem(SESSION_KEY);
    if (!email) return null;
    const a = readAccounts()[email];
    return a ? toUser(email, a) : null;
  },

  async signUp(emailRaw: string, password: string, name: string): Promise<AppUser> {
    const email = norm(emailRaw);
    const accounts = readAccounts();
    if (accounts[email]) throw fail('user_already_exists', 'User already registered');
    const salt = crypto.randomUUID();
    accounts[email] = { id: crypto.randomUUID(), name: name.trim(), salt, hash: await hashPassword(password, salt), createdAt: new Date().toISOString() };
    writeAccounts(accounts);
    localStorage.setItem(SESSION_KEY, email);
    return toUser(email, accounts[email]);
  },

  async signIn(emailRaw: string, password: string): Promise<AppUser> {
    const email = norm(emailRaw);
    const a = readAccounts()[email];
    if (!a || (await hashPassword(password, a.salt)) !== a.hash) throw fail('invalid_credentials', 'Invalid login credentials');
    localStorage.setItem(SESSION_KEY, email);
    return toUser(email, a);
  },

  signOut() {
    localStorage.removeItem(SESSION_KEY);
  },

  exists(emailRaw: string): boolean {
    return !!readAccounts()[norm(emailRaw)];
  },

  /** 로그인한 상태에서 현재 비밀번호를 확인한 뒤 변경 */
  async changePassword(emailRaw: string, current: string, next: string): Promise<void> {
    const email = norm(emailRaw);
    const accounts = readAccounts();
    const a = accounts[email];
    if (!a || (await hashPassword(current, a.salt)) !== a.hash) throw fail('wrong_current', '현재 비밀번호가 올바르지 않습니다.');
    if (current === next) throw fail('same_password', 'New password should be different from the old password.');
    a.salt = crypto.randomUUID();
    a.hash = await hashPassword(next, a.salt);
    writeAccounts(accounts);
  },

  /**
   * 비밀번호를 잊었을 때: 로컬 계정은 메일로 확인할 방법이 없으므로 이 기기에서 바로 재설정합니다.
   * 로컬 데이터는 원래 이 기기에 암호화 없이 저장되어 있어 이 기능으로 새로 노출되는 정보는 없습니다.
   */
  async resetPassword(emailRaw: string, next: string): Promise<void> {
    const email = norm(emailRaw);
    const accounts = readAccounts();
    const a = accounts[email];
    if (!a) throw fail('user_not_found', '이 기기에 해당 이메일로 만든 로컬 계정이 없습니다.');
    a.salt = crypto.randomUUID();
    a.hash = await hashPassword(next, a.salt);
    writeAccounts(accounts);
  },

  updateName(emailRaw: string, name: string) {
    const email = norm(emailRaw);
    const accounts = readAccounts();
    if (accounts[email]) {
      accounts[email].name = name.trim();
      writeAccounts(accounts);
    }
  },
};
