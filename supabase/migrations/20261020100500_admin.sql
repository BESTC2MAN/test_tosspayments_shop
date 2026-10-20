-- F-13 관리자 페이지, F-14 상품·재고 관리, F-15 취소·환불, F-17 상품 사진
-- 관리자 지정: update public.profiles set role = 'admin' where id = (select id from auth.users where email = '...');

-- ---------- 관리자 테이블 권한 ----------
create policy "관리자 상품 전체 조회" on public.products for select to authenticated using (public.is_admin());
create policy "관리자 상품 등록" on public.products for insert to authenticated with check (public.is_admin());
create policy "관리자 상품 수정" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "관리자 재고 등록" on public.product_stock for insert to authenticated with check (public.is_admin());
create policy "관리자 재고 수정" on public.product_stock for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "관리자 쿠폰 조회" on public.coupons for select to authenticated using (public.is_admin());
create policy "관리자 쿠폰 등록" on public.coupons for insert to authenticated with check (public.is_admin());
create policy "관리자 쿠폰 수정" on public.coupons for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

-- ---------- 배송 상태 변경 ----------
create or replace function public.admin_update_order(p_order_id text, p_status text, p_courier text, p_tracking_no text)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using hint = '관리자만 할 수 있습니다.'; end if;
  select * into o from public.orders where order_id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using hint = '주문을 찾을 수 없습니다.'; end if;
  if o.status not in ('confirmed', 'preparing', 'shipping', 'delivered', 'partial_canceled')
     or p_status not in ('confirmed', 'preparing', 'shipping', 'delivered', 'partial_canceled') then
    raise exception 'INVALID_STATUS' using hint = '결제 완료 이후의 주문만 배송 상태를 바꿀 수 있습니다.';
  end if;
  if p_status = 'partial_canceled' and o.status <> 'partial_canceled' then
    raise exception 'INVALID_STATUS' using hint = '부분 취소 상태는 취소 기능으로만 바뀝니다.';
  end if;
  if p_status in ('shipping', 'delivered') and nullif(trim(coalesce(p_tracking_no, '')), '') is null then
    raise exception 'TRACKING_REQUIRED' using hint = '배송 중으로 바꾸려면 송장번호를 입력해 주세요.';
  end if;
  update public.orders
     set status = p_status,
         courier = nullif(trim(coalesce(p_courier, '')), ''),
         tracking_no = nullif(trim(coalesce(p_tracking_no, '')), ''),
         shipped_at = case when p_status in ('shipping', 'delivered') then coalesce(shipped_at, now()) else shipped_at end,
         delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
         updated_at = now()
   where id = o.id;
end $$;

-- ---------- 대시보드 숫자 (한국 시간 기준 오늘) ----------
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d0 timestamptz := (date_trunc('day', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
        paid text[] := array['confirmed', 'preparing', 'shipping', 'delivered', 'partial_canceled'];
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using hint = '관리자만 볼 수 있습니다.'; end if;
  return jsonb_build_object(
    'today_orders', (select count(*) from public.orders where created_at >= d0 and status = any (paid)),
    'today_sales', (select coalesce(sum(amount - canceled_amount), 0) from public.orders where created_at >= d0 and status = any (paid)),
    'to_ship', (select count(*) from public.orders where status in ('confirmed', 'preparing')),
    'waiting_deposit', (select count(*) from public.orders where status = 'waiting_deposit'),
    'low_stock', (select count(*) from public.product_stock s join public.products p on p.id = s.product_id
                   where p.active and s.qty <= 3));
end $$;

-- ---------- 취소 반영 (payments-cancel Edge Function 이 토스 취소 성공 후 호출) ----------
-- p_lines: null 이면 전체 취소, [{index, qty}] 면 해당 줄 수량만 취소
create or replace function public.apply_cancel(p_order_id text, p_lines jsonb, p_amount integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; it jsonb; i integer; v_items jsonb; v_all boolean := true;
begin
  select * into o from public.orders where order_id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_lines is null then
    perform public.release_order_resources(p_order_id, null);
    select jsonb_agg(x || jsonb_build_object('canceledQty', (x->>'qty')::integer)) into v_items
      from jsonb_array_elements(o.items) x;
    update public.orders set items = v_items, status = 'canceled', canceled_amount = o.amount,
           cancel_reason = p_reason, canceled_at = now(), updated_at = now()
     where id = o.id;
  else
    perform public.release_order_resources(p_order_id, p_lines);
    v_items := o.items;
    for it in select value from jsonb_array_elements(p_lines) loop
      i := (it->>'index')::integer;
      v_items := jsonb_set(v_items, array[i::text, 'canceledQty'],
        to_jsonb(coalesce((v_items->i->>'canceledQty')::integer, 0) + (it->>'qty')::integer));
    end loop;
    select bool_and(coalesce((x->>'canceledQty')::integer, 0) >= (x->>'qty')::integer) into v_all from jsonb_array_elements(v_items) x;
    update public.orders
       set items = v_items,
           status = case when v_all then 'canceled' else 'partial_canceled' end,
           stock_reserved = case when v_all then false else stock_reserved end,
           canceled_amount = least(o.amount, o.canceled_amount + p_amount),
           cancel_reason = p_reason, canceled_at = now(), updated_at = now()
     where id = o.id;
  end if;
  return (select to_jsonb(x) from (select status, canceled_amount, items from public.orders where id = o.id) x);
end $$;

revoke all on function public.apply_cancel(text, jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.apply_cancel(text, jsonb, integer, text) to service_role;
revoke all on function public.admin_update_order(text, text, text, text) from public, anon;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_update_order(text, text, text, text) to authenticated;
grant execute on function public.admin_stats() to authenticated;

-- ---------- 상품 사진 Storage (F-17) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "관리자 상품 사진 업로드" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "관리자 상품 사진 수정" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
create policy "관리자 상품 사진 삭제" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
