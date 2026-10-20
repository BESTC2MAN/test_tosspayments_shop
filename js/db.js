/* =========================================================
   Supabase 주문 저장 (REST RPC 호출, SDK/빌드 불필요)
   - publishable 키만 사용합니다. orders 테이블은 RLS로 직접 접근이 막혀 있고
     create_order / mark_order_authorized 함수로만 쓸 수 있습니다.
   - 저장 실패가 결제 흐름을 막지 않도록 에러는 삼키고 false 를 반환합니다.
   ========================================================= */
(function () {
  "use strict";

  const CFG = window.SHOP_CONFIG;

  async function rpc(fn, body) {
    if (!CFG.SUPABASE_URL || !CFG.SUPABASE_KEY) return null;
    try {
      const res = await fetch(CFG.SUPABASE_URL + "/rest/v1/rpc/" + fn, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: CFG.SUPABASE_KEY,
          Authorization: "Bearer " + CFG.SUPABASE_KEY,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(fn + " " + res.status + " " + (await res.text()));
      const text = await res.text();
      return text ? JSON.parse(text) : true;
    } catch (e) {
      console.warn("[supabase]", e);
      return false;
    }
  }

  window.ShopDB = {
    createOrder: function (o) {
      return rpc("create_order", {
        p_order_id: o.orderId,
        p_order_name: o.orderName,
        p_amount: o.amount,
        p_name: o.customer.name,
        p_phone: o.customer.phone,
        p_email: o.customer.email,
        p_address: o.customer.address,
        p_address2: o.customer.address2 || null,
        p_memo: o.customer.memo || null,
        p_items: o.items,
      });
    },
    markAuthorized: function (orderId, amount, paymentKey) {
      return rpc("mark_order_authorized", {
        p_order_id: orderId,
        p_amount: amount,
        p_payment_key: paymentKey,
      });
    },
  };
})();
