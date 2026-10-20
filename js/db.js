/* =========================================================
   Supabase 연동 (supabase-js UMD, 빌드 불필요)
   - publishable 키만 사용합니다. 테이블 접근 범위는 RLS 정책과
     SECURITY DEFINER 함수로 제한됩니다. service_role 키는 넣지 않습니다.
   - 모든 함수는 예외를 던지지 않고 { ok, data } 또는
     { ok: false, code, message } 를 돌려줍니다. message 는 손님에게 보여줄 문구입니다.
   ========================================================= */
(function () {
  "use strict";

  const CFG = window.SHOP_CONFIG;
  const sb = window.supabase && CFG.SUPABASE_URL
    ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

  function fail(error, fallback) {
    console.warn("[supabase]", error);
    const code = (error && error.message) || "NETWORK_ERROR";
    const known = /^[A-Z_]+$/.test(code);
    return {
      ok: false,
      code: known ? code : "SERVER_ERROR",
      message: (error && error.hint) || fallback || "잠시 후 다시 시도해 주세요.",
    };
  }
  async function call(promise, fallback) {
    if (!sb) return fail({ message: "NOT_CONFIGURED" }, "DB 연결 설정이 없습니다.");
    try {
      const res = await promise;
      if (res.error) return fail(res.error, fallback);
      return { ok: true, data: res.data };
    } catch (e) {
      return fail({ message: "NETWORK_ERROR" }, "서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.");
    }
  }
  const rpc = function (fn, args, fallback) { return call(sb && sb.rpc(fn, args), fallback); };

  async function uid() {
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session ? data.session.user.id : null;
  }

  window.ShopDB = {
    sb: sb,

    /* ---------- 상품 (F-03, F-05) ---------- */
    fetchCatalog: function () {
      return call(sb && sb.from("products").select("*, product_stock(color_index, size, qty)").order("sort"),
        "상품을 불러오지 못했습니다.");
    },

    /* ---------- 주문·결제 (F-01, F-02, F-04, F-12) ---------- */
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
        p_coupon_code: o.couponCode || null,
      }, "주문을 저장하지 못했습니다.");
    },
    checkCoupon: function (code, subtotal) {
      return rpc("check_coupon", { p_code: code, p_subtotal: subtotal }, "쿠폰을 확인하지 못했습니다.");
    },
    markAuthorized: function (orderId, amount, paymentKey) {
      return rpc("mark_order_authorized", { p_order_id: orderId, p_amount: amount, p_payment_key: paymentKey });
    },
    markFailed: function (orderId, code, message) {
      return rpc("mark_order_failed", { p_order_id: orderId, p_code: code, p_message: message });
    },
    confirmPayment: async function (body) {
      try {
        const res = await fetch(CFG.CONFIRM_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: CFG.SUPABASE_KEY },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(function () { return {}; });
        if (!res.ok) return { ok: false, code: data.code || "CONFIRM_FAILED", message: data.message || "결제 승인에 실패했습니다." };
        return { ok: true, data: data };
      } catch (e) {
        return { ok: false, code: "NETWORK_ERROR", message: "승인 서버에 연결하지 못했습니다. 새로고침해 다시 시도해 주세요." };
      }
    },

    /* ---------- 비회원 주문 조회 (F-06) ---------- */
    lookupOrder: function (orderId, contact) {
      return rpc("lookup_order", { p_order_id: orderId, p_contact: contact }, "주문을 조회하지 못했습니다.");
    },

    /* ---------- 회원 (F-07, F-08) ---------- */
    session: async function () {
      if (!sb) return null;
      const { data } = await sb.auth.getSession();
      return data.session;
    },
    onAuthChange: function (fn) {
      if (sb) sb.auth.onAuthStateChange(function (event, session) { fn(event, session); });
    },
    signIn: function (email, password) {
      return call(sb && sb.auth.signInWithPassword({ email: email, password: password }), "이메일 또는 비밀번호가 맞지 않습니다.");
    },
    signUp: function (email, password, name) {
      return call(sb && sb.auth.signUp({
        email: email, password: password,
        options: { data: { name: name }, emailRedirectTo: new URL("account.html", location.href).href },
      }), "가입하지 못했습니다.");
    },
    signInWithProvider: function (provider) {
      return call(sb && sb.auth.signInWithOAuth({
        provider: provider, options: { redirectTo: new URL("account.html", location.href).href },
      }), "간편 로그인을 시작하지 못했습니다.");
    },
    resetPassword: function (email) {
      return call(sb && sb.auth.resetPasswordForEmail(email, { redirectTo: new URL("login.html?mode=update", location.href).href }),
        "재설정 메일을 보내지 못했습니다.");
    },
    updatePassword: function (password) {
      return call(sb && sb.auth.updateUser({ password: password }), "비밀번호를 바꾸지 못했습니다.");
    },
    signOut: function () { return call(sb && sb.auth.signOut()); },
    profile: async function () {
      const id = await uid();
      if (!id) return { ok: false, code: "NOT_SIGNED_IN", message: "로그인이 필요합니다." };
      return call(sb.from("profiles").select("*").eq("id", id).maybeSingle());
    },
    updateProfile: async function (fields) {
      const id = await uid();
      return call(sb.from("profiles").update(fields).eq("id", id), "회원 정보를 저장하지 못했습니다.");
    },
    myOrders: function () {
      return call(sb && sb.from("orders").select("order_id, order_name, status, amount, discount, shipping_fee, items, " +
        "method, created_at, courier, tracking_no, canceled_amount, virtual_account, receipt_url")
        .not("status", "in", "(pending,expired)").order("created_at", { ascending: false }).limit(50),
        "주문 내역을 불러오지 못했습니다.");
    },
    addresses: function () {
      return call(sb && sb.from("addresses").select("*").order("is_default", { ascending: false }).order("created_at"));
    },
    saveAddress: async function (a) {
      const id = await uid();
      const row = Object.assign({}, a, { user_id: id });
      return call(a.id ? sb.from("addresses").update(row).eq("id", a.id) : sb.from("addresses").insert(row),
        "배송지를 저장하지 못했습니다.");
    },
    deleteAddress: function (id) { return call(sb && sb.from("addresses").delete().eq("id", id)); },
    setDefaultAddress: function (id) { return rpc("set_default_address", { p_id: id }); },

    /* ---------- 장바구니 동기화 (F-09) ---------- */
    getCart: function () {
      return call(sb && sb.from("cart_items").select("product_id, color_index, size, qty"));
    },
    replaceCart: function (items) {
      return rpc("replace_cart", { p_items: items });
    },

    /* ---------- 찜 (F-10) ---------- */
    wishlist: function () { return call(sb && sb.from("wishlist").select("product_id, created_at").order("created_at", { ascending: false })); },
    addWish: async function (productId) {
      const id = await uid();
      return call(sb.from("wishlist").upsert({ user_id: id, product_id: productId }, { onConflict: "user_id,product_id" }));
    },
    removeWish: function (productId) { return call(sb && sb.from("wishlist").delete().eq("product_id", productId)); },

    /* ---------- 리뷰 (F-11) ---------- */
    reviews: function (productId) {
      return call(sb && sb.from("reviews").select("id, rating, content, author_name, color, size, created_at")
        .eq("product_id", productId).order("created_at", { ascending: false }).limit(20));
    },
    myReviews: function () { return call(sb && sb.from("reviews").select("order_id, product_id")); },
    createReview: function (r) {
      return rpc("create_review", {
        p_order_id: r.orderId, p_product_id: r.productId, p_rating: r.rating, p_content: r.content,
      }, "리뷰를 저장하지 못했습니다.");
    },

    /* ---------- 관리자 (F-13~F-15) ---------- */
    isAdmin: async function () {
      const r = await rpc("is_admin", {});
      return r.ok && r.data === true;
    },
    adminFunction: async function (name, body) {
      const s = await this.session();
      if (!s) return { ok: false, code: "NOT_SIGNED_IN", message: "로그인이 필요합니다." };
      try {
        const res = await fetch(CFG.SUPABASE_URL + "/functions/v1/" + name, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: CFG.SUPABASE_KEY, Authorization: "Bearer " + s.access_token },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(function () { return {}; });
        if (!res.ok) return { ok: false, code: data.code || "FAILED", message: data.message || "요청을 처리하지 못했습니다." };
        return { ok: true, data: data };
      } catch (e) {
        return { ok: false, code: "NETWORK_ERROR", message: "서버에 연결하지 못했습니다." };
      }
    },
    call: call,
    rpc: rpc,
  };
})();
