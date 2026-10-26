import { useState, type FormEvent } from 'react';
import { Empty, Field, Modal } from '../components/ui';
import type { DataApi } from '../hooks/useAppData';
import { toDateStr } from '../lib/date';
import { newId, type AppData, type Notice } from '../lib/types';

export function NoticesPage({ data, api, focusId }: { data: AppData; api: DataApi; focusId?: string }) {
  const [edit, setEdit] = useState<Notice | null>(null);
  const [openId, setOpenId] = useState<string | undefined>(focusId);
  const list = [...data.notices].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date));

  return (
    <div className="stack">
      <div className="toolbar">
        <span className="muted">학교·학급 공지, 가정통신문 내용을 적어 두세요.</span>
        <span className="grow" />
        <button className="btn primary" onClick={() => setEdit({ id: newId(), title: '', body: '', date: toDateStr(new Date()), pinned: false, important: false })}>
          + 공지 추가
        </button>
      </div>
      {list.length === 0 ? (
        <div className="card">
          <Empty>등록된 공지가 없습니다.</Empty>
        </div>
      ) : (
        list.map((n) => (
          <article key={n.id} className={`card notice ${n.important ? 'important' : ''}`}>
            <button className="notice-head link-plain" onClick={() => setOpenId(openId === n.id ? undefined : n.id)} aria-expanded={openId === n.id}>
              {n.pinned && <span aria-label="고정">📌</span>}
              {n.important && <span className="badge warn">중요</span>}
              <strong className="grow">{n.title}</strong>
              <span className="muted small">{n.date}</span>
            </button>
            {openId === n.id && (
              <>
                <p className="notice-body">{n.body || '(내용 없음)'}</p>
                <div className="actions">
                  <button className="btn ghost small" onClick={() => void api.upsert('notices', { ...n, pinned: !n.pinned })}>
                    {n.pinned ? '고정 해제' : '상단 고정'}
                  </button>
                  <span className="grow" />
                  <button className="btn ghost small" onClick={() => setEdit(n)}>
                    수정
                  </button>
                </div>
              </>
            )}
          </article>
        ))
      )}
      {edit && <NoticeModal item={edit} exists={data.notices.some((x) => x.id === edit.id)} api={api} onClose={() => setEdit(null)} />}
    </div>
  );
}

function NoticeModal({ item, exists, api, onClose }: { item: Notice; exists: boolean; api: DataApi; onClose: () => void }) {
  const [f, setF] = useState(item);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    void api.upsert('notices', { ...f, title: f.title.trim() });
    onClose();
  };
  return (
    <Modal title={exists ? '공지 수정' : '공지 추가'} onClose={onClose}>
      <form onSubmit={save}>
        <Field label="제목" required>
          {(id) => <input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} required autoFocus />}
        </Field>
        <Field label="날짜">{(id) => <input id={id} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required />}</Field>
        <Field label="내용">{(id) => <textarea id={id} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={6} maxLength={5000} />}</Field>
        <label className="check">
          <input type="checkbox" checked={f.important} onChange={(e) => setF({ ...f, important: e.target.checked })} /> 중요 공지 (홈 화면에 표시)
        </label>
        <label className="check">
          <input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} /> 상단 고정
        </label>
        <div className="actions">
          {exists && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                if (!confirm('이 공지를 삭제할까요?')) return;
                void api.remove('notices', item.id);
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
