-- Supabase 보안 점검 반영: 트리거 전용 함수 직접 호출 차단, search_path 고정
revoke all on function public.handle_new_user() from public, anon, authenticated;
alter function public.shop_shipping_fee(integer) set search_path = public;
alter function public.profiles_guard_role() set search_path = public;
