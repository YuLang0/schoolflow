import { Fragment, useState, type FormEvent } from 'react';
import { Banner, Field, Modal } from '../components/ui';
import type { DataApi } from '../hooks/useAppData';
import { formatKoreanDate, weekdayIndex } from '../lib/date';
import { fetchTimetable, isNeisLimited, schoolWeek } from '../lib/neis';
import { mergeNeisTimetable } from '../lib/neisImport';
import { classStatus, entryAt } from '../lib/schedule';
import { DAY_NAMES, LUNCH_TIME, PERIOD_COUNT, newId, type AppData, type TimetableEntry } from '../lib/types';

export function TimetablePage({ data, api }: { data: AppData; api: DataApi }) {
  const [edit, setEdit] = useState<TimetableEntry | null>(null);
  const now = new Date();
  const today = weekdayIndex(now);
  const status = classStatus(now, data.settings.periodTimes);
  const periods = data.settings.periodTimes;

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success' | 'info'; text: string } | null>(null);
  const { school, gradeNo, classNo } = data.settings;
  const ready = !!(school && gradeNo && classNo);

  const importNeis = async () => {
    if (!school) return;
    setBusy(true);
    setMsg(null);
    try {
      const week = schoolWeek(new Date());
      const all = await fetchTimetable(school, gradeNo, classNo, week.from, week.to);
      const rows = all.filter((r) => r.period <= PERIOD_COUNT); // 우리 학교는 7교시까지
      const extra = all.length - rows.length;
      if (rows.length === 0) {
        setMsg({ kind: 'info', text: `나이스에 ${formatKoreanDate(week.from)} 주의 ${gradeNo}학년 ${classNo}반 시간표가 아직 없습니다. 방학이거나 학교가 아직 올리지 않았을 수 있습니다.` });
        return;
      }
      const merged = mergeNeisTimetable(data.timetable, rows);
      const dayNames = merged.days.map((d) => DAY_NAMES[d]).join('·');
      if (data.timetable.length > 0 && !confirm(`${formatKoreanDate(week.from)} 주 시간표(${dayNames})를 나이스 내용으로 바꿉니다. 계속할까요?`)) return;
      const ok = await api.replaceAll({ ...data, timetable: merged.timetable });
      if (ok)
        setMsg({
          kind: 'success',
          text: `나이스에서 ${rows.length}개 수업을 가져왔습니다. (${dayNames}) 바뀐 수업이 있으면 칸을 눌러 고칠 수 있습니다.${extra > 0 ? ` (8교시 이후 ${extra}개는 제외)` : ''}${isNeisLimited() ? ' ※ 서버 연결이 막혀 나이스에 직접 연결했기 때문에 5개까지만 받아 왔습니다.' : ''}`,
        });
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
        <p className="muted grow">칸을 눌러 과목을 입력하거나 고칠 수 있습니다.</p>
        <button className="btn ghost" onClick={() => void importNeis()} disabled={busy || !ready} title={ready ? '' : '설정에서 학교·학년·반을 먼저 정해 주세요'}>
          {busy ? '가져오는 중…' : '나이스에서 가져오기'}
        </button>
      </div>
      {!ready && <p className="hint">나이스 시간표를 가져오려면 설정 → 내 정보에서 학교·학년·반을 정해 주세요.</p>}
      {msg && (
        <Banner kind={msg.kind} onClose={() => setMsg(null)}>
          {msg.text}
        </Banner>
      )}
      <div className="card tt-wrap">
        <table className="tt">
          <thead>
            <tr>
              <th />
              {DAY_NAMES.map((d, i) => (
                <th key={d} className={i === today ? 'today' : ''}>
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
                    <td key={day} className={`${day === today ? 'today' : ''} ${isNow ? 'now' : ''}`}>
                      <button onClick={() => open(day, pi + 1)} aria-label={`${DAY_NAMES[day]}요일 ${pi + 1}교시 ${e?.subject ?? '비어 있음'}`}>
                        {e ? (
                          <>
                            <strong>{e.subject}</strong>
                            {e.room && <small>{e.room}</small>}
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
      {edit && <EntryModal entry={edit} exists={data.timetable.some((x) => x.id === edit.id)} api={api} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EntryModal({ entry, exists, api, onClose }: { entry: TimetableEntry; exists: boolean; api: DataApi; onClose: () => void }) {
  const [f, setF] = useState(entry);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!f.subject.trim()) return;
    void api.upsert('timetable', { ...f, subject: f.subject.trim(), room: f.room.trim(), teacher: f.teacher.trim() });
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
