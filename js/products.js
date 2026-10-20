/* =========================================================
   상품 데이터(Supabase products / product_stock) + 상품 일러스트(SVG)
   상품은 DB에서 불러와 setProducts()로 채웁니다(app.js).
   관리자 화면에서 사진을 올리면 images.front/back/detail 사진을 쓰고,
   없으면 SVG 일러스트를 그립니다.
   ========================================================= */
(function (global) {
  "use strict";

  /* 축구 저지 컬러웨이
     body 몸판 · stripe 세로 줄무늬 · sleeve 소매 · trim 칼라·소매 끝·사이드 라인
     collar "crew" | "v" · pattern "tonal" | "pin" | "hoop" | "none" · num 등번호 색 */
  function kit(name, body, o) {
    o = o || {};
    const trim = o.trim || (isLight(body) ? "#1b1b1b" : "#ffffff");
    return {
      name: name,
      hex: body,
      body: body,
      stripe: o.stripe || null,
      sleeve: o.sleeve || null,
      trim: trim,
      collar: o.collar || "crew",
      pattern: o.pattern || "none",
      num: o.num || trim,
      swatch: o.stripe ? "linear-gradient(90deg," + body + " 50%," + o.stripe + " 50%)" : null,
    };
  }

  const CATEGORIES = {
    jersey:      { key: "jersey",      en: "Football Kits", ko: "축구복", page: "jerseys.html" },
    windbreaker: { key: "windbreaker", en: "Windbreakers",  ko: "바람막이", page: "windbreakers.html" },
  };

  // 구단명은 상품 구분용으로만 사용합니다. 비공식 데모 상품이며 엠블럼·스폰서 로고는 넣지 않습니다.
  const NOTE = " 구단 공식 상품이 아닌 데모 상품으로, 엠블럼과 스폰서 로고는 들어가지 않습니다.";

  // DB에서 채워지는 상품 목록 (참조를 유지하도록 배열 내용만 바꿉니다)
  const PRODUCTS = [];

  /* DB 행 → 화면용 상품 객체
     colors: 축구복은 kit() 옵션({name, body, stripe…}), 바람막이는 {name, hex}
     stock: { "색상인덱스|사이즈": 수량 } */
  function fromRow(row, stockRows) {
    const stock = {};
    (stockRows || []).forEach(function (s) { stock[s.color_index + "|" + s.size] = s.qty; });
    const colors = (row.colors || []).map(function (c) {
      return c.body ? kit(c.name, c.body, c) : { name: c.name, hex: c.hex || "#888888" };
    });
    return {
      id: row.id,
      cat: row.cat,
      club: row.club || "",
      clubShort: row.club_short || "",
      sub: row.sub,
      name: row.name,
      price: row.price,
      sale: row.sale || 0,
      badge: row.badge || "",
      type: row.type || "track",
      desc: (row.description || "") + (row.cat === "jersey" ? NOTE : ""),
      colors: colors,
      sizes: row.sizes || [],
      images: row.images || {},
      rating: Number(row.rating_avg) || 0,
      reviews: row.review_count || 0,
      sort: row.sort || 0,
      stock: stock,
    };
  }

  function setProducts(rows) {
    PRODUCTS.length = 0;
    rows.forEach(function (r) { PRODUCTS.push(fromRow(r, r.product_stock)); });
    PRODUCTS.sort(function (a, b) { return a.sort - b.sort; });
  }

  // 재고 수량: 재고 행이 없으면 0(판매 불가)
  function stockOf(p, colorIndex, size) {
    const n = p.stock[colorIndex + "|" + size];
    return typeof n === "number" ? n : 0;
  }
  function isSoldOutAll(p) {
    return !Object.keys(p.stock).some(function (k) { return p.stock[k] > 0; });
  }
  /* ---------- helpers ---------- */
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function luma(hex) {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  }
  function isLight(hex) { return luma(hex) > 160; }

  // 한 페이지에 여러 장이 그려지므로 그라디언트·clipPath id를 매번 다르게 만듭니다
  let artSeq = 0;
  function uid() { return "art" + (++artSeq); }

  function wrap(inner, o) {
    o = o || {};
    return '<svg class="art' + (o.cls ? " " + o.cls : "") + '" viewBox="' + (o.vb || "0 0 400 500") + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid meet">' +
      (o.vb ? "" : '<ellipse cx="200" cy="462" rx="138" ry="9" fill="#000" opacity=".1"/>') + inner + "</svg>";
  }

  // 원단 음영: 좌우 어둡게, 가운데 밝게 + 아래로 갈수록 어둡게 + 메시 질감
  function fabricDefs(id, sheen) {
    return '<linearGradient id="' + id + 'h" x1="0" x2="1">' +
        '<stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".2" stop-color="#000" stop-opacity=".05"/>' +
        '<stop offset=".48" stop-color="#fff" stop-opacity="' + (sheen ? ".16" : ".08") + '"/>' +
        '<stop offset=".8" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>' +
      '<linearGradient id="' + id + 'v" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>' +
      '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset=".2" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity="' + (sheen ? ".2" : ".07") + '"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<pattern id="' + id + 'm" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r=".8" fill="#000" opacity=".22"/></pattern>';
  }
  function fabricOverlay(id, mesh) {
    return '<rect x="0" y="0" width="400" height="500" fill="url(#' + id + 'h)"/>' +
      '<rect x="0" y="0" width="400" height="500" fill="url(#' + id + 'v)"/>' +
      '<rect x="0" y="0" width="400" height="500" fill="url(#' + id + 'g)"/>' +
      (mesh ? '<rect x="0" y="0" width="400" height="500" fill="url(#' + id + 'm)" opacity=".35"/>' : "");
  }

  /* ---------- 축구 저지 ---------- */
  function jerseyShape(back) {
    const neck = back ? "Q200 116 242 104" : "Q200 140 242 104";
    return "M158 104 " + neck + " L290 122 Q318 134 348 178 L322 250 L282 232 L279 300 L284 426 Q200 442 116 426 L121 300 L118 232 L78 250 L52 178 Q82 134 110 122 Z";
  }
  const SLEEVE_L = "M110 122 Q82 134 52 178 L78 250 L118 232 Q122 176 128 120 Z";
  const SLEEVE_R = "M290 122 Q318 134 348 178 L322 250 L282 232 Q278 176 272 120 Z";

  function jerseyArt(k, view) {
    const id = uid();
    const back = view === "back";
    const shape = jerseyShape(back);
    const dk = shade(k.body, -45);
    let inner = "";

    // 1) 목 안쪽(뒷판 안감)
    if (!back) {
      inner += k.collar === "v"
        ? '<path d="M158 104 Q200 90 242 104 L200 154 Z" fill="' + shade(k.body, -70) + '"/>'
        : '<path d="M158 104 Q200 90 242 104 Q200 140 158 104 Z" fill="' + shade(k.body, -70) + '"/>';
    }
    // 2) 몸판
    inner += '<path d="' + shape + '" fill="' + k.body + '"/>';

    // 3) 몸판 위 패턴·소매·트림 (실루엣으로 잘라냄)
    let g = "";
    if (k.stripe) {
      for (let x = 200 - 13 - 52 * 3; x < 340; x += 52) g += '<rect x="' + x + '" y="90" width="26" height="360" fill="' + k.stripe + '"/>';
    }
    if (k.pattern === "tonal") {
      g += '<rect x="0" y="0" width="400" height="500" fill="url(#' + id + 't)"/>';
    } else if (k.pattern === "pin") {
      for (let x = 128; x < 280; x += 14) g += '<path d="M' + x + ' 96V440" stroke="' + k.trim + '" stroke-width="1.2" opacity=".35"/>';
    } else if (k.pattern === "hoop") {
      for (let y = 200; y < 440; y += 34) g += '<rect x="100" y="' + y + '" width="200" height="12" fill="' + shade(k.body, -14) + '"/>';
    }
    if (k.sleeve) g += '<path d="' + SLEEVE_L + '" fill="' + k.sleeve + '"/><path d="' + SLEEVE_R + '" fill="' + k.sleeve + '"/>';
    // 사이드 라인
    g += '<path d="M118 232 L126 232 L124 428 L116 426 Z M282 232 L274 232 L276 428 L284 426 Z" fill="' + k.trim + '" opacity=".9"/>';
    // 소매 끝 밴드
    g += '<path d="M52 178 L78 250 L90 246 L64 174 Z M348 178 L322 250 L310 246 L336 174 Z" fill="' + k.trim + '"/>';
    // 주름과 음영
    g += '<path d="M150 246 Q162 330 150 424" stroke="#000" stroke-opacity=".07" stroke-width="12" fill="none"/>' +
         '<path d="M246 236 Q236 330 250 424" stroke="#fff" stroke-opacity=".08" stroke-width="16" fill="none"/>' +
         '<path d="M120 238 q16 12 34 8 M280 238 q-16 12 -34 8 M120 300 q20 -6 34 4" stroke="#000" stroke-opacity=".12" stroke-width="2" fill="none"/>' +
         '<ellipse cx="200" cy="' + (back ? 116 : 136) + '" rx="46" ry="9" fill="#000" opacity=".05"/>';
    g += fabricOverlay(id, true);

    inner += '<g clip-path="url(#' + id + 'c)">' + g + "</g>";

    // 4) 봉제선과 밑단 스티치
    inner += '<path d="M128 120 Q122 176 118 232 M272 120 Q278 176 282 232" stroke="' + dk + '" stroke-opacity=".55" stroke-width="1.6" fill="none"/>' +
      '<path d="M118 416 Q200 431 282 416" stroke="' + (isLight(k.body) ? "#000" : "#fff") + '" stroke-opacity=".25" stroke-width="1.4" stroke-dasharray="3 3" fill="none"/>';

    // 5) 칼라
    if (back) {
      inner += '<path d="M158 104 Q200 116 242 104" fill="none" stroke="' + k.trim + '" stroke-width="9" stroke-linecap="round"/>';
    } else if (k.collar === "v") {
      inner += '<path d="M156 103 L200 154 L244 103" fill="none" stroke="' + k.trim + '" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/>' +
        '<path d="M164 106 L200 147 L236 106" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1.5"/>';
    } else {
      inner += '<path d="M157 103 Q200 141 243 103" fill="none" stroke="' + k.trim + '" stroke-width="11" stroke-linecap="round"/>' +
        '<path d="M163 108 Q200 136 237 108" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1.5"/>';
    }

    // 6) 앞: 상점 마크 / 뒤: 이름과 등번호
    if (back) {
      const stroke = k.stripe ? ' stroke="' + shade(k.body, -60) + '" stroke-width="5" paint-order="stroke"' : "";
      inner += '<text x="200" y="176" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="30" letter-spacing="4" fill="' + k.num + '"' + stroke + '>KIM</text>' +
        '<text x="200" y="330" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="150" fill="' + k.num + '"' + stroke + '>7</text>' +
        '<rect x="188" y="112" width="24" height="8" rx="1" fill="' + k.trim + '" opacity=".7"/>';
    } else {
      const logo = k.stripe ? k.trim : (isLight(k.body) ? "#1b1b1b" : "#ffffff");
      inner += '<g transform="translate(232 170)"><path d="M0 22L12 3l12 19z" fill="none" stroke="' + logo + '" stroke-width="3.4" stroke-linejoin="round"/><path d="M7 22l5-7 5 7" fill="none" stroke="' + logo + '" stroke-width="2.2"/></g>';
    }

    const tonal = isLight(k.body) ? shade(k.body, -12) : shade(k.body, 16);
    const defs = '<defs><clipPath id="' + id + 'c"><path d="' + shape + '"/></clipPath>' + fabricDefs(id, false) +
      '<pattern id="' + id + 't" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><rect width="7" height="16" fill="' + tonal + '" opacity=".55"/></pattern></defs>';

    const vb = view === "detail" ? "120 70 160 200" : null;
    return wrap(defs + inner, { vb: vb, cls: back ? "art-back" : "" });
  }

  /* ---------- 바람막이 ---------- */
  const WB_SHAPE = "M156 106 L244 106 L292 124 Q322 136 332 172 L356 396 L316 404 L300 236 L302 428 Q200 440 98 428 L100 236 L84 404 L44 396 L68 172 Q78 136 108 124 Z";

  function windbreakerArt(type, hex, view) {
    const id = uid();
    const back = view === "back";
    const hood = type !== "track";
    const yoke = type === "track" || type === "shell";
    const contrast = isLight(hex) ? "#26282b" : luma(hex) < 45 ? "#5b6068" : "#1d1d1f";
    const dk = shade(hex, -40);
    const metal = "#c9ccd1";
    let inner = "";

    // 후드(앞에서 보면 목 뒤로 보임)
    if (hood && !back) {
      inner += '<path d="M146 112 Q140 50 200 42 Q260 50 254 112 Z" fill="' + shade(hex, -30) + '"/>' +
        '<path d="M162 110 Q162 68 200 63 Q238 68 238 110 Z" fill="' + shade(hex, -75) + '"/>';
    }
    inner += '<path d="' + WB_SHAPE + '" fill="' + hex + '"/>';

    let g = "";
    if (yoke) g += '<path d="M30 198 L150 168 L200 176 L250 168 L370 198 V60 H30 Z" fill="' + contrast + '"/>';
    if (type === "track") g += '<path d="M292 126 Q326 140 338 200 L352 392 M108 126 Q74 140 62 200 L48 392" stroke="' + (yoke ? hex : contrast) + '" stroke-width="5" fill="none" opacity=".9"/>';
    if (back && hood) {
      g += '<path d="M146 108 Q138 200 200 214 Q262 200 254 108 Z" fill="' + shade(hex, -14) + '"/>' +
        '<path d="M200 110 V212" stroke="' + dk + '" stroke-width="1.6" opacity=".6"/>' +
        '<path d="M150 112 Q144 196 200 208 Q256 196 250 112" stroke="#000" stroke-opacity=".18" stroke-width="2" fill="none"/>';
    }
    if (back) {
      g += '<path d="M104 250 Q200 262 296 250 L296 258 Q200 270 104 258 Z" fill="#000" opacity=".14"/>' +
        '<text x="200" y="' + (hood ? 300 : 230) + '" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="17" letter-spacing="6" fill="' + (isLight(hex) ? "#222" : "#fff") + '" opacity=".75">RIDGELINE</text>';
    }
    // 소매 끝 시보리, 밑단 스트링 밴드
    g += '<path d="M44 396 L84 404 L82 388 L43 380 Z M356 396 L316 404 L318 388 L357 380 Z" fill="' + shade(hex, -32) + '"/>' +
      '<path d="M98 414 Q200 427 302 414 L302 428 Q200 440 98 428 Z" fill="' + shade(hex, -24) + '"/>';
    // 주름
    g += '<path d="M62 270 q14 7 28 0 M338 270 q-14 7 -28 0 M58 330 q16 6 30 -2 M342 330 q-16 6 -30 -2 M130 396 q22 -8 44 2 M226 398 q22 -8 44 0" stroke="#000" stroke-opacity=".16" stroke-width="2.2" fill="none"/>' +
      '<path d="M150 200 Q140 300 150 410" stroke="#000" stroke-opacity=".07" stroke-width="14" fill="none"/>';
    g += fabricOverlay(id, false);
    inner += '<g clip-path="url(#' + id + 'c)">' + g + "</g>";

    // 봉제선
    inner += '<path d="M108 124 Q104 180 100 236 M292 124 Q296 180 300 236" stroke="' + dk + '" stroke-opacity=".6" stroke-width="1.6" fill="none"/>' +
      (type === "shell" ? '<path d="M108 124 Q104 180 100 236 M292 124 Q296 180 300 236" stroke="#fff" stroke-opacity=".18" stroke-width="5" fill="none"/>' : "");

    // 칼라 스탠드
    inner += back
      ? '<path d="M156 106 L244 106 L240 124 Q200 130 160 124 Z" fill="' + shade(hex, -14) + '"/>'
      : '<path d="M156 106 L244 106 L238 ' + (type === "track" ? 140 : 132) + ' Q200 146 162 ' + (type === "track" ? 140 : 132) + ' Z" fill="' + (type === "track" ? contrast : shade(hex, -12)) + '"/>';

    if (!back) {
      // 지퍼
      const zipEnd = type === "anorak" ? 240 : 428;
      inner += '<path d="M200 112 V' + zipEnd + '" stroke="#1a1a1a" stroke-width="5"/>' +
        '<path d="M200 112 V' + zipEnd + '" stroke="#5a5a5a" stroke-width="7" stroke-dasharray="1.5 2" opacity=".7"/>' +
        '<rect x="195" y="' + (type === "anorak" ? 150 : 138) + '" width="10" height="24" rx="3" fill="' + metal + '"/>' +
        '<circle cx="200" cy="' + (type === "anorak" ? 178 : 166) + '" r="3.5" fill="none" stroke="' + metal + '" stroke-width="2"/>';
      // 후드 스트링
      if (hood) {
        inner += '<path d="M184 134 Q182 160 178 186 M216 134 Q218 160 222 186" stroke="#e8e8e8" stroke-width="2.6" fill="none"/>' +
          '<rect x="174" y="184" width="8" height="12" rx="2" fill="#2a2a2a"/><rect x="218" y="184" width="8" height="12" rx="2" fill="#2a2a2a"/>';
      }
      // 포켓
      if (type === "anorak") {
        inner += '<path d="M134 300 L266 300 L278 388 L122 388 Z" fill="' + shade(hex, -10) + '"/>' +
          '<path d="M134 300 L266 300 L278 388 L122 388 Z" fill="none" stroke="' + dk + '" stroke-width="1.4" stroke-dasharray="3 3"/>' +
          '<path d="M140 304 L128 384 M260 304 L272 384" stroke="' + dk + '" stroke-width="3"/>';
      } else {
        inner += '<path d="M124 306 L136 372 M276 306 L264 372" stroke="#1a1a1a" stroke-width="3.2"/>' +
          '<rect x="133" y="368" width="6" height="12" rx="2" fill="' + metal + '"/><rect x="261" y="368" width="6" height="12" rx="2" fill="' + metal + '"/>';
      }
      if (yoke) inner += '<path d="M226 196 L268 190" stroke="#111" stroke-width="3"/><rect x="264" y="186" width="6" height="11" rx="2" fill="' + metal + '"/>';
      // 밑단 토글
      inner += '<circle cx="112" cy="432" r="4.5" fill="#222"/><circle cx="288" cy="432" r="4.5" fill="#222"/>' +
        '<path d="M112 436 v10 M288 436 v10" stroke="#ddd" stroke-width="2"/>';
      // 상점 마크
      const logo = yoke ? (isLight(contrast) ? "#111" : "#fff") : (isLight(hex) ? "#1b1b1b" : "#fff");
      inner += '<g transform="translate(126 160)"><path d="M0 20L11 3l11 17z" fill="none" stroke="' + logo + '" stroke-width="3.2" stroke-linejoin="round"/><path d="M6 20l5-6 5 6" fill="none" stroke="' + logo + '" stroke-width="2"/></g>';
    }

    const defs = '<defs><clipPath id="' + id + 'c"><path d="' + WB_SHAPE + '"/></clipPath>' + fabricDefs(id, true) + "</defs>";
    const vb = view === "detail" ? "110 40 180 225" : null;
    return wrap(defs + inner, { vb: vb, cls: back ? "art-back" : "" });
  }

  /* view: "front"(기본) | "back" | "detail" */
  function renderProductArt(product, colorIndex, view) {
    // 관리자가 올린 사진이 있으면 사진 사용 (F-17)
    const src = product.images && product.images[view || "front"];
    if (src) {
      return '<img class="art art-photo' + (view === "back" ? " art-back" : "") + '" src="' + String(src).replace(/"/g, "&quot;") +
        '" alt="" loading="lazy" decoding="async">';
    }
    const color = product.colors[colorIndex || 0] || product.colors[0];
    if (product.cat === "jersey") return jerseyArt(color, view);
    return windbreakerArt(product.type, color.hex, view);
  }

  function findProduct(id) {
    return PRODUCTS.find(function (p) { return p.id === id; });
  }

  global.Shop = global.Shop || {};
  global.Shop.PRODUCTS = PRODUCTS;
  global.Shop.CATEGORIES = CATEGORIES;
  global.Shop.renderProductArt = renderProductArt;
  global.Shop.findProduct = findProduct;
  global.Shop.setProducts = setProducts;
  global.Shop.stockOf = stockOf;
  global.Shop.isSoldOutAll = isSoldOutAll;
  global.Shop.kit = kit;
})(window);
