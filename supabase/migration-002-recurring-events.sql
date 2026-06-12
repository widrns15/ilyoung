-- ============================================================
-- 1+0 — 마이그레이션 002: 반복 일정 (매년 생일, 매월 정기 일정)
-- 기존 DB에는 이 파일을 Run 하세요. (001을 아직 안 돌렸다면 001 먼저)
-- ============================================================

create table public.recurring_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  title text not null,
  freq text not null default 'yearly' check (freq in ('monthly', 'yearly')),
  -- yearly 전용 (1~12). monthly 는 null
  month integer check (month between 1 and 12),
  -- 1~30 = 해당 일, 31 = 말일. 일수가 모자라는 달은 말일로 당겨짐
  day integer not null check (day between 1 and 31),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint yearly_needs_month check (freq <> 'yearly' or month is not null)
);

create index recurring_events_couple_idx on public.recurring_events (couple_id);

alter table public.recurring_events enable row level security;

create policy "recurring_events: couple all" on public.recurring_events
  for all using (couple_id = public.my_couple_id())
  with check (couple_id = public.my_couple_id());
