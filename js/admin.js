/* =========================================================
   관리자 페이지 (F-13 주문 관리, F-14 상품·재고, F-15 취소·환불, F-17 사진, F-12 쿠폰)
   - 접근 권한은 DB에서 막습니다(RLS의 is_admin(), admin_* 함수, payments-cancel 함수).
     이 화면의 권한 확인은 안내용입니다.
   ========================================================= */
(function () {
  "use strict";

  const Shop = window.Shop;
  const DB = window.ShopDB;
  const sb = DB.sb;
  const esc = Shop.esc;
  const won = Shop.won;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  const PAID = ["confirmed", "preparing", "shipping", "delivered", "partial_canceled"];
  const SHIP_STATUSES = ["confirmed", "preparing", "shipping", "delivered"];
  const VIEWS = [["front", "앞면"], ["back", "뒷면"], ["detail", "디테일"]];
  const state = { products: [] };

  Shop.onReady(async function () {
    const s = await DB.session();
    if (!s) { location.replace("login.html?next=admin.html"); return; }
    $("#admin-email").textContent = s.user.email;
    $("#admin-logout").addEventListener("click", async function () { await DB.signOut(); location.href = "login.html"; });
    $("#admin-loading").hidden = true;
    if (!(await DB.isAdmin())) {
      $("#no-access-email").textContent = s.user.email;
      $("#no-access").hidden = false;
      return;
    }
    $("#admin-main").hidden = false;
    $$("[data-tab]").forEach(function (b) { b.addEventListener("click", function () { showTab(b.dataset.tab); }); });
    $("#order-filters").addEventListener("submit", function (e) { e.preventDefault(); loadOrders(); });
    $("#new-product").addEventListener("click", function () { openProduct(null); });
    $("#coupon-form").addEventListener("submit", createCoupon);
    showTab("dash");
  });

  function showTab(name) {
    $$("[data-tab]").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === name)); });
    ["dash", "orders", "products", "coupons"].forEach(function (t) { $("#tab-" + t).hidden = t !== name; });
    if (name === "dash") loadDash();
    if (name === "orders") loadOrders();
    if (name === "products") loadProducts();
    if (name === "coupons") loadCoupons();
  }

  function errorRow(table, cols, msg) {
    table.innerHTML = '<tbody><tr><td colspan="' + cols + '" class="empty-box">' + esc(msg) + "</td></tr></tbody>";
  }

  /* ---------- 대시보드 ---------- */
  async function loadDash() {
    const st = await DB.rpc("admin_stats", {});
    const s = st.ok ? st.data : {};
    $("#stats").innerHTML = [
      ["오늘 주문", (s.today_orders || 0) + "건"],
      ["오늘 매출", won(s.today_sales || 0)],
      ["배송 대기", (s.to_ship || 0) + "건"],
      ["재고 3개 이하 옵션", (s.low_stock || 0) + "개"],
    ].map(function (x) { return '<div class="stat"><p class="k">' + x[0] + '</p><p class="v">' + x[1] + "</p></div>"; }).join("");
    const r = await DB.call(sb.from("orders").select("order_id, order_name, customer_name, amount, status, created_at")
      .not("status", "in", "(pending,expired,failed)").order("created_at", { ascending: false }).limit(10));
    if (!r.ok) return errorRow($("#recent-table"), 5, r.message);
    renderOrderRows($("#recent-table"), r.data);
  }

  /* ---------- 주문 목록 ---------- */
  async function loadOrders() {
    const f = $("#order-filters").elements;
    let q = sb.from("orders").select("order_id, order_name, customer_name, customer_phone, amount, canceled_amount, status, created_at", { count: "exact" })
      .order("created_at", { ascending: false }).limit(100);
    if (f.status.value === "paid") q = q.in("status", PAID);
    else if (f.status.value) q = q.eq("status", f.status.value);
    if (f.from.value) q = q.gte("created_at", f.from.value + "T00:00:00+09:00");
    if (f.to.value) q = q.lte("created_at", f.to.value + "T23:59:59.999+09:00");
    const kw = f.q.value.trim().replace(/[,()*%]/g, "");
    if (kw) {
      const digits = kw.replace(/\D/g, "");
      q = q.or("order_id.ilike.%" + kw + "%,customer_name.ilike.%" + kw + "%" + (digits.length >= 4 ? ",customer_phone.ilike.%" + digits + "%" : ""));
    }
    const r = await DB.call(q);
    if (!r.ok) return errorRow($("#orders-table"), 6, r.message);
    $("#order-count").textContent = "검색 결과 " + r.data.length + "건 (최근 100건까지 표시)";
    renderOrderRows($("#orders-table"), r.data, true);
  }

  function renderOrderRows(table, list, withPhone) {
    if (!list.length) return errorRow(table, 6, "주문이 없습니다.");
    table.innerHTML = "<thead><tr><th>주문일시</th><th>주문번호</th><th>주문자</th><th>상품</th><th class=\"num\">금액</th><th>상태</th></tr></thead><tbody>" +
      list.map(function (o) {
        return '<tr data-order="' + esc(o.order_id) + '"><td>' + esc(Shop.fmtDate(o.created_at, true)) + "</td><td>" + esc(o.order_id) +
          "</td><td>" + esc(o.customer_name) + (withPhone && o.customer_phone ? "<br><small>" + esc(o.customer_phone) + "</small>" : "") +
          "</td><td>" + esc(o.order_name) + '</td><td class="num">' + won(o.amount) +
          (o.canceled_amount ? '<br><small style="color:var(--accent)">-' + won(o.canceled_amount) + "</small>" : "") +
          "</td><td>" + Shop.statusHTML(o.status) + "</td></tr>";
      }).join("") + "</tbody>";
    $$("tr[data-order]", table).forEach(function (tr) { tr.addEventListener("click", function () { openOrder(tr.dataset.order); }); });
  }

  /* ---------- 주문 상세 · 배송 처리 · 취소 ---------- */
  async function openOrder(orderId) {
    const dlg = $("#order-dialog");
    const r = await DB.call(sb.from("orders").select("*").eq("order_id", orderId).maybeSingle());
    if (!r.ok || !r.data) { Shop.toast(r.message || "주문을 찾을 수 없습니다."); return; }
    const o = r.data;
    const requestId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).replace(/[^A-Za-z0-9-]/g, "");
    const canShip = SHIP_STATUSES.indexOf(o.status) > -1 || o.status === "partial_canceled";
    const canCancel = ["waiting_deposit"].concat(PAID).indexOf(o.status) > -1 && o.payment_key;

    const items = (o.items || []).map(function (it, i) {
      const left = it.qty - (it.canceledQty || 0);
      return "<tr><td>" + esc(it.name) + "<br><small>" + esc(it.color) + " / " + esc(it.size) + "</small></td>" +
        '<td class="num">' + won(it.unit) + '</td><td class="num">' + it.qty + (it.canceledQty ? ' <small style="color:var(--accent)">(-' + it.canceledQty + ")</small>" : "") +
        '</td><td class="num">' + won(it.line) + "</td>" +
        (canCancel && o.status !== "waiting_deposit"
          ? '<td class="num"><input type="number" min="0" max="' + left + '" value="0" data-cancel="' + i + '" aria-label="취소 수량"' + (left ? "" : " disabled") + "></td>"
          : "<td></td>") + "</tr>";
    }).join("");

    const couriers = Object.keys(Shop.COURIERS);
    dlg.innerHTML =
      '<div class="sheet-head"><h2>주문 상세</h2><button class="icon-btn" data-close aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="sheet-body">' +
        '<dl class="kv">' +
          kv("주문번호", esc(o.order_id)) + kv("상태", Shop.statusHTML(o.status)) +
          kv("주문일시", esc(Shop.fmtDate(o.created_at, true))) +
          kv("주문자", esc(o.customer_name) + " · " + esc(o.customer_phone) + " · " + esc(o.customer_email) + (o.user_id ? " <small>(회원)</small>" : " <small>(비회원)</small>")) +
          kv("배송지", esc(o.address + (o.address2 ? " " + o.address2 : ""))) +
          (o.memo ? kv("배송 메모", esc(o.memo)) : "") +
          kv("결제", won(o.amount) + " (상품 " + won(o.subtotal) + (o.discount ? " · 쿠폰 " + esc(o.coupon_code) + " -" + won(o.discount) : "") +
            " · 배송비 " + won(o.shipping_fee) + ")" + (o.method ? " · " + esc(o.method) : "")) +
          (o.approved_at ? kv("승인 시각", esc(Shop.fmtDate(o.approved_at, true))) : "") +
          (o.canceled_amount ? kv("환불", won(o.canceled_amount) + (o.cancel_reason ? " · " + esc(o.cancel_reason) : "")) : "") +
          (o.fail_message ? kv("실패 사유", esc(o.fail_code + " · " + o.fail_message)) : "") +
          (o.tracking_no ? kv("송장", Shop.trackingHTML(o.courier, o.tracking_no)) : "") +
        "</dl>" +
        '<div class="table-wrap"><table class="data-table cancel-lines"><thead><tr><th>상품</th><th class="num">단가</th><th class="num">수량</th><th class="num">금액</th><th class="num">' +
          (canCancel && o.status !== "waiting_deposit" ? "취소 수량" : "") + "</th></tr></thead><tbody>" + items + "</tbody></table></div>" +

        (canShip ? '<h3 class="section-title">배송 처리</h3><div class="form-grid">' +
          '<div class="field"><label for="o-status">배송 상태</label><select id="o-status">' +
            SHIP_STATUSES.concat(o.status === "partial_canceled" ? ["partial_canceled"] : []).map(function (s) {
              return '<option value="' + s + '"' + (s === o.status ? " selected" : "") + ">" + Shop.STATUS[s] + "</option>";
            }).join("") + "</select></div>" +
          '<div class="field"><label for="o-courier">택배사</label><select id="o-courier"><option value="">선택</option>' +
            couriers.map(function (c) { return '<option' + (c === o.courier ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select></div>" +
          '<div class="field full"><label for="o-tracking">송장번호</label><input id="o-tracking" value="' + esc(o.tracking_no || "") + '" inputmode="numeric"></div>' +
          '<div class="full"><button class="btn btn-primary btn-sm" type="button" id="o-save">배송 정보 저장</button><p class="form-msg" id="o-ship-msg"></p></div>' +
        "</div>" : "") +

        (canCancel ? '<h3 class="section-title">결제 취소 · 환불</h3>' +
          '<div class="field"><label for="o-reason">취소 사유</label><input id="o-reason" placeholder="예) 고객 요청, 품절"></div>' +
          '<div class="filters" style="margin-top:10px">' +
            '<button class="btn btn-accent btn-sm" type="button" id="o-cancel-all">전체 취소 (' + won(o.amount - o.canceled_amount) + ")</button>" +
            (o.status !== "waiting_deposit" ? '<button class="btn btn-outline btn-sm" type="button" id="o-cancel-part">선택 수량만 부분 취소</button>' : "") +
          "</div><p class=\"form-msg\" id=\"o-cancel-msg\"></p>" : "") +
      "</div>";

    $("[data-close]", dlg).addEventListener("click", function () { dlg.close(); });
    if (canShip) {
      $("#o-save").addEventListener("click", async function () {
        const m = $("#o-ship-msg");
        const res = await DB.rpc("admin_update_order", {
          p_order_id: o.order_id, p_status: $("#o-status").value, p_courier: $("#o-courier").value, p_tracking_no: $("#o-tracking").value,
        });
        if (!res.ok) { m.textContent = res.message; m.className = "form-msg is-error"; return; }
        Shop.toast("배송 정보를 저장했습니다.");
        refreshAfter(o.order_id);
      });
    }
    if (canCancel) {
      const doCancel = async function (partial) {
        const m = $("#o-cancel-msg");
        const reason = $("#o-reason").value.trim();
        if (!reason) { m.textContent = "취소 사유를 입력해 주세요."; m.className = "form-msg is-error"; return; }
        let lines = null;
        if (partial) {
          lines = $$("[data-cancel]", dlg).map(function (inp) { return { index: Number(inp.dataset.cancel), qty: Number(inp.value) }; })
            .filter(function (l) { return l.qty > 0; });
          if (!lines.length) { m.textContent = "취소할 수량을 입력해 주세요."; m.className = "form-msg is-error"; return; }
        }
        if (!confirm(partial ? "선택한 수량을 부분 취소하고 환불할까요?" : "이 주문을 전체 취소하고 환불할까요?")) return;
        m.textContent = "취소 요청 중…"; m.className = "form-msg";
        const res = await DB.adminFunction("payments-cancel", { orderId: o.order_id, reason: reason, lines: lines, requestId: requestId + (partial ? "-p" : "-a") });
        if (!res.ok) { m.textContent = res.message; m.className = "form-msg is-error"; return; }
        Shop.toast(won(res.data.refunded) + " 환불 처리했습니다.");
        refreshAfter(o.order_id);
      };
      $("#o-cancel-all").addEventListener("click", function () { doCancel(false); });
      if ($("#o-cancel-part")) $("#o-cancel-part").addEventListener("click", function () { doCancel(true); });
    }
    if (!dlg.open) dlg.showModal();
  }

  function refreshAfter(orderId) {
    openOrder(orderId);
    if (!$("#tab-orders").hidden) loadOrders(); else loadDash();
  }
  function kv(k, v) { return "<dt>" + esc(k) + "</dt><dd>" + v + "</dd>"; }

  /* ---------- 상품·재고 ---------- */
  async function loadProducts() {
    const r = await DB.call(sb.from("products").select("*, product_stock(color_index, size, qty)").order("sort"));
    if (!r.ok) return errorRow($("#products-table"), 7, r.message);
    state.products = r.data;
    const table = $("#products-table");
    table.innerHTML = "<thead><tr><th></th><th>ID</th><th>상품명</th><th>분류</th><th class=\"num\">판매가</th><th class=\"num\">재고</th><th>상태</th></tr></thead><tbody>" +
      r.data.map(function (row) {
        const p = Shop.fromRow(row, row.product_stock);
        const total = (row.product_stock || []).reduce(function (s, x) { return s + x.qty; }, 0);
        const low = (row.product_stock || []).filter(function (x) { return x.qty <= 3; }).length;
        return '<tr data-product="' + esc(row.id) + '"><td><div class="thumb">' + Shop.renderProductArt(p, 0) + "</div></td><td>" + esc(row.id) +
          "</td><td>" + esc(row.name) + "</td><td>" + esc(Shop.CATEGORIES[row.cat].ko + " · " + row.sub) + '</td><td class="num">' +
          (row.sale ? won(row.sale) + '<br><small style="text-decoration:line-through;color:var(--gray-500)">' + won(row.price) + "</small>" : won(row.price)) +
          '</td><td class="num">' + total + "개" + (low ? '<br><small style="color:var(--accent)">부족 ' + low + "개 옵션</small>" : "") +
          "</td><td>" + (row.active ? '<span class="status s-delivered">판매 중</span>' : '<span class="status">판매 중지</span>') + "</td></tr>";
      }).join("") + "</tbody>";
    $$("tr[data-product]", table).forEach(function (tr) { tr.addEventListener("click", function () { openProduct(tr.dataset.product); }); });
  }

  function openProduct(id) {
    const dlg = $("#product-dialog");
    const row = id ? state.products.find(function (p) { return p.id === id; }) : null;
    const isNew = !row;
    // 편집 상태: 색상(원본 옵션 유지), 사이즈, 재고, 사진
    const ed = {
      cat: row ? row.cat : "jersey",
      colors: row ? row.colors.map(function (c) { return Object.assign({}, c); }) : [{ name: "홈", body: "#c8102e" }],
      fixedColors: row ? row.colors.length : 0,
      sizes: row ? row.sizes.slice() : ["S", "M", "L", "XL", "XXL"],
      stock: {},
      images: row ? Object.assign({}, row.images) : {},
      files: {},
    };
    (row ? row.product_stock : []).forEach(function (s) { ed.stock[s.color_index + "|" + s.size] = s.qty; });

    const v = function (k, d) { return esc(row && row[k] != null ? row[k] : d); };
    dlg.innerHTML =
      '<div class="sheet-head"><h2>' + (isNew ? "새 상품 등록" : "상품 수정") + '</h2><button class="icon-btn" data-close aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<form class="sheet-body" id="product-form" novalidate><div class="form-grid">' +
        field("상품 ID (영문 대문자·숫자·-)", '<input name="id" value="' + v("id", "") + '"' + (isNew ? ' placeholder="FK-NEW" required' : " readonly") + ">") +
        field("카테고리", '<select name="cat"' + (isNew ? "" : " disabled") + '><option value="jersey"' + (ed.cat === "jersey" ? " selected" : "") +
          '>축구복</option><option value="windbreaker"' + (ed.cat === "windbreaker" ? " selected" : "") + ">바람막이</option></select>") +
        field("상품명", '<input name="name" value="' + v("name", "") + '" required>', true) +
        field("세부 분류 (필터 칩)", '<input name="sub" value="' + v("sub", "") + '" placeholder="프리미어리그 / 트레이닝">') +
        field("바람막이 형태", '<select name="type">' + ["track", "anorak", "packable", "shell"].map(function (t) {
          return '<option value="' + t + '"' + (row && row.type === t ? " selected" : "") + ">" + { track: "풀집 트랙", anorak: "하프집 아노락", packable: "경량 후드", shell: "방수 쉘" }[t] + "</option>";
        }).join("") + "</select>") +
        field("정가(원)", '<input name="price" type="number" min="100" value="' + v("price", "") + '" required>') +
        field("할인가(원, 0=할인 없음)", '<input name="sale" type="number" min="0" value="' + v("sale", 0) + '">') +
        field("배지", '<select name="badge">' + [["", "없음"], ["best", "Best"], ["new", "New"], ["sale", "Sale"]].map(function (b) {
          return '<option value="' + b[0] + '"' + ((row ? row.badge : "") === b[0] ? " selected" : "") + ">" + b[1] + "</option>";
        }).join("") + "</select>") +
        field("노출 순서 (작을수록 앞)", '<input name="sort" type="number" value="' + v("sort", 999) + '">') +
        field("구단 약칭 (축구복 구단 바로가기, 예: LIV)", '<input name="club" value="' + v("club", "") + '" maxlength="4">') +
        field("구단 한글 약칭 (예: 리버풀)", '<input name="club_short" value="' + v("club_short", "") + '">') +
        field("설명", '<textarea name="description">' + v("description", "") + "</textarea>", true) +
        '<label class="check-row full"><input type="checkbox" name="active"' + (!row || row.active ? " checked" : "") + "> 판매 중 (끄면 목록에서 숨기고 주문을 막습니다)</label>" +
      "</div>" +
      '<h3 class="section-title">색상</h3><div id="pf-colors"></div><button type="button" class="btn btn-outline btn-sm" id="pf-add-color">색상 추가</button>' +
      '<h3 class="section-title">사이즈</h3><div class="field"><input id="pf-sizes" value="' + esc(ed.sizes.join(", ")) + '" aria-label="사이즈 (쉼표로 구분)"></div>' +
      '<h3 class="section-title">재고 (색상 × 사이즈)</h3><div class="table-wrap" style="border:0"><table class="stock-grid" id="pf-stock"></table></div>' +
      '<h3 class="section-title">사진 <small style="font-weight:400;color:var(--gray-500)">없으면 자동 일러스트 사용 · JPG/PNG/WebP 5MB 이하</small></h3><div class="photo-slots" id="pf-photos"></div>' +
      '<p class="form-msg" id="pf-msg"></p>' +
      "</form>" +
      '<div class="sheet-foot"><button class="btn btn-outline btn-sm" type="button" data-close>닫기</button><button class="btn btn-primary btn-sm" type="button" id="pf-save">저장</button></div>';

    const form = $("#product-form", dlg);
    $$("[data-close]", dlg).forEach(function (b) { b.addEventListener("click", function () { dlg.close(); }); });

    function syncType() { form.elements.type.closest(".field").hidden = ed.cat !== "windbreaker"; }
    form.elements.cat.addEventListener("change", function () {
      ed.cat = form.elements.cat.value;
      ed.colors = ed.colors.map(function (c) { return ed.cat === "jersey" ? { name: c.name, body: c.hex || c.body } : { name: c.name, hex: c.body || c.hex }; });
      syncType(); drawColors(); drawPhotos();
    });
    syncType();

    function colorHex(c) { return c.body || c.hex || "#888888"; }
    function drawColors() {
      $("#pf-colors", dlg).innerHTML = ed.colors.map(function (c, i) {
        return '<div class="filters" data-ci="' + i + '"><input type="color" value="' + esc(colorHex(c)) + '" aria-label="' + (ed.cat === "jersey" ? "몸판 색" : "색상") + '">' +
          '<input value="' + esc(c.name) + '" placeholder="색상 이름" aria-label="색상 이름">' +
          (i >= ed.fixedColors ? '<button type="button" class="btn btn-outline btn-sm" data-del>삭제</button>' : "") + "</div>";
      }).join("");
      $$("[data-ci]", dlg).forEach(function (rowEl) {
        const i = Number(rowEl.dataset.ci);
        const inputs = $$("input", rowEl);
        inputs[0].addEventListener("input", function () {
          if (ed.cat === "jersey") ed.colors[i].body = inputs[0].value; else ed.colors[i].hex = inputs[0].value;
          drawPhotos();
        });
        inputs[1].addEventListener("input", function () { ed.colors[i].name = inputs[1].value; drawStock(); });
        const del = $("[data-del]", rowEl);
        if (del) del.addEventListener("click", function () { ed.colors.splice(i, 1); drawColors(); drawStock(); drawPhotos(); });
      });
    }
    $("#pf-add-color", dlg).addEventListener("click", function () {
      ed.colors.push(ed.cat === "jersey" ? { name: "새 색상", body: "#1f2a44" } : { name: "새 색상", hex: "#1f2a44" });
      drawColors(); drawStock();
    });
    $("#pf-sizes", dlg).addEventListener("change", function () {
      ed.sizes = this.value.split(",").map(function (s) { return s.trim().toUpperCase(); }).filter(function (s, i, a) { return s && a.indexOf(s) === i; });
      drawStock();
    });

    function drawStock() {
      $$("#pf-stock input", dlg).forEach(function (inp) { ed.stock[inp.dataset.k] = Number(inp.value) || 0; });
      $("#pf-stock", dlg).innerHTML = "<tr><th></th>" + ed.sizes.map(function (s) { return "<th>" + esc(s) + "</th>"; }).join("") + "</tr>" +
        ed.colors.map(function (c, ci) {
          return "<tr><th>" + esc(c.name) + "</th>" + ed.sizes.map(function (s) {
            const k = ci + "|" + s;
            return '<td><input type="number" min="0" data-k="' + esc(k) + '" value="' + (ed.stock[k] || 0) + '" aria-label="' + esc(c.name + " " + s + " 재고") + '"></td>';
          }).join("") + "</tr>";
        }).join("");
    }
    function previewProduct() {
      return Shop.fromRow({ id: "PREVIEW", cat: ed.cat, type: form.elements.type.value, colors: ed.colors, sizes: ed.sizes, images: {}, name: "", price: 1 }, []);
    }
    function drawPhotos() {
      const p = previewProduct();
      $("#pf-photos", dlg).innerHTML = VIEWS.map(function (vw) {
        const src = ed.files[vw[0]] ? URL.createObjectURL(ed.files[vw[0]]) : ed.images[vw[0]];
        return '<div class="photo-slot"><div class="pv">' + (src ? '<img src="' + esc(src) + '" alt="">' : Shop.renderProductArt(p, 0, vw[0])) + "</div>" +
          "<strong>" + vw[1] + '</strong><input type="file" accept="image/jpeg,image/png,image/webp" data-view="' + vw[0] + '" aria-label="' + vw[1] + ' 사진">' +
          (src ? '<button type="button" data-remove="' + vw[0] + '">사진 지우기</button>' : "") + "</div>";
      }).join("");
      $$("#pf-photos input[type=file]", dlg).forEach(function (inp) {
        inp.addEventListener("change", function () {
          const file = inp.files[0];
          if (!file) return;
          if (file.size > 5 * 1024 * 1024) { Shop.toast("5MB 이하 사진만 올릴 수 있습니다."); return; }
          ed.files[inp.dataset.view] = file;
          drawPhotos();
        });
      });
      $$("#pf-photos [data-remove]", dlg).forEach(function (b) {
        b.addEventListener("click", function () { delete ed.files[b.dataset.remove]; delete ed.images[b.dataset.remove]; drawPhotos(); });
      });
    }
    form.elements.type.addEventListener("change", drawPhotos);
    drawColors(); drawStock(); drawPhotos();

    $("#pf-save", dlg).addEventListener("click", async function () {
      const msg = $("#pf-msg", dlg);
      const btn = this;
      drawStock();   // 입력 중인 재고 값 반영
      const f = form.elements;
      const data = {
        id: f.id.value.trim().toUpperCase(),
        cat: ed.cat,
        name: f.name.value.trim(),
        sub: f.sub.value.trim() || "기타",
        type: ed.cat === "windbreaker" ? f.type.value : null,
        price: Number(f.price.value),
        sale: Number(f.sale.value) || 0,
        badge: f.badge.value,
        sort: Number(f.sort.value) || 0,
        club: f.club.value.trim().toUpperCase() || null,
        club_short: f.club_short.value.trim() || null,
        description: f.description.value.trim(),
        active: f.active.checked,
        colors: ed.colors.map(function (c) { return Object.assign({}, c, { name: (c.name || "").trim() || "색상" }); }),
        sizes: ed.sizes,
      };
      const bad = !/^[A-Z0-9-]{2,32}$/.test(data.id) ? "상품 ID는 영문 대문자·숫자·-로 2~32자입니다." :
        !data.name ? "상품명을 입력해 주세요." :
        !(data.price > 0) ? "정가를 입력해 주세요." :
        data.sale && data.sale >= data.price ? "할인가는 정가보다 낮아야 합니다." :
        !data.colors.length ? "색상을 1개 이상 넣어 주세요." :
        !data.sizes.length ? "사이즈를 1개 이상 넣어 주세요." : "";
      if (bad) { msg.textContent = bad; msg.className = "form-msg is-error"; return; }

      btn.disabled = true;
      msg.textContent = "저장 중…"; msg.className = "form-msg";
      // 사진 업로드 (F-17)
      const images = Object.assign({}, ed.images);
      for (const view of Object.keys(ed.files)) {
        const file = ed.files[view];
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z]/g, "");
        const path = data.id + "/" + view + "-" + Date.now() + "." + ext;
        const up = await DB.call(sb.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false }), "사진을 올리지 못했습니다.");
        if (!up.ok) { btn.disabled = false; msg.textContent = up.message; msg.className = "form-msg is-error"; return; }
        images[view] = sb.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      }
      data.images = images;

      const saved = await DB.call(isNew ? sb.from("products").insert(data) : sb.from("products").update(data).eq("id", data.id),
        "상품을 저장하지 못했습니다.");
      if (!saved.ok) {
        btn.disabled = false;
        msg.textContent = saved.code === "SERVER_ERROR" && isNew ? "저장하지 못했습니다. 이미 있는 상품 ID인지 확인해 주세요." : saved.message;
        msg.className = "form-msg is-error";
        return;
      }
      const stockRows = [];
      data.colors.forEach(function (c, ci) {
        data.sizes.forEach(function (s) { stockRows.push({ product_id: data.id, color_index: ci, size: s, qty: Math.max(0, ed.stock[ci + "|" + s] || 0) }); });
      });
      const st = await DB.call(sb.from("product_stock").upsert(stockRows, { onConflict: "product_id,color_index,size" }), "재고를 저장하지 못했습니다.");
      btn.disabled = false;
      if (!st.ok) { msg.textContent = st.message; msg.className = "form-msg is-error"; return; }
      Shop.toast("상품을 저장했습니다.");
      dlg.close();
      loadProducts();
    });

    dlg.showModal();
  }

  function field(label, control, full) {
    return '<div class="field' + (full ? " full" : "") + '"><label>' + esc(label) + "</label>" + control + "</div>";
  }

  /* ---------- 쿠폰 ---------- */
  async function loadCoupons() {
    const r = await DB.call(sb.from("coupons").select("*").order("created_at", { ascending: false }));
    const table = $("#coupons-table");
    if (!r.ok) return errorRow(table, 7, r.message);
    if (!r.data.length) return errorRow(table, 7, "쿠폰이 없습니다.");
    table.innerHTML = "<thead><tr><th>코드</th><th>이름</th><th>할인</th><th class=\"num\">최소 주문</th><th>기간</th><th class=\"num\">사용</th><th>상태</th></tr></thead><tbody>" +
      r.data.map(function (c) {
        return "<tr><td><b>" + esc(c.code) + "</b></td><td>" + esc(c.name) + "</td><td>" +
          (c.kind === "percent" ? c.value + "%" + (c.max_discount ? " (최대 " + won(c.max_discount) + ")" : "") : won(c.value)) +
          '</td><td class="num">' + won(c.min_order) + "</td><td>" + (c.starts_at ? esc(Shop.fmtDate(c.starts_at)) : "") + " ~ " + (c.ends_at ? esc(Shop.fmtDate(c.ends_at)) : "") +
          '</td><td class="num">' + c.used_count + (c.usage_limit ? " / " + c.usage_limit : "") + "</td>" +
          '<td><button class="btn btn-outline btn-sm" data-toggle="' + esc(c.code) + '" data-active="' + c.active + '">' + (c.active ? "사용 중 · 끄기" : "꺼짐 · 켜기") + "</button></td></tr>";
      }).join("") + "</tbody>";
    $$("[data-toggle]", table).forEach(function (b) {
      b.addEventListener("click", async function (e) {
        e.stopPropagation();
        const res = await DB.call(sb.from("coupons").update({ active: b.dataset.active !== "true" }).eq("code", b.dataset.toggle));
        if (!res.ok) Shop.toast(res.message);
        loadCoupons();
      });
    });
  }

  async function createCoupon(e) {
    e.preventDefault();
    const f = e.target.elements;
    const msg = $("#coupon-form-msg");
    const num = function (x) { return x.value === "" ? null : Number(x.value); };
    const row = {
      code: f.code.value.trim().toUpperCase(), name: f.name.value.trim(), kind: f.kind.value, value: Number(f.value.value),
      min_order: Number(f.min_order.value) || 0, max_discount: f.kind.value === "percent" ? num(f.max_discount) : null,
      starts_at: f.starts_at.value ? f.starts_at.value + "T00:00:00+09:00" : null,
      ends_at: f.ends_at.value ? f.ends_at.value + "T23:59:59+09:00" : null,
      usage_limit: num(f.usage_limit),
    };
    const bad = !/^[A-Z0-9_-]{3,32}$/.test(row.code) ? "코드는 영문 대문자·숫자·_·-로 3~32자입니다." :
      !row.name ? "쿠폰 이름을 입력해 주세요." :
      !(row.value > 0) ? "할인 값을 입력해 주세요." :
      row.kind === "percent" && row.value > 100 ? "정률 할인은 100% 이하입니다." : "";
    if (bad) { msg.textContent = bad; msg.className = "form-msg is-error"; return; }
    const r = await DB.call(sb.from("coupons").insert(row), "쿠폰을 만들지 못했습니다. 이미 있는 코드인지 확인해 주세요.");
    if (!r.ok) { msg.textContent = r.message; msg.className = "form-msg is-error"; return; }
    msg.textContent = "쿠폰을 만들었습니다."; msg.className = "form-msg is-ok";
    e.target.reset();
    loadCoupons();
  }
})();
