/* =========================================================
   결제 결과 페이지 (success.html / fail.html)
   - 성공: 승인 서버(Supabase Edge Function payments-confirm)에
     { paymentKey, orderId, amount } 를 보내 최종 확정합니다(F-01).
     서버가 DB 주문 금액과 대조하고 재고를 차감한 뒤 토스 승인 API를 호출합니다.
   - 실패: 주문을 "결제 실패"로 표시합니다(F-04).
   ========================================================= */
(function () {
  "use strict";

  const Shop = window.Shop;
  const DB = window.ShopDB;
  const won = Shop.won;
  const esc = Shop.esc;
  const PENDING_KEY = "ridgeline_pending_order";
  const params = new URLSearchParams(location.search);
  const $ = function (s) { return document.querySelector(s); };

  // 토스 은행 코드 → 은행 이름 (가상계좌 안내용)
  const BANKS = {
    "39": "경남은행", "34": "광주은행", "12": "단위농협", "32": "부산은행", "45": "새마을금고", "64": "산림조합",
    "88": "신한은행", "48": "신협", "27": "씨티은행", "20": "우리은행", "71": "우체국", "50": "저축은행",
    "37": "전북은행", "35": "제주은행", "90": "카카오뱅크", "89": "케이뱅크", "92": "토스뱅크", "81": "하나은행",
    "54": "HSBC", "03": "IBK기업은행", "06": "KB국민은행", "31": "iM뱅크", "02": "KDB산업은행", "11": "NH농협은행",
    "23": "SC제일은행", "07": "수협은행",
  };

  function readPending() {
    try { return JSON.parse(sessionStorage.getItem(PENDING_KEY)); } catch (e) { return null; }
  }
  function clearPending() {
    try { sessionStorage.removeItem(PENDING_KEY); } catch (e) { /* noop */ }
  }
  function rows(list) {
    return list.map(function (r) {
      return "<div><dt>" + esc(r[0]) + "</dt><dd>" + r[1] + "</dd></div>";
    }).join("");
  }
  function fmtDate(s) {
    if (!s) return "-";
    const d = new Date(s);
    return d.getFullYear() + "년 " + (d.getMonth() + 1) + "월 " + d.getDate() + "일 " +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  Shop.onReady(function () {
    if (document.body.dataset.page === "success") handleSuccess();
    else handleFail();
  });

  /* ---------- 성공 ---------- */
  async function handleSuccess() {
    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amount = Number(params.get("amount"));
    const pending = readPending();

    if (!paymentKey || !orderId || !amount) {
      showError("잘못된 접근입니다.", "결제 정보가 없습니다. 주문을 다시 진행해 주세요.");
      return;
    }

    $("#result-title").textContent = "Processing";
    $("#result-lead").textContent = "결제를 승인하는 중입니다…";

    // 결제 인증 표시 → 최종 확정 (금액·재고 검증은 서버가 함)
    await DB.markAuthorized(orderId, amount, paymentKey);
    const r = await DB.confirmPayment({ paymentKey: paymentKey, orderId: orderId, amount: amount });
    if (!r.ok) {
      if (r.code === "NETWORK_ERROR" || r.code === "TOSS_UNREACHABLE" || r.code === "SERVER_ERROR") {
        showError("결제 승인 대기", r.message);
        $("#result-actions").innerHTML = '<button class="btn btn-primary" onclick="location.reload()">다시 시도</button>';
        return;
      }
      location.replace("fail.html?code=" + encodeURIComponent(r.code) +
        "&message=" + encodeURIComponent(r.message) + "&orderId=" + encodeURIComponent(orderId) + "&confirmed=1");
      return;
    }

    Shop.Cart.clear();
    clearPending();

    const o = (r.data && r.data.order) || {};
    const va = o.virtual_account;
    const waiting = o.status === "waiting_deposit";

    $("#result-title").textContent = waiting ? "Almost done" : "Thank you";
    $("#result-lead").innerHTML = waiting
      ? "주문이 접수되었습니다. 아래 계좌로 입금하시면 결제가 완료됩니다."
      : "결제가 완료되었습니다. 주문해 주셔서 감사합니다.";

    const list = [
      ["주문번호", "<strong class=\"order-no\">" + esc(orderId) + "</strong>"],
      ["주문상품", esc(o.order_name || (pending && pending.orderName) || "-")],
    ];
    if (o.discount) list.push(["쿠폰 할인", "-" + won(o.discount)]);
    list.push(["결제금액", won(o.amount || amount)]);
    if (o.method) list.push(["결제수단", esc(o.method)]);
    if (waiting && va) {
      list.push(["입금 계좌", esc((BANKS[va.bankCode] || va.bankCode || "") + " " + (va.accountNumber || ""))]);
      list.push(["예금주", esc(va.customerName || "RIDGELINE")]);
      list.push(["입금 기한", esc(fmtDate(va.dueDate))]);
    }
    if (o.customer_name) list.push(["주문자", esc(o.customer_name) + " · " + esc(o.customer_email || "")]);
    if (o.address) list.push(["배송지", esc(o.address + (o.address2 ? " " + o.address2 : ""))]);
    if (o.receipt_url) list.push(["영수증", '<a href="' + esc(o.receipt_url) + '" target="_blank" rel="noopener">영수증 보기</a>']);
    $("#result-table").innerHTML = rows(list);

    // 비회원 주문 조회 안내 (F-06)
    $("#result-note").hidden = false;
    $("#result-note").innerHTML = '<span aria-hidden="true">i</span><span>주문번호를 꼭 메모해 두세요. ' +
      '<a href="orders.html?orderId=' + encodeURIComponent(orderId) + '">주문 조회</a>에서 주문번호와 휴대폰 번호로 배송 상태를 확인할 수 있습니다.</span>';
  }

  function showError(title, msg) {
    $(".result-icon").innerHTML = failIcon();
    $("#result-title").textContent = title;
    $("#result-lead").textContent = msg;
    $("#result-table").innerHTML = "";
  }

  /* ---------- 실패 ---------- */
  function handleFail() {
    const code = params.get("code") || "UNKNOWN_ERROR";
    const message = params.get("message") || "결제 중 문제가 발생했습니다.";
    const orderId = params.get("orderId");
    const canceled = code === "PAY_PROCESS_CANCELED" || code === "USER_CANCEL";

    // 승인 서버가 이미 실패 처리한 경우가 아니면 여기서 실패로 표시
    if (orderId && !params.get("confirmed")) DB.markFailed(orderId, code, message);

    $("#result-title").textContent = canceled ? "Canceled" : "Payment Failed";
    $("#result-lead").textContent = canceled
      ? "결제를 취소하셨습니다. 장바구니 상품은 그대로 남아 있어요."
      : "결제를 완료하지 못했습니다. 다시 시도해 주세요.";

    const list = [["사유", esc(message)], ["에러 코드", "<code>" + esc(code) + "</code>"]];
    if (orderId) list.unshift(["주문번호", esc(orderId)]);
    $("#result-table").innerHTML = rows(list);
  }

  function failIcon() {
    return '<svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="34" fill="#e2231a"/><path d="M25 25l22 22M47 25L25 47" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>';
  }
})();
