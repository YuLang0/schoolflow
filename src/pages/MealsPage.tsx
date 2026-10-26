import { useState } from 'react';
import { MealCard } from '../components/MealCard';
import type { Focus } from '../components/Shell';
import { Banner, Empty } from '../components/ui';
import { useMeals } from '../hooks/useMeals';
import { addDays, formatKoreanDate, toDateStr } from '../lib/date';
import { ALLERGENS, schoolWeek } from '../lib/neis';
import type { AppData } from '../lib/types';

export function MealsPage({ data, go }: { data: AppData; go: (f: Focus) => void }) {
  const today = toDateStr(new Date());
  const [from, setFrom] = useState(() => schoolWeek(new Date()).from);
  const [showNumbers, setShowNumbers] = useState(false);
  const to = addDays(from, 4);
  const { school, allergies } = data.settings;
  const { meals, loading, error, refresh } = useMeals(school, from, to);

  if (!school)
    return (
      <div className="card">
        <Empty>
          급식표를 보려면 먼저 학교를 정해 주세요.{' '}
          <button className="link" onClick={() => go({ view: 'settings' })}>
            설정으로 가기
          </button>
        </Empty>
      </div>
    );

  const days = [0, 1, 2, 3, 4].map((i) => addDays(from, i));

  return (
    <div className="stack">
      <div className="toolbar">
        <button className="icon-btn" onClick={() => setFrom(addDays(from, -7))} aria-label="이전 주">
          ‹
        </button>
        <strong>
          {formatKoreanDate(from)} ~ {formatKoreanDate(to).replace(/^\d+월 /, '')}
        </strong>
        <button className="icon-btn" onClick={() => setFrom(addDays(from, 7))} aria-label="다음 주">
          ›
        </button>
        <button className="btn ghost small" onClick={() => setFrom(schoolWeek(new Date()).from)}>
          이번 주
        </button>
        <span className="grow" />
        <label className="check small">
          <input type="checkbox" checked={showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} /> 알레르기 번호
        </label>
        <button className="btn ghost small" onClick={refresh} disabled={loading}>
          새로고침
        </button>
      </div>
      <p className="muted small">
        {school.name} · 나이스 제공{allergies.length > 0 && ` · ⚠ 내 알레르기: ${allergies.map((n) => ALLERGENS[n - 1]).join(', ')}`}
      </p>
      {error && <Banner kind="error">{error}</Banner>}
      {loading && !meals && <div className="splash">급식 정보를 불러오는 중…</div>}
      {meals && (
        <div className="meal-week">
          {days.map((d) => {
            const list = meals.filter((m) => m.date === d);
            return (
              <section key={d} className={`card meal-day ${d === today ? 'today' : ''}`}>
                <h3>
                  {formatKoreanDate(d)} {d === today && <span className="badge">오늘</span>}
                </h3>
                {list.length === 0 ? <Empty>급식 정보 없음</Empty> : list.map((m) => <MealCard key={m.type} meal={m} allergies={allergies} showNumbers={showNumbers} />)}
              </section>
            );
          })}
        </div>
      )}
      {showNumbers && (
        <p className="tiny muted">
          {ALLERGENS.map((a, i) => `${i + 1}.${a}`).join('  ')}
        </p>
      )}
    </div>
  );
}
