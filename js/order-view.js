/* =========================================================
   주문 표시 공통 (주문 조회 · 마이페이지 · 관리자)
   ========================================================= */
(function (global) {
  "use strict";

  const Shop = global.Shop;
  const esc = Shop.esc;
  const won = Shop.won;

  const STATUS = {
    pending: "결제 대기", authorized: "결제 인증", waiting_deposit: "입금 대기", confirmed: "결제 완료",
    preparing: "배송 준비", shipping: "배송 중", delivered: "배송 완료",
    partial_canceled: "부분 취소", canceled: "취소됨", failed: "결제 실패", expired: "만료",
  };
  // 택배사 → 배송 조회 주소 (송장번호를 뒤에 붙임)
  const COURIERS = {
    "CJ대한통운": "https://trace.cjlogistics.com/next/tracking.html?wblNo=",
    "우체국택배": "https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=",
    "한진택배": "https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=",
    "롯데택배": "https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=",
    "로젠택배": "https://www.ilogen.com/web/personal/trace/",
  };
  const BANKS = {
    "39": "경남은행", "34": "광주은행", "12": "단위농협", "32": "부산은행", "45": "새마을금고", "64": "산림조합",
    "88": "신한은행", "48": "신협", "27": "씨티은행", "20": "우리은행", "71": "우체국", "50": "저축은행",
    "37": "전북은행", "35": "제주은행", "90": "카카오뱅크", "89": "케이뱅크", "92": "토스뱅크", "81": "하나은행",
    "54": "HSBC", "03": "IBK기업은행", "06": "KB국민은행", "31": "iM뱅크", "02": "KDB산업은행", "11": "NH농협은행",
    "23": "SC제일은행", "07": "수협은행",
  };

  function statusHTML(s) {
    return '<span class="status s-' + esc(s) + '">' + esc(STATUS[s] || s) + "</span>";
  }
  function fmtDate(s, time) {
    if (!s) return "-";
    const d = new Date(s);
    const day = d.getFullYear() + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + String(d.getDate()).padStart(2, "0");
    return time ? day + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") : day;
  }
  function trackingHTML(courier, no) {
    if (!no) return "";
    const base = COURIERS[courier];
    const label = esc((courier || "") + " " + no);
    return base ? '<a href="' + esc(base + encodeURIComponent(no)) + '" target="_blank" rel="noopener">' + label + " 배송 조회</a>" : label;
  }
  function lineArt(it) {
    const p = Shop.findProduct(it.id);
    return p ? Shop.renderProductArt(p, it.colorIndex || 0) : "";
  }

  /* opts.actions(it, index, order) → 줄 오른쪽에 붙일 버튼 HTML */
  function orderCardHTML(o, opts) {
    opts = opts || {};
    const items = o.items || [];
    const va = o.virtual_account;
    const lines = items.map(function (it, i) {
      const canceled = it.canceledQty ? '<p class="canceled">' + it.canceledQty + "개 취소됨</p>" : "";
      return '<div class="order-line">' +
        '<div class="order-line-media">' + lineArt(it) + "</div>" +
        '<div><p class="nm">' + esc(it.name) + '</p><p class="op">' + esc(it.color) + " / " + esc(it.size) + " · " + it.qty + "개</p>" + canceled + "</div>" +
        '<div class="act"><span>' + won(it.line || 0) + "</span>" + (opts.actions ? opts.actions(it, i, o) : "") + "</div>" +
      "</div>";
    }).join("");
    const meta = [];
    meta.push("<div>결제 금액 <b>" + won(o.amount) + "</b>" +
      (o.discount ? " (쿠폰 -" + won(o.discount) + ")" : "") +
      (o.shipping_fee ? " · 배송비 " + won(o.shipping_fee) : "") + (o.method ? " · " + esc(o.method) : "") + "</div>");
    if (o.canceled_amount) meta.push("<div>환불 금액 <b>" + won(o.canceled_amount) + "</b></div>");
    if (o.status === "waiting_deposit" && va) {
      meta.push("<div>입금 계좌 <b>" + esc((BANKS[va.bankCode] || va.bankCode || "") + " " + (va.accountNumber || "")) +
        "</b> · 기한 " + esc(fmtDate(va.dueDate, true)) + "</div>");
    }
    if (o.address) meta.push("<div>배송지 " + esc(o.address + (o.address2 ? " " + o.address2 : "")) + "</div>");
    if (o.tracking_no) meta.push("<div>송장 " + trackingHTML(o.courier, o.tracking_no) + "</div>");
    if (o.receipt_url) meta.push('<div><a href="' + esc(o.receipt_url) + '" target="_blank" rel="noopener">영수증 보기</a></div>');
    if ((o.status === "failed" || o.status === "expired") && o.fail_message) meta.push("<div>사유 " + esc(o.fail_message) + "</div>");

    return '<article class="order-card">' +
      '<div class="order-card-head"><div><p class="no">' + esc(o.order_id) + '</p><p class="date">' + esc(fmtDate(o.created_at, true)) + "</p></div>" +
        statusHTML(o.status) + "</div>" +
      lines +
      '<div class="order-meta">' + meta.join("") + "</div>" +
    "</article>";
  }

  Shop.STATUS = STATUS;
  Shop.COURIERS = COURIERS;
  Shop.statusHTML = statusHTML;
  Shop.fmtDate = fmtDate;
  Shop.trackingHTML = trackingHTML;
  Shop.orderCardHTML = orderCardHTML;
})(window);
