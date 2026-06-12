-- ============================================================
-- 두리 — 마이그레이션 001: 반복 거래 / 월 예산 / 기념일
-- schema.sql 을 이미 적용한 기존 DB에는 이 파일만 Run 하세요.
-- (새로 만드는 DB는 schema.sql 하나로 충분합니다.)
-- ============================================================

-- ---------- 기념일(사귄 날) / 월 예산 ----------

alter table public.couples add column anniversary date;
alter table public.couples add column monthly_budget integer check (monthly_budget is null or monthly_budget > 0);

create policy "couples: members update" on public.couples
  for update using (id = public.my_couple_id())
  with check (id = public.my_couple_id());

-- 클라이언트는 기념일/예산만 수정 가능 (invite_code 보호)
revoke update on public.couples from authenticated;
grant update (anniversary, monthly_budget) on public.couples to authenticated;

-- ---------- 반복 거래 규칙 ----------

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  type text not null check (type in ('expense', 'income')),
  amount integer not null check (amount > 0),
  category text not null default '기타',
  memo text not null default '',
  -- 1~30 = 해당 일, 31 = 말일. 일수가 모자라는 달은 말일로 당겨짐
  day_of_month integer not null check (day_of_month between 1 and 31),
  starts_on date not null default current_date,
  last_run_on date,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index recurring_couple_idx on public.recurring_rules (couple_id);

alter table public.recurring_rules enable row level security;

create policy "recurring: couple all" on public.recurring_rules
  for all using (couple_id = public.my_couple_id())
  with check (couple_id = public.my_couple_id());

-- 생성된 거래 추적 + 중복 생성 방지 (두 명이 동시에 앱을 열어도 한 건만)
alter table public.transactions add column recurring_rule_id uuid references public.recurring_rules (id) on delete set null;
create unique index tx_recurring_dedupe_idx on public.transactions (recurring_rule_id, date);
