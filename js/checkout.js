/* =========================================================
   주문/결제 — 토스페이먼츠 결제위젯 v2 연동
   흐름: 위젯 렌더 → 결제 요청(requestPayment)
        → successUrl(?paymentKey&orderId&amount) / failUrl(?code&message)
        → 서버에서 결제 승인 API 호출(success.js 참고)
   ========================================================= */
(function () {
  "use strict";

  const Shop = window.Shop;
  const CFG = window.SHOP_CONFIG;
  const won = Shop.won;
  const esc = Shop.esc;
  const PENDING_KEY = "ridgeline_pending_order";

  const $ = function (s) { return document.querySelector(s); };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
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

    renderSummary(items);
    initPaymentWidget().catch(function (err) {
      console.error(err);
      const btn = $("#pay-button");
      btn.textContent = "결제 모듈을 불러오지 못했습니다";
      $("#payment-method").innerHTML =
        '<p class="test-banner warn-banner">결제위젯 로딩 실패: ' + esc(err.message || err) + "</p>";
    });
  }

  /* ---------- 주문 요약 ---------- */
  function renderSummary(items) {
    const t = Shop.Cart.totals();
    $("#summary-items").innerHTML = items.map(function (it) {
      return '<div class="summary-item">' +
        '<div class="thumb">' + Shop.renderProductArt(it.product, it.color) + "</div>" +
        "<div><p class=\"nm\">" + esc(it.product.name) + "</p>" +
        '<p class="op">' + esc(it.product.colors[it.color].name) + " / " + esc(it.size) + " · " + it.qty + "개</p></div>" +
        '<span class="pr">' + won(it.line) + "</span>" +
      "</div>";
    }).join("");
    $("#sum-subtotal").textContent = won(t.subtotal + t.discount);
    $("#sum-discount").textContent = t.discount ? "-" + won(t.discount) : "0원";
    $("#sum-shipping").textContent = t.shipping ? won(t.shipping) : "무료";
    $("#sum-total").textContent = won(t.total);
  }

  /* ---------- 토스페이먼츠 결제위젯 ---------- */
  async function initPaymentWidget() {
    if (typeof window.TossPayments !== "function") {
      throw new Error("토스페이먼츠 SDK(js.tosspayments.com)를 불러오지 못했습니다. 네트워크를 확인하세요.");
    }
    const amount = Shop.Cart.totals().total;

    const tossPayments = window.TossPayments(CFG.TOSS_CLIENT_KEY);
    // 회원 결제라면 회원 고유 ID(UUID 등)를 customerKey로 넘기세요.
    const widgets = tossPayments.widgets({ customerKey: window.TossPayments.ANONYMOUS });

    // 결제 금액은 렌더링 전에 반드시 먼저 설정
    await widgets.setAmount({ currency: "KRW", value: amount });

    await Promise.all([
      widgets.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
      widgets.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
    ]);

    const btn = $("#pay-button");
    btn.disabled = false;
    btn.textContent = won(amount) + " 결제하기";
    btn.addEventListener("click", function () { pay(widgets, amount, btn); });
  }

  async function pay(widgets, amount, btn) {
    const customer = validateForm();
    if (!customer) return;

    const items = Shop.Cart.items();
    const first = items[0].product.name;
    const orderName = items.length > 1 ? first + " 외 " + (items.length - 1) + "건" : first;
    const orderId = makeOrderId();

    // 성공 페이지에서 금액 위변조 여부를 확인하기 위해 저장
    // (실서비스에서는 서버 DB에 주문을 먼저 생성하고, 승인 시 서버에서 금액을 대조해야 합니다)
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({
        orderId: orderId,
        orderName: orderName,
        amount: amount,
        customer: customer,
        items: items.map(function (it) {
          return { id: it.id, name: it.product.name, color: it.product.colors[it.color].name, size: it.size, qty: it.qty, line: it.line };
        }),
        createdAt: new Date().toISOString(),
      }));
    } catch (e) { /* 저장 불가 환경 */ }

    btn.disabled = true;
    btn.textContent = "결제창 여는 중…";
    try {
      await widgets.requestPayment({
        orderId: orderId,
        orderName: orderName,
        successUrl: new URL("success.html", location.href).href,
        failUrl: new URL("fail.html", location.href).href,
        customerName: customer.name,
        customerEmail: customer.email,
        customerMobilePhone: customer.phone,
      });
    } catch (err) {
      // 사용자가 결제창을 닫거나 위젯 내부 검증(약관 미동의 등)에서 실패한 경우
      console.warn(err);
      Shop.toast(err && err.message ? err.message : "결제가 취소되었습니다.");
      btn.disabled = false;
      btn.textContent = won(amount) + " 결제하기";
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
