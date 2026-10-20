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
  const MAX_QTY = 10;

  /* ---------- catalog: DB 상품을 불러온 뒤 화면을 그립니다 ---------- */
  let catalogOk = false;
  const catalogReady = (async function () {
    if (!global.ShopDB) return;
    const r = await global.ShopDB.fetchCatalog();
    if (r.ok) { Shop.setProducts(r.data); catalogOk = true; }
    else Shop.catalogError = r.message;
  })();
  const domReady = new Promise(function (resolve) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", resolve);
    else resolve();
  });
  Shop.ready = Promise.all([catalogReady, domReady]).then(function () { return catalogOk; });
  Shop.onReady = function (fn) { return Shop.ready.then(fn); };

  /* ---------- cart store ---------- */
  const Cart = {
    _items: null,
    load: function () {
      if (this._items) return this._items;
      try { this._items = JSON.parse(localStorage.getItem(CART_KEY)) || []; }
      catch (e) { this._items = []; }
      // 판매 중이 아니거나 옵션이 바뀐 상품 제거 (상품을 못 불러온 경우에는 그대로 둠)
      if (catalogOk) {
        this._items = this._items.filter(function (it) {
          const p = Shop.findProduct(it.id);
          return p && p.colors[it.color] && p.sizes.indexOf(it.size) > -1;
        });
      }
      return this._items;
    },
    // 다른 기기와 동기화한 결과로 통째로 바꿀 때 사용 (F-09)
    replace: function (list, silent) {
      this._items = list;
      try { localStorage.setItem(CART_KEY, JSON.stringify(this._items)); } catch (e) { /* 저장 불가 환경 */ }
      if (!silent) document.dispatchEvent(new CustomEvent("cart:change", { detail: { synced: true } }));
    },
    save: function () {
      try { localStorage.setItem(CART_KEY, JSON.stringify(this._items)); } catch (e) { /* 저장 불가 환경 */ }
      document.dispatchEvent(new CustomEvent("cart:change"));
    },
    items: function () {
      return this.load().filter(function (it) { return Shop.findProduct(it.id); }).map(function (it) {
        const p = Shop.findProduct(it.id);
        return Object.assign({}, it, {
          product: p, unit: unitPrice(p), line: unitPrice(p) * it.qty, stock: Shop.stockOf(p, it.color, it.size),
        });
      });
    },
    key: function (id, color, size) { return id + "|" + color + "|" + size; },
    // 재고를 넘기면 담지 않고 false
    add: function (id, colorIndex, size, qty) {
      const items = this.load();
      const p = Shop.findProduct(id);
      const k = this.key(id, colorIndex, size);
      const found = items.find(function (it) { return it.key === k; });
      const next = (found ? found.qty : 0) + (qty || 1);
      const limit = Math.min(MAX_QTY, p ? Shop.stockOf(p, colorIndex, size) : 0);
      if (next > limit) return false;
      if (found) found.qty = next;
      else items.push({ key: k, id: id, color: colorIndex, size: size, qty: qty || 1 });
      this.save();
      return true;
    },
    setQty: function (key, qty) {
      const items = this.load();
      const it = items.find(function (i) { return i.key === key; });
      if (!it) return;
      if (qty <= 0) this._items = items.filter(function (i) { return i.key !== key; });
      else it.qty = Math.min(qty, MAX_QTY);
      this.save();
    },
    remove: function (key) { this.setQty(key, 0); },
    clear: function () { this._items = []; this.save(); },
    count: function () { return this.load().reduce(function (s, it) { return s + it.qty; }, 0); },
    // 재고보다 많이 담긴 줄 (품절 포함)
    problems: function () { return this.items().filter(function (it) { return it.qty > it.stock; }); },
    // coupon: 쿠폰 할인 금액. 실제 결제 금액은 DB의 create_order 가 같은 규칙으로 다시 계산합니다.
    totals: function (coupon) {
      const items = this.items();
      const subtotal = items.reduce(function (s, it) { return s + it.line; }, 0);
      const discount = items.reduce(function (s, it) {
        return s + (it.product.sale ? (it.product.price - it.product.sale) * it.qty : 0);
      }, 0);
      const shipping = subtotal === 0 || subtotal >= CFG.FREE_SHIPPING_OVER ? 0 : CFG.SHIPPING_FEE;
      const couponOff = Math.min(coupon || 0, subtotal);
      return { subtotal: subtotal, discount: discount, coupon: couponOff, shipping: shipping, total: subtotal - couponOff + shipping };
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
            stockNote(it) +
            '<div class="cart-line-row">' +
              '<div class="qty"><button aria-label="수량 줄이기" data-qty="-1">−</button><span>' + it.qty + '</span><button aria-label="수량 늘리기" data-qty="1"' +
                (it.qty >= Math.min(MAX_QTY, it.stock) ? " disabled" : "") + ">+</button></div>" +
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

  function stockNote(it) {
    if (it.stock === 0) return '<p class="stock-note is-out">품절된 옵션입니다. 삭제 후 주문해 주세요.</p>';
    if (it.qty > it.stock) return '<p class="stock-note is-out">재고가 ' + it.stock + "개 남아 있습니다. 수량을 줄여 주세요.</p>";
    if (it.stock <= 3) return '<p class="stock-note">' + it.stock + "개 남음</p>";
    return "";
  }

  /* ---------- quick view modal ---------- */
  const qvState = { product: null, color: 0, size: null, view: "front" };
  const VIEWS = [["front", "앞면"], ["back", "뒷면"], ["detail", "디테일"]];

  function drawQvMedia(modal) {
    const p = qvState.product;
    $(".qv-art", modal).innerHTML = Shop.renderProductArt(p, qvState.color, qvState.view);
    $(".qv-thumbs", modal).innerHTML = VIEWS.map(function (v) {
      return '<button class="qv-thumb" aria-label="' + v[1] + ' 보기" aria-pressed="' + (v[0] === qvState.view) + '" data-view="' + v[0] + '">' +
        Shop.renderProductArt(p, qvState.color, v[0]) + "</button>";
    }).join("");
    $$(".qv-thumb", modal).forEach(function (b) {
      b.addEventListener("click", function () { qvState.view = b.dataset.view; drawQvMedia(modal); });
    });
  }

  function openQuickView(id) {
    const p = Shop.findProduct(id);
    const modal = $("#quick-view");
    if (!p || !modal) return;
    qvState.product = p; qvState.color = 0; qvState.size = null; qvState.view = "front";
    const cat = Shop.CATEGORIES[p.cat];

    $(".qv-content", modal).innerHTML =
      '<div class="qv">' +
        '<div class="qv-media">' + badgeHTML(p) + '<div class="qv-art"></div><div class="qv-thumbs"></div></div>' +
        '<div class="qv-body">' +
          '<p class="qv-cat">' + cat.en + " · " + esc(p.sub) + "</p>" +
          '<h2 class="qv-name" id="qv-title">' + esc(p.name) + "</h2>" +
          ratingHTML(p) +
          priceHTML(p) +
          '<p class="qv-desc">' + esc(p.desc) + "</p>" +
          '<div class="opt-group"><p class="opt-label">색상<span class="qv-color-name">' + esc(p.colors[0].name) + "</span></p>" +
            '<div class="color-opts" role="radiogroup" aria-label="색상">' +
              p.colors.map(function (c, i) {
                return '<button class="color-opt" role="radio" aria-checked="' + (i === 0) + '" aria-label="' + esc(c.name) + '" data-color="' + i + '" style="background:' + (c.swatch || c.hex) + '"></button>';
              }).join("") +
            "</div></div>" +
          '<div class="opt-group"><p class="opt-label">사이즈</p>' +
            '<div class="size-opts" role="radiogroup" aria-label="사이즈"></div>' +
            '<p class="stock-note qv-stock" aria-live="polite"></p><p class="opt-error" aria-live="polite"></p></div>' +
          '<ul class="qv-info">' +
            "<li><strong>배송</strong>평일 14시 이전 주문 시 당일 출고 · " + won(CFG.FREE_SHIPPING_OVER) + " 이상 무료배송</li>" +
            (p.cat === "jersey" ? "<li><strong>마킹</strong>이름·등번호 마킹은 준비 중입니다 (뒷면 이미지는 예시)</li>" : "<li><strong>소재</strong>나일론 100% · 발수 코팅</li>") +
            "<li><strong>교환/반품</strong>수령 후 30일 이내 무료</li>" +
          "</ul>" +
          '<div class="qv-actions">' +
            '<button class="btn btn-outline btn-block" data-qv-add>장바구니 담기</button>' +
            '<button class="btn btn-primary btn-block" data-qv-buy>바로 구매</button>' +
          "</div>" +
        "</div>" +
      "</div>";

    drawQvMedia(modal);
    drawQvSizes(modal);
    $$(".color-opt", modal).forEach(function (b) {
      b.addEventListener("click", function () {
        qvState.color = Number(b.dataset.color);
        $$(".color-opt", modal).forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
        $(".qv-color-name", modal).textContent = p.colors[qvState.color].name;
        drawQvMedia(modal);
        drawQvSizes(modal);
      });
    });
    $("[data-qv-add]", modal).addEventListener("click", function () {
      if (!requireSize(modal) || !addFromQv(modal)) return;
      closeLayers();
      toast("장바구니에 담았습니다 · " + p.name);
    });
    $("[data-qv-buy]", modal).addEventListener("click", function () {
      if (!requireSize(modal)) return;
      // 이미 담겨 있으면 그대로 주문서로 이동
      const inCart = Cart.load().some(function (it) { return it.key === Cart.key(p.id, qvState.color, qvState.size); });
      if (!inCart && !addFromQv(modal)) return;
      location.href = "checkout.html";
    });

    openLayer(modal);
  }

  // 선택한 색상의 사이즈별 재고로 버튼을 다시 그림 (F-05)
  function drawQvSizes(modal) {
    const p = qvState.product;
    const box = $(".size-opts", modal);
    if (qvState.size && Shop.stockOf(p, qvState.color, qvState.size) === 0) qvState.size = null;
    box.innerHTML = p.sizes.map(function (s) {
      const n = Shop.stockOf(p, qvState.color, s);
      return '<button class="size-opt" role="radio" aria-checked="' + (s === qvState.size) + '" data-size="' + esc(s) + '"' +
        (n === 0 ? ' disabled aria-label="' + esc(s) + ' 품절"' : "") + ">" + esc(s) + "</button>";
    }).join("");
    $$(".size-opt", box).forEach(function (b) {
      b.addEventListener("click", function () {
        qvState.size = b.dataset.size;
        $$(".size-opt", box).forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
        $(".opt-error", modal).textContent = "";
        drawQvStock(modal);
      });
    });
    drawQvStock(modal);
  }
  function drawQvStock(modal) {
    const p = qvState.product;
    const el = $(".qv-stock", modal);
    const n = qvState.size ? Shop.stockOf(p, qvState.color, qvState.size) : null;
    el.textContent = Shop.isSoldOutAll(p) ? "전 옵션 품절입니다." : n !== null && n <= 3 ? "이 옵션은 " + n + "개 남았어요." : "";
  }
  function addFromQv(modal) {
    const p = qvState.product;
    if (Cart.add(p.id, qvState.color, qvState.size, 1)) return true;
    const n = Shop.stockOf(p, qvState.color, qvState.size);
    $(".opt-error", modal).textContent = n >= MAX_QTY
      ? "한 옵션은 " + MAX_QTY + "개까지 담을 수 있습니다."
      : "재고가 " + n + "개라 더 담을 수 없습니다.";
    return false;
  }

  function requireSize(modal) {
    if (qvState.size) return true;
    $(".opt-error", modal).textContent = "사이즈를 선택해 주세요.";
    return false;
  }

  function badgeHTML(p) {
    if (Shop.isSoldOutAll(p)) return '<span class="badge soldout">Sold out</span>';
    if (p.badge === "sale") return '<span class="badge sale">' + Math.round((1 - p.sale / p.price) * 100) + "% OFF</span>";
    if (p.badge === "new") return '<span class="badge new">New</span>';
    if (p.badge === "best") return '<span class="badge">Best</span>';
    return "";
  }
  function ratingHTML(p) {
    if (!p.rating) return "";
    return '<p class="rating"><span class="stars" style="--r:' + p.rating + '" aria-hidden="true"></span>' +
      '<span class="sr-only">별점 5점 만점에</span><strong>' + p.rating.toFixed(1) + "</strong>" +
      '<span class="rv">리뷰 ' + p.reviews.toLocaleString("ko-KR") + "</span></p>";
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
    if (!catalogOk) {
      grid.innerHTML = '<p class="empty-state">' + esc(Shop.catalogError || "상품을 불러오지 못했습니다.") +
        ' <button class="btn btn-outline" onclick="location.reload()">다시 시도</button></p>';
      return;
    }
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
      if (state.sort === "review") list.sort(function (a, b) { return (b.reviews || 0) - (a.reviews || 0); });

      $("#result-count").textContent = "총 " + list.length + "개 상품";
      if (!list.length) { grid.innerHTML = '<p class="empty-state">조건에 맞는 상품이 없습니다.</p>'; return; }

      grid.innerHTML = list.map(function (p) {
        return '<article class="product-card" data-id="' + p.id + '" tabindex="0" aria-label="' + esc(p.name) + '">' +
          '<div class="product-media">' + badgeHTML(p) + Shop.renderProductArt(p, 0) + Shop.renderProductArt(p, 0, "back") +
            '<button class="quick-add" data-quick>빠른 구매</button>' +
          "</div>" +
          '<div class="product-info">' +
            '<div class="swatches">' + p.colors.map(function (c) { return '<span class="swatch-dot" title="' + esc(c.name) + '" style="background:' + (c.swatch || c.hex) + '"></span>'; }).join("") + "</div>" +
            '<h3 class="product-name">' + esc(p.name) + "</h3>" +
            '<p class="product-sub">' + esc(p.sub) + " · " + p.colors.map(function (c) { return esc(c.name); }).join(" / ") + "</p>" +
            priceHTML(p) +
            ratingHTML(p) +
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

  /* ---------- hero slider ---------- */
  function initHero() {
    const slides = $$(".hero-slide");
    const dots = $(".hero-dots");
    if (slides.length < 2 || !dots) return;
    let cur = 0, timer;
    dots.innerHTML = slides.map(function (s, i) {
      return '<button aria-label="' + (i + 1) + '번 배너" aria-pressed="' + (i === 0) + '"></button>';
    }).join("");
    const show = function (n) {
      cur = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle("is-active", i === cur); s.setAttribute("aria-hidden", String(i !== cur)); });
      $$("button", dots).forEach(function (b, i) { b.setAttribute("aria-pressed", String(i === cur)); });
    };
    const play = function () { clearInterval(timer); timer = setInterval(function () { show(cur + 1); }, 6000); };
    $$("button", dots).forEach(function (b, i) { b.addEventListener("click", function () { show(i); play(); }); });
    show(0);
    if (!global.matchMedia || !global.matchMedia("(prefers-reduced-motion: reduce)").matches) play();
  }

  /* ---------- club shortcuts ---------- */
  function initClubs() {
    const row = $("#club-row");
    if (!row) return;
    const clubs = Shop.PRODUCTS.filter(function (p) { return p.club; });
    row.innerHTML = clubs.map(function (p) {
      const k = p.colors[0];
      const fill = k.stripe ? "repeating-linear-gradient(90deg," + k.body + " 0 8px," + k.stripe + " 8px 16px)" : k.body;
      return '<button class="club" data-id="' + p.id + '">' +
        '<span class="club-disc" style="background:' + fill + ";box-shadow:inset 0 0 0 4px " + k.trim + '"><span>' + esc(p.club) + "</span></span>" +
        '<span class="club-name">' + esc(p.clubShort) + "</span></button>";
    }).join("");
    $$(".club", row).forEach(function (b) {
      b.addEventListener("click", function () { openQuickView(b.dataset.id); });
    });
  }

  /* ---------- boot ---------- */
  domReady.then(initHero);
  Shop.onReady(function () {
    initHeader();
    initClubs();
    initListing();
  });

  global.Shop.Cart = Cart;
  global.Shop.$ = $;
  global.Shop.$$ = $$;
  global.Shop.openLayer = openLayer;
  global.Shop.closeLayers = closeLayers;
  global.Shop.openQuickView = openQuickView;
  global.Shop.won = won;
  global.Shop.esc = esc;
  global.Shop.toast = toast;
})(window);
