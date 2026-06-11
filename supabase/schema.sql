-- ============================================================
-- 두리 (duri) — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 전체 복사/붙여넣기 후 Run 하세요.
-- ============================================================

-- ---------- 테이블 ----------

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  couple_id uuid references public.couples (id) on delete set null,
  display_name text not null default '',
  color text not null default '#F2685C',
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  title text not null,
  memo text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint events_range check (ends_at >= starts_at)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  type text not null check (type in ('expense', 'income')),
  amount integer not null check (amount > 0),
  category text not null default '기타',
  memo text not null default '',
  date date not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index events_couple_range_idx on public.events (couple_id, starts_at, ends_at);
create index tx_couple_date_idx on public.transactions (couple_id, date);
create index tx_event_idx on public.transactions (event_id);

-- ---------- 회원가입 시 프로필 자동 생성 ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS 헬퍼: 내 커플 id ----------

create or replace function public.my_couple_id()
returns uuid
language sql security definer stable set search_path = public
as $$
  select couple_id from public.profiles where id = auth.uid()
$$;

-- ---------- 커플 생성 / 참여 (RPC) ----------

create or replace function public.create_couple()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  code text;
  new_couple_id uuid;
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  i int;
begin
  if (select couple_id from profiles where id = auth.uid()) is not null then
    raise exception '이미 연결된 커플이 있어요.';
  end if;

  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from couples where invite_code = code);
  end loop;

  insert into couples (invite_code) values (code) returning id into new_couple_id;
  update profiles set couple_id = new_couple_id where id = auth.uid();
  return code;
end;
$$;

create or replace function public.join_couple(code text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  target uuid;
  member_count int;
begin
  if (select couple_id from profiles where id = auth.uid()) is not null then
    raise exception '이미 연결된 커플이 있어요.';
  end if;

  select id into target from couples where invite_code = upper(trim(code));
  if target is null then
    raise exception '초대 코드를 찾을 수 없어요.';
  end if;

  select count(*) into member_count from profiles where couple_id = target;
  if member_count >= 2 then
    raise exception '이미 두 명이 연결된 코드예요.';
  end if;

  -- 두 번째 멤버는 기본 색을 다르게
  update profiles set couple_id = target, color = '#4D7CFE' where id = auth.uid();
  return true;
end;
$$;

-- ---------- RLS ----------

alter table public.couples enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.transactions enable row level security;

create policy "couples: members read" on public.couples
  for select using (id = public.my_couple_id());

create policy "profiles: me and my partner" on public.profiles
  for select using (id = auth.uid() or (couple_id is not null and couple_id = public.my_couple_id()));

create policy "profiles: update self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- 클라이언트는 이름/색만 수정 가능 (couple_id 는 RPC 로만 변경)
revoke update on public.profiles from authenticated;
grant update (display_name, color) on public.profiles to authenticated;

create policy "events: couple all" on public.events
  for all using (couple_id = public.my_couple_id())
  with check (couple_id = public.my_couple_id());

create policy "transactions: couple all" on public.transactions
  for all using (couple_id = public.my_couple_id())
  with check (couple_id = public.my_couple_id());

-- ---------- Realtime ----------

alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.profiles;

alter table public.events replica identity full;
alter table public.transactions replica identity full;
alter table public.profiles replica identity full;
