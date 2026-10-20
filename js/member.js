/* =========================================================
   회원 공통 기능 (모든 페이지)
   - 헤더 계정 아이콘: 로그인 상태에 따라 login.html / account.html (F-07)
   - 장바구니 동기화: 로그인하면 계정 장바구니(cart_items)와 합치고, 이후 변경을 저장 (F-09)
   - 주문서: 회원 정보·기본 배송지 자동 입력, 배송지 저장 (F-08)
   ========================================================= */
(function (global) {
  "use strict";

  const Shop = global.Shop;
  const DB = global.ShopDB;
  const esc = Shop.esc;
  const OWNER_KEY = "ridgeline_cart_owner";   // 지금 로컬 장바구니가 어느 회원 것과 동기화됐는지
  const USER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>';

  const lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* noop */ } };

  let session = null;

  /* ---------- 헤더 계정 아이콘 ---------- */
  function renderAccountLink() {
    let link = document.querySelector(".account-link");
    const actions = document.querySelector(".site-header .header-actions");
    if (!link && actions) {
      link = document.createElement("a");
      link.className = "icon-btn account-link";
      link.innerHTML = USER_ICON;
      const cartBtn = actions.querySelector("[data-open-cart]");
      actions.insertBefore(link, cartBtn || null);
    }
    if (!link) return;
    link.href = session ? "account.html" : "login.html";
    link.setAttribute("aria-label", session ? "마이페이지" : "로그인");
    link.classList.toggle("is-member", !!session);
  }

  /* ---------- 장바구니 동기화 ---------- */
  function toServer(list) {
    return list.map(function (it) { return { id: it.id, color: it.color, size: it.size, qty: it.qty }; });
  }
  async function syncCart() {
    const uid = session.user.id;
    const r = await DB.getCart();
    if (!r.ok) return;
    const server = r.data.map(function (s) {
      return { key: Shop.Cart.key(s.product_id, s.color_index, s.size), id: s.product_id, color: s.color_index, size: s.size, qty: s.qty };
    });
    let merged = server;
    if (lsGet(OWNER_KEY) !== uid) {
      // 비회원으로 담은 상품을 계정 장바구니에 합침 (같은 옵션은 더 많은 수량)
      const map = {};
      server.concat(Shop.Cart.load()).forEach(function (it) {
        map[it.key] = map[it.key] ? Object.assign({}, it, { qty: Math.min(10, Math.max(map[it.key].qty, it.qty)) }) : Object.assign({}, it);
      });
      merged = Object.keys(map).map(function (k) { return map[k]; });
      lsSet(OWNER_KEY, uid);
      if (JSON.stringify(toServer(merged)) !== JSON.stringify(toServer(server))) DB.replaceCart(toServer(merged));
    }
    Shop.Cart.replace(merged.filter(function (it) { return Shop.findProduct(it.id); }));
  }
  let pushTimer;
  document.addEventListener("cart:change", function (e) {
    if (e.detail && e.detail.synced) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async function () {
      // 시작 직후(세션 확인 전)의 변경도 놓치지 않도록 그때그때 세션을 확인
      const s = await DB.session();
      if (s && lsGet(OWNER_KEY) === s.user.id) DB.replaceCart(toServer(Shop.Cart.load()));
    }, 400);
  });

  /* ---------- 시작 ---------- */
  Shop.onReady(async function () {
    session = await DB.session();
    renderAccountLink();
    if (session && document.body.dataset.page !== "success") syncCart();
  });
  DB.onAuthChange(function (event, s) {
    if (event === "SIGNED_OUT") {
      session = null;
      lsSet(OWNER_KEY, null);
      Shop.Cart.replace([]);   // 공용 기기에서 다음 사람에게 장바구니가 보이지 않도록
      renderAccountLink();
    } else if (event === "SIGNED_IN" && s && (!session || session.user.id !== s.user.id)) {
      session = s;
      renderAccountLink();
    }
  });

  /* ---------- 주문서 자동 입력 (F-08) ---------- */
  async function fillCheckout(f) {
    const box = document.getElementById("member-box");
    const s = await DB.session();
    if (!s) {
      if (box) box.innerHTML = '<span>회원이면 저장한 배송지를 불러올 수 있어요.</span><a href="login.html?next=checkout.html">로그인</a>';
      return;
    }
    const row = document.getElementById("save-address-row");
    if (row) row.hidden = false;
    const [prof, addrs] = await Promise.all([DB.profile(), DB.addresses()]);
    const p = prof.ok && prof.data ? prof.data : {};
    const list = addrs.ok ? addrs.data : [];
    const setIfEmpty = function (el, v) { if (el && !el.value && v) el.value = v; };
    const apply = function (a) {
      f.name.value = a.recipient; f.phone.value = a.phone; f.address.value = a.address; f.address2.value = a.address2 || "";
    };
    setIfEmpty(f.email, s.user.email);
    const def = list.find(function (a) { return a.is_default; }) || list[0];
    if (def) apply(def);
    setIfEmpty(f.name, p.name);
    setIfEmpty(f.phone, p.phone);
    if (box) {
      box.innerHTML = "<span><b>" + esc(p.name || s.user.email) + "</b>님으로 주문합니다.</span>" +
        (list.length ? '<label class="sr-only" for="addr-pick">저장된 배송지</label><select id="addr-pick">' +
          list.map(function (a, i) { return '<option value="' + i + '"' + (a === def ? " selected" : "") + ">" + esc((a.label || a.recipient) + " · " + a.address) + "</option>"; }).join("") +
          "</select>" : "") +
        '<a href="account.html#addresses">배송지 관리</a>';
      const pick = document.getElementById("addr-pick");
      if (pick) pick.addEventListener("change", function () { apply(list[Number(pick.value)]); });
    }
  }
  async function saveCheckoutAddress(c) {
    const addrs = await DB.addresses();
    const list = addrs.ok ? addrs.data : [];
    const dup = list.some(function (a) { return a.address === c.address && (a.address2 || "") === (c.address2 || ""); });
    if (dup) return;
    DB.saveAddress({ recipient: c.name, phone: c.phone, address: c.address, address2: c.address2 || null });
  }

  global.ShopMember = { fillCheckout: fillCheckout, saveCheckoutAddress: saveCheckoutAddress };
})(window);
