import { useEffect, useId, useState, type ReactNode } from 'react';
import { looksLikeHangul } from '../lib/password';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span className="req">*</span>}
      </label>
      {children(id)}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Banner({ kind, children, onClose }: { kind: 'error' | 'success' | 'info'; children: ReactNode; onClose?: () => void }) {
  return (
    <div className={`banner banner-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <div>{children}</div>
      {onClose && (
        <button className="icon-btn" onClick={onClose} aria-label="알림 닫기">
          ✕
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/** 보기/숨기기 버튼, Caps Lock·한글 입력 경고가 있는 비밀번호 칸 */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const hangul = looksLikeHangul(value);
  return (
    <>
      <div className="pw-wrap">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))}
          onKeyDown={(e) => setCaps(e.getModifierState('CapsLock'))}
          onBlur={() => setCaps(false)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
        />
        <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}>
          {show ? '숨기기' : '보기'}
        </button>
      </div>
      {caps && <p className="warn">Caps Lock이 켜져 있습니다.</p>}
      {hangul && <p className="warn">한글이 입력되었습니다. 한/영 키를 확인하세요.</p>}
    </>
  );
}
