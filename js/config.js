/* =========================================================
   쇼핑몰 / 토스페이먼츠 설정
   ---------------------------------------------------------
   TOSS_CLIENT_KEY
   - 지금 값은 토스페이먼츠 개발자센터 문서에 공개된 "결제위젯 연동 테스트 키"입니다.
   - 실제 서비스에서는 개발자센터 > API 키 메뉴의
     "결제위젯 연동 키 > 클라이언트 키(test_gck_... / live_gck_...)"로 교체하세요.
   - 시크릿 키(…_gsk_…)는 절대 프론트엔드에 넣지 마세요. 결제 승인은 서버에서 합니다.
   ========================================================= */
window.SHOP_CONFIG = {
  STORE_NAME: "RIDGELINE",
  TOSS_CLIENT_KEY: "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm",

  // 화면 표시용. 실제 금액은 DB 함수(shop_shipping_fee)가 다시 계산하므로 바꿀 때는 두 곳을 함께 고칩니다.
  SHIPPING_FEE: 3000,
  FREE_SHIPPING_OVER: 70000,

  // Supabase. publishable 키는 공개되어도 되는 키이며,
  // 접근 범위는 DB의 RLS/함수 권한으로 제한됩니다. service_role 키는 절대 넣지 마세요.
  SUPABASE_URL: "https://uvvyedkoyelpjrydzheh.supabase.co",
  SUPABASE_KEY: "sb_publishable_FiTMSnZDIg_wnBMynGYV9Q_ScZHTUBI",
};

// 결제 승인(confirm) 서버: Supabase Edge Function (supabase/functions/payments-confirm)
window.SHOP_CONFIG.CONFIRM_ENDPOINT = window.SHOP_CONFIG.SUPABASE_URL + "/functions/v1/payments-confirm";
