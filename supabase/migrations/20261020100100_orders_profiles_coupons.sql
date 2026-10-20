-- 회원 프로필·관리자 권한, 주문 컬럼 확장, 쿠폰

-- ---------- 회원 프로필 (F-07) ----------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  phone      text,
  role       text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create policy "본인 프로필 조회" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "본인 프로필 수정" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- role 은 본인이 바꿀 수 없게 막음 (관리자 지정은 SQL 로만)
create or replace function public.profiles_guard_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'ROLE_CHANGE_NOT_ALLOWED';
  end if;
  return new;
end $$;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.profiles_guard_role();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 주문 확장 (F-01, F-04, F-13, F-15) ----------
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'pending',          -- 결제 대기
  'authorized',       -- 결제 인증
  'waiting_deposit',  -- 가상계좌 입금 대기
  'confirmed',        -- 결제 완료
  'preparing',        -- 배송 준비
  'shipping',         -- 배송 중
  'delivered',        -- 배송 완료
  'partial_canceled', -- 부분 취소
  'canceled',         -- 취소됨
  'failed',           -- 결제 실패
  'expired'           -- 만료
));

alter table public.orders
  add column user_id         uuid references auth.users(id) on delete set null,
  add column subtotal        integer not null default 0,
  add column discount        integer not null default 0,
  add column shipping_fee    integer not null default 0,
  add column coupon_code     text,
  add column method          text,
  add column approved_at     timestamptz,
  add column receipt_url     text,
  add column virtual_account jsonb,
  add column fail_code       text,
  add column fail_message    text,
  add column canceled_amount integer not null default 0,
  add column cancel_reason   text,
  add column canceled_at     timestamptz,
  add column courier         text,
  add column tracking_no     text,
  add column shipped_at      timestamptz,
  add column delivered_at    timestamptz,
  add column stock_reserved  boolean not null default false,
  add column coupon_counted  boolean not null default false;

create index orders_user_id_idx on public.orders (user_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at desc);

create policy "본인 주문 조회" on public.orders
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------- 쿠폰 (F-12) ----------
create table public.coupons (
  code         text primary key check (code ~ '^[A-Z0-9_-]{3,32}$'),
  name         text not null,
  kind         text not null check (kind in ('amount', 'percent')),
  value        integer not null check (value > 0),
  min_order    integer not null default 0,
  max_discount integer,               -- 정률 할인 상한
  starts_at    timestamptz,
  ends_at      timestamptz,
  usage_limit  integer,               -- 전체 사용 가능 횟수 (null = 무제한)
  used_count   integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100)
);
alter table public.coupons enable row level security;
-- 손님은 check_coupon 함수로만 확인합니다. 관리자 정책은 관리자 마이그레이션에서 추가.

insert into public.coupons (code, name, kind, value, min_order, max_discount) values
  ('WELCOME10', '첫 구매 10% 할인', 'percent', 10, 50000, 15000),
  ('RIDGE5000', '5,000원 할인', 'amount', 5000, 70000, null);
