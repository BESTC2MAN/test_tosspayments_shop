/* =========================================================
   결제 결과 페이지 (success.html / fail.html)
   ---------------------------------------------------------
   ※ 결제 승인(confirm)은 반드시 서버에서 시크릿 키로 호출해야 합니다.
      SHOP_CONFIG.CONFIRM_ENDPOINT 를 지정하면 이 페이지가
      { paymentKey, orderId, amount } 를 해당 서버로 POST 합니다.

   서버 예시 (Node/Express):
     app.post("/api/payments/confirm", async (req, res) => {
       const { paymentKey, orderId, amount } = req.body;
       // 1) DB의 주문 금액과 amount 가 같은지 반드시 검증
       const auth = Buffer.from(process.env.TOSS_SECRET_KEY + ":").toString("base64");
       const r = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
         method: "POST",
         headers: { Authorization: "Basic " + auth, "Content-Type": "application/json" },
         body: JSON.stringify({ paymentKey, orderId, amount }),
       });
       res.status(r.status).json(await r.json());
     });
   ========================================================= */
(function () {
  "use strict";

  const Shop = window.Shop;
  const CFG = window.SHOP_CONFIG;
  const won = Shop.won;
  const esc = Shop.esc;
  const PENDING_KEY = "ridgeline_pending_order";
  const params = new URLSearchParams(location.search);
  const $ = function (s) { return document.querySelector(s); };

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

  document.addEventListener("DOMContentLoaded", function () {
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
    // 금액 위변조 1차 확인 (최종 검증은 서버에서)
    if (pending && (pending.orderId !== orderId || pending.amount !== amount)) {
      showError("결제 금액이 일치하지 않습니다.", "주문 정보와 결제 금액이 달라 결제를 진행하지 않았습니다.");
      return;
    }

    let confirmed = false;
    let confirmData = null;
    if (CFG.CONFIRM_ENDPOINT) {
      $("#result-title").textContent = "Processing";
      $("#result-lead").textContent = "결제를 승인하는 중입니다…";
      try {
        const res = await fetch(CFG.CONFIRM_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentKey: paymentKey, orderId: orderId, amount: amount }),
        });
        confirmData = await res.json();
        if (!res.ok) {
          location.replace("fail.html?code=" + encodeURIComponent(confirmData.code || "CONFIRM_FAILED") +
            "&message=" + encodeURIComponent(confirmData.message || "결제 승인에 실패했습니다.") +
            "&orderId=" + encodeURIComponent(orderId));
          return;
        }
        confirmed = true;
      } catch (e) {
        showError("결제 승인 요청 실패", "승인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
    }

    // Supabase 주문 상태를 authorized 로 갱신 (금액이 일치하는 pending 주문만)
    if (window.ShopDB) await window.ShopDB.markAuthorized(orderId, amount, paymentKey);

    Shop.Cart.clear();
    clearPending();

    $("#result-title").textContent = confirmed ? "Thank you" : "Payment Authorized";
    $("#result-lead").innerHTML = confirmed
      ? "주문이 완료되었습니다. 주문 내역은 이메일로 보내드립니다."
      : "결제 인증이 완료되었습니다.<br>서버에서 결제 승인 API를 호출하면 주문이 최종 확정됩니다.";

    const list = [
      ["주문번호", esc(orderId)],
      ["주문상품", esc(pending ? pending.orderName : "-")],
      ["결제금액", won(amount)],
    ];
    if (pending && pending.customer) {
      list.push(["주문자", esc(pending.customer.name) + " · " + esc(pending.customer.email)]);
      list.push(["배송지", esc(pending.customer.address + (pending.customer.address2 ? " " + pending.customer.address2 : ""))]);
    }
    if (confirmData && confirmData.method) list.push(["결제수단", esc(confirmData.method)]);
    list.push(["paymentKey", '<code style="font-size:12px">' + esc(paymentKey) + "</code>"]);
    $("#result-table").innerHTML = rows(list);

    if (!confirmed) {
      $("#result-note").hidden = false;
    }
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
