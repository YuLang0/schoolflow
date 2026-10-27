import { useState, type FormEvent, type ReactNode } from 'react';
import { Empty, Field, Modal } from '../components/ui';
import type { DataApi } from '../hooks/useAppData';
import { toCSV } from '../lib/csv';
import { ddayLabel, formatKoreanDate, toDateStr } from '../lib/date';
import { downloadText } from '../lib/download';
import { newId, type AppData, type Exam } from '../lib/types';
import { GradeCalcPanel } from './GradeCalcPanel';

export function ExamsPage({ data, api, focusId }: { data: AppData; api: DataApi; focusId?: string }) {
  const [tab, setTab] = useState<'exams' | 'calc'>(() => (sessionStorage.getItem('sf:examTab') === 'calc' && !focusId ? 'calc' : 'exams'));
  const pick = (t: 'exams' | 'calc') => {
    setTab(t);
    sessionStorage.setItem('sf:examTab', t);
  };
  const tabs = (
    <div className="seg page-tabs">
      <button className={tab === 'exams' ? 'on' : ''} onClick={() => pick('exams')}>
        시험 일정
      </button>
      <button className={tab === 'calc' ? 'on' : ''} onClick={() => pick('calc')}>
        내신 계산기
      </button>
    </div>
  );
  if (tab === 'calc')
    return (
      <div className="stack">
        {tabs}
        <GradeCalcPanel data={data} api={api} />
      </div>
    );
  return <ExamList data={data} api={api} focusId={focusId} tabs={tabs} />;
}

function ExamList({ data, api, focusId, tabs }: { data: AppData; api: DataApi; focusId?: string; tabs: ReactNode }) {
  const [edit, setEdit] = useState<Exam | null>(() => data.exams.find((e) => e.id === focusId) ?? null);
  const today = toDateStr(new Date());
  const upcoming = data.exams.filter((e) => e.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = data.exams.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const scored = past.filter((e) => e.score !== null);
  const avg = scored.length ? scored.reduce((s, e) => s + (e.score ?? 0), 0) / scored.length : null;

  const exportCSV = () =>
    downloadText(
      `schoolflow-exams-${today}.csv`,
      toCSV(
        ['과목', '시험명', '날짜', '시간', '범위', '점수', '메모'],
        [...data.exams].sort((a, b) => a.date.localeCompare(b.date)).map((e) => [e.subject, e.title, e.date, e.time, e.scope, e.score ?? '', e.memo]),
      ),
      'text/csv;charset=utf-8',
    );

  const row = (e: Exam) => (
    <li key={e.id}>
      <span className={`dday ${e.date >= today ? 'soon' : ''}`}>{ddayLabel(today, e.date)}</span>
      <button className="grow link-plain" onClick={() => setEdit(e)}>
        {e.subject && <span className="muted">[{e.subject}] </span>}
        {e.title}
        {e.scope && <small className="muted block">범위: {e.scope}</small>}
      </button>
      <span className="muted small">
        {formatKoreanDate(e.date)} {e.time}
      </span>
      {e.score !== null && <span className="badge">{e.score}점</span>}
    </li>
  );

  return (
    <div className="stack">
      {tabs}
      <div className="toolbar">
        <span className="muted">{avg !== null ? `지난 시험 평균 ${avg.toFixed(1)}점 (${scored.length}개)` : '시험이 끝나면 점수를 기록해 보세요.'}</span>
        <span className="grow" />
        <button className="btn ghost" onClick={exportCSV} disabled={data.exams.length === 0}>
          CSV
        </button>
        <button className="btn primary" onClick={() => setEdit({ id: newId(), title: '', subject: '', date: today, time: '', scope: '', memo: '', score: null })}>
          + 시험 추가
        </button>
      </div>
      <section className="card">
        <h3>예정된 시험</h3>
        {upcoming.length ? <ul className="list">{upcoming.map(row)}</ul> : <Empty>예정된 시험이 없습니다.</Empty>}
      </section>
      {past.length > 0 && (
        <section className="card">
          <h3>지난 시험</h3>
          <ul className="list">{past.map(row)}</ul>
        </section>
      )}
      {edit && <ExamModal item={edit} exists={data.exams.some((x) => x.id === edit.id)} api={api} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ExamModal({ item, exists, api, onClose }: { item: Exam; exists: boolean; api: DataApi; onClose: () => void }) {
  const [f, setF] = useState(item);
  const [score, setScore] = useState(item.score === null ? '' : String(item.score));
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim() || !f.date) return;
    const n = score.trim() === '' ? null : Number(score);
    void api.upsert('exams', { ...f, title: f.title.trim(), subject: f.subject.trim(), score: n !== null && Number.isFinite(n) ? n : null });
    onClose();
  };
  return (
    <Modal title={exists ? '시험 수정' : '시험 추가'} onClose={onClose}>
      <form onSubmit={save}>
        <Field label="시험명" required hint="예: 1학기 중간고사, 단원평가">
          {(id) => <input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} required autoFocus />}
        </Field>
        <div className="row2">
          <Field label="과목">{(id) => <input id={id} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={30} />}</Field>
          <Field label="점수">
            {(id) => <input id={id} type="number" inputMode="decimal" step="any" value={score} onChange={(e) => setScore(e.target.value)} />}
          </Field>
        </div>
        <div className="row2">
          <Field label="날짜" required>
            {(id) => <input id={id} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required />}
          </Field>
          <Field label="시간">{(id) => <input id={id} type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />}</Field>
        </div>
        <Field label="시험 범위">{(id) => <textarea id={id} value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} rows={2} maxLength={2000} />}</Field>
        <Field label="메모">{(id) => <textarea id={id} value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} rows={2} maxLength={2000} />}</Field>
        <div className="actions">
          {exists && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                if (!confirm('이 시험을 삭제할까요?')) return;
                void api.remove('exams', item.id);
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
