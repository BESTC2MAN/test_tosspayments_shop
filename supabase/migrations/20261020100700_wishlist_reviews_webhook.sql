-- F-10 찜, F-11 리뷰·별점, F-16 결제 상태 자동 반영(웹훅)

-- ---------- 찜 ----------
create table public.wishlist (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.wishlist enable row level security;
create policy "본인 찜" on public.wishlist for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- 리뷰 ----------
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null references public.products(id) on update cascade on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  order_id    text not null,
  rating      integer not null check (rating between 1 and 5),
  content     text not null check (length(content) between 10 and 1000),
  author_name text not null,   -- 가린 이름 (예: 홍**)
  color       text,
  size        text,
  created_at  timestamptz not null default now(),
  unique (order_id, product_id)
);
create index reviews_product_idx on public.reviews (product_id, created_at desc);
alter table public.reviews enable row level security;
create policy "리뷰는 누구나 조회" on public.reviews for select to anon, authenticated using (true);
create policy "본인 리뷰 삭제" on public.reviews for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- 상품 별점·리뷰 수 자동 집계
create or replace function public.reviews_refresh_stats()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid text := coalesce(new.product_id, old.product_id);
begin
  update public.products p
     set rating_avg = coalesce((select round(avg(rating)::numeric, 1) from public.reviews where product_id = pid), 0),
         review_count = (select count(*) from public.reviews where product_id = pid)
   where p.id = pid;
  return null;
end $$;
create trigger reviews_refresh_stats after insert or delete on public.reviews
  for each row execute function public.reviews_refresh_stats();

-- 산 사람만, 주문 상품마다 한 번
create or replace function public.create_review(p_order_id text, p_product_id text, p_rating integer, p_content text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o public.orders%rowtype; it jsonb; v_name text;
begin
  if uid is null then raise exception 'NOT_SIGNED_IN' using hint = '로그인이 필요합니다.'; end if;
  select * into o from public.orders where order_id = p_order_id and user_id = uid;
  if not found or o.status not in ('confirmed', 'preparing', 'shipping', 'delivered', 'partial_canceled') then
    raise exception 'NOT_PURCHASED' using hint = '구매한 상품만 리뷰를 쓸 수 있습니다.';
  end if;
  select x into it from jsonb_array_elements(o.items) x
   where x->>'id' = p_product_id and (x->>'qty')::integer > coalesce((x->>'canceledQty')::integer, 0) limit 1;
  if it is null then raise exception 'NOT_PURCHASED' using hint = '구매한 상품만 리뷰를 쓸 수 있습니다.'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 or length(trim(coalesce(p_content, ''))) < 10 then
    raise exception 'INVALID_REVIEW' using hint = '별점과 10자 이상의 내용을 입력해 주세요.';
  end if;
  if exists (select 1 from public.reviews where order_id = p_order_id and product_id = p_product_id) then
    raise exception 'ALREADY_REVIEWED' using hint = '이미 리뷰를 쓴 상품입니다.';
  end if;
  select coalesce(nullif(trim(name), ''), split_part((select email from auth.users where id = uid), '@', 1)) into v_name
    from public.profiles where id = uid;
  v_name := left(coalesce(v_name, '회원'), 1) || repeat('*', greatest(char_length(coalesce(v_name, '회원')) - 1, 2));
  insert into public.reviews (product_id, user_id, order_id, rating, content, author_name, color, size)
  values (p_product_id, uid, p_order_id, p_rating, trim(p_content), v_name, it->>'color', it->>'size');
end $$;

-- ---------- 토스 결제 상태 동기화 (payments-webhook 이 토스에서 다시 조회한 결제 정보로 호출) ----------
create or replace function public.sync_payment_status(p_order_id text, p_payment jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; st text := p_payment->>'status'; r jsonb;
        v_canceled integer := coalesce((p_payment->>'totalAmount')::integer, 0) - coalesce((p_payment->>'balanceAmount')::integer, 0);
begin
  select * into o from public.orders where order_id = p_order_id;
  if not found then return 'ORDER_NOT_FOUND'; end if;

  if st in ('DONE', 'WAITING_FOR_DEPOSIT') then
    if o.status in ('pending', 'authorized') then
      r := public.confirm_begin(p_order_id, (p_payment->>'totalAmount')::integer, p_payment->>'paymentKey');
      if (r->>'ok')::boolean then perform public.confirm_finish(p_order_id, true, p_payment, null, null); end if;
    elsif o.status = 'waiting_deposit' and st = 'DONE' then
      update public.orders set status = 'confirmed', approved_at = coalesce(nullif(p_payment->>'approvedAt', '')::timestamptz, now()),
             receipt_url = coalesce(p_payment->'receipt'->>'url', receipt_url), updated_at = now()
       where id = o.id;
    end if;
  elsif st = 'CANCELED' then
    if o.status not in ('canceled', 'failed', 'expired') then
      perform public.release_order_resources(p_order_id, null);
      update public.orders set status = 'canceled', canceled_amount = greatest(canceled_amount, v_canceled),
             canceled_at = coalesce(canceled_at, now()), cancel_reason = coalesce(cancel_reason, '결제사 취소'), updated_at = now()
       where id = o.id;
    end if;
  elsif st = 'PARTIAL_CANCELED' then
    update public.orders set status = case when status in ('confirmed', 'preparing', 'shipping', 'delivered') then 'partial_canceled' else status end,
           canceled_amount = greatest(canceled_amount, v_canceled), updated_at = now()
     where id = o.id;
  elsif st in ('EXPIRED', 'ABORTED') then
    if o.status = 'waiting_deposit' then
      perform public.release_order_resources(p_order_id, null);
      update public.orders set status = 'expired', fail_code = 'DEPOSIT_EXPIRED', fail_message = '입금 기한 만료', updated_at = now() where id = o.id;
    elsif o.status in ('pending', 'authorized') then
      perform public.confirm_finish(p_order_id, false, null, st, '결제사에서 결제가 ' || case st when 'EXPIRED' then '만료' else '중단' end || '되었습니다.');
    end if;
  end if;
  return (select status from public.orders where id = o.id);
end $$;

revoke all on function public.sync_payment_status(text, jsonb) from public, anon, authenticated;
revoke all on function public.reviews_refresh_stats() from public, anon, authenticated;
revoke all on function public.create_review(text, text, integer, text) from public, anon;
grant execute on function public.sync_payment_status(text, jsonb) to service_role;
grant execute on function public.create_review(text, text, integer, text) to authenticated;
