-- F-01 결제 확정, F-02 금액 검증, F-04 실패·만료 정리, F-05 재고 차감, F-12 쿠폰
-- 에러는 message 에 코드, hint 에 손님에게 보여줄 문구를 담습니다.

-- ---------- 금액 규칙 ----------
create or replace function public.shop_shipping_fee(p_subtotal integer)
returns integer language sql immutable as $$
  select case when p_subtotal = 0 or p_subtotal >= 70000 then 0 else 3000 end;
$$;

create or replace function public.coupon_discount(p_code text, p_subtotal integer)
returns integer language plpgsql stable security definer set search_path = public as $$
declare c public.coupons%rowtype; d integer;
begin
  select * into c from public.coupons where code = upper(trim(p_code));
  if not found or not c.active then
    raise exception 'COUPON_INVALID' using hint = '사용할 수 없는 쿠폰 코드입니다.';
  end if;
  if (c.starts_at is not null and now() < c.starts_at) or (c.ends_at is not null and now() > c.ends_at) then
    raise exception 'COUPON_EXPIRED' using hint = '사용 기간이 아닌 쿠폰입니다.';
  end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    raise exception 'COUPON_EXHAUSTED' using hint = '모두 소진된 쿠폰입니다.';
  end if;
  if p_subtotal < c.min_order then
    raise exception 'COUPON_MIN_ORDER'
      using hint = to_char(c.min_order, 'FM999,999,999') || '원 이상 주문할 때 쓸 수 있는 쿠폰입니다.';
  end if;
  d := case when c.kind = 'amount' then c.value else floor(p_subtotal * c.value / 100.0)::integer end;
  if c.max_discount is not null then d := least(d, c.max_discount); end if;
  return least(d, p_subtotal);
end $$;

-- 주문서 화면에서 쿠폰 미리 확인 (실제 할인은 create_order 가 다시 계산)
create or replace function public.check_coupon(p_code text, p_subtotal integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d integer; c public.coupons%rowtype;
begin
  d := public.coupon_discount(p_code, p_subtotal);
  select * into c from public.coupons where code = upper(trim(p_code));
  return jsonb_build_object('code', c.code, 'name', c.name, 'discount', d);
end $$;

-- ---------- 주문 생성: 서버에서 금액·재고 재계산 ----------
drop function if exists public.create_order(text, text, integer, text, text, text, text, text, text, jsonb);

create or replace function public.create_order(
  p_order_id text, p_order_name text, p_amount integer,
  p_name text, p_phone text, p_email text, p_address text, p_address2 text, p_memo text,
  p_items jsonb, p_coupon_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  it jsonb; p public.products%rowtype;
  v_color integer; v_size text; v_qty integer; v_unit integer; v_stock integer;
  v_lines jsonb := '[]'::jsonb; v_subtotal integer := 0;
  v_ship integer; v_disc integer := 0; v_total integer; v_code text; v_name text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using hint = '장바구니가 비어 있습니다.';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'TOO_MANY_ITEMS' using hint = '한 번에 30개 옵션까지 주문할 수 있습니다.';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2
     or coalesce(p_phone, '') !~ '^01[0-9]{8,9}$'
     or coalesce(p_email, '') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(trim(coalesce(p_address, ''))) < 5 then
    raise exception 'INVALID_CUSTOMER' using hint = '주문자 정보를 다시 확인해 주세요.';
  end if;

  for it in select value from jsonb_array_elements(p_items) loop
    select * into p from public.products where id = it->>'id' and active;
    if not found then
      raise exception 'PRODUCT_UNAVAILABLE' using hint = '판매가 끝난 상품이 장바구니에 있습니다. 장바구니를 확인해 주세요.';
    end if;

    -- 색상: 인덱스(현재 화면) 또는 색상 이름(이전 화면) 모두 허용
    v_color := null;
    if jsonb_typeof(it->'color') = 'number' then
      v_color := (it->>'color')::integer;
    else
      select (c.ord - 1)::integer into v_color
        from jsonb_array_elements(p.colors) with ordinality as c(val, ord)
       where c.val->>'name' = it->>'color' limit 1;
    end if;
    v_size := it->>'size';
    v_qty := case when (it->>'qty') ~ '^[0-9]+$' then (it->>'qty')::integer end;
    if v_color is null or v_color < 0 or v_color >= jsonb_array_length(p.colors)
       or v_size is null or not (v_size = any (p.sizes)) or v_qty is null or v_qty < 1 or v_qty > 10 then
      raise exception 'INVALID_OPTION' using hint = p.name || '의 옵션이 올바르지 않습니다.';
    end if;

    select qty into v_stock from public.product_stock
     where product_id = p.id and color_index = v_color and size = v_size;
    if coalesce(v_stock, 0) < v_qty then
      raise exception 'OUT_OF_STOCK' using hint = p.name || ' (' || (p.colors->v_color->>'name') || ' / ' || v_size || ') 재고가 '
        || case when coalesce(v_stock, 0) = 0 then '없습니다.' else coalesce(v_stock, 0) || '개 남아 있습니다.' end;
    end if;

    v_unit := case when p.sale > 0 then p.sale else p.price end;
    v_lines := v_lines || jsonb_build_object(
      'id', p.id, 'name', p.name, 'colorIndex', v_color, 'color', p.colors->v_color->>'name',
      'size', v_size, 'qty', v_qty, 'unit', v_unit, 'line', v_unit * v_qty, 'canceledQty', 0);
    v_subtotal := v_subtotal + v_unit * v_qty;
  end loop;

  v_ship := public.shop_shipping_fee(v_subtotal);
  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    v_code := upper(trim(p_coupon_code));
    v_disc := public.coupon_discount(v_code, v_subtotal);
  end if;
  v_total := v_subtotal - v_disc + v_ship;

  if p_amount is distinct from v_total then
    raise exception 'AMOUNT_MISMATCH' using hint = '결제 금액이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.',
      detail = 'expected ' || v_total;
  end if;

  v_name := (v_lines->0->>'name') || case when jsonb_array_length(v_lines) > 1
    then ' 외 ' || (jsonb_array_length(v_lines) - 1) || '건' else '' end;

  insert into public.orders (order_id, order_name, amount, subtotal, discount, shipping_fee, coupon_code,
                             customer_name, customer_phone, customer_email, address, address2, memo, items, user_id)
  values (p_order_id, v_name, v_total, v_subtotal, v_disc, v_ship, v_code,
          trim(p_name), p_phone, trim(p_email), trim(p_address), nullif(trim(p_address2), ''), nullif(trim(p_memo), ''),
          v_lines, auth.uid());

  return jsonb_build_object('orderId', p_order_id, 'orderName', v_name, 'amount', v_total);
end $$;

-- ---------- 결제 실패·포기 (손님 화면에서 호출) ----------
create or replace function public.mark_order_failed(p_order_id text, p_code text, p_message text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.orders
     set status = 'failed', fail_code = left(p_code, 64), fail_message = left(p_message, 300), updated_at = now()
   where order_id = p_order_id and status in ('pending', 'authorized') and not stock_reserved;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- ---------- 재고·쿠폰 되돌리기 (내부용) ----------
-- p_lines: [{index, qty}] 를 주면 그 줄만, 없으면 아직 취소되지 않은 전체 수량을 되돌립니다.
create or replace function public.release_order_resources(p_order_id text, p_lines jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; it jsonb; i integer; n integer;
begin
  select * into o from public.orders where order_id = p_order_id for update;
  if not found or not o.stock_reserved then return; end if;
  if p_lines is null then
    for i in 0 .. jsonb_array_length(o.items) - 1 loop
      it := o.items->i;
      n := (it->>'qty')::integer - coalesce((it->>'canceledQty')::integer, 0);
      if n > 0 then
        update public.product_stock set qty = qty + n, updated_at = now()
         where product_id = it->>'id' and color_index = (it->>'colorIndex')::integer and size = it->>'size';
      end if;
    end loop;
    update public.orders set stock_reserved = false where id = o.id;
    if o.coupon_counted then
      update public.coupons set used_count = greatest(used_count - 1, 0) where code = o.coupon_code;
      update public.orders set coupon_counted = false where id = o.id;
    end if;
  else
    for it in select value from jsonb_array_elements(p_lines) loop
      i := (it->>'index')::integer;
      n := (it->>'qty')::integer;
      update public.product_stock set qty = qty + n, updated_at = now()
       where product_id = o.items->i->>'id' and color_index = (o.items->i->>'colorIndex')::integer
         and size = o.items->i->>'size';
    end loop;
  end if;
end $$;

-- ---------- 결제 확정 1단계: 검증 + 재고 차감 (Edge Function 이 호출) ----------
create or replace function public.confirm_begin(p_order_id text, p_amount integer, p_payment_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; it jsonb; v_fail text; v_msg text;
begin
  select * into o from public.orders where order_id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', '주문을 찾을 수 없습니다.');
  end if;
  if o.status in ('waiting_deposit', 'confirmed', 'preparing', 'shipping', 'delivered', 'partial_canceled', 'canceled') then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_PROCESSED', 'status', o.status, 'paymentKey', o.payment_key);
  end if;
  if o.status not in ('pending', 'authorized') then
    return jsonb_build_object('ok', false, 'code', 'ORDER_CLOSED', 'message', '만료되었거나 실패한 주문입니다. 다시 주문해 주세요.');
  end if;
  if o.amount <> p_amount then
    update public.orders set status = 'failed', fail_code = 'AMOUNT_MISMATCH',
           fail_message = '결제 금액 ' || p_amount || '원 ≠ 주문 금액 ' || o.amount || '원', updated_at = now()
     where id = o.id;
    return jsonb_build_object('ok', false, 'code', 'AMOUNT_MISMATCH', 'message', '결제 금액이 주문 금액과 달라 결제를 진행하지 않았습니다.');
  end if;

  if not o.stock_reserved then
    begin
      for it in select value from jsonb_array_elements(o.items) loop
        update public.product_stock set qty = qty - (it->>'qty')::integer, updated_at = now()
         where product_id = it->>'id' and color_index = (it->>'colorIndex')::integer
           and size = it->>'size' and qty >= (it->>'qty')::integer;
        if not found then
          v_fail := 'OUT_OF_STOCK';
          v_msg := (it->>'name') || ' (' || (it->>'color') || ' / ' || (it->>'size') || ') 재고가 부족해 결제를 진행하지 않았습니다.';
          raise exception 'stop';
        end if;
      end loop;
      if o.coupon_code is not null then
        update public.coupons set used_count = used_count + 1
         where code = o.coupon_code and active and (usage_limit is null or used_count < usage_limit);
        if not found then
          v_fail := 'COUPON_EXHAUSTED';
          v_msg := '쿠폰이 모두 소진되어 결제를 진행하지 않았습니다.';
          raise exception 'stop';
        end if;
      end if;
    exception when raise_exception then
      update public.orders set status = 'failed', fail_code = v_fail, fail_message = v_msg, updated_at = now()
       where id = o.id;
      return jsonb_build_object('ok', false, 'code', v_fail, 'message', v_msg);
    end;
  end if;

  update public.orders
     set status = 'authorized', payment_key = p_payment_key, stock_reserved = true,
         coupon_counted = (coupon_code is not null), updated_at = now()
   where id = o.id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 결제 확정 2단계: 토스 응답 반영 ----------
create or replace function public.confirm_finish(p_order_id text, p_ok boolean, p_payment jsonb, p_code text, p_message text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_ok then
    update public.orders
       set status = case when p_payment->>'status' = 'WAITING_FOR_DEPOSIT' then 'waiting_deposit' else 'confirmed' end,
           payment_key = coalesce(p_payment->>'paymentKey', payment_key),
           method = p_payment->>'method',
           approved_at = nullif(p_payment->>'approvedAt', '')::timestamptz,
           receipt_url = p_payment->'receipt'->>'url',
           virtual_account = case when jsonb_typeof(p_payment->'virtualAccount') = 'object' then p_payment->'virtualAccount' end,
           fail_code = null, fail_message = null, updated_at = now()
     where order_id = p_order_id and status in ('pending', 'authorized');
  else
    perform public.release_order_resources(p_order_id);
    update public.orders
       set status = 'failed', fail_code = left(p_code, 64), fail_message = left(p_message, 300), updated_at = now()
     where order_id = p_order_id and status in ('pending', 'authorized');
  end if;
end $$;

-- ---------- 오래된 주문 만료 (pg_cron 10분마다) ----------
create or replace function public.expire_stale_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  update public.orders set status = 'expired', fail_code = 'EXPIRED', fail_message = '결제 대기 시간 초과', updated_at = now()
   where status in ('pending', 'authorized') and not stock_reserved and updated_at < now() - interval '1 hour';
  get diagnostics n = row_count;
  -- 가상계좌 입금 기한이 지난 주문은 재고를 되돌리고 만료
  for r in select order_id from public.orders
            where status = 'waiting_deposit'
              and coalesce(nullif(virtual_account->>'dueDate', '')::timestamptz, created_at + interval '7 days') < now() loop
    perform public.release_order_resources(r.order_id);
    update public.orders set status = 'expired', fail_code = 'DEPOSIT_EXPIRED', fail_message = '입금 기한 만료', updated_at = now()
     where order_id = r.order_id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- 실행 권한 ----------
revoke all on function public.release_order_resources(text, jsonb) from public, anon, authenticated;
revoke all on function public.confirm_begin(text, integer, text) from public, anon, authenticated;
revoke all on function public.confirm_finish(text, boolean, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.expire_stale_orders() from public, anon, authenticated;
revoke all on function public.coupon_discount(text, integer) from public, anon, authenticated;
grant execute on function public.release_order_resources(text, jsonb) to service_role;
grant execute on function public.confirm_begin(text, integer, text) to service_role;
grant execute on function public.confirm_finish(text, boolean, jsonb, text, text) to service_role;
grant execute on function public.expire_stale_orders() to service_role;
grant execute on function public.create_order(text, text, integer, text, text, text, text, text, text, jsonb, text) to anon, authenticated;
grant execute on function public.check_coupon(text, integer) to anon, authenticated;
grant execute on function public.mark_order_failed(text, text, text) to anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('expire-stale-orders', '*/10 * * * *', $$select public.expire_stale_orders()$$);
