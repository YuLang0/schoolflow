import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react';
import { Banner, Field, PasswordInput } from '../components/ui';
import { showNotification } from '../hooks/useReminders';
import type { DataApi } from '../hooks/useAppData';
import { authMode, changePassword, signOut, updateName } from '../lib/auth';
import { authErrorMessage } from '../lib/authErrors';
import { makeBackup, parseBackup } from '../lib/backup';
import { toCSV } from '../lib/csv';
import { toDateStr } from '../lib/date';
import { downloadText } from '../lib/download';
import { FIXED_SCHOOL_NAME } from '../hooks/useSchool';
import { ALLERGENS } from '../lib/neis';
import { newPasswordProblem } from '../lib/password';
import { DAY_NAMES, LUNCH_TIME, type AppData, type AppUser, type Settings } from '../lib/types';

type Theme = 'system' | 'light' | 'dark';
type Msg = { kind: 'error' | 'success' | 'info'; text: string } | null;

function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function SettingsPage({
  data,
  api,
  user,
  onUserChange,
  onSignedOut,
}: {
  data: AppData;
  api: DataApi;
  user: AppUser;
  onUserChange: (u: AppUser) => void;
  onSignedOut: () => void;
}) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('sf:theme') as Theme) || 'system');
  const s = data.settings;
  const save = (patch: Partial<Settings>) => void api.saveSettings({ ...s, ...patch });

  useEffect(() => {
    localStorage.setItem('sf:theme', theme);
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="stack settings">
      <ProfileSection user={user} onUserChange={onUserChange} settings={s} save={save} />
      {user.test ? (
        <section className="card">
          <h3>비밀번호 변경</h3>
          <p className="muted small">테스트 모드에는 계정이 없어 비밀번호가 없습니다.</p>
        </section>
      ) : (
        <PasswordSection user={user} />
      )}

      <section className="card">
        <h3>화면</h3>
        <div className="seg">
          {(['system', 'light', 'dark'] as Theme[]).map((t) => (
            <button key={t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>
              {t === 'system' ? '기기 설정' : t === 'light' ? '라이트' : '다크'}
            </button>
          ))}
        </div>
      </section>

      <PeriodSection settings={s} />
      <AllergySection settings={s} save={save} />
      <NotifySection settings={s} save={save} />
      <DataSection data={data} api={api} />

      <section className="card">
        <h3>계정</h3>
        <p className="muted small">
          {user.test
            ? '테스트 모드: 데이터가 이 브라우저에만 저장됩니다.'
            : authMode === 'cloud'
              ? '계정 동기화 모드: 데이터가 Supabase 서버에 저장됩니다.'
              : '로컬 데모 모드: 데이터가 이 브라우저에만 저장됩니다.'}
        </p>
        <button
          className="btn ghost"
          onClick={async () => {
            await signOut();
            onSignedOut();
          }}
        >
          {user.test ? '테스트 끝내기' : '로그아웃'}
        </button>
      </section>
      <p className="tiny muted center">SchoolFlow v1.1</p>
    </div>
  );
}

function ProfileSection({ user, onUserChange, settings, save }: { user: AppUser; onUserChange: (u: AppUser) => void; settings: Settings; save: (p: Partial<Settings>) => void }) {
  const [name, setName] = useState(user.name);
  const [gradeNo, setGradeNo] = useState(settings.gradeNo);
  const [classNo, setClassNo] = useState(settings.classNo);
  const [msg, setMsg] = useState<Msg>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (name.trim() && name.trim() !== user.name) {
        if (!user.test) await updateName(user, name);
        onUserChange({ ...user, name: name.trim() });
      }
      save({ schoolName: FIXED_SCHOOL_NAME, gradeNo, classNo: classNo.trim() });
      setMsg({ kind: 'success', text: '저장했습니다.' });
    } catch (err) {
      setMsg({ kind: 'error', text: authErrorMessage(err) });
    }
  };
  return (
    <form className="card" onSubmit={submit}>
      <h3>내 정보</h3>
      <p className="muted small">{user.email}</p>
      <Field label="이름(별명)">{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />}</Field>
      <div className="field">
        <label>학교</label>
        <div className="school-chosen">
          <strong>{FIXED_SCHOOL_NAME}</strong>
        </div>
      </div>
      <div className="row2">
        <Field label="학년">
          {(id) => (
            <select id={id} value={gradeNo} onChange={(e) => setGradeNo(e.target.value)}>
              <option value="">선택</option>
              {['1', '2', '3'].map((g) => (
                <option key={g} value={g}>
                  {g}학년
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="반" hint="숫자만 (예: 3)">
          {(id) => <input id={id} value={classNo} onChange={(e) => setClassNo(e.target.value)} maxLength={10} inputMode="numeric" />}
        </Field>
      </div>
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      <button className="btn primary">저장</button>
      <p className="hint">학년·반을 정하면 나이스에서 우리 반 시간표를 가져올 수 있습니다.</p>
    </form>
  );
}

function AllergySection({ settings, save }: { settings: Settings; save: (p: Partial<Settings>) => void }) {
  const toggle = (n: number) => {
    const has = settings.allergies.includes(n);
    save({ allergies: has ? settings.allergies.filter((x) => x !== n) : [...settings.allergies, n].sort((a, b) => a - b) });
  };
  return (
    <section className="card">
      <h3>급식 알레르기</h3>
      <p className="muted small">고른 재료가 들어간 메뉴는 급식표에서 ⚠ 표시로 강조됩니다.</p>
      <div className="chips">
        {ALLERGENS.map((a, i) => (
          <button key={a} type="button" className={`chip ${settings.allergies.includes(i + 1) ? 'on' : ''}`} aria-pressed={settings.allergies.includes(i + 1)} onClick={() => toggle(i + 1)}>
            {i + 1}. {a}
          </button>
        ))}
      </div>
    </section>
  );
}

function PasswordSection({ user }: { user: AppUser }) {
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = newPasswordProblem(pw, pw2);
    if (problem) return setMsg({ kind: 'error', text: problem });
    setBusy(true);
    setMsg(null);
    try {
      await changePassword(user, cur, pw);
      setCur('');
      setPw('');
      setPw2('');
      setMsg({ kind: 'success', text: '비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.' });
    } catch (err) {
      setMsg({ kind: 'error', text: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card" onSubmit={submit} aria-labelledby="pw-title">
      <h3 id="pw-title">비밀번호 변경</h3>
      {/* 비밀번호 관리자가 어느 계정인지 알 수 있도록 */}
      <input type="email" value={user.email} autoComplete="username" readOnly hidden />
      <Field label="현재 비밀번호" required>
        {(id) => <PasswordInput id={id} value={cur} onChange={setCur} autoComplete="current-password" />}
      </Field>
      <div className="row2">
        <Field label="새 비밀번호" required hint="8자 이상, 영문과 숫자를 섞어 주세요.">
          {(id) => <PasswordInput id={id} value={pw} onChange={setPw} autoComplete="new-password" />}
        </Field>
        <Field label="새 비밀번호 확인" required>
          {(id) => <PasswordInput id={id} value={pw2} onChange={setPw2} autoComplete="new-password" />}
        </Field>
      </div>
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      <button className="btn primary" disabled={busy}>
        {busy ? '변경 중…' : '비밀번호 변경'}
      </button>
      <p className="hint">현재 비밀번호가 기억나지 않으면 로그아웃한 뒤 로그인 화면의 "비밀번호를 잊으셨나요?"를 누르세요.</p>
    </form>
  );
}

function PeriodSection({ settings }: { settings: Settings }) {
  return (
    <section className="card">
      <h3>교시 시간</h3>
      <p className="muted small">우리 학교 시간표 기준으로 고정되어 있습니다.</p>
      <ul className="list period-fixed">
        {settings.periodTimes.map((t, i) => (
          <Fragment key={i}>
            {t.start === LUNCH_TIME.end && (
              <li className="lunch">
                <span className="badge warn">점심</span>
                <span>
                  {LUNCH_TIME.start} ~ {LUNCH_TIME.end}
                </span>
              </li>
            )}
            <li>
              <span className="badge">{i + 1}교시</span>
              <span>
                {t.start} ~ {t.end}
              </span>
            </li>
          </Fragment>
        ))}
      </ul>
    </section>
  );
}

function NotifySection({ settings, save }: { settings: Settings; save: (p: Partial<Settings>) => void }) {
  const supported = 'Notification' in window;
  const [perm, setPerm] = useState(supported ? Notification.permission : 'denied');

  const toggle = async (on: boolean) => {
    if (on && supported && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p !== 'granted') return;
    }
    save({ notifications: on });
  };

  return (
    <section className="card">
      <h3>알림</h3>
      {!supported ? (
        <p className="muted small">이 브라우저는 알림을 지원하지 않습니다. 아이폰은 홈 화면에 추가한 앱에서만 알림을 받을 수 있습니다.</p>
      ) : (
        <>
          <label className="check">
            <input type="checkbox" checked={settings.notifications && perm === 'granted'} onChange={(e) => void toggle(e.target.checked)} /> 과제·시험 알림 받기
          </label>
          {perm === 'denied' && <p className="warn">브라우저에서 알림이 차단되어 있습니다. 주소창 왼쪽 자물쇠 아이콘에서 알림을 허용해 주세요.</p>}
          <div className="row2">
            <Field label="마감 며칠 전부터 알릴까요?">
              {(id) => (
                <select id={id} value={settings.remindDays} onChange={(e) => save({ remindDays: Number(e.target.value) })}>
                  {[0, 1, 2, 3, 5, 7].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? '당일만' : `${n}일 전부터`}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <label className="check">
            <input type="checkbox" checked={settings.classReminder} onChange={(e) => save({ classReminder: e.target.checked })} /> 수업 시작 5분 전 알림
          </label>
          <p className="hint">앱(또는 브라우저 탭)이 열려 있을 때 알림이 옵니다.</p>
          <button className="btn ghost small" disabled={perm !== 'granted'} onClick={() => void showNotification('SchoolFlow 알림 테스트', '알림이 잘 도착했습니다!')}>
            테스트 알림 보내기
          </button>
        </>
      )}
    </section>
  );
}

function DataSection({ data, api }: { data: AppData; api: DataApi }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const today = toDateStr(new Date());

  const restore = async (file: File) => {
    try {
      const next = parseBackup(await file.text());
      const count = next.assignments.length + next.exams.length + next.events.length + next.notices.length + next.timetable.length;
      if (!confirm(`백업 파일의 데이터 ${count}개로 지금 데이터를 모두 바꿉니다. 계속할까요?`)) return;
      const ok = await api.replaceAll(next);
      setMsg(ok ? { kind: 'success', text: `복원했습니다. (항목 ${count}개)` } : { kind: 'error', text: '복원 중 오류가 발생했습니다.' });
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const exportTimetable = () =>
    downloadText(
      `schoolflow-timetable-${today}.csv`,
      toCSV(
        ['교시', ...DAY_NAMES],
        data.settings.periodTimes.map((p, i) => [`${i + 1}교시 (${p.start}~${p.end})`, ...DAY_NAMES.map((_, d) => data.timetable.find((e) => e.day === d && e.period === i + 1)?.subject ?? '')]),
      ),
      'text/csv;charset=utf-8',
    );

  return (
    <section className="card">
      <h3>백업 · 내보내기</h3>
      <div className="actions wrap">
        <button className="btn ghost" onClick={() => downloadText(`schoolflow-backup-${today}.json`, makeBackup(data), 'application/json')}>
          백업 파일 받기 (JSON)
        </button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>
          백업에서 복원
        </button>
        <button className="btn ghost" onClick={exportTimetable}>
          시간표 CSV
        </button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && void restore(e.target.files[0])} />
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      <p className="hint">과제·시험 CSV는 각 화면 위쪽의 CSV 버튼으로 받을 수 있습니다.</p>
    </section>
  );
}
