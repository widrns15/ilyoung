-- ============================================================
-- 마이그레이션 005: 가계부 리마인드 알림 설정
-- 주말 결산(일요일 저녁) / 미기록 리마인드(5일 단위)를 사람별로 켜고 끌 수 있게 한다.
-- 발송은 Edge Function ledger-reminders 가 cron 으로 수행(_cron.sql 참고).
-- schema.sql 을 이미 적용한 기존 DB에는 이 파일만 Run 하세요.
-- ============================================================

alter table public.profiles add column remind_recap boolean not null default true;
alter table public.profiles add column remind_idle boolean not null default true;

-- 클라이언트가 자기 행의 알림 설정을 바꿀 수 있게 (기존 grant 에 컬럼 추가)
grant update (remind_recap, remind_idle) on public.profiles to authenticated;
