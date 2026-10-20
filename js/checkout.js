/* =========================================================
   주문/결제 — 토스페이먼츠 결제위젯 v2 연동
   흐름: 위젯 렌더 → DB에 주문 생성(create_order: 금액·재고를 서버에서 재계산)
        → 결제 요청(requestPayment)
        → successUrl(?paymentKey&orderId&amount) → result.js 가 승인 서버(payments-confirm) 호출
        → failUrl(?code&message&orderId)
   ========================================================= */
(function () {
  "use strict";

  const Shop = window.Shop;
  const CFG = window.SHOP_CONFIG;
  const DB = window.ShopDB;
  const won = Shop.won;
  const esc = Shop.esc;
  const PENDING_KEY = "ridgeline_pending_order";

  const $ = function (s) { return document.querySelector(s); };
  const state = { coupon: null, widgets: null, amount: 0, busy: false };

  Shop.onReady(init);

  function init(catalogOk) {
    if (!catalogOk) {
      $("#checkout-empty").hidden = false;
      $("#checkout-empty p").textContent = Shop.catalogError || "상품 정보를 불러오지 못했습니다. 새로고침해 주세요.";
      return;
    }
    const items = Shop.Cart.items();
    if (!items.length) {
      $("#checkout-empty").hidden = false;
      return;
    }
    $("#checkout-main").hidden = false;

    if (location.protocol === "file:") {
      $("#env-warning").innerHTML =
        '<div class="test-banner warn-banner" role="alert"><span aria-hidden="true">!</span><span>' +
        "<strong>로컬 파일(file://)로 열려 있습니다.</strong> 토스페이먼츠 결제는 http(s) 주소에서만 동작합니다. " +
        "함께 들어있는 <code>serve.ps1</code>로 로컬 서버를 띄운 뒤 <code>http://localhost:8080</code>으로 접속하세요.</span></div>";
    }

    renderSummary();
    initCoupon();
    // 로그인 회원의 장바구니가 다른 기기 내용과 합쳐지면 금액을 다시 계산
    document.addEventListener("cart:change", function () {
      if (!Shop.Cart.items().length) { location.reload(); return; }
      applyAmount();
    });
    if (window.ShopMember) window.ShopMember.fillCheckout($("#order-form").elements);
    initPaymentWidget().catch(function (err) {
      console.error(err);
      const btn = $("#pay-button");
      btn.textContent = "결제 모듈을 불러오지 못했습니다";
      $("#payment-method").innerHTML =
        '<p class="test-banner warn-banner">결제위젯 로딩 실패: ' + esc(err.message || err) + "</p>";
    });
  }

  function totals() { return Shop.Cart.totals(state.coupon ? state.coupon.discount : 0); }

  /* ---------- 주문 요약 ---------- */
  function renderSummary() {
    const items = Shop.Cart.items();
    const t = totals();
    $("#summary-items").innerHTML = items.map(function (it) {
      const warn = it.stock === 0 ? "품절" : it.qty > it.stock ? "재고 " + it.stock + "개" : "";
      return '<div class="summary-item">' +
        '<div class="thumb">' + Shop.renderProductArt(it.product, it.color) + "</div>" +
        "<div><p class=\"nm\">" + esc(it.product.name) + "</p>" +
        '<p class="op">' + esc(it.product.colors[it.color].name) + " / " + esc(it.size) + " · " + it.qty + "개</p>" +
        (warn ? '<p class="stock-note is-out">' + warn + "</p>" : "") + "</div>" +
        '<span class="pr">' + won(it.line) + "</span>" +
      "</div>";
    }).join("");
    $("#sum-subtotal").textContent = won(t.subtotal + t.discount);
    $("#sum-discount").textContent = t.discount ? "-" + won(t.discount) : "0원";
    $("#sum-coupon").textContent = t.coupon ? "-" + won(t.coupon) : "0원";
    $("#sum-shipping").textContent = t.shipping ? won(t.shipping) : "무료";
    $("#sum-total").textContent = won(t.total);

    const problems = Shop.Cart.problems();
    $("#stock-warning").hidden = !problems.length;
    if (problems.length) {
      $("#stock-warning").innerHTML = '<span aria-hidden="true">!</span><span>재고가 부족한 상품이 있습니다. ' +
        '<a href="jerseys.html">장바구니</a>에서 수량을 줄이거나 삭제한 뒤 주문해 주세요.</span>';
    }
    return t;
  }

  /* ---------- 쿠폰 (F-12) ---------- */
  function initCoupon() {
    const input = $("#coupon-code");
    const msg = $("#coupon-msg");
    const btn = $("#coupon-apply");
    btn.addEventListener("click", async function () {
      if (state.coupon) {           // 적용 취소
        state.coupon = null;
        input.disabled = false; input.value = ""; btn.textContent = "적용";
        msg.textContent = ""; msg.className = "coupon-msg";
        return applyAmount();
      }
      const code = input.value.trim();
      if (!code) { msg.textContent = "쿠폰 코드를 입력해 주세요."; msg.className = "coupon-msg is-error"; return; }
      btn.disabled = true;
      const r = await DB.checkCoupon(code, Shop.Cart.totals().subtotal);
      btn.disabled = false;
      if (!r.ok) { msg.textContent = r.message; msg.className = "coupon-msg is-error"; return; }
      state.coupon = r.data;
      input.value = r.data.code; input.disabled = true; btn.textContent = "취소";
      msg.textContent = r.data.name + " · " + won(r.data.discount) + " 할인"; msg.className = "coupon-msg is-ok";
      applyAmount();
    });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); btn.click(); } });
  }

  async function applyAmount() {
    const t = renderSummary();
    state.amount = t.total;
    if (state.widgets) {
      await state.widgets.setAmount({ currency: "KRW", value: t.total });
      if (!state.busy) $("#pay-button").textContent = won(t.total) + " 결제하기";
    }
  }

  /* ---------- 토스페이먼츠 결제위젯 ---------- */
  async function initPaymentWidget() {
    if (typeof window.TossPayments !== "function") {
      throw new Error("토스페이먼츠 SDK(js.tosspayments.com)를 불러오지 못했습니다. 네트워크를 확인하세요.");
    }
    state.amount = totals().total;

    const tossPayments = window.TossPayments(CFG.TOSS_CLIENT_KEY);
    const session = DB ? await DB.session() : null;
    // 회원은 회원 ID를 customerKey 로 넘깁니다 (비회원은 ANONYMOUS)
    const widgets = tossPayments.widgets({ customerKey: session ? session.user.id : window.TossPayments.ANONYMOUS });

    // 결제 금액은 렌더링 전에 반드시 먼저 설정
    await widgets.setAmount({ currency: "KRW", value: state.amount });

    await Promise.all([
      widgets.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
      widgets.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
    ]);
    state.widgets = widgets;

    const btn = $("#pay-button");
    btn.disabled = false;
    btn.textContent = won(state.amount) + " 결제하기";
    btn.addEventListener("click", function () { pay(btn); });
  }

  async function pay(btn) {
    if (state.busy) return;
    if (Shop.Cart.problems().length) {
      renderSummary();
      $("#stock-warning").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const customer = validateForm();
    if (!customer) return;

    const items = Shop.Cart.items();
    const amount = state.amount;
    const first = items[0].product.name;
    const orderName = items.length > 1 ? first + " 외 " + (items.length - 1) + "건" : first;
    const orderId = makeOrderId();
    const reset = function () { state.busy = false; btn.disabled = false; btn.textContent = won(state.amount) + " 결제하기"; };

    state.busy = true;
    btn.disabled = true;
    btn.textContent = "주문 저장 중…";

    // 서버에 주문 생성: 금액·재고·쿠폰을 서버가 다시 계산해 다르면 거절합니다 (F-02)
    const created = await DB.createOrder({
      orderId: orderId,
      orderName: orderName,
      amount: amount,
      customer: customer,
      couponCode: state.coupon ? state.coupon.code : null,
      items: items.map(function (it) { return { id: it.id, color: it.color, size: it.size, qty: it.qty }; }),
    });
    if (!created.ok) {
      reset();
      Shop.toast(created.message);
      if (created.code === "AMOUNT_MISMATCH" || created.code === "OUT_OF_STOCK" || created.code === "PRODUCT_UNAVAILABLE") {
        // 가격·재고가 바뀌었을 수 있으니 최신 정보로 다시 그립니다
        setTimeout(function () { location.reload(); }, 1800);
      }
      return;
    }

    if (window.ShopMember && $("#save-address") && $("#save-address").checked) {
      window.ShopMember.saveCheckoutAddress(customer);
    }

    // 결과 페이지에서 주문 요약을 보여주기 위해 저장 (검증은 서버가 함)
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({
        orderId: orderId, orderName: created.data.orderName, amount: created.data.amount, createdAt: new Date().toISOString(),
      }));
    } catch (e) { /* 저장 불가 환경 */ }

    btn.textContent = "결제창 여는 중…";
    try {
      await state.widgets.requestPayment({
        orderId: orderId,
        orderName: created.data.orderName,
        successUrl: new URL("success.html", location.href).href,
        failUrl: new URL("fail.html", location.href).href,
        customerName: customer.name,
        customerEmail: customer.email,
        customerMobilePhone: customer.phone,
      });
    } catch (err) {
      // 사용자가 결제창을 닫거나 위젯 내부 검증(약관 미동의 등)에서 실패한 경우
      console.warn(err);
      DB.markFailed(orderId, (err && err.code) || "USER_CANCEL", (err && err.message) || "결제창을 닫음");
      Shop.toast(err && err.message ? err.message : "결제가 취소되었습니다.");
      reset();
    }
  }

  function makeOrderId() {
    // 6~64자, 영문 대소문자·숫자·-·_ 만 허용
    const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
    return "RL-" + Date.now() + "-" + rand;
  }

  /* ---------- 폼 검증 ---------- */
  function validateForm() {
    // form.name 은 폼 자체의 name 속성이므로 elements 로 접근
    const f = $("#order-form").elements;
    const data = {
      name: f.name.value.trim(),
      phone: f.phone.value.replace(/\D/g, ""),
      email: f.email.value.trim(),
      address: f.address.value.trim(),
      address2: f.address2.value.trim(),
      memo: f.memo.value.trim(),
    };
    const rules = [
      ["name", data.name.length >= 2, "이름을 2자 이상 입력해 주세요."],
      ["phone", /^01\d{8,9}$/.test(data.phone), "휴대폰 번호를 정확히 입력해 주세요."],
      ["email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email), "올바른 이메일 주소를 입력해 주세요."],
      ["address", data.address.length >= 5, "배송받을 주소를 입력해 주세요."],
    ];
    let firstBad = null;
    rules.forEach(function (r) {
      const input = f[r[0]];
      const hint = input.parentElement.querySelector(".hint");
      if (r[1]) { input.removeAttribute("aria-invalid"); hint.textContent = ""; }
      else {
        input.setAttribute("aria-invalid", "true");
        hint.textContent = r[2];
        if (!firstBad) firstBad = input;
      }
    });
    if (firstBad) {
      firstBad.focus();
      firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
      return null;
    }
    return data;
  }
})();
