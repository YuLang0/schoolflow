import { describe, expect, it } from 'vitest';
import { average, defaultGradeCalc, overall, rankToGrade, sanitizeGradeCalc } from './gradeCalc';
import { groupEvents, toSchoolEvents } from './neis';
import { fitLines, subjectColorIndex } from './timetableImage';

describe('학사일정', () => {
  const rows: Record<string, string>[] = [
    { AA_YMD: '20261031', EVENT_NM: '토요휴업일', SBTR_DD_SC_NM: '휴업일' },
    { AA_YMD: '20261103', EVENT_NM: '2학기 기말고사', SBTR_DD_SC_NM: '해당없음', ONE_GRADE_EVENT_YN: 'Y', TW_GRADE_EVENT_YN: 'Y', THREE_GRADE_EVENT_YN: 'N' },
    { AA_YMD: '20261104', EVENT_NM: '2학기 기말고사', SBTR_DD_SC_NM: '해당없음', ONE_GRADE_EVENT_YN: 'Y', TW_GRADE_EVENT_YN: 'Y', THREE_GRADE_EVENT_YN: 'N' },
    { AA_YMD: '20261102', EVENT_NM: '3학년 진로특강', ONE_GRADE_EVENT_YN: 'N', TW_GRADE_EVENT_YN: 'N', THREE_GRADE_EVENT_YN: 'Y' },
    { AA_YMD: '20261109', EVENT_NM: '개교기념일', SBTR_DD_SC_NM: '휴업일' },
    { AA_YMD: '20261110', EVENT_NM: '수행평가 주간' },
  ];
  it('토요휴업일·다른 학년 일정 제외, 휴일·시험 구분', () => {
    const ev = toSchoolEvents(rows, '2');
    expect(ev.map((e) => e.name)).toEqual(['2학기 기말고사', '2학기 기말고사', '개교기념일', '수행평가 주간']);
    expect(ev[0]).toMatchObject({ date: '2026-11-03', exam: true, holiday: false });
    expect(ev[2]).toMatchObject({ holiday: true, exam: false });
    expect(ev[3].exam).toBe(false); // 수행평가는 시험 기간이 아님
    expect(toSchoolEvents(rows, '3').map((e) => e.name)).toContain('3학년 진로특강');
  });
  it('이어지는 같은 일정은 하나로', () => {
    expect(groupEvents(toSchoolEvents(rows, '2'))[0]).toEqual({ name: '2학기 기말고사', from: '2026-11-03', to: '2026-11-04', exam: true, holiday: false });
  });
});

describe('내신 계산기', () => {
  it('학점 가중 평균, 등급 없는 과목은 제외', () => {
    const r = average([
      { id: '1', subject: '국어', units: 4, grade: 2 },
      { id: '2', subject: '수학', units: 4, grade: 3 },
      { id: '3', subject: '체육', units: 2, grade: null },
      { id: '4', subject: '영어', units: 2, grade: 1 },
    ]);
    expect(r.avg).toBeCloseTo((8 + 12 + 2) / 10);
    expect(r).toMatchObject({ units: 10, count: 3 });
    expect(average([]).avg).toBeNull();
  });
  it('전체 평균은 모든 학기 합산', () => {
    const c = defaultGradeCalc();
    c.terms[0].rows = [{ id: 'a', subject: 'a', units: 2, grade: 1 }];
    c.terms[1].rows = [{ id: 'b', subject: 'b', units: 2, grade: 3 }];
    expect(overall(c).avg).toBe(2);
  });
  it('석차 → 등급 (5등급제·9등급제 경계)', () => {
    expect(rankToGrade(10, 100, 5)).toMatchObject({ grade: 1 });
    expect(rankToGrade(11, 100, 5)).toMatchObject({ grade: 2 });
    expect(rankToGrade(34, 100, 5)?.grade).toBe(2);
    expect(rankToGrade(100, 100, 5)?.grade).toBe(5);
    expect(rankToGrade(4, 100, 9)?.grade).toBe(1);
    expect(rankToGrade(5, 100, 9)?.grade).toBe(2);
    expect(rankToGrade(1, 30, 9)?.grade).toBe(1);
    expect(rankToGrade(0, 30, 9)).toBeNull();
    expect(rankToGrade(31, 30, 9)).toBeNull();
  });
  it('저장값 검증: 잘못된 값 정리, 5등급제에서 6등급 이상 지움', () => {
    const c = sanitizeGradeCalc({ system: 5, terms: [{ id: 't', name: '1-1', rows: [{ subject: 'x', units: 99, grade: 7 }, { subject: 'y', units: 3, grade: 2 }] }] });
    expect(c.terms[0].rows).toEqual([
      { id: 'r0', subject: 'x', units: 0, grade: null },
      { id: 'r1', subject: 'y', units: 3, grade: 2 },
    ]);
    expect(sanitizeGradeCalc(undefined).terms).toHaveLength(6);
  });
});

describe('시간표 이미지', () => {
  const measure = (s: string) => s.length * 10;
  it('길면 띄어쓰기에서 두 줄로', () => {
    expect(fitLines('국어', 100, measure)).toEqual(['국어']);
    expect(fitLines('학교주도 자율활동', 60, measure)).toEqual(['학교주도', '자율활동']);
    expect(fitLines('학교주도자율활동', 60, measure)).toEqual(['학교주도', '자율활동']);
  });
  it('같은 과목은 같은 색', () => {
    expect(subjectColorIndex('수학', 8)).toBe(subjectColorIndex('수학', 8));
    expect(subjectColorIndex('수학', 8)).toBeLessThan(8);
  });
});
