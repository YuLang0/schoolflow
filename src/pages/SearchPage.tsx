import { useState } from 'react';
import type { Focus } from '../components/Shell';
import { Empty } from '../components/ui';
import { KIND_LABEL, search, type SearchHit } from '../lib/search';
import type { AppData } from '../lib/types';

export function SearchPage({ data, go }: { data: AppData; go: (f: Focus) => void }) {
  const [q, setQ] = useState('');
  const hits = search(data, q);

  const open = (h: SearchHit) => {
    if (h.kind === 'events') go({ view: 'calendar', date: data.events.find((e) => e.id === h.id)?.date });
    else if (h.kind === 'timetable') go({ view: 'timetable' });
    else go({ view: h.kind, id: h.id });
  };

  return (
    <div className="stack">
      <input className="search-input" type="search" placeholder="과제, 시험, 공지, 일정, 과목 검색" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="검색어" />
      <div className="card">
        {!q.trim() ? (
          <Empty>검색어를 입력하세요.</Empty>
        ) : hits.length === 0 ? (
          <Empty>"{q}"에 대한 결과가 없습니다.</Empty>
        ) : (
          <ul className="list">
            {hits.map((h) => (
              <li key={`${h.kind}:${h.id}`}>
                <span className="badge">{KIND_LABEL[h.kind]}</span>
                <button className="grow link-plain" onClick={() => open(h)}>
                  {h.title}
                  <small className="muted block">{h.detail}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
