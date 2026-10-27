import { useState, type FormEvent } from 'react';
import type { Focus } from '../components/Shell';
import { Empty, Field, Modal } from '../components/ui';
import type { DataApi } from '../hooks/useAppData';
import { useSchoolEvents } from '../hooks/useSchoolEvents';
import { formatKoreanDate, monthGrid, parseDateStr, toDateStr } from '../lib/date';
import { newId, type AppData, type CalEvent } from '../lib/types';

export function CalendarPage({ data, api, go, initialDate }: { data: AppData; api: DataApi; go: (f: Focus) => void; initialDate?: string }) {
  const today = toDateStr(new Date());
  const [selected, setSelected] = useState(initialDate ?? today);
  const [cursor, setCursor] = useState(() => {
    const d = parseDateStr(initialDate ?? today);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [edit, setEdit] = useState<CalEvent | null>(null);

  const days = monthGrid(cursor.y, cursor.m);
  const school = useSchoolEvents(data.settings.gradeNo, days[0], days[days.length - 1]);
  const move = (n: number) => setCursor(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));

  const itemsOn = (d: string) => ({
    a: data.assignments.filter((x) => x.due === d),
    e: data.exams.filter((x) => x.date === d),
    v: data.events.filter((x) => x.date === d),
    s: school.events?.filter((x) => x.date === d) ?? [],
  });
  const sel = itemsOn(selected);

  return (
    <div className="stack">
      <div className="card">
        <div className="cal-head">
          <button className="icon-btn" onClick={() => move(-1)} aria-label="이전 달">
            ‹
          </button>
          <h3>
            {cursor.y}년 {cursor.m + 1}월
          </h3>
          <button className="icon-btn" onClick={() => move(1)} aria-label="다음 달">
            ›
          </button>
          <button
            className="btn ghost small"
            onClick={() => {
              const d = new Date();
              setCursor({ y: d.getFullYear(), m: d.getMonth() });
              setSelected(today);
            }}
          >
            오늘
          </button>
        </div>
        <div className="cal">
          {['월', '화', '수', '목', '금', '토', '일'].map((d) => (
            <div key={d} className="cal-dow">
              {d}
            </div>
          ))}
          {days.map((d) => {
            const it = itemsOn(d);
            const other = parseDateStr(d).getMonth() !== cursor.m;
            const dow = parseDateStr(d).getDay();
            const red = dow === 0 || it.s.some((x) => x.holiday);
            return (
              <button
                key={d}
                className={`cal-day ${other ? 'other' : ''} ${d === today ? 'today' : ''} ${d === selected ? 'sel' : ''} ${red ? 'red' : ''} ${dow === 6 ? 'sat' : ''}`}
                onClick={() => setSelected(d)}
                aria-label={`${formatKoreanDate(d)} 과제 ${it.a.length}개, 시험 ${it.e.length}개, 일정 ${it.v.length}개${it.s.length ? `, 학사일정 ${it.s.map((x) => x.name).join(', ')}` : ''}`}
              >
                <span>{parseDateStr(d).getDate()}</span>
                {it.s[0] && <span className={`cal-event ${it.s[0].exam ? 'exam' : ''}`}>{it.s[0].name}</span>}
                <span className="dots">
                  {it.a.length > 0 && <i className="dot-a" />}
                  {it.e.length > 0 && <i className="dot-e" />}
                  {it.v.length > 0 && <i className="dot-v" />}
                  {it.s.length > 0 && <i className="dot-s" />}
                </span>
              </button>
            );
          })}
        </div>
        {school.error && <p className="warn">학사일정을 불러오지 못했습니다: {school.error}</p>}
        <p className="legend small muted">
          <i className="dot-a" /> 과제 마감 <i className="dot-e" /> 시험 <i className="dot-v" /> 일정 <i className="dot-s" /> 학사일정
        </p>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>{formatKoreanDate(selected)}</h3>
          <button className="btn primary small" onClick={() => setEdit({ id: newId(), title: '', date: selected, memo: '' })}>
            + 일정
          </button>
        </div>
        {sel.a.length + sel.e.length + sel.v.length + sel.s.length === 0 ? (
          <Empty>이 날은 등록된 항목이 없습니다.</Empty>
        ) : (
          <ul className="list">
            {sel.s.map((x, i) => (
              <li key={`s${i}`}>
                <span className={`badge ${x.exam ? 'warn' : x.holiday ? 'red' : 'school'}`}>{x.exam ? '시험' : x.holiday ? '휴일' : '학사'}</span>
                <span className="grow">
                  {x.name}
                  {x.detail && <small className="muted block">{x.detail}</small>}
                </span>
              </li>
            ))}
            {sel.v.map((v) => (
              <li key={v.id}>
                <span className="badge">일정</span>
                <button className="grow link-plain" onClick={() => setEdit(v)}>
                  {v.title}
                  {v.memo && <small className="muted block">{v.memo}</small>}
                </button>
              </li>
            ))}
            {sel.e.map((e) => (
              <li key={e.id}>
                <span className="badge warn">시험</span>
                <button className="grow link-plain" onClick={() => go({ view: 'exams', id: e.id })}>
                  {e.subject && `[${e.subject}] `}
                  {e.title} {e.time}
                </button>
              </li>
            ))}
            {sel.a.map((a) => (
              <li key={a.id} className={a.done ? 'done' : ''}>
                <span className="badge">과제</span>
                <button className="grow link-plain" onClick={() => go({ view: 'assignments', id: a.id })}>
                  {a.subject && `[${a.subject}] `}
                  {a.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {edit && <EventModal item={edit} exists={data.events.some((x) => x.id === edit.id)} api={api} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EventModal({ item, exists, api, onClose }: { item: CalEvent; exists: boolean; api: DataApi; onClose: () => void }) {
  const [f, setF] = useState(item);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim() || !f.date) return;
    void api.upsert('events', { ...f, title: f.title.trim() });
    onClose();
  };
  return (
    <Modal title={exists ? '일정 수정' : '일정 추가'} onClose={onClose}>
      <form onSubmit={save}>
        <Field label="제목" required>
          {(id) => <input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} required autoFocus />}
        </Field>
        <Field label="날짜" required>
          {(id) => <input id={id} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required />}
        </Field>
        <Field label="메모">{(id) => <textarea id={id} value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} rows={3} maxLength={2000} />}</Field>
        <div className="actions">
          {exists && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                void api.remove('events', item.id);
                onClose();
              }}
            >
              삭제
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn ghost" onClick={onClose}>
            취소
          </button>
          <button className="btn primary">저장</button>
        </div>
      </form>
    </Modal>
  );
}
