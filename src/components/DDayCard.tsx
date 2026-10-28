import type { Focus } from './Shell';
import { Empty } from './ui';
import { ddayLabel, diffDays, toDateStr } from '../lib/date';
import type { DDay } from '../lib/types';

/** 홈 화면 D-day 위젯: 다가오는 날 순서, 지난 날은 숨김 */
export function DDayCard({ ddays, go }: { ddays: DDay[]; go: (f: Focus) => void }) {
  const today = toDateStr(new Date());
  const list = ddays.filter((d) => diffDays(today, d.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section className="card">
      <div className="card-head">
        <h3>D-day</h3>
        <button className="link" onClick={() => go({ view: 'settings' })}>
          편집
        </button>
      </div>
      {list.length === 0 ? (
        <Empty>설정 → D-day에서 수능·방학·생일 같은 날을 추가해 보세요.</Empty>
      ) : (
        <div className="dday-chips">
          {list.map((d) => (
            <div key={d.id} className={`dday-chip ${diffDays(today, d.date) <= 7 ? 'near' : ''}`}>
              <strong>{ddayLabel(today, d.date)}</strong>
              <span>{d.name}</span>
              <small>{d.date.slice(5).replace('-', '/')}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
