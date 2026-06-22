-- ============================================================
-- 마이그레이션 004: 웹 푸시 구독
-- 잠금화면/알림용 PushSubscription 저장. 커플 멤버끼리 공유(상대에게 발송하려면 조회 필요).
-- schema.sql 을 이미 적용한 기존 DB에는 이 파일만 Run 하세요.
-- ============================================================

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_sub_couple_idx on public.push_subscriptions (couple_id);

alter table public.push_subscriptions enable row level security;

-- 커플 멤버는 자기 커플의 구독을 읽고/쓰기 가능 (상대 구독 조회는 서버 함수가 service_role 로 수행)
create policy "push: couple all" on public.push_subscriptions
  for all using (couple_id = public.my_couple_id())
  with check (couple_id = public.my_couple_id());
