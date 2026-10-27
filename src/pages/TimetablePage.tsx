import { Fragment, useState, type FormEvent } from 'react';
import { TimetableImageModal } from '../components/TimetableImageModal';
import { Banner, Field, Modal } from '../components/ui';
import type { DataApi } from '../hooks/useAppData';
import { useIsMobile } from '../hooks/useIsMobile';
import { useSchool } from '../hooks/useSchool';
import { weekdayIndex } from '../lib/date';
import { classStatus, entryAt } from '../lib/schedule';
import { syncTimetable } from '../lib/timetableSync';
import { DAY_NAMES, LUNCH_TIME, newId, type AppData, type TimetableEntry } from '../lib/types';

export function TimetablePage({ data, api }: { data: AppData; api: DataApi }) {
  const [edit, setEdit] = useState<TimetableEntry | null>(null);
  const now = new Date();
  const today = weekdayIndex(now);
  const status = classStatus(now, data.settings.periodTimes);
  const periods = data.settings.periodTimes;

  const [busy, setBusy] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const mobile = useIsMobile();
  // 휴대폰에서는 하루씩 보는 게 기본. 주간 표로 바꾸면 기억해 둠
  const [mode, setMode] = useState<'day' | 'week'>(() => (localStorage.getItem('sf:ttMode') === 'week' ? 'week' : 'day'));
  const [selDay, setSelDay] = useState(() => (today <= 4 ? today : 0));
  const pickMode = (m: 'day' | 'week') => {
    setMode(m);
    try {
      localStorage.setItem('sf:ttMode', m);
    } catch {
      /* 저장 실패는 무시 */
    }
  };
  const [msg, setMsg] = useState<{ kind: 'error' | 'success' | 'info'; text: string } | null>(null);
  const { gradeNo, classNo } = data.settings;
  const { school } = useSchool();
  const ready = !!(school && gradeNo && classNo);

  const importNeis = async () => {
    if (!school) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await syncTimetable(data, school, new Date());
      if (r.data && !(await api.replaceAll(r.data))) return;
      setMsg({ kind: r.kind, text: r.message });
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const open = (day: number, period: number) =>
    setEdit(entryAt(data.timetable, day, period) ?? { id: newId(), day, period, subject: '', room: '', teacher: '' });

  return (
    <div className="stack">
      <div className="toolbar">
        {mobile ? (
          <div className="seg">
            <button className={mode === 'day' ? 'on' : ''} onClick={() => pickMode('day')}>
              하루
            </button>
            <button className={mode === 'week' ? 'on' : ''} onClick={() => pickMode('week')}>
              주간
            </button>
          </div>
        ) : (
          <p className="muted">매주 처음 앱을 열 때 나이스에서 이번 주 시간표를 자동으로 가져옵니다. 칸을 눌러 직접 고칠 수도 있습니다.</p>
        )}
        <span className="grow" />
        <button className={`btn ghost ${mobile ? 'small' : ''}`} onClick={() => setImageOpen(true)} disabled={data.timetable.length === 0}>
          {mobile ? '🖼️ 이미지' : '이미지로 저장'}
        </button>
        <button
          className={`btn ghost ${mobile ? 'small' : ''}`}
          onClick={() => void importNeis()}
          disabled={busy || !ready}
          title={ready ? '' : '설정에서 학년·반을 먼저 정해 주세요'}
          aria-label="나이스에서 지금 다시 가져오기"
        >
          {busy ? '가져오는 중…' : mobile ? '🔄 새로고침' : '지금 다시 가져오기'}
        </button>
      </div>
      {!ready && <p className="hint">나이스 시간표를 가져오려면 설정 → 내 정보에서 학년·반을 정해 주세요.</p>}
      {msg && (
        <Banner kind={msg.kind} onClose={() => setMsg(null)}>
          {msg.text}
        </Banner>
      )}
      {mobile && mode === 'day' ? (
        <>
          <div className="day-tabs" role="tablist" aria-label="요일">
            {DAY_NAMES.map((d, i) => (
              <button key={d} role="tab" aria-selected={selDay === i} className={selDay === i ? 'on' : ''} onClick={() => setSelDay(i)}>
                {d}
                {i === today && <small>오늘</small>}
              </button>
            ))}
          </div>
          <ul className="card day-list">
            {periods.map((p, pi) => {
              const e = entryAt(data.timetable, selDay, pi + 1);
              const isNow = selDay === today && status.kind === 'class' && status.period === pi + 1;
              return (
                <Fragment key={pi}>
                  {p.start === LUNCH_TIME.end && (
                    <li className="day-lunch">
                      🍚 점심시간 {LUNCH_TIME.start} ~ {LUNCH_TIME.end}
                    </li>
                  )}
                  <li className={`${isNow ? 'now' : ''} ${e?.changedFrom ? 'changed' : ''}`}>
                    <button onClick={() => open(selDay, pi + 1)} aria-label={`${DAY_NAMES[selDay]}요일 ${pi + 1}교시 ${e?.subject ?? '비어 있음'}`}>
                      <span className="per">
                        <strong>{pi + 1}교시</strong>
                        <small>
                          {p.start}~{p.end}
                        </small>
                      </span>
                      <span className="subj">
                        {e ? e.subject : <span className="muted">+ 과목 입력</span>}
                        {e?.changedFrom && <small className="was">원래 {e.changedFrom}</small>}
                        {!e?.changedFrom && e?.room && <small className="muted">{e.room}</small>}
                      </span>
                      {isNow && <span className="badge">지금</span>}
                    </button>
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </>
      ) : (
      <div className="card tt-wrap">
        <table className="tt">
          <thead>
            <tr>
              <th />
              {DAY_NAMES.map((d, i) => (
                <th key={d} className={i === today ? 'today' : ''}>
                  {i === today && <span className="badge today-badge">오늘</span>}
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p, pi) => (
              <Fragment key={pi}>
              {p.start === LUNCH_TIME.end && (
                <tr className="lunch-row">
                  <th>
                    점심
                    <small>{LUNCH_TIME.start}</small>
                  </th>
                  <td colSpan={5}>🍚 점심시간 {LUNCH_TIME.start} ~ {LUNCH_TIME.end}</td>
                </tr>
              )}
              <tr>
                <th>
                  {pi + 1}교시
                  <small>{p.start}</small>
                </th>
                {DAY_NAMES.map((_, day) => {
                  const e = entryAt(data.timetable, day, pi + 1);
                  const isNow = day === today && status.kind === 'class' && status.period === pi + 1;
                  return (
                    <td key={day} className={`${day === today ? 'today' : ''} ${isNow ? 'now' : ''} ${e?.changedFrom ? 'changed' : ''}`}>
                      <button
                        onClick={() => open(day, pi + 1)}
                        aria-label={`${DAY_NAMES[day]}요일 ${pi + 1}교시 ${e?.subject ?? '비어 있음'}${e?.changedFrom ? ` (변경됨, 이전: ${e.changedFrom})` : ''}`}
                        title={e?.changedFrom ? `변경됨 · 이전: ${e.changedFrom}` : undefined}
                      >
                        {e ? (
                          <>
                            <strong>{e.subject}</strong>
                            {e.changedFrom ? <small className="was">← {e.changedFrom}</small> : e.room && <small>{e.room}</small>}
                          </>
                        ) : (
                          <span className="plus">+</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      )}
      {data.timetable.some((e) => e.changedFrom) && (
        <div className="toolbar">
          <p className="small muted grow">
            <span className="legend-changed" /> 주황색 칸은 나이스에서 가져올 때 지난번과 달라진 수업입니다. (← 이전 과목)
          </p>
          <button
            className="btn ghost small"
            onClick={() =>
              void api.replaceAll({
                ...data,
                timetable: data.timetable.filter((e) => !(e.changedFrom && e.subject === '수업 없음')).map((e) => ({ ...e, changedFrom: null })),
              })
            }
          >
            변경 표시 지우기
          </button>
        </div>
      )}
      {imageOpen && <TimetableImageModal data={data} onClose={() => setImageOpen(false)} />}
      {edit && <EntryModal entry={edit} exists={data.timetable.some((x) => x.id === edit.id)} api={api} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EntryModal({ entry, exists, api, onClose }: { entry: TimetableEntry; exists: boolean; api: DataApi; onClose: () => void }) {
  const [f, setF] = useState(entry);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!f.subject.trim()) return;
    // 직접 고치면 '변경됨' 표시는 지웁니다
    void api.upsert('timetable', { ...f, subject: f.subject.trim(), room: f.room.trim(), teacher: f.teacher.trim(), changedFrom: null });
    onClose();
  };
  return (
    <Modal title={`${DAY_NAMES[entry.day]}요일 ${entry.period}교시`} onClose={onClose}>
      <form onSubmit={save}>
        <Field label="과목" required>
          {(id) => <input id={id} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={30} required autoFocus />}
        </Field>
        <div className="row2">
          <Field label="교실">{(id) => <input id={id} value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} maxLength={30} />}</Field>
          <Field label="선생님">{(id) => <input id={id} value={f.teacher} onChange={(e) => setF({ ...f, teacher: e.target.value })} maxLength={30} />}</Field>
        </div>
        <div className="actions">
          {exists && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                void api.remove('timetable', entry.id);
                onClose();
              }}
            >
              비우기
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
