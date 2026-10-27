// 내신 등급 계산 (학점·단위 가중 평균)
export type GradeSystem = 5 | 9;

export interface GradeRow {
  id: string;
  subject: string;
  units: number; // 학점(단위수)
  grade: number | null; // 성취 등급
}

export interface GradeTerm {
  id: string;
  name: string; // 예: 1학년 1학기
  rows: GradeRow[];
}

export interface GradeCalc {
  system: GradeSystem;
  terms: GradeTerm[];
}

export const TERM_NAMES = ['1학년 1학기', '1학년 2학기', '2학년 1학기', '2학년 2학기', '3학년 1학기', '3학년 2학기'];

export function defaultGradeCalc(): GradeCalc {
  return { system: 5, terms: TERM_NAMES.map((name, i) => ({ id: `t${i + 1}`, name, rows: [] })) };
}

/** 누적 비율(%) 상한: 9등급제 4·11·23·40·60·77·89·96·100, 5등급제 10·34·66·90·100 */
export const CUTOFFS: Record<GradeSystem, number[]> = {
  9: [4, 11, 23, 40, 60, 77, 89, 96, 100],
  5: [10, 34, 66, 90, 100],
};

/** 등급과 학점이 모두 있는 과목만으로 가중 평균. 계산할 과목이 없으면 null */
export function average(rows: GradeRow[]): { avg: number | null; units: number; count: number } {
  const valid = rows.filter((r) => r.grade !== null && r.units > 0);
  const units = valid.reduce((s, r) => s + r.units, 0);
  if (!units) return { avg: null, units: 0, count: 0 };
  return { avg: valid.reduce((s, r) => s + r.units * (r.grade as number), 0) / units, units, count: valid.length };
}

export function overall(calc: GradeCalc) {
  return average(calc.terms.flatMap((t) => t.rows));
}

/** 석차와 수강자 수로 등급 구하기 (동석차는 고려하지 않은 단순 계산) */
export function rankToGrade(rank: number, total: number, system: GradeSystem): { grade: number; percent: number } | null {
  if (!Number.isInteger(rank) || !Number.isInteger(total) || rank < 1 || total < 1 || rank > total) return null;
  const percent = (rank / total) * 100;
  const grade = CUTOFFS[system].findIndex((c) => percent <= c + 1e-9) + 1;
  return { grade, percent };
}

/** 저장된 값 검증 (백업 복원·예전 데이터 대비) */
export function sanitizeGradeCalc(v: unknown): GradeCalc {
  const base = defaultGradeCalc();
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const system: GradeSystem = o.system === 9 ? 9 : 5;
  if (!Array.isArray(o.terms)) return { ...base, system };
  const terms = (o.terms as Record<string, unknown>[])
    .filter((t) => t && typeof t === 'object')
    .slice(0, 12)
    .map((t, i) => ({
      id: typeof t.id === 'string' ? t.id.slice(0, 40) : `t${i + 1}`,
      name: typeof t.name === 'string' ? t.name.slice(0, 30) : `${i + 1}학기`,
      rows: (Array.isArray(t.rows) ? (t.rows as Record<string, unknown>[]) : [])
        .filter((r) => r && typeof r === 'object')
        .slice(0, 30)
        .map((r, j) => ({
          id: typeof r.id === 'string' ? r.id.slice(0, 40) : `r${j}`,
          subject: typeof r.subject === 'string' ? r.subject.slice(0, 30) : '',
          units: typeof r.units === 'number' && r.units > 0 && r.units <= 10 ? r.units : 0,
          grade: typeof r.grade === 'number' && Number.isInteger(r.grade) && r.grade >= 1 && r.grade <= system ? r.grade : null,
        })),
    }));
  return { system, terms: terms.length ? terms : base.terms };
}
