-- F-08 배송지 저장, F-09 장바구니 동기화

-- ---------- 배송지 ----------
create table public.addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label      text check (length(label) <= 20),
  recipient  text not null check (length(recipient) between 2 and 30),
  phone      text not null check (phone ~ '^01[0-9]{8,9}$'),
  address    text not null check (length(address) between 5 and 200),
  address2   text check (length(address2) <= 100),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);
create unique index addresses_one_default on public.addresses (user_id) where is_default;
alter table public.addresses enable row level security;
create policy "본인 배송지" on public.addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 배송지는 회원당 10개까지, 첫 배송지는 자동으로 기본 배송지
create or replace function public.addresses_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.addresses where user_id = new.user_id) >= 10 then
    raise exception 'ADDRESS_LIMIT' using hint = '배송지는 10개까지 저장할 수 있습니다.';
  end if;
  if not exists (select 1 from public.addresses where user_id = new.user_id) then new.is_default := true; end if;
  if new.is_default then update public.addresses set is_default = false where user_id = new.user_id; end if;
  return new;
end $$;
create trigger addresses_before_insert before insert on public.addresses
  for each row execute function public.addresses_before_insert();

create or replace function public.set_default_address(p_id uuid)
returns void language sql security invoker set search_path = public as $$
  update public.addresses set is_default = false where user_id = auth.uid() and is_default and id <> p_id;
  update public.addresses set is_default = true where user_id = auth.uid() and id = p_id;
$$;

-- ---------- 장바구니 ----------
create table public.cart_items (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id  text not null references public.products(id) on update cascade on delete cascade,
  color_index integer not null check (color_index >= 0),
  size        text not null,
  qty         integer not null check (qty between 1 and 10),
  updated_at  timestamptz not null default now(),
  primary key (user_id, product_id, color_index, size)
);
alter table public.cart_items enable row level security;
create policy "본인 장바구니 조회" on public.cart_items for select to authenticated using (user_id = auth.uid());

-- 화면의 장바구니를 통째로 저장 (판매 중인 상품만)
create or replace function public.replace_cart(p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then raise exception 'INVALID_CART'; end if;
  delete from public.cart_items where user_id = uid;
  insert into public.cart_items (user_id, product_id, color_index, size, qty)
  select uid, x->>'id', (x->>'color')::integer, x->>'size', least(greatest((x->>'qty')::integer, 1), 10)
    from jsonb_array_elements(p_items) x
    join public.products p on p.id = x->>'id' and p.active
   where (x->>'color') ~ '^[0-9]+$' and (x->>'qty') ~ '^[0-9]+$'
  on conflict do nothing;
end $$;

revoke all on function public.replace_cart(jsonb) from public, anon;
revoke all on function public.set_default_address(uuid) from public, anon;
revoke all on function public.addresses_before_insert() from public, anon, authenticated;
grant execute on function public.replace_cart(jsonb) to authenticated;
grant execute on function public.set_default_address(uuid) to authenticated;
