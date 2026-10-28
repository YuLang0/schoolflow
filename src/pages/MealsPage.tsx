import { useState } from 'react';
import { MealCard } from '../components/MealCard';
import type { Focus } from '../components/Shell';
import { Banner, Empty } from '../components/ui';
import { useIsMobile } from '../hooks/useIsMobile';
import { favoriteDishes } from '../lib/favorites';
import { useMeals } from '../hooks/useMeals';
import { useSchool } from '../hooks/useSchool';
import { addDays, formatKoreanDate, parseDateStr, toDateStr } from '../lib/date';
import { ALLERGENS, isNeisLimited, schoolWeek } from '../lib/neis';
import type { AppData } from '../lib/types';

export function MealsPage({ data }: { data: AppData; go?: (f: Focus) => void }) {
  const today = toDateStr(new Date());
  const [from, setFrom] = useState(() => schoolWeek(new Date()).from);
  const [showNumbers, setShowNumbers] = useState(false);
  const mobile = useIsMobile();
  const [selDate, setSelDate] = useState<string | null>(null); // 휴대폰에서 고른 날 (없으면 오늘 또는 월요일)
  const to = addDays(from, 4);
  const { allergies } = data.settings;
  const { school, error: schoolError } = useSchool();
  const { meals, loading, error, refresh } = useMeals(school, from, to);

  if (!school)
    return (
      <div className="card">
        <Empty>{schoolError ?? '학교 정보를 불러오는 중…'}</Empty>
      </div>
    );

  const days = [0, 1, 2, 3, 4].map((i) => addDays(from, i));

  return (
    <div className="stack">
      <div className="toolbar">
        <button className="icon-btn" onClick={() => (setFrom(addDays(from, -7)), setSelDate(null))} aria-label="이전 주">
          ‹
        </button>
        <strong>
          {formatKoreanDate(from)} ~ {formatKoreanDate(to).replace(/^\d+월 /, '')}
        </strong>
        <button className="icon-btn" onClick={() => (setFrom(addDays(from, 7)), setSelDate(null))} aria-label="다음 주">
          ›
        </button>
        <button className="btn ghost small" onClick={() => (setFrom(schoolWeek(new Date()).from), setSelDate(null))}>
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
      {meals && isNeisLimited() && <Banner kind="info">서버 연결이 막혀 나이스에 직접 연결했습니다. 이 경우 한 번에 5건까지만 받아 와서 일부 급식이 빠질 수 있습니다.</Banner>}
      {loading && !meals && <div className="splash">급식 정보를 불러오는 중…</div>}
      {meals && mobile && (
        <>
          <div className="day-tabs" role="tablist" aria-label="요일">
            {days.map((d) => {
              const cur = selDate ?? (days.includes(today) ? today : days[0]);
              return (
                <button key={d} role="tab" aria-selected={cur === d} className={cur === d ? 'on' : ''} onClick={() => setSelDate(d)}>
                  {'일월화수목금토'[parseDateStr(d).getDay()]}
                  {meals.some((m) => m.date === d && favoriteDishes(m, data.settings.favoriteFoods).length > 0) && <i className="fav-dot" aria-label="좋아하는 메뉴 있음" />}
                  <small>{d === today ? '오늘' : `${parseDateStr(d).getDate()}일`}</small>
                </button>
              );
            })}
          </div>
          {(() => {
            const cur = selDate && days.includes(selDate) ? selDate : days.includes(today) ? today : days[0];
            const list = meals.filter((m) => m.date === cur);
            return (
              <section className={`card meal-day meal-one ${cur === today ? 'today' : ''}`}>
                <h3>
                  {formatKoreanDate(cur)} {cur === today && <span className="badge">오늘</span>}
                </h3>
                {list.length === 0 ? <Empty>급식 정보 없음</Empty> : list.map((m) => <MealCard key={m.type} meal={m} allergies={allergies} showNumbers={showNumbers} favorites={data.settings.favoriteFoods} />)}
              </section>
            );
          })()}
        </>
      )}
      {meals && !mobile && (
        <div className="meal-week">
          {days.map((d) => {
            const list = meals.filter((m) => m.date === d);
            return (
              <section key={d} className={`card meal-day ${d === today ? 'today' : ''}`}>
                <h3>
                  {formatKoreanDate(d)} {d === today && <span className="badge">오늘</span>}
                </h3>
                {list.length === 0 ? <Empty>급식 정보 없음</Empty> : list.map((m) => <MealCard key={m.type} meal={m} allergies={allergies} showNumbers={showNumbers} favorites={data.settings.favoriteFoods} />)}
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
