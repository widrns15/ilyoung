# 웹 푸시 알림 설정

코드는 모두 들어가 있고, 아래 인프라 단계만 직접 하면 동작합니다.

## 1. VAPID 키 생성

```bash
npx web-push generate-vapid-keys
```

- **Public Key** → 프론트 `.env` 의 `VITE_VAPID_PUBLIC_KEY`
- **Private Key** → 아래 Edge Function 시크릿 `VAPID_PRIVATE_KEY`

## 2. DB 마이그레이션

Supabase SQL Editor 에서 `supabase/migration-004-push-subscriptions.sql` 실행.

## 3. Edge Functions 배포

```bash
supabase functions deploy notify
supabase functions deploy event-reminders --no-verify-jwt
```

시크릿 등록(둘 다 같은 키 사용):

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=<공개키> \
  VAPID_PRIVATE_KEY=<비밀키> \
  VAPID_SUBJECT=mailto:you@example.com
```

> `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` 는 Edge 런타임에 기본 주입됩니다.

## 4. 전날 알림 cron

Database > Extensions 에서 `pg_cron`, `pg_net` 활성화 후, `supabase/functions/_cron.sql` 의 `<PROJECT_REF>`·`<SERVICE_ROLE_KEY>` 를 채워 SQL Editor 에서 실행.
(`0 23 * * *` UTC = KST 08:00, 일정일 전날 아침 발송)

## 5. 프론트 배포 후 사용

- HTTPS 필수. iOS 는 **홈 화면에 추가한 PWA** 에서만 푸시가 동작(Safari 탭 ❌).
- 설정 > 알림 > 푸시 알림 토글 ON → 권한 허용.

## 동작 범위

- **파트너 활동**: 상대가 일정/가계부를 추가하면 즉시 푸시(`notify`, insert 직후 클라이언트가 호출).
- **전날 리마인더**: 매일 cron 이 '내일' 기준으로 찾아 커플 전원에게 푸시(`event-reminders`).
  - 내일 시작하는 실제 일정
  - 내일 도래하는 반복 일정(매월/매년, 말일 보정)
  - 내일이 기념일 마일스톤(100일 단위 · n주년)인 경우
