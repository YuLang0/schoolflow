import { useState, type FormEvent } from 'react';
import { Empty, Field, Modal } from '../components/ui';
import type { DataApi } from '../hooks/useAppData';
import { toCSV } from '../lib/csv';
import { ddayLabel, diffDays, toDateStr } from '../lib/date';
import { downloadText } from '../lib/download';
import { newId, type AppData, type Assignment, type Priority } from '../lib/types';

const PRIORITY: Record<Priority, string> = { high: '높음', normal: '보통', low: '낮음' };
type Filter = 'todo' | 'done' | 'all';

export function AssignmentsPage({ data, api, focusId }: { data: AppData; api: DataApi; focusId?: string }) {
  const [filter, setFilter] = useState<Filter>('todo');
  const [edit, setEdit] = useState<Assignment | null>(() => data.assignments.find((a) => a.id === focusId) ?? null);
  const today = toDateStr(new Date());

  const list = data.assignments
    .filter((a) => (filter === 'all' ? true : filter === 'done' ? a.done : !a.done))
    .sort((a, b) => (a.done !== b.done ? Number(a.done) - Number(b.done) : a.due.localeCompare(b.due) || a.title.localeCompare(b.title)));

  const toggle = (a: Assignment) => void api.upsert('assignments', { ...a, done: !a.done, doneAt: a.done ? null : toDateStr(new Date()) });

  const exportCSV = () =>
    downloadText(
      `schoolflow-assignments-${today}.csv`,
      toCSV(
        ['과목', '제목', '마감일', '중요도', '완료', '완료일', '메모'],
        data.assignments.map((a) => [a.subject, a.title, a.due, PRIORITY[a.priority], a.done ? 'O' : '', a.doneAt ?? '', a.memo]),
      ),
      'text/csv;charset=utf-8',
    );

  const blank = (): Assignment => ({ id: newId(), title: '', subject: '', due: today, priority: 'normal', memo: '', done: false, doneAt: null, createdAt: new Date().toISOString() });

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="seg">
          {(['todo', 'done', 'all'] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'todo' ? '진행 중' : f === 'done' ? '완료' : '전체'}
            </button>
          ))}
        </div>
        <span className="grow" />
        <button className="btn ghost" onClick={exportCSV} disabled={data.assignments.length === 0}>
          CSV
        </button>
        <button className="btn primary" onClick={() => setEdit(blank())}>
          + 과제 추가
        </button>
      </div>

      <div className="card">
        {list.length === 0 ? (
          <Empty>{filter === 'done' ? '완료한 과제가 없습니다.' : '등록된 과제가 없습니다. + 과제 추가 버튼을 눌러 추가해 보세요.'}</Empty>
        ) : (
          <ul className="list">
            {list.map((a) => {
              const n = diffDays(today, a.due);
              return (
                <li key={a.id} className={a.done ? 'done' : ''}>
                  <input type="checkbox" checked={a.done} onChange={() => toggle(a)} aria-label={`${a.title} 완료 표시`} />
                  <button className="grow link-plain" onClick={() => setEdit(a)}>
                    <span className={`prio prio-${a.priority}`} aria-label={`중요도 ${PRIORITY[a.priority]}`} />
                    {a.subject && <span className="muted">[{a.subject}] </span>}
                    {a.title}
                    {a.done && a.doneAt && <small className="muted"> · {a.doneAt} 완료</small>}
                  </button>
                  <span className="muted small">{a.due.slice(5)}</span>
                  {!a.done && <span className={`dday ${n < 0 ? 'late' : n <= 1 ? 'soon' : ''}`}>{ddayLabel(today, a.due)}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {edit && <AssignmentModal item={edit} exists={data.assignments.some((a) => a.id === edit.id)} api={api} onClose={() => setEdit(null)} />}
    </div>
  );
}

function AssignmentModal({ item, exists, api, onClose }: { item: Assignment; exists: boolean; api: DataApi; onClose: () => void }) {
  const [f, setF] = useState(item);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim() || !f.due) return;
    void api.upsert('assignments', { ...f, title: f.title.trim(), subject: f.subject.trim() });
    onClose();
  };
  return (
    <Modal title={exists ? '과제 수정' : '과제 추가'} onClose={onClose}>
      <form onSubmit={save}>
        <Field label="제목" required>
          {(id) => <input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} required autoFocus />}
        </Field>
        <div className="row2">
          <Field label="과목">{(id) => <input id={id} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={30} />}</Field>
          <Field label="마감일" required>
            {(id) => <input id={id} type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} required />}
          </Field>
        </div>
        <Field label="중요도">
          {(id) => (
            <select id={id} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Priority })}>
              <option value="high">높음</option>
              <option value="normal">보통</option>
              <option value="low">낮음</option>
            </select>
          )}
        </Field>
        <Field label="메모">{(id) => <textarea id={id} value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} rows={3} maxLength={2000} />}</Field>
        <div className="actions">
          {exists && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                if (!confirm('이 과제를 삭제할까요?')) return;
                void api.remove('assignments', item.id);
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
