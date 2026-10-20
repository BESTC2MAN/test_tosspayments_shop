/* =========================================================
   상품 데이터 + 상품 일러스트(SVG)
   실제 상품 이미지가 생기면 image 필드를 추가하고
   renderProductArt()에서 <img>를 반환하도록 바꾸면 됩니다.
   ========================================================= */
(function (global) {
  "use strict";

  const C = {
    black:  { name: "블랙",       hex: "#1b1b1b" },
    navy:   { name: "네이비",     hex: "#1f2a44" },
    red:    { name: "레드",       hex: "#c8261d" },
    yellow: { name: "서밋 골드",  hex: "#e8a317" },
    olive:  { name: "올리브",     hex: "#5b6142" },
    sand:   { name: "샌드",       hex: "#c9b48f" },
    gray:   { name: "그레이",     hex: "#8b8f94" },
    white:  { name: "화이트",     hex: "#efefea" },
    blue:   { name: "블루",       hex: "#2f6db5" },
    green:  { name: "포레스트",   hex: "#2f5d46" },
    orange: { name: "오렌지",     hex: "#e2622b" },
    brown:  { name: "브라운",     hex: "#6b4a32" },
  };

  // 축구 저지 컬러웨이: body(몸판), stripe(세로 줄무늬), sleeve(소매), trim(칼라·소매 끝)
  function kit(name, body, o) {
    o = o || {};
    return {
      name: name,
      hex: body,
      body: body,
      stripe: o.stripe || null,
      sleeve: o.sleeve || null,
      trim: o.trim || (isLight(body) ? "#1b1b1b" : "#ffffff"),
      swatch: o.stripe ? "linear-gradient(90deg," + body + " 50%," + o.stripe + " 50%)" : null,
    };
  }

  const CATEGORIES = {
    jersey:      { key: "jersey",      en: "Football Kits", ko: "축구복", page: "jerseys.html" },
    windbreaker: { key: "windbreaker", en: "Windbreakers",  ko: "바람막이", page: "windbreakers.html" },
  };

  const TOP_SIZES   = ["S", "M", "L", "XL", "XXL"];

  // 구단명은 상품 구분용으로만 사용합니다. 비공식 데모 상품이며 엠블럼·스폰서 로고는 넣지 않습니다.
  const NOTE = " 구단 공식 상품이 아닌 데모 상품으로, 엠블럼과 스폰서 로고는 들어가지 않습니다.";

  const PRODUCTS = [
    // ---------- 축구복: 프리미어리그 빅6 ----------
    { id: "FK-MCI", cat: "jersey", sub: "프리미어리그", name: "맨체스터 시티 저지", price: 129000, sale: 0,     badge: "best", colors: [kit("홈", "#6cabdd"), kit("어웨이", "#1c2c5b", { trim: "#6cabdd" })], sizes: TOP_SIZES, desc: "스카이 블루 홈과 네이비 어웨이. 가벼운 흡습속건 메시 원단의 레귤러 핏." + NOTE },
    { id: "FK-ARS", cat: "jersey", sub: "프리미어리그", name: "아스날 저지",         price: 129000, sale: 0,     badge: "new",  colors: [kit("홈", "#db0007", { sleeve: "#ffffff", trim: "#ffffff" }), kit("어웨이", "#f2c230", { trim: "#0b1e5b" })], sizes: TOP_SIZES, desc: "레드 몸판에 화이트 소매를 매치한 홈 컬러, 옐로 어웨이." + NOTE },
    { id: "FK-LIV", cat: "jersey", sub: "프리미어리그", name: "리버풀 저지",         price: 129000, sale: 0,     badge: "best", colors: [kit("홈", "#c8102e"), kit("어웨이", "#f4f4f0", { trim: "#c8102e" })], sizes: TOP_SIZES, soldOut: ["S"], desc: "올 레드 홈과 화이트 어웨이. 통기 패널로 경기 중에도 시원합니다." + NOTE },
    { id: "FK-MUN", cat: "jersey", sub: "프리미어리그", name: "맨체스터 유나이티드 저지", price: 129000, sale: 109000, badge: "sale", colors: [kit("홈", "#da291c", { trim: "#111111" }), kit("어웨이", "#f4f4f0", { trim: "#da291c" })], sizes: TOP_SIZES, desc: "블랙 칼라 포인트의 레드 홈, 화이트 어웨이." + NOTE },
    { id: "FK-CHE", cat: "jersey", sub: "프리미어리그", name: "첼시 저지",           price: 129000, sale: 0,     badge: "",     colors: [kit("홈", "#034694"), kit("어웨이", "#f4f4f0", { trim: "#034694" })], sizes: TOP_SIZES, desc: "로열 블루 홈과 화이트 어웨이. 신축성 좋은 슬림 레귤러 핏." + NOTE },
    { id: "FK-TOT", cat: "jersey", sub: "프리미어리그", name: "토트넘 홋스퍼 저지",   price: 129000, sale: 99000, badge: "sale", colors: [kit("홈", "#f4f4f0", { trim: "#132257" }), kit("어웨이", "#132257", { trim: "#f4f4f0" })], sizes: TOP_SIZES, desc: "네이비 트림의 화이트 홈, 네이비 어웨이." + NOTE },

    // ---------- 축구복: 라리가 ----------
    { id: "FK-ATM", cat: "jersey", sub: "라리가", name: "아틀레티코 마드리드 저지", price: 129000, sale: 0, badge: "new",  colors: [kit("홈", "#cb3524", { stripe: "#f4f4f0", trim: "#1e2b4e" }), kit("어웨이", "#1e2b4e", { trim: "#cb3524" })], sizes: TOP_SIZES, desc: "레드·화이트 세로 줄무늬 홈과 네이비 어웨이." + NOTE },
    { id: "FK-RMA", cat: "jersey", sub: "라리가", name: "레알 마드리드 저지",       price: 139000, sale: 0, badge: "best", colors: [kit("홈", "#f4f4f0", { trim: "#c9a227" }), kit("어웨이", "#1b2a4a", { trim: "#c9a227" })], sizes: TOP_SIZES, soldOut: ["M"], desc: "골드 트림의 올 화이트 홈, 네이비 어웨이." + NOTE },
    { id: "FK-FCB", cat: "jersey", sub: "라리가", name: "FC 바르셀로나 저지",       price: 139000, sale: 0, badge: "best", colors: [kit("홈", "#a50044", { stripe: "#004d98", sleeve: "#004d98", trim: "#edbb00" }), kit("어웨이", "#edbb00", { trim: "#a50044" })], sizes: TOP_SIZES, desc: "블루·가넷 세로 줄무늬 홈과 골드 어웨이." + NOTE },

    // ---------- 바람막이 ----------
    { id: "WB-001", cat: "windbreaker", type: "shell", sub: "트레이닝", name: "매치데이 트레이닝 윈드 재킷", price: 119000, sale: 0,     badge: "best", colors: [C.black, C.navy, C.red], sizes: TOP_SIZES, desc: "워밍업과 출퇴근 모두에 좋은 풀집 윈드 재킷. 메시 안감으로 땀이 차지 않습니다." },
    { id: "WB-002", cat: "windbreaker", type: "shell", sub: "아노락",   name: "사이드라인 하프집 아노락",     price: 139000, sale: 109000, badge: "sale", colors: [C.blue, C.olive, C.yellow], sizes: TOP_SIZES, desc: "바람을 막는 하프집 아노락. 캥거루 포켓에 접어 넣을 수 있습니다." },
    { id: "WB-003", cat: "windbreaker", type: "shell", sub: "경량",     name: "피치사이드 패커블 재킷",       price: 99000,  sale: 0,     badge: "new",  colors: [C.white, C.black, C.green], sizes: TOP_SIZES, desc: "150g대의 초경량 바람막이. 전용 파우치에 넣어 가방에 챙기기 좋습니다." },
    { id: "WB-004", cat: "windbreaker", type: "shell", sub: "트레이닝", name: "드릴 탑 윈드브레이커",         price: 129000, sale: 0,     badge: "",     colors: [C.navy, C.gray, C.orange], sizes: TOP_SIZES, soldOut: ["XXL"], desc: "팔 움직임이 편한 래글런 소매의 트레이닝 탑. 밑단 스트링으로 바람 차단." },
    { id: "WB-005", cat: "windbreaker", type: "shell", sub: "경량",     name: "올웨더 2L 쉘 재킷",           price: 189000, sale: 0,     badge: "best", colors: [C.yellow, C.black, C.navy], sizes: TOP_SIZES, desc: "가벼운 2레이어 방수 쉘. 비 오는 날 관전과 원정 응원에 추천합니다." },
    { id: "WB-006", cat: "windbreaker", type: "shell", sub: "아노락",   name: "스톰 쉴드 오버헤드 아노락",   price: 159000, sale: 129000, badge: "sale", colors: [C.red, C.sand, C.black], sizes: TOP_SIZES, desc: "넉넉한 오버핏 아노락. 후드 조절 스트링과 사이드 지퍼로 입고 벗기 쉽습니다." },
  ];


  /* ---------- helpers ---------- */
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function isLight(hex) {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 160;
  }

  function wrap(inner) {
    return '<svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid meet">' +
      '<ellipse cx="200" cy="452" rx="150" ry="12" fill="#000" opacity=".07"/>' + inner + "</svg>";
  }

  /* ---------- illustrations ---------- */
  function topArt(type, hex) {
    const dk = shade(hex, -38), lt = shade(hex, 26);
    const trim = isLight(hex) ? "#2a2a2a" : "#151515";
    const logo = isLight(hex) ? "#1b1b1b" : "#ffffff";
    const quilt = type === "jacket"
      ? '<g stroke="' + dk + '" stroke-width="3" opacity=".7"><path d="M108 235h184M108 285h184M108 335h184M108 385h184"/><path d="M52 240l50 4M48 290l52 2M46 340l54 0M298 244l50-4M300 292l52-2M300 340l54 0"/></g>'
      : type === "fleece"
      ? '<g fill="' + dk + '" opacity=".35">' + dots() + "</g>"
      : '<path d="M102 205h196" stroke="' + trim + '" stroke-width="0"/>';
    const yoke = type === "shell"
      ? '<path d="M100 160l40-30h120l40 30v52H100z" fill="' + trim + '"/><path d="M60 190l40-30v52l-48 20z M340 190l-40-30v52l48 20z" fill="' + trim + '"/>'
      : "";
    const zipEnd = type === "shell" && false ? 260 : 410;
    return wrap(
      // sleeves
      '<path d="M100 160L58 188 40 372h44l20-130z" fill="' + hex + '"/>' +
      '<path d="M300 160l42 28 18 184h-44l-20-130z" fill="' + hex + '"/>' +
      '<path d="M40 372h44l-2 18H38z M316 372h44l2 18h-44z" fill="' + trim + '"/>' +
      // body
      '<path d="M140 128h120l40 32v250H100V160z" fill="' + hex + '"/>' +
      yoke + quilt +
      // hem
      '<path d="M100 398h200v16H100z" fill="' + trim + '"/>' +
      // hood / collar
      (type === "fleece"
        ? '<path d="M150 132q50-34 100 0l-14 18q-36-18-72 0z" fill="' + lt + '"/>'
        : '<path d="M146 136q54-92 108 0q-54-26-108 0z" fill="' + lt + '"/><path d="M146 136q54-26 108 0" fill="none" stroke="' + dk + '" stroke-width="3"/>') +
      // zipper
      '<path d="M200 138V' + zipEnd + '" stroke="' + trim + '" stroke-width="5"/>' +
      '<rect x="194" y="150" width="12" height="22" rx="2" fill="#9a9a9a"/>' +
      // pockets
      '<path d="M122 330l46-10M278 330l-46-10" stroke="' + trim + '" stroke-width="4" stroke-linecap="round"/>' +
      // chest logo
      '<g transform="translate(232 182)"><path d="M0 22L12 4l12 18z" fill="none" stroke="' + logo + '" stroke-width="3.5" stroke-linejoin="round"/><path d="M6 22l6-8 6 8" fill="none" stroke="' + logo + '" stroke-width="2.5"/></g>'
    );
  }
  function dots() {
    let s = "";
    for (let y = 175; y < 395; y += 18) for (let x = 112; x < 292; x += 18) s += '<circle cx="' + (x + (y % 36 ? 9 : 0)) + '" cy="' + y + '" r="3"/>';
    return s;
  }

  // 한 페이지에 여러 장이 그려지므로 clipPath id를 매번 다르게 만듭니다
  let artSeq = 0;
  function jerseyArt(k) {
    const id = "jersey-clip-" + (++artSeq);
    const body = "M132 128L172 112Q200 138 228 112L268 128L266 226L272 420H128L134 226Z";
    const sleeve = k.sleeve || k.body;
    const logo = k.stripe ? k.trim : (isLight(k.body) ? "#1b1b1b" : "#ffffff");
    let stripes = "";
    if (k.stripe) {
      for (let x = 119; x < 280; x += 36) stripes += '<rect x="' + x + '" y="100" width="18" height="330" fill="' + k.stripe + '"/>';
    }
    return wrap(
      '<defs><clipPath id="' + id + '"><path d="' + body + '"/></clipPath></defs>' +
      // back collar (inside)
      '<path d="M172 112Q200 98 228 112Q200 138 172 112z" fill="' + shade(k.body, -45) + '"/>' +
      // sleeves + cuffs
      '<path d="M134 128L62 170 82 252 136 230z" fill="' + sleeve + '"/>' +
      '<path d="M266 128L338 170 318 252 264 230z" fill="' + sleeve + '"/>' +
      '<path d="M62 170L82 252M338 170L318 252" stroke="' + k.trim + '" stroke-width="9"/>' +
      // body + stripes + side shading
      '<path d="' + body + '" fill="' + k.body + '"/>' +
      '<g clip-path="url(#' + id + ')">' + stripes +
        '<rect x="120" y="100" width="22" height="330" fill="#000" opacity=".08"/>' +
        '<rect x="258" y="100" width="22" height="330" fill="#000" opacity=".08"/>' +
      "</g>" +
      // collar
      '<path d="M172 112Q200 146 228 112" fill="none" stroke="' + k.trim + '" stroke-width="9" stroke-linecap="round"/>' +
      // hem
      '<path d="M128 412h144" stroke="' + shade(k.body, -30) + '" stroke-width="4" opacity=".6"/>' +
      // maker logo (shop mark only, no club crest)
      '<g transform="translate(228 172)"><path d="M0 20L11 3l11 17z" fill="none" stroke="' + logo + '" stroke-width="3.5" stroke-linejoin="round"/></g>'
    );
  }

  function renderProductArt(product, colorIndex) {
    const color = product.colors[colorIndex || 0] || product.colors[0];
    if (product.cat === "jersey") return jerseyArt(color);
    return topArt(product.type, color.hex);
  }

  function findProduct(id) {
    return PRODUCTS.find(function (p) { return p.id === id; });
  }

  global.Shop = global.Shop || {};
  global.Shop.PRODUCTS = PRODUCTS;
  global.Shop.CATEGORIES = CATEGORIES;
  global.Shop.renderProductArt = renderProductArt;
  global.Shop.findProduct = findProduct;
})(window);
