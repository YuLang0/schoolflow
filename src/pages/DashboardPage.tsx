import type { Focus } from '../components/Shell';
import { MealCard } from '../components/MealCard';
import { Empty } from '../components/ui';
import { useMeals } from '../hooks/useMeals';
import type { DataApi } from '../hooks/useAppData';
import { ddayLabel, diffDays, formatKoreanDate, toDateStr } from '../lib/date';
import { classStatus, todayClasses } from '../lib/schedule';
import type { AppData, AppUser } from '../lib/types';

function statusText(data: AppData, now: Date): string {
  const s = classStatus(now, data.settings.periodTimes);
  const subj = (p: number) => todayClasses(data.timetable, now).find((e) => e.period === p)?.subject;
  switch (s.kind) {
    case 'weekend':
      return '오늘은 수업이 없는 날입니다.';
    case 'before':
      return `곧 1교시${subj(1) ? ` ${subj(1)}` : ''} 수업이 시작됩니다.`;
    case 'class':
      return `지금 ${s.period}교시${subj(s.period) ? ` ${subj(s.period)}` : ''} 수업 중 · ${s.endsIn}분 남음`;
    case 'break':
      return `쉬는 시간 · ${s.startsIn}분 후 ${s.next}교시${subj(s.next) ? ` ${subj(s.next)}` : ''}`;
    case 'after':
      return '오늘 수업이 모두 끝났습니다. 수고했어요!';
  }
}

export function DashboardPage({ data, api, user, go }: { data: AppData; api: DataApi; user: AppUser; go: (f: Focus) => void }) {
  const now = new Date();
  const today = toDateStr(now);
  const status = classStatus(now, data.settings.periodTimes);
  const classes = todayClasses(data.timetable, now);
  const todo = data.assignments
    .filter((a) => !a.done)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 6);
  const exams = data.exams
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const events = data.events.filter((e) => e.date === today);
  const notices = data.notices
    .filter((n) => n.pinned || n.important)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const doneCount = data.assignments.filter((a) => a.done).length;
  const meals = useMeals(data.settings.school, today, today);
  const lunch = meals.meals?.find((m) => m.type === '중식') ?? meals.meals?.[0];

  return (
    <div className="stack">
      <section className="card hero">
        <p className="muted">{formatKoreanDate(today)}</p>
        <h2>안녕하세요, {user.name || '학생'}님 👋</h2>
        <p>{statusText(data, now)}</p>
        <div className="stats">
          <div>
            <strong>{data.assignments.length - doneCount}</strong>
            <span>남은 과제</span>
          </div>
          <div>
            <strong>{exams[0] ? ddayLabel(today, exams[0].date) : '-'}</strong>
            <span>다음 시험</span>
          </div>
          <div>
            <strong>{classes.length}</strong>
            <span>오늘 수업</span>
          </div>
        </div>
      </section>

      <div className="grid2">
        <section className="card">
          <div className="card-head">
            <h3>오늘 시간표</h3>
            <button className="link" onClick={() => go({ view: 'timetable' })}>
              전체 보기
            </button>
          </div>
          {classes.length === 0 ? (
            <Empty>오늘 등록된 수업이 없습니다.</Empty>
          ) : (
            <ul className="list">
              {classes.map((c) => (
                <li key={c.id} className={status.kind === 'class' && status.period === c.period ? 'now' : ''}>
                  <span className="badge">{c.period}교시</span>
                  <span className="grow">{c.subject}</span>
                  <span className="muted small">
                    {data.settings.periodTimes[c.period - 1]?.start ?? ''} {c.room}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h3>해야 할 과제</h3>
            <button className="link" onClick={() => go({ view: 'assignments' })}>
              전체 보기
            </button>
          </div>
          {todo.length === 0 ? (
            <Empty>남은 과제가 없습니다. 🎉</Empty>
          ) : (
            <ul className="list">
              {todo.map((a) => (
                <li key={a.id}>
                  <input
                    type="checkbox"
                    aria-label={`${a.title} 완료`}
                    checked={a.done}
                    onChange={() => void api.upsert('assignments', { ...a, done: true, doneAt: toDateStr(new Date()) })}
                  />
                  <button className="grow link-plain" onClick={() => go({ view: 'assignments', id: a.id })}>
                    {a.subject && <span className="muted">[{a.subject}] </span>}
                    {a.title}
                  </button>
                  <span className={`dday ${diffDays(today, a.due) < 0 ? 'late' : diffDays(today, a.due) <= 1 ? 'soon' : ''}`}>{ddayLabel(today, a.due)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h3>다가오는 시험</h3>
            <button className="link" onClick={() => go({ view: 'exams' })}>
              전체 보기
            </button>
          </div>
          {exams.length === 0 ? (
            <Empty>예정된 시험이 없습니다.</Empty>
          ) : (
            <ul className="list">
              {exams.map((e) => (
                <li key={e.id}>
                  <span className="dday soon">{ddayLabel(today, e.date)}</span>
                  <button className="grow link-plain" onClick={() => go({ view: 'exams', id: e.id })}>
                    {e.subject && <span className="muted">[{e.subject}] </span>}
                    {e.title}
                  </button>
                  <span className="muted small">{e.date.slice(5)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {data.settings.school && (
          <section className="card">
            <div className="card-head">
              <h3>오늘 급식</h3>
              <button className="link" onClick={() => go({ view: 'meals' })}>
                이번 주 보기
              </button>
            </div>
            {meals.error ? (
              <Empty>{meals.error}</Empty>
            ) : lunch ? (
              <MealCard meal={lunch} allergies={data.settings.allergies} showNumbers={false} />
            ) : (
              <Empty>{meals.loading ? '불러오는 중…' : '오늘은 급식 정보가 없습니다.'}</Empty>
            )}
          </section>
        )}

        <section className="card">
          <div className="card-head">
            <h3>오늘 일정 · 중요 공지</h3>
            <button className="link" onClick={() => go({ view: 'calendar', date: today })}>
              달력
            </button>
          </div>
          {events.length === 0 && notices.length === 0 ? (
            <Empty>오늘 일정과 중요 공지가 없습니다.</Empty>
          ) : (
            <ul className="list">
              {events.map((e) => (
                <li key={e.id}>
                  <span className="badge">일정</span>
                  <span className="grow">{e.title}</span>
                </li>
              ))}
              {notices.map((n) => (
                <li key={n.id}>
                  <span className="badge warn">{n.pinned ? '📌' : '중요'}</span>
                  <button className="grow link-plain" onClick={() => go({ view: 'notices', id: n.id })}>
                    {n.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
