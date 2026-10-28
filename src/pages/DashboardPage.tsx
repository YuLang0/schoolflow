import type { Focus } from '../components/Shell';
import { DDayCard } from '../components/DDayCard';
import { MealCard } from '../components/MealCard';
import { favoriteDishes } from '../lib/favorites';
import { Empty } from '../components/ui';
import { useMeals } from '../hooks/useMeals';
import { useSchool } from '../hooks/useSchool';
import { useSchoolEvents } from '../hooks/useSchoolEvents';
import { groupEvents } from '../lib/neis';
import { addDays, ddayLabel, formatKoreanDate, toDateStr } from '../lib/date';
import { classStatus, isMovingClass, todayClasses } from '../lib/schedule';
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
    case 'lunch':
      return `점심시간 🍚 · ${s.startsIn}분 후 ${s.next}교시${subj(s.next) ? ` ${subj(s.next)}` : ''}`;
    case 'after':
      return '오늘 수업이 모두 끝났습니다. 수고했어요!';
  }
}

export function DashboardPage({ data, user, go }: { data: AppData; user: AppUser; go: (f: Focus) => void }) {
  const now = new Date();
  const today = toDateStr(now);
  const status = classStatus(now, data.settings.periodTimes);
  const classes = todayClasses(data.timetable, now);
  const exams = data.exams
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const events = data.events.filter((e) => e.date === today);
  const notices = data.notices
    .filter((n) => n.pinned || n.important)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const { school } = useSchool();
  const meals = useMeals(school, today, today);
  const lunch = meals.meals?.find((m) => m.type === '중식') ?? meals.meals?.[0];
  // 학사일정은 앞으로 60일
  const schoolEvents = useSchoolEvents(data.settings.gradeNo, today, addDays(today, 60));
  const upcoming = groupEvents(schoolEvents.events ?? []).slice(0, 5);
  const schoolExam = groupEvents(schoolEvents.events ?? []).find((g) => g.exam);
  // 다음 시험: 내가 적은 시험과 학교 시험 기간 중 더 가까운 것
  const nextExam = [
    ...(exams[0] ? [{ date: exams[0].date, name: exams[0].title }] : []),
    ...(schoolExam ? [{ date: schoolExam.from, name: schoolExam.name }] : []),
  ].sort((a, b) => a.date.localeCompare(b.date))[0];
  // 다음 학사일정 (시험 제외)
  const nextEvent = upcoming.find((g) => !g.exam);

  return (
    <div className="stack">
      <section className="card hero">
        <p className="muted">{formatKoreanDate(today)}</p>
        <h2>안녕하세요, {user.name || '학생'}님 👋</h2>
        <p>{statusText(data, now)}</p>
        <div className="stats">
          <div>
            <strong>{nextExam ? ddayLabel(today, nextExam.date) : '-'}</strong>
            <span>다음 시험</span>
            {nextExam && <em title={nextExam.name}>{nextExam.name}</em>}
          </div>
          <div>
            <strong>{classes.length}</strong>
            <span>오늘 수업</span>
          </div>
          <div>
            <strong>{nextEvent ? ddayLabel(today, nextEvent.from) : '-'}</strong>
            <span>다음 일정</span>
            {nextEvent && <em className="plain" title={nextEvent.name}>{nextEvent.name}</em>}
          </div>
        </div>
      </section>

      <div className="grid2">
        <DDayCard ddays={data.settings.ddays} go={go} />
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
                  <span className="grow">
                    {c.subject}
                    {c.changedFrom && <span className="badge warn changed-badge">변경 · 원래 {c.changedFrom}</span>}
                    {isMovingClass(c, data.settings.homeRoom) && <span className="badge move changed-badge">🚶 이동</span>}
                  </span>
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

        <section className="card">
          <div className="card-head">
            <h3>학사일정</h3>
            <button className="link" onClick={() => go({ view: 'calendar' })}>
              달력
            </button>
          </div>
          {schoolEvents.error ? (
            <Empty>{schoolEvents.error}</Empty>
          ) : !schoolEvents.events ? (
            <Empty>불러오는 중…</Empty>
          ) : upcoming.length === 0 ? (
            <Empty>앞으로 60일 동안 학사일정이 없습니다.</Empty>
          ) : (
            <ul className="list">
              {upcoming.map((g) => (
                <li key={g.from + g.name}>
                  <span className={`dday ${g.exam ? 'soon' : ''}`}>{ddayLabel(today, g.from)}</span>
                  <span className="grow">{g.name}</span>
                  <span className="muted small">
                    {g.from.slice(5).replace('-', '/')}
                    {g.to !== g.from && `~${g.to.slice(5).replace('-', '/')}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {school && (
          <section className="card">
            <div className="card-head">
              <h3>
                오늘 급식
                {lunch && favoriteDishes(lunch, data.settings.favoriteFoods).length > 0 && <span className="badge fav-badge">⭐ {favoriteDishes(lunch, data.settings.favoriteFoods)[0]} 나와요!</span>}
              </h3>
              <button className="link" onClick={() => go({ view: 'meals' })}>
                이번 주 보기
              </button>
            </div>
            {meals.error ? (
              <Empty>{meals.error}</Empty>
            ) : lunch ? (
              <MealCard meal={lunch} allergies={data.settings.allergies} showNumbers={false} favorites={data.settings.favoriteFoods} />
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
