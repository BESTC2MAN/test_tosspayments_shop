/* =========================================================
   마이페이지 (F-08 주문 내역·배송지, F-10 찜, F-11 리뷰 작성)
   ========================================================= */
(function () {
  "use strict";

  const Shop = window.Shop;
  const DB = window.ShopDB;
  const esc = Shop.esc;
  const won = Shop.won;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const REVIEWABLE = ["confirmed", "preparing", "shipping", "delivered", "partial_canceled"];
  const TABS = ["orders", "wishlist", "addresses", "profile"];
  const CLOSE_BTN = '<button class="icon-btn" data-close aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  let user = null;

  Shop.onReady(async function () {
    const s = await DB.session();
    if (!s) { location.replace("login.html?next=account.html"); return; }
    user = s.user;
    const prof = await DB.profile();
    const p = prof.ok && prof.data ? prof.data : {};
    $("#hello").textContent = (p.name || user.email) + "님, 반가워요";
    if (p.role === "admin") $("#admin-link").hidden = false;
    $("#logout").addEventListener("click", async function () { await DB.signOut(); location.href = "jerseys.html"; });

    $$("[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () { history.replaceState(null, "", "#" + b.dataset.tab); showTab(b.dataset.tab); });
    });
    initProfile(p);
    $("#add-address").addEventListener("click", function () { openAddress(null); });
    const h = location.hash.slice(1);
    showTab(TABS.indexOf(h) > -1 ? h : "orders");
  });

  function showTab(name) {
    $$("[data-tab]").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === name)); });
    TABS.forEach(function (t) { $("#tab-" + t).hidden = t !== name; });
    if (name === "orders") loadOrders();
    if (name === "wishlist") loadWishlist();
    if (name === "addresses") loadAddresses();
  }

  /* ---------- 주문 내역 + 리뷰 쓰기 ---------- */
  async function loadOrders() {
    const box = $("#orders-list");
    const [r, rv] = await Promise.all([DB.myOrders(), DB.myReviews()]);
    if (!r.ok) { box.innerHTML = '<p class="empty-box">' + esc(r.message) + "</p>"; return; }
    if (!r.data.length) {
      box.innerHTML = '<p class="empty-box">아직 주문 내역이 없어요.<br><br><a class="btn btn-primary" href="jerseys.html">쇼핑하러 가기</a></p>';
      return;
    }
    const done = {};
    (rv.ok ? rv.data : []).forEach(function (x) { done[x.order_id + "|" + x.product_id] = true; });
    box.innerHTML = r.data.map(function (o) {
      return Shop.orderCardHTML(o, {
        actions: function (it, i, order) {
          if (REVIEWABLE.indexOf(order.status) < 0 || (it.canceledQty || 0) >= it.qty) return "";
          if (done[order.order_id + "|" + it.id]) return '<span style="font-size:12px;color:var(--gray-500)">리뷰 완료</span>';
          return '<button class="btn btn-outline btn-sm" type="button" data-review="' + esc(order.order_id) + '" data-product="' + esc(it.id) +
            '" data-name="' + esc(it.name) + '">리뷰 쓰기</button>';
        },
      });
    }).join("");
    $$("[data-review]", box).forEach(function (b) {
      b.addEventListener("click", function () { openReview(b.dataset.review, b.dataset.product, b.dataset.name); });
    });
  }

  function openReview(orderId, productId, name) {
    const dlg = $("#review-dialog");
    dlg.innerHTML = '<div class="sheet-head"><h2>리뷰 쓰기</h2>' + CLOSE_BTN + "</div>" +
      '<form class="sheet-body form-stack" id="review-form" novalidate>' +
        "<p><b>" + esc(name) + "</b></p>" +
        '<div><p style="font-size:13px;font-weight:700;margin-bottom:6px">별점</p><div class="star-input">' +
          [5, 4, 3, 2, 1].map(function (n) {
            return '<input type="radio" name="rating" id="star' + n + '" value="' + n + '"' + (n === 5 ? " checked" : "") + '><label for="star' + n + '" aria-label="' + n + '점">★</label>';
          }).join("") + "</div></div>" +
        '<div class="field"><label for="rv-content">내용 (10자 이상)</label><textarea id="rv-content" name="content" maxlength="1000" placeholder="사이즈, 핏, 소재 등 다른 분들께 도움이 되는 이야기를 남겨 주세요."></textarea></div>' +
        '<button class="btn btn-primary" type="submit">등록</button><p class="form-msg"></p>' +
      "</form>";
    $("[data-close]", dlg).addEventListener("click", function () { dlg.close(); });
    $("#review-form", dlg).addEventListener("submit", async function (e) {
      e.preventDefault();
      const f = this;
      const content = f.elements.content.value.trim();
      const m = $(".form-msg", f);
      if (content.length < 10) { m.textContent = "내용을 10자 이상 써 주세요."; m.className = "form-msg is-error"; return; }
      $("button[type=submit]", f).disabled = true;
      const r = await DB.createReview({ orderId: orderId, productId: productId, rating: Number(f.elements.rating.value), content: content });
      $("button[type=submit]", f).disabled = false;
      if (!r.ok) { m.textContent = r.message; m.className = "form-msg is-error"; return; }
      dlg.close();
      Shop.toast("리뷰를 등록했어요. 감사합니다!");
      loadOrders();
    });
    dlg.showModal();
  }

  /* ---------- 찜한 상품 ---------- */
  async function loadWishlist() {
    const box = $("#wish-list");
    const r = await DB.wishlist();
    if (!r.ok) { box.innerHTML = '<p class="empty-box">' + esc(r.message) + "</p>"; return; }
    const list = r.data.map(function (w) { return Shop.findProduct(w.product_id); }).filter(Boolean);
    if (!list.length) { box.innerHTML = '<p class="empty-box">찜한 상품이 없어요. 상품 사진의 하트를 눌러 보세요.</p>'; return; }
    box.innerHTML = '<div class="wish-grid">' + list.map(function (p) {
      const page = Shop.CATEGORIES[p.cat].page;
      return '<article class="product-card"><a href="' + page + "#p=" + esc(p.id) + '"><div class="product-media">' + Shop.renderProductArt(p, 0) + "</div></a>" +
        '<div class="product-info"><h3 class="product-name"><a href="' + page + "#p=" + esc(p.id) + '">' + esc(p.name) + "</a></h3>" +
        '<p class="price"><span>' + won(p.sale || p.price) + "</span></p>" +
        '<button class="remove-link" type="button" data-unwish="' + esc(p.id) + '">찜 해제</button></div></article>';
    }).join("") + "</div>";
    $$("[data-unwish]", box).forEach(function (b) {
      b.addEventListener("click", async function () { await DB.removeWish(b.dataset.unwish); loadWishlist(); });
    });
  }

  /* ---------- 배송지 ---------- */
  async function loadAddresses() {
    const box = $("#address-list");
    const r = await DB.addresses();
    if (!r.ok) { box.innerHTML = '<p class="empty-box">' + esc(r.message) + "</p>"; return; }
    if (!r.data.length) { box.innerHTML = '<p class="empty-box">저장된 배송지가 없어요. 주문할 때 저장하거나 아래에서 추가해 주세요.</p>'; return; }
    box.innerHTML = r.data.map(function (a) {
      return '<div class="address-card"><div><p class="lbl">' + esc(a.label || a.recipient) + (a.is_default ? '<span class="def">기본</span>' : "") + "</p>" +
        "<p>" + esc(a.recipient) + " · " + esc(a.phone) + "</p><p>" + esc(a.address + (a.address2 ? " " + a.address2 : "")) + "</p></div>" +
        '<div class="acts">' + (a.is_default ? "" : '<button type="button" data-default="' + a.id + '">기본으로</button>') +
        '<button type="button" data-edit="' + a.id + '">수정</button><button type="button" data-del="' + a.id + '">삭제</button></div></div>';
    }).join("");
    $$("[data-default]", box).forEach(function (b) { b.addEventListener("click", async function () { await DB.setDefaultAddress(b.dataset.default); loadAddresses(); }); });
    $$("[data-edit]", box).forEach(function (b) {
      b.addEventListener("click", function () { openAddress(r.data.find(function (a) { return a.id === b.dataset.edit; })); });
    });
    $$("[data-del]", box).forEach(function (b) {
      b.addEventListener("click", async function () {
        if (!confirm("이 배송지를 삭제할까요?")) return;
        await DB.deleteAddress(b.dataset.del);
        loadAddresses();
      });
    });
  }

  function openAddress(a) {
    const dlg = $("#address-dialog");
    const v = function (k) { return esc(a && a[k] ? a[k] : ""); };
    dlg.innerHTML = '<div class="sheet-head"><h2>' + (a ? "배송지 수정" : "배송지 추가") + "</h2>" + CLOSE_BTN + "</div>" +
      '<form class="sheet-body form-grid" id="address-form" novalidate>' +
        '<div class="field"><label for="ad-label">배송지 이름</label><input id="ad-label" name="label" value="' + v("label") + '" placeholder="집, 회사" maxlength="20"></div>' +
        '<div class="field"><label for="ad-name">받는 분</label><input id="ad-name" name="recipient" value="' + v("recipient") + '"></div>' +
        '<div class="field full"><label for="ad-phone">휴대폰 번호</label><input id="ad-phone" name="phone" value="' + v("phone") + '" inputmode="numeric" placeholder="01012345678"></div>' +
        '<div class="field full"><label for="ad-addr">주소</label><input id="ad-addr" name="address" value="' + v("address") + '"></div>' +
        '<div class="field full"><label for="ad-addr2">상세 주소</label><input id="ad-addr2" name="address2" value="' + v("address2") + '"></div>' +
        (a ? "" : '<label class="check-row full"><input type="checkbox" name="is_default"> 기본 배송지로 설정</label>') +
        '<div class="full"><button class="btn btn-primary" type="submit">저장</button><p class="form-msg"></p></div>' +
      "</form>";
    $("[data-close]", dlg).addEventListener("click", function () { dlg.close(); });
    $("#address-form", dlg).addEventListener("submit", async function (e) {
      e.preventDefault();
      const f = this.elements;
      const m = $(".form-msg", this);
      const row = {
        label: f.label.value.trim() || null, recipient: f.recipient.value.trim(), phone: f.phone.value.replace(/\D/g, ""),
        address: f.address.value.trim(), address2: f.address2.value.trim() || null,
      };
      if (!a) row.is_default = f.is_default.checked;
      else row.id = a.id;
      const bad = row.recipient.length < 2 ? "받는 분 이름을 입력해 주세요." : !/^01\d{8,9}$/.test(row.phone) ? "휴대폰 번호를 확인해 주세요." :
        row.address.length < 5 ? "주소를 입력해 주세요." : "";
      if (bad) { m.textContent = bad; m.className = "form-msg is-error"; return; }
      const r = await DB.saveAddress(row);
      if (!r.ok) { m.textContent = r.message; m.className = "form-msg is-error"; return; }
      dlg.close();
      loadAddresses();
    });
    dlg.showModal();
  }

  /* ---------- 회원 정보 ---------- */
  function initProfile(p) {
    const f = $("#profile-form");
    f.elements.name.value = p.name || "";
    f.elements.phone.value = p.phone || "";
    f.elements.email.value = user.email;
    f.addEventListener("submit", async function (e) {
      e.preventDefault();
      const m = $(".form-msg", f);
      const phone = f.elements.phone.value.replace(/\D/g, "");
      if (phone && !/^01\d{8,9}$/.test(phone)) { m.textContent = "휴대폰 번호를 확인해 주세요."; m.className = "form-msg is-error"; return; }
      const r = await DB.updateProfile({ name: f.elements.name.value.trim() || null, phone: phone || null });
      m.textContent = r.ok ? "저장했어요." : r.message;
      m.className = "form-msg " + (r.ok ? "is-ok" : "is-error");
    });
    const pf = $("#password-form");
    pf.addEventListener("submit", async function (e) {
      e.preventDefault();
      const m = $(".form-msg", pf);
      const a = pf.elements.password.value;
      const b = pf.elements.password2.value;
      if (a.length < 8) { m.textContent = "비밀번호는 8자 이상으로 정해 주세요."; m.className = "form-msg is-error"; return; }
      if (a !== b) { m.textContent = "두 비밀번호가 다릅니다."; m.className = "form-msg is-error"; return; }
      const r = await DB.updatePassword(a);
      m.textContent = r.ok ? "비밀번호를 바꿨어요." : r.message;
      m.className = "form-msg " + (r.ok ? "is-ok" : "is-error");
      if (r.ok) pf.reset();
    });
  }
})();
