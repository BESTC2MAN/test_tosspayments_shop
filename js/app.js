/* =========================================================
   공통 UI: 장바구니, 헤더, 상품 목록, 퀵뷰, 토스트
   ========================================================= */
(function (global) {
  "use strict";

  const Shop = global.Shop;
  const CFG = global.SHOP_CONFIG;
  const CART_KEY = "ridgeline_cart_v1";

  /* ---------- utils ---------- */
  const won = function (n) { return n.toLocaleString("ko-KR") + "원"; };
  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  const esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  const unitPrice = function (p) { return p.sale || p.price; };

  /* ---------- cart store ---------- */
  const Cart = {
    _items: null,
    load: function () {
      if (this._items) return this._items;
      try { this._items = JSON.parse(localStorage.getItem(CART_KEY)) || []; }
      catch (e) { this._items = []; }
      // 존재하지 않는 상품 제거
      this._items = this._items.filter(function (it) { return Shop.findProduct(it.id); });
      return this._items;
    },
    save: function () {
      try { localStorage.setItem(CART_KEY, JSON.stringify(this._items)); } catch (e) { /* 저장 불가 환경 */ }
      document.dispatchEvent(new CustomEvent("cart:change"));
    },
    items: function () {
      return this.load().map(function (it) {
        const p = Shop.findProduct(it.id);
        return Object.assign({}, it, { product: p, unit: unitPrice(p), line: unitPrice(p) * it.qty });
      });
    },
    key: function (id, color, size) { return id + "|" + color + "|" + size; },
    add: function (id, colorIndex, size, qty) {
      const items = this.load();
      const k = this.key(id, colorIndex, size);
      const found = items.find(function (it) { return it.key === k; });
      if (found) found.qty = Math.min(found.qty + (qty || 1), 10);
      else items.push({ key: k, id: id, color: colorIndex, size: size, qty: qty || 1 });
      this.save();
    },
    setQty: function (key, qty) {
      const items = this.load();
      const it = items.find(function (i) { return i.key === key; });
      if (!it) return;
      if (qty <= 0) this._items = items.filter(function (i) { return i.key !== key; });
      else it.qty = Math.min(qty, 10);
      this.save();
    },
    remove: function (key) { this.setQty(key, 0); },
    clear: function () { this._items = []; this.save(); },
    count: function () { return this.load().reduce(function (s, it) { return s + it.qty; }, 0); },
    totals: function () {
      const subtotal = this.items().reduce(function (s, it) { return s + it.line; }, 0);
      const discount = this.items().reduce(function (s, it) {
        return s + (it.product.sale ? (it.product.price - it.product.sale) * it.qty : 0);
      }, 0);
      const shipping = subtotal === 0 || subtotal >= CFG.FREE_SHIPPING_OVER ? 0 : CFG.SHIPPING_FEE;
      return { subtotal: subtotal, discount: discount, shipping: shipping, total: subtotal + shipping };
    },
  };

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    let el = $(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-show"); }, 2200);
  }

  /* ---------- overlay (shared by drawer & modal) ---------- */
  function openLayer(el) {
    $(".overlay").classList.add("is-open");
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const focusable = el.querySelector("button, a, input");
    if (focusable) focusable.focus();
  }
  function closeLayers() {
    $$(".drawer.is-open, .modal.is-open").forEach(function (el) {
      el.classList.remove("is-open");
      el.setAttribute("aria-hidden", "true");
    });
    const ov = $(".overlay");
    if (ov) ov.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  /* ---------- header ---------- */
  function updateCartBadge() {
    const n = Cart.count();
    $$(".cart-count").forEach(function (el) {
      el.textContent = n > 99 ? "99+" : n;
      el.dataset.empty = n === 0 ? "true" : "false";
    });
  }

  function initHeader() {
    const toggle = $(".menu-toggle");
    const nav = $(".main-nav");
    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        const open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    $$("[data-open-cart]").forEach(function (b) {
      b.addEventListener("click", function () { renderDrawer(); openLayer($("#cart-drawer")); });
    });
    $$("[data-close-layer]").forEach(function (b) { b.addEventListener("click", closeLayers); });
    const ov = $(".overlay");
    if (ov) ov.addEventListener("click", closeLayers);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLayers(); });
    updateCartBadge();
    document.addEventListener("cart:change", function () {
      updateCartBadge();
      if ($("#cart-drawer") && $("#cart-drawer").classList.contains("is-open")) renderDrawer();
    });
  }

  /* ---------- cart drawer ---------- */
  function renderDrawer() {
    const drawer = $("#cart-drawer");
    if (!drawer) return;
    const body = $(".drawer-body", drawer);
    const foot = $(".drawer-foot", drawer);
    const items = Cart.items();
    const t = Cart.totals();

    if (!items.length) {
      body.innerHTML =
        '<div class="cart-empty"><p>장바구니가 비어 있습니다.</p>' +
        '<button class="btn btn-outline" data-close-layer>쇼핑 계속하기</button></div>';
      foot.hidden = true;
      $("[data-close-layer]", body).addEventListener("click", closeLayers);
      return;
    }

    const remain = Math.max(0, CFG.FREE_SHIPPING_OVER - t.subtotal);
    const pct = Math.min(100, Math.round((t.subtotal / CFG.FREE_SHIPPING_OVER) * 100));
    body.innerHTML =
      '<div class="free-ship">' +
        (remain > 0 ? "<strong>" + won(remain) + "</strong> 더 담으면 무료배송" : "<strong>무료배송</strong> 혜택이 적용됩니다") +
        '<div class="free-ship-bar"><span style="width:' + pct + '%"></span></div>' +
      "</div>" +
      items.map(function (it) {
        const p = it.product;
        return '<div class="cart-line" data-key="' + esc(it.key) + '">' +
          '<div class="cart-line-media">' + Shop.renderProductArt(p, it.color) + "</div>" +
          "<div>" +
            '<p class="cart-line-name">' + esc(p.name) + "</p>" +
            '<p class="cart-line-opt">' + esc(p.colors[it.color].name) + " / " + esc(it.size) + "</p>" +
            '<div class="cart-line-row">' +
              '<div class="qty"><button aria-label="수량 줄이기" data-qty="-1">−</button><span>' + it.qty + '</span><button aria-label="수량 늘리기" data-qty="1">+</button></div>' +
              '<span class="cart-line-price">' + won(it.line) + "</span>" +
            "</div>" +
            '<button class="remove-link" data-remove>삭제</button>' +
          "</div>" +
        "</div>";
      }).join("");

    foot.hidden = false;
    $(".drawer-total .amt", foot).textContent = won(t.total);
    $(".drawer-note", foot).textContent =
      "상품 " + won(t.subtotal) + " + 배송비 " + (t.shipping ? won(t.shipping) : "무료");

    $$(".cart-line", body).forEach(function (row) {
      const key = row.dataset.key;
      const item = items.find(function (i) { return i.key === key; });
      $$("[data-qty]", row).forEach(function (b) {
        b.addEventListener("click", function () { Cart.setQty(key, item.qty + Number(b.dataset.qty)); });
      });
      $("[data-remove]", row).addEventListener("click", function () { Cart.remove(key); });
    });
  }

  /* ---------- quick view modal ---------- */
  const qvState = { product: null, color: 0, size: null };

  function openQuickView(id) {
    const p = Shop.findProduct(id);
    const modal = $("#quick-view");
    if (!p || !modal) return;
    qvState.product = p; qvState.color = 0; qvState.size = null;
    const cat = Shop.CATEGORIES[p.cat];
    const soldOut = p.soldOut || [];

    $(".qv-content", modal).innerHTML =
      '<div class="qv">' +
        '<div class="qv-media">' + badgeHTML(p) + '<div class="qv-art">' + Shop.renderProductArt(p, 0) + "</div></div>" +
        '<div class="qv-body">' +
          '<p class="qv-cat">' + cat.en + " · " + esc(p.sub) + "</p>" +
          '<h2 class="qv-name" id="qv-title">' + esc(p.name) + "</h2>" +
          priceHTML(p) +
          '<p class="qv-desc">' + esc(p.desc) + "</p>" +
          '<div class="opt-group"><p class="opt-label">색상<span class="qv-color-name">' + esc(p.colors[0].name) + "</span></p>" +
            '<div class="color-opts" role="radiogroup" aria-label="색상">' +
              p.colors.map(function (c, i) {
                return '<button class="color-opt" role="radio" aria-checked="' + (i === 0) + '" aria-label="' + esc(c.name) + '" data-color="' + i + '" style="background:' + (c.swatch || c.hex) + '"></button>';
              }).join("") +
            "</div></div>" +
          '<div class="opt-group"><p class="opt-label">사이즈</p>' +
            '<div class="size-opts" role="radiogroup" aria-label="사이즈">' +
              p.sizes.map(function (s) {
                const so = soldOut.indexOf(s) > -1;
                return '<button class="size-opt" role="radio" aria-checked="false" data-size="' + s + '"' + (so ? " disabled aria-label=\"" + s + " 품절\"" : "") + ">" + s + "</button>";
              }).join("") +
            "</div><p class=\"opt-error\" aria-live=\"polite\"></p></div>" +
          '<div class="qv-actions">' +
            '<button class="btn btn-outline btn-block" data-qv-add>장바구니 담기</button>' +
            '<button class="btn btn-primary btn-block" data-qv-buy>바로 구매</button>' +
          "</div>" +
        "</div>" +
      "</div>";

    $$(".color-opt", modal).forEach(function (b) {
      b.addEventListener("click", function () {
        qvState.color = Number(b.dataset.color);
        $$(".color-opt", modal).forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
        $(".qv-color-name", modal).textContent = p.colors[qvState.color].name;
        $(".qv-art", modal).innerHTML = Shop.renderProductArt(p, qvState.color);
      });
    });
    $$(".size-opt", modal).forEach(function (b) {
      b.addEventListener("click", function () {
        qvState.size = b.dataset.size;
        $$(".size-opt", modal).forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
        $(".opt-error", modal).textContent = "";
      });
    });
    $("[data-qv-add]", modal).addEventListener("click", function () {
      if (!requireSize(modal)) return;
      Cart.add(p.id, qvState.color, qvState.size, 1);
      closeLayers();
      toast("장바구니에 담았습니다 · " + p.name);
    });
    $("[data-qv-buy]", modal).addEventListener("click", function () {
      if (!requireSize(modal)) return;
      Cart.add(p.id, qvState.color, qvState.size, 1);
      location.href = "checkout.html";
    });

    openLayer(modal);
  }

  function requireSize(modal) {
    if (qvState.size) return true;
    $(".opt-error", modal).textContent = "사이즈를 선택해 주세요.";
    return false;
  }

  function badgeHTML(p) {
    if (p.badge === "sale") return '<span class="badge sale">' + Math.round((1 - p.sale / p.price) * 100) + "% OFF</span>";
    if (p.badge === "new") return '<span class="badge new">New</span>';
    if (p.badge === "best") return '<span class="badge">Best</span>';
    return "";
  }
  function priceHTML(p) {
    if (p.sale) {
      return '<p class="price"><span class="off">' + Math.round((1 - p.sale / p.price) * 100) + "%</span>" +
        "<span>" + won(p.sale) + '</span><span class="was">' + won(p.price) + "</span></p>";
    }
    return '<p class="price"><span>' + won(p.price) + "</span></p>";
  }

  /* ---------- product listing ---------- */
  function initListing() {
    const grid = $("#product-grid");
    if (!grid) return;
    const catKey = document.body.dataset.category;
    const all = Shop.PRODUCTS.filter(function (p) { return p.cat === catKey; });
    const subs = ["전체"].concat(all.map(function (p) { return p.sub; }).filter(function (v, i, a) { return a.indexOf(v) === i; }));
    const state = { sub: "전체", sort: "recommend" };

    const strip = $("#sub-filters");
    strip.innerHTML = subs.map(function (s, i) {
      return '<button class="chip" aria-pressed="' + (i === 0) + '" data-sub="' + esc(s) + '">' + esc(s) + "</button>";
    }).join("");
    $$(".chip", strip).forEach(function (b) {
      b.addEventListener("click", function () {
        state.sub = b.dataset.sub;
        $$(".chip", strip).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        draw();
      });
    });
    $("#sort").addEventListener("change", function (e) { state.sort = e.target.value; draw(); });

    function draw() {
      let list = all.filter(function (p) { return state.sub === "전체" || p.sub === state.sub; });
      list = list.slice();
      if (state.sort === "low") list.sort(function (a, b) { return unitPrice(a) - unitPrice(b); });
      if (state.sort === "high") list.sort(function (a, b) { return unitPrice(b) - unitPrice(a); });
      if (state.sort === "new") list.sort(function (a, b) { return (b.badge === "new") - (a.badge === "new"); });
      if (state.sort === "sale") list.sort(function (a, b) { return (b.sale ? 1 : 0) - (a.sale ? 1 : 0); });

      $("#result-count").textContent = "총 " + list.length + "개 상품";
      if (!list.length) { grid.innerHTML = '<p class="empty-state">조건에 맞는 상품이 없습니다.</p>'; return; }

      grid.innerHTML = list.map(function (p) {
        return '<article class="product-card" data-id="' + p.id + '" tabindex="0" aria-label="' + esc(p.name) + '">' +
          '<div class="product-media">' + badgeHTML(p) + Shop.renderProductArt(p, 0) +
            '<button class="quick-add" data-quick>빠른 구매</button>' +
          "</div>" +
          '<div class="product-info">' +
            '<div class="swatches">' + p.colors.map(function (c) { return '<span class="swatch-dot" title="' + esc(c.name) + '" style="background:' + (c.swatch || c.hex) + '"></span>'; }).join("") + "</div>" +
            '<h3 class="product-name">' + esc(p.name) + "</h3>" +
            '<p class="product-sub">' + esc(p.sub) + " · " + p.colors.length + "가지 색상</p>" +
            priceHTML(p) +
          "</div>" +
        "</article>";
      }).join("");

      $$(".product-card", grid).forEach(function (card) {
        const open = function () { openQuickView(card.dataset.id); };
        card.addEventListener("click", open);
        card.addEventListener("keydown", function (e) { if (e.key === "Enter") open(); });
      });
    }
    draw();
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    initListing();
  });

  global.Shop.Cart = Cart;
  global.Shop.won = won;
  global.Shop.esc = esc;
  global.Shop.toast = toast;
})(window);
