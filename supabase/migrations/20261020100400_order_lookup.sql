-- F-06 비회원 주문 조회: 주문번호 + 주문 때 쓴 휴대폰 번호(또는 이메일)가 모두 맞을 때만 주문 하나를 돌려줌
create or replace function public.lookup_order(p_order_id text, p_contact text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o public.orders%rowtype; v_contact text := trim(coalesce(p_contact, ''));
begin
  if length(v_contact) < 5 or coalesce(p_order_id, '') !~ '^[A-Za-z0-9_-]{6,64}$' then
    raise exception 'INVALID_LOOKUP' using hint = '주문번호와 휴대폰 번호를 정확히 입력해 주세요.';
  end if;
  select * into o from public.orders
   where order_id = trim(p_order_id)
     and (customer_phone = regexp_replace(v_contact, '[^0-9]', '', 'g') or lower(customer_email) = lower(v_contact));
  if not found then
    raise exception 'ORDER_NOT_FOUND' using hint = '일치하는 주문이 없습니다. 주문번호와 연락처를 확인해 주세요.';
  end if;
  return jsonb_build_object(
    'order_id', o.order_id, 'order_name', o.order_name, 'status', o.status, 'created_at', o.created_at,
    'amount', o.amount, 'subtotal', o.subtotal, 'discount', o.discount, 'shipping_fee', o.shipping_fee,
    'canceled_amount', o.canceled_amount, 'method', o.method, 'items', o.items,
    'customer_name', o.customer_name, 'address', o.address, 'address2', o.address2,
    'courier', o.courier, 'tracking_no', o.tracking_no, 'shipped_at', o.shipped_at, 'delivered_at', o.delivered_at,
    'virtual_account', case when o.status = 'waiting_deposit' then o.virtual_account end,
    'receipt_url', o.receipt_url, 'fail_message', o.fail_message);
end $$;
grant execute on function public.lookup_order(text, text) to anon, authenticated;
