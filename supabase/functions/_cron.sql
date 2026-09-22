-- 알림 함수들을 cron 으로 실행 (Supabase SQL Editor 에서 1회 실행)
-- 전제: Database > Extensions 에서 pg_cron, pg_net 활성화
-- 시각은 UTC 기준. KST = UTC + 9h
-- <PROJECT_REF> 와 <SERVICE_ROLE_KEY> 를 실제 값으로 바꾸세요.

-- 1) 전날 알림 (event-reminders) — 매일 UTC 23:00 = KST 08:00, 일정일 전날 아침
select cron.schedule(
  'event-reminders-daily',
  '0 23 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/event-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 2) 주말 결산 (ledger-reminders job=weekly) — 일요일 UTC 11:00 = KST 20:00
select cron.schedule(
  'ledger-weekly-recap',
  '0 11 * * 0',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/ledger-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{"job":"weekly"}'::jsonb
  );
  $$
);

-- 3) 미기록 리마인드 (ledger-reminders job=idle) — 매일 UTC 10:00 = KST 19:00
select cron.schedule(
  'ledger-idle-reminder',
  '0 10 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/ledger-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{"job":"idle"}'::jsonb
  );
  $$
);

-- 해제:
--   select cron.unschedule('event-reminders-daily');
--   select cron.unschedule('ledger-weekly-recap');
--   select cron.unschedule('ledger-idle-reminder');
