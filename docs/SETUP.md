# 사람이 직접 하는 설정

코드로는 할 수 없고 각 서비스 화면에서 직접 해야 하는 설정입니다.

## 1. 인증·비밀번호 메일 발송 한도 풀기 (Gmail SMTP)

Supabase 기본 메일 서버는 시간당 몇 통만 보낼 수 있습니다. 학생들이 한꺼번에 가입하면 인증 메일이 오지 않습니다.
Gmail 계정 하나를 메일 발송용으로 연결하면 하루 약 500통까지 보낼 수 있습니다. 자기 도메인이 없어도 됩니다.

1. **발송용 Gmail 계정 준비**: 개인 메일 대신 새 계정을 만드는 것을 권합니다. (예: schoolflow.gmmsh@gmail.com)
2. 그 계정으로 https://myaccount.google.com/security 에 들어가 **2단계 인증**을 켭니다.
3. https://myaccount.google.com/apppasswords 에서 앱 비밀번호를 만듭니다. (앱 이름: SchoolFlow)
   - 16자리 비밀번호가 나옵니다. 이것을 복사해 둡니다. Gmail 로그인 비밀번호가 아닙니다.
4. Supabase → **Authentication → Emails → SMTP Settings** → **Enable Custom SMTP**를 켭니다.

   | 항목 | 값 |
   |---|---|
   | Sender email | 발송용 Gmail 주소 |
   | Sender name | `SchoolFlow` |
   | Host | `smtp.gmail.com` |
   | Port | `465` |
   | Username | 발송용 Gmail 주소 |
   | Password | 3번의 16자리 앱 비밀번호 (띄어쓰기 없이) |

   **Save**를 누릅니다.
5. Supabase → **Authentication → Rate Limits**에서 **Rate limit for sending emails**를 `100`(시간당) 정도로 올리고 저장합니다.
6. 확인: 사이트에서 로그아웃하고 **비밀번호를 잊으셨나요?**로 재설정 메일을 받아 봅니다. 보낸 사람이 발송용 Gmail이면 성공입니다.

## 2. 앱을 닫아도 오는 알림 (웹 푸시)

서버의 예약 함수 `netlify/functions/push-cron.mjs`가 1분마다 실행됩니다.
- **수업 5분 전**: 학교 휴업일에는 보내지 않습니다.
- **아침 7시 30분**: 다가오는 시험, 좋아하는 급식 메뉴

### Netlify 환경변수 두 개 추가 (둘 다 **Secret 체크**)

| Key | 값 | 어디서 |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 비밀 키 | Supabase → Project Settings → **API Keys** → `service_role` 또는 `secret` 키. 화면에서 Reveal 후 복사 |
| `VAPID_PRIVATE_KEY` | 알림 서명용 비밀 키 | Claude 대화에서 받은 값. 코드의 공개키 `BMb5qu7Q…`와 짝이 맞는 키 |

- 두 값 모두 **절대 코드·채팅·깃허브에 올리지 마세요.** 특히 service_role 키는 모든 데이터에 접근할 수 있는 키라 Netlify 환경변수에만 넣습니다.
- `VITE_SUPABASE_URL`, `NEIS_API_KEY`는 이미 있는 값을 함께 씁니다.
- 넣은 뒤 **Deploys → Trigger deploy → Deploy site**로 다시 배포합니다.

### 학생이 켜는 방법
- **안드로이드(Chrome)**: 사이트 → 설정 → 알림 → **앱을 닫아도 알림 받기 (이 기기)** 체크 → 알림 허용
- **아이폰**: Safari로 사이트를 열고 **공유 버튼 → 홈 화면에 추가**로 설치합니다. 설치한 앱에서 설정 → 알림 → 같은 항목을 체크합니다. (iOS 16.4 이상)
- 알림 종류(시험 / 수업 5분 전 / 좋아하는 메뉴)는 같은 화면의 체크박스로 고릅니다.

### 잘 되는지 확인
- Netlify → **Logs → Functions → push-cron**에서 1분마다 실행 기록이 보이면 예약이 동작하는 것입니다.
  - 평소에는 `idle`
  - 수업 5분 전·7시 30분에는 보낸 개수가 남습니다.
- `not configured`가 보이면 위 환경변수가 빠진 것입니다.

### VAPID 키를 새로 바꿔야 할 때
1. `npx web-push generate-vapid-keys`로 새 키를 만듭니다.
2. 공개키를 `src/lib/push.ts`와 `netlify/functions/push-cron.mjs` 두 곳에 넣습니다. 둘은 같아야 하고, 테스트가 확인합니다.
3. 비밀키는 Netlify `VAPID_PRIVATE_KEY`에 넣습니다.
4. 이미 알림을 켠 기기는 한 번 껐다가 다시 켜야 합니다.
