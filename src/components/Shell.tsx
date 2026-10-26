import { useEffect, useState } from 'react';
import { useAppData } from '../hooks/useAppData';
import { useReminders } from '../hooks/useReminders';
import { authMode } from '../lib/auth';
import type { AppUser } from '../lib/types';
import { AssignmentsPage } from '../pages/AssignmentsPage';
import { CalendarPage } from '../pages/CalendarPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ExamsPage } from '../pages/ExamsPage';
import { NoticesPage } from '../pages/NoticesPage';
import { SearchPage } from '../pages/SearchPage';
import { SettingsPage } from '../pages/SettingsPage';
import { TimetablePage } from '../pages/TimetablePage';
import { Banner } from './ui';

export type View = 'dashboard' | 'timetable' | 'assignments' | 'exams' | 'calendar' | 'notices' | 'search' | 'settings';
export interface Focus {
  view: View;
  id?: string;
  date?: string;
}

const NAV: { view: View; label: string; icon: string }[] = [
  { view: 'dashboard', label: '홈', icon: '🏠' },
  { view: 'timetable', label: '시간표', icon: '🗓️' },
  { view: 'assignments', label: '과제', icon: '📝' },
  { view: 'exams', label: '시험', icon: '🎯' },
  { view: 'calendar', label: '달력', icon: '📅' },
  { view: 'notices', label: '공지', icon: '📢' },
  { view: 'search', label: '검색', icon: '🔍' },
  { view: 'settings', label: '설정', icon: '⚙️' },
];

const VIEW_KEY = 'sf:view';

export function Shell({
  user,
  initialNotice,
  onUserChange,
  onSignedOut,
}: {
  user: AppUser;
  initialNotice?: { kind: 'error' | 'success' | 'info'; text: string };
  onUserChange: (u: AppUser) => void;
  onSignedOut: () => void;
}) {
  const api = useAppData(user);
  const [focus, setFocus] = useState<Focus>(() => {
    const saved = sessionStorage.getItem(VIEW_KEY) as View | null;
    return { view: saved && NAV.some((n) => n.view === saved) ? saved : 'dashboard' };
  });
  const [notice, setNotice] = useState(initialNotice);
  useReminders(user, api.data);

  useEffect(() => {
    sessionStorage.setItem(VIEW_KEY, focus.view);
    window.scrollTo(0, 0);
  }, [focus]);

  const go = (f: Focus) => setFocus(f);
  const { data } = api;

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="주 메뉴">
        <div className="logo">
          <img src="/icon.svg" alt="" width={32} height={32} />
          <span>SchoolFlow</span>
        </div>
        {NAV.map((n) => (
          <button key={n.view} className={`nav-item ${focus.view === n.view ? 'on' : ''}`} onClick={() => go({ view: n.view })} aria-current={focus.view === n.view ? 'page' : undefined}>
            <span aria-hidden>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
        <div className="sidebar-foot">
          <span className={`dot ${api.saving ? 'busy' : 'ok'}`} aria-hidden />
          {authMode === 'cloud' ? (api.saving ? '동기화 중…' : '동기화됨') : '로컬 저장'}
        </div>
      </nav>

      <main className="content">
        <header className="topbar">
          <h1>{NAV.find((n) => n.view === focus.view)?.label}</h1>
          <div className="topbar-right">
            <button className="icon-btn mobile-only" onClick={() => go({ view: 'search' })} aria-label="검색">
              🔍
            </button>
            <span className="muted small">{user.name || user.email}</span>
          </div>
        </header>
        {notice && (
          <Banner kind={notice.kind} onClose={() => setNotice(undefined)}>
            {notice.text}
          </Banner>
        )}
        {api.error && (
          <Banner kind="error" onClose={api.clearError}>
            {api.error}{' '}
            <button className="link" onClick={() => void api.reload()}>
              다시 불러오기
            </button>
          </Banner>
        )}
        {!data ? (
          <div className="splash">{api.loading ? '데이터를 불러오는 중…' : '데이터를 불러오지 못했습니다.'}</div>
        ) : (
          <>
            {focus.view === 'dashboard' && <DashboardPage data={data} api={api} user={user} go={go} />}
            {focus.view === 'timetable' && <TimetablePage data={data} api={api} />}
            {focus.view === 'assignments' && <AssignmentsPage data={data} api={api} focusId={focus.id} />}
            {focus.view === 'exams' && <ExamsPage data={data} api={api} focusId={focus.id} />}
            {focus.view === 'calendar' && <CalendarPage data={data} api={api} go={go} initialDate={focus.date} />}
            {focus.view === 'notices' && <NoticesPage data={data} api={api} focusId={focus.id} />}
            {focus.view === 'search' && <SearchPage data={data} go={go} />}
            {focus.view === 'settings' && <SettingsPage data={data} api={api} user={user} onUserChange={onUserChange} onSignedOut={onSignedOut} />}
          </>
        )}
      </main>

      <nav className="bottombar" aria-label="하단 메뉴">
        {NAV.filter((n) => n.view !== 'search').map((n) => (
          <button key={n.view} className={focus.view === n.view ? 'on' : ''} onClick={() => go({ view: n.view })} aria-label={n.label}>
            <span aria-hidden>{n.icon}</span>
            <small>{n.label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}
