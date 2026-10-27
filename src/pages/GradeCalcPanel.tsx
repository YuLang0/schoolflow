import { useEffect, useRef, useState } from 'react';
import { Empty, Field } from '../components/ui';
import type { DataApi } from '../hooks/useAppData';
import { average, CUTOFFS, overall, rankToGrade, type GradeCalc, type GradeRow, type GradeSystem } from '../lib/gradeCalc';
import { newId, type AppData } from '../lib/types';

const fmt = (n: number | null) => (n === null ? '-' : n.toFixed(2));

export function GradeCalcPanel({ data, api }: { data: AppData; api: DataApi }) {
  const [calc, setCalc] = useState<GradeCalc>(data.settings.gradeCalc);
  const [termId, setTermId] = useState(() => {
    // 내 학년의 1학기를 기본으로
    const g = Number(data.settings.gradeNo) || 1;
    return calc.terms[(g - 1) * 2]?.id ?? calc.terms[0].id;
  });

  // 입력할 때마다 저장하지 않고 잠시 멈췄을 때 저장. 화면을 떠나면 남은 변경을 바로 저장
  const latest = useRef({ settings: data.settings, api, calc, dirty: false });
  latest.current.settings = data.settings;
  latest.current.api = api;
  const flush = () => {
    const l = latest.current;
    if (!l.dirty) return;
    l.dirty = false;
    void l.api.saveSettings({ ...l.settings, gradeCalc: l.calc });
  };
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    latest.current.calc = calc;
    latest.current.dirty = true;
    const t = window.setTimeout(flush, 700);
    return () => window.clearTimeout(t);
  }, [calc]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  const term = calc.terms.find((t) => t.id === termId) ?? calc.terms[0];
  const setRows = (rows: GradeRow[]) => setCalc({ ...calc, terms: calc.terms.map((t) => (t.id === term.id ? { ...t, rows } : t)) });
  const setRow = (id: string, patch: Partial<GradeRow>) => setRows(term.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const all = overall(calc);
  const termAvg = average(term.rows);

  const setSystem = (system: GradeSystem) => {
    if (system === calc.system) return;
    // 등급제가 바뀌면 범위를 넘는 등급은 지움
    setCalc({
      system,
      terms: calc.terms.map((t) => ({ ...t, rows: t.rows.map((r) => ({ ...r, grade: r.grade !== null && r.grade > system ? null : r.grade })) })),
    });
  };

  return (
    <div className="stack">
      <section className="card hero">
        <div className="toolbar">
          <div className="seg">
            {([5, 9] as GradeSystem[]).map((s) => (
              <button key={s} className={calc.system === s ? 'on' : ''} onClick={() => setSystem(s)}>
                {s}등급제
              </button>
            ))}
          </div>
          <span className="muted small grow">2025년 고1 입학생부터 5등급제, 그 전 입학생은 9등급제입니다.</span>
        </div>
        <div className="stats">
          <div>
            <strong>{fmt(all.avg)}</strong>
            <span>전체 평균 등급</span>
          </div>
          <div>
            <strong>{fmt(termAvg.avg)}</strong>
            <span>{term.name} 평균</span>
          </div>
          <div>
            <strong>{all.units}</strong>
            <span>반영 학점 ({all.count}과목)</span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="chips term-chips">
          {calc.terms.map((t) => {
            const a = average(t.rows).avg;
            return (
              <button key={t.id} className={`chip ${t.id === term.id ? 'on-primary' : ''}`} onClick={() => setTermId(t.id)}>
                {t.name}
                {a !== null && <small> · {a.toFixed(2)}</small>}
              </button>
            );
          })}
        </div>

        {term.rows.length === 0 ? (
          <Empty>{term.name} 과목이 없습니다. 아래 버튼으로 과목을 추가하세요.</Empty>
        ) : (
          <table className="grade-table">
            <thead>
              <tr>
                <th>과목</th>
                <th>학점</th>
                <th>등급</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {term.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input value={r.subject} onChange={(e) => setRow(r.id, { subject: e.target.value })} placeholder="과목명" maxLength={30} aria-label="과목명" />
                  </td>
                  <td>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={10}
                      value={r.units || ''}
                      onChange={(e) => setRow(r.id, { units: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })}
                      aria-label={`${r.subject || '과목'} 학점`}
                    />
                  </td>
                  <td>
                    <select value={r.grade ?? ''} onChange={(e) => setRow(r.id, { grade: e.target.value ? Number(e.target.value) : null })} aria-label={`${r.subject || '과목'} 등급`}>
                      <option value="">-</option>
                      {Array.from({ length: calc.system }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}등급
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="icon-btn" onClick={() => setRows(term.rows.filter((x) => x.id !== r.id))} aria-label={`${r.subject || '과목'} 삭제`}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="actions">
          <button className="btn ghost small" disabled={term.rows.length >= 30} onClick={() => setRows([...term.rows, { id: newId(), subject: '', units: 3, grade: null }])}>
            + 과목 추가
          </button>
          <span className="grow" />
          <span className="muted small">학점 × 등급의 합 ÷ 학점 합으로 계산합니다.</span>
        </div>
      </section>

      <RankHelper system={calc.system} />
    </div>
  );
}

function RankHelper({ system }: { system: GradeSystem }) {
  const [rank, setRank] = useState('');
  const [total, setTotal] = useState('');
  const r = rankToGrade(Number(rank), Number(total), system);
  return (
    <section className="card">
      <h3>석차로 등급 알아보기</h3>
      <div className="row2">
        <Field label="내 석차">{(id) => <input id={id} type="number" inputMode="numeric" min={1} value={rank} onChange={(e) => setRank(e.target.value)} />}</Field>
        <Field label="수강자 수">{(id) => <input id={id} type="number" inputMode="numeric" min={1} value={total} onChange={(e) => setTotal(e.target.value)} />}</Field>
      </div>
      {r ? (
        <p className="rank-result">
          상위 <strong>{r.percent.toFixed(1)}%</strong> → <strong>{r.grade}등급</strong>
        </p>
      ) : (
        rank && total && <p className="warn">석차는 1 이상, 수강자 수 이하로 입력해 주세요.</p>
      )}
      <p className="hint">
        {system}등급제 누적 비율: {CUTOFFS[system].map((c, i) => `${i + 1}등급 ~${c}%`).join(', ')}. 동점자는 고려하지 않은 단순 계산이라 실제 등급과 다를 수 있습니다.
      </p>
    </section>
  );
}
