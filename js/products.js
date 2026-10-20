/* =========================================================
   상품 데이터 + 상품 일러스트(SVG)
   실제 상품 사진이 생기면 image 필드를 추가하고
   renderProductArt()에서 <img>를 반환하도록 바꾸면 됩니다.
   ========================================================= */
(function (global) {
  "use strict";

  const C = {
    black:  { name: "블랙",       hex: "#1d1d1f" },
    navy:   { name: "네이비",     hex: "#1f2a44" },
    red:    { name: "레드",       hex: "#c8261d" },
    yellow: { name: "볼트 옐로",  hex: "#e8c21a" },
    olive:  { name: "올리브",     hex: "#5b6142" },
    sand:   { name: "샌드",       hex: "#cbb892" },
    gray:   { name: "그레이",     hex: "#8b8f94" },
    white:  { name: "화이트",     hex: "#efefea" },
    blue:   { name: "블루",       hex: "#2f6db5" },
    green:  { name: "포레스트",   hex: "#2f5d46" },
    orange: { name: "오렌지",     hex: "#e2622b" },
  };

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

  const TOP_SIZES = ["S", "M", "L", "XL", "XXL"];

  // 구단명은 상품 구분용으로만 사용합니다. 비공식 데모 상품이며 엠블럼·스폰서 로고는 넣지 않습니다.
  const NOTE = " 구단 공식 상품이 아닌 데모 상품으로, 엠블럼과 스폰서 로고는 들어가지 않습니다.";

  const PRODUCTS = [
    // ---------- 축구복: 프리미어리그 빅6 ----------
    { id: "FK-MCI", cat: "jersey", club: "MCI", clubShort: "맨시티", sub: "프리미어리그", name: "맨체스터 시티 저지", price: 129000, sale: 0, badge: "best", rating: 4.8, reviews: 1284,
      colors: [kit("홈", "#6cabdd", { trim: "#ffffff", pattern: "tonal", num: "#1c2c5b" }), kit("어웨이", "#1c2c5b", { trim: "#6cabdd", collar: "v", pattern: "pin" })], sizes: TOP_SIZES,
      desc: "스카이 블루 홈과 네이비 어웨이. 가벼운 흡습속건 메시 원단의 레귤러 핏." + NOTE },
    { id: "FK-ARS", cat: "jersey", club: "ARS", clubShort: "아스날", sub: "프리미어리그", name: "아스날 저지", price: 129000, sale: 0, badge: "new", rating: 4.9, reviews: 962,
      colors: [kit("홈", "#db0007", { sleeve: "#ffffff", trim: "#ffffff", num: "#ffffff" }), kit("어웨이", "#f2c230", { trim: "#0b1e5b", collar: "v", pattern: "tonal" })], sizes: TOP_SIZES,
      desc: "레드 몸판에 화이트 소매를 매치한 홈 컬러, 옐로 어웨이." + NOTE },
    { id: "FK-LIV", cat: "jersey", club: "LIV", clubShort: "리버풀", sub: "프리미어리그", name: "리버풀 저지", price: 129000, sale: 0, badge: "best", rating: 4.8, reviews: 1517,
      colors: [kit("홈", "#c8102e", { trim: "#ffffff", pattern: "pin" }), kit("어웨이", "#f4f4f0", { trim: "#c8102e", collar: "v" })], sizes: TOP_SIZES, soldOut: ["S"],
      desc: "올 레드 홈과 화이트 어웨이. 통기 패널로 경기 중에도 시원합니다." + NOTE },
    { id: "FK-MUN", cat: "jersey", club: "MUN", clubShort: "맨유", sub: "프리미어리그", name: "맨체스터 유나이티드 저지", price: 129000, sale: 109000, badge: "sale", rating: 4.7, reviews: 1103,
      colors: [kit("홈", "#da291c", { trim: "#111111", collar: "v", pattern: "tonal", num: "#ffffff" }), kit("어웨이", "#f4f4f0", { trim: "#da291c" })], sizes: TOP_SIZES,
      desc: "블랙 칼라 포인트의 레드 홈, 화이트 어웨이." + NOTE },
    { id: "FK-CHE", cat: "jersey", club: "CHE", clubShort: "첼시", sub: "프리미어리그", name: "첼시 저지", price: 129000, sale: 0, badge: "", rating: 4.6, reviews: 744,
      colors: [kit("홈", "#034694", { trim: "#ffffff", pattern: "tonal" }), kit("어웨이", "#f4f4f0", { trim: "#034694", collar: "v", pattern: "hoop" })], sizes: TOP_SIZES,
      desc: "로열 블루 홈과 화이트 어웨이. 신축성 좋은 슬림 레귤러 핏." + NOTE },
    { id: "FK-TOT", cat: "jersey", club: "TOT", clubShort: "토트넘", sub: "프리미어리그", name: "토트넘 홋스퍼 저지", price: 129000, sale: 99000, badge: "sale", rating: 4.8, reviews: 2210,
      colors: [kit("홈", "#f4f4f0", { trim: "#132257", pattern: "tonal" }), kit("어웨이", "#132257", { trim: "#f4f4f0", collar: "v", pattern: "pin" })], sizes: TOP_SIZES,
      desc: "네이비 트림의 화이트 홈, 네이비 어웨이." + NOTE },

    // ---------- 축구복: 라리가 ----------
    { id: "FK-ATM", cat: "jersey", club: "ATM", clubShort: "아틀레티코", sub: "라리가", name: "아틀레티코 마드리드 저지", price: 129000, sale: 0, badge: "new", rating: 4.7, reviews: 418,
      colors: [kit("홈", "#cb3524", { stripe: "#f4f4f0", sleeve: "#cb3524", trim: "#1e2b4e", num: "#1e2b4e" }), kit("어웨이", "#1e2b4e", { trim: "#cb3524", collar: "v", pattern: "tonal" })], sizes: TOP_SIZES,
      desc: "레드·화이트 세로 줄무늬 홈과 네이비 어웨이." + NOTE },
    { id: "FK-RMA", cat: "jersey", club: "RMA", clubShort: "레알", sub: "라리가", name: "레알 마드리드 저지", price: 139000, sale: 0, badge: "best", rating: 4.9, reviews: 1876,
      colors: [kit("홈", "#f4f4f0", { trim: "#c9a227", collar: "v", pattern: "tonal", num: "#1b2a4a" }), kit("어웨이", "#1b2a4a", { trim: "#c9a227", pattern: "pin" })], sizes: TOP_SIZES, soldOut: ["M"],
      desc: "골드 트림의 올 화이트 홈, 네이비 어웨이." + NOTE },
    { id: "FK-FCB", cat: "jersey", club: "FCB", clubShort: "바르샤", sub: "라리가", name: "FC 바르셀로나 저지", price: 139000, sale: 0, badge: "best", rating: 4.8, reviews: 1652,
      colors: [kit("홈", "#a50044", { stripe: "#004d98", sleeve: "#004d98", trim: "#edbb00", num: "#edbb00" }), kit("어웨이", "#edbb00", { trim: "#a50044", collar: "v", pattern: "tonal" })], sizes: TOP_SIZES,
      desc: "블루·가넷 세로 줄무늬 홈과 골드 어웨이." + NOTE },

    // ---------- 바람막이 (type: track 풀집 트랙 · anorak 하프집 · packable 경량 후드 · shell 방수 후드) ----------
    { id: "WB-001", cat: "windbreaker", type: "track",    sub: "트레이닝", name: "매치데이 트레이닝 윈드 재킷", price: 119000, sale: 0,      badge: "best", rating: 4.7, reviews: 538, colors: [C.black, C.navy, C.red], sizes: TOP_SIZES, desc: "워밍업과 출퇴근 모두에 좋은 풀집 윈드 재킷. 메시 안감으로 땀이 차지 않습니다." },
    { id: "WB-002", cat: "windbreaker", type: "anorak",   sub: "아노락",   name: "사이드라인 하프집 아노락",     price: 139000, sale: 109000, badge: "sale", rating: 4.6, reviews: 302, colors: [C.blue, C.olive, C.yellow], sizes: TOP_SIZES, desc: "바람을 막는 하프집 아노락. 캥거루 포켓에 접어 넣을 수 있습니다." },
    { id: "WB-003", cat: "windbreaker", type: "packable", sub: "경량",     name: "피치사이드 패커블 재킷",       price: 99000,  sale: 0,      badge: "new",  rating: 4.8, reviews: 211, colors: [C.white, C.black, C.green], sizes: TOP_SIZES, desc: "150g대의 초경량 바람막이. 전용 파우치에 넣어 가방에 챙기기 좋습니다." },
    { id: "WB-004", cat: "windbreaker", type: "track",    sub: "트레이닝", name: "드릴 탑 윈드브레이커",         price: 129000, sale: 0,      badge: "",     rating: 4.5, reviews: 187, colors: [C.navy, C.gray, C.orange], sizes: TOP_SIZES, soldOut: ["XXL"], desc: "팔 움직임이 편한 래글런 소매의 트레이닝 탑. 밑단 스트링으로 바람 차단." },
    { id: "WB-005", cat: "windbreaker", type: "shell",    sub: "경량",     name: "올웨더 2L 쉘 재킷",           price: 189000, sale: 0,      badge: "best", rating: 4.9, reviews: 655, colors: [C.yellow, C.black, C.navy], sizes: TOP_SIZES, desc: "가벼운 2레이어 방수 쉘. 비 오는 날 관전과 원정 응원에 추천합니다." },
    { id: "WB-006", cat: "windbreaker", type: "anorak",   sub: "아노락",   name: "스톰 쉴드 오버헤드 아노락",   price: 159000, sale: 129000, badge: "sale", rating: 4.7, reviews: 344, colors: [C.red, C.sand, C.black], sizes: TOP_SIZES, desc: "넉넉한 오버핏 아노락. 후드 조절 스트링과 사이드 지퍼로 입고 벗기 쉽습니다." },
  ];

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
})(window);
