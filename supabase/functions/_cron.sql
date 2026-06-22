-- event-reminders 를 매일 실행 (Supabase SQL Editor 에서 1회 실행)
-- 전제: Database > Extensions 에서 pg_cron, pg_net 활성화
-- '0 23 * * *' = UTC 23:00 = KST 08:00 → 다음날(=일정일) 전날 아침에 발송
-- <PROJECT_REF> 와 <SERVICE_ROLE_KEY> 를 실제 값으로 바꾸세요.

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

-- 해제: select cron.unschedule('event-reminders-daily');
