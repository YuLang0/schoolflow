# SchoolFlow

고등학생을 위한 학교생활 통합관리 웹앱입니다. 시간표 · 급식 · 시험 · 학사일정 · 공지를 한곳에서 관리합니다.

## 기능
- 화면: 로그인, 홈(대시보드), 시간표, 급식, 시험(내신 계산기), 달력, 공지, 검색, 설정
- 저장 모드 2가지
  - **로컬 데모 모드**: Supabase 설정이 없으면 데이터를 브라우저에만 저장
  - **계정 동기화 모드**: Supabase에 계정별로 저장 (RLS로 본인 데이터만 접근)
- 계정: 회원가입(이메일 인증), 인증 메일 재발송, **비밀번호 찾기(재설정 메일)**, **설정에서 비밀번호 변경**
- 경기모바일과학고등학교 전용: 학교·교시 시간 고정, 나이스 시간표 자동 가져오기(매주·반 변경 시, 바뀐 수업 강조), 주간 급식표(알레르기 메뉴 강조)
- 학사일정(달력·홈, 다음 시험 D-day), 내신 계산기(5·9등급제, 석차→등급), 시간표 이미지 저장(가로·세로·다크)
- 이동수업(🚶)·공강 표시, 홈 D-day 위젯, 좋아하는 급식 메뉴 ⭐ 표시
- 앱을 닫아도 오는 알림(웹 푸시): 수업 5분 전, 아침 7:30 시험·좋아하는 메뉴 (설정 방법: `docs/SETUP.md`)
- 다크 모드, 시험·수업 알림, JSON 백업/복원, CSV 내보내기, PWA(홈 화면 설치·오프라인)

## 개발
```bash
npm install
cp .env.example .env   # Supabase 값을 넣거나, 비워 두면 로컬 데모 모드
npm run dev
npm test               # 단위 테스트
npm run build          # 타입 검사 + 배포 빌드 (dist/)
```

## Supabase 준비
1. SQL Editor에서 `supabase/schema.sql` 실행
2. Authentication → URL Configuration
   - Site URL: 배포 주소 (예: `https://schoolflow-yulang.netlify.app`)
   - Redirect URLs: `https://schoolflow-yulang.netlify.app/**`, `http://localhost:5173/**`
3. 배포 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   (anon public 키만 넣으세요. service_role 키는 절대 넣지 마세요.)

## 나이스 API
- 요청은 Netlify 함수 `netlify/functions/neis.mjs`(`/api/neis`)를 거쳐 나이스로 갑니다. 인증키가 브라우저에 노출되지 않습니다.
- [나이스 교육정보 개방 포털](https://open.neis.go.kr)에서 인증키를 발급받아 Netlify 환경변수 `NEIS_API_KEY`에 넣으세요.
  키가 없으면 나이스 샘플 제한(한 번에 5건)이 걸려 시간표가 일부만 들어옵니다.

## 직접 하는 설정
메일 발송 한도(Gmail SMTP)와 웹 푸시 환경변수는 `docs/SETUP.md`를 보세요.

## 배포 (Netlify)
`netlify.toml`에 빌드 설정이 있습니다. 저장소를 Netlify 사이트에 연결하면 push할 때마다 자동 배포됩니다.
보안 헤더는 `public/_headers`에 있습니다.
