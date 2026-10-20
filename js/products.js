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

  const CATEGORIES = {
    clothing: { key: "clothing", en: "Clothing", ko: "옷",   page: "clothing.html" },
    shoes:    { key: "shoes",    en: "Footwear", ko: "신발", page: "shoes.html" },
    pants:    { key: "pants",    en: "Pants",    ko: "바지", page: "pants.html" },
  };

  const TOP_SIZES   = ["S", "M", "L", "XL", "XXL"];
  const PANT_SIZES  = ["28", "30", "32", "34", "36"];
  const SHOE_SIZES  = ["240", "250", "260", "270", "280", "290"];

  const PRODUCTS = [
    // ---------- 옷 ----------
    { id: "CL-001", cat: "clothing", type: "jacket", sub: "패딩",     name: "서밋 레트로 다운 재킷", price: 359000, sale: 0,      badge: "best", colors: [C.black, C.yellow, C.red], sizes: TOP_SIZES, soldOut: ["XXL"], desc: "700 필파워 구스 다운을 채운 박스 핏 퍼퍼. 패커블 후드가 칼라에 수납됩니다." },
    { id: "CL-002", cat: "clothing", type: "shell",  sub: "바람막이", name: "알파인 라이트 3L 쉘 재킷",   price: 489000, sale: 429000, badge: "sale", colors: [C.orange, C.navy, C.black], sizes: TOP_SIZES, desc: "3레이어 방수·투습 멤브레인. 헬멧 호환 후드와 피트 집 벤틸레이션." },
    { id: "CL-003", cat: "clothing", type: "fleece", sub: "플리스",   name: "보레알 하이파일 플리스 재킷",     price: 229000, sale: 0,      badge: "new",  colors: [C.sand, C.black, C.green], sizes: TOP_SIZES, desc: "재활용 폴리에스터 하이파일 플리스. 어깨와 팔꿈치는 나일론 보강." },
    { id: "CL-004", cat: "clothing", type: "jacket", sub: "패딩",     name: "하이 앨티튜드 익스페디션 파카",       price: 699000, sale: 0,      badge: "",     colors: [C.red, C.black], sizes: TOP_SIZES, desc: "극한 환경용 800 필파워 다운. 배플 구조와 스노우 스커트 적용." },
    { id: "CL-005", cat: "clothing", type: "shell",  sub: "바람막이", name: "트레일 윈드 아노락",             price: 159000, sale: 119000, badge: "sale", colors: [C.blue, C.olive, C.yellow], sizes: TOP_SIZES, desc: "가볍고 바람을 막는 하프 집 아노락. 캥거루 포켓에 셀프 패커블." },
    { id: "CL-006", cat: "clothing", type: "fleece", sub: "플리스",   name: "글래시어 1/4 집 플리스",         price: 99000,  sale: 0,      badge: "",     colors: [C.gray, C.navy, C.brown], sizes: TOP_SIZES, desc: "미드레이어로 좋은 마이크로 플리스. 일상과 산행 모두에 무난합니다." },
    { id: "CL-007", cat: "clothing", type: "jacket", sub: "패딩",     name: "에코 써멀 경량 패딩",          price: 249000, sale: 0,      badge: "new",  colors: [C.green, C.black, C.white], sizes: TOP_SIZES, desc: "합성 충전재로 젖어도 보온력을 유지. 주머니에 수납되는 경량 패딩." },
    { id: "CL-008", cat: "clothing", type: "shell",  sub: "바람막이", name: "릿지 쉘 2L 방수 재킷",  price: 329000, sale: 0,      badge: "best", colors: [C.yellow, C.black, C.navy], sizes: TOP_SIZES, soldOut: ["S"], desc: "아이코닉한 컬러 블로킹의 2레이어 방수 재킷. 내부 지퍼로 플리스 결합 가능." },

    // ---------- 신발 ----------
    { id: "SH-001", cat: "shoes", type: "boot",    sub: "등산화",   name: "베어리지 미드 방수 하이킹 부츠", price: 239000, sale: 0,      badge: "best", colors: [C.brown, C.black], sizes: SHOE_SIZES, soldOut: ["290"], desc: "방수 멤브레인과 고무 러그 아웃솔. 발목을 안정적으로 잡아주는 미드컷." },
    { id: "SH-002", cat: "shoes", type: "runner",  sub: "트레일러닝", name: "엔듀로 트레일 러너",   price: 189000, sale: 159000, badge: "sale", colors: [C.orange, C.black, C.blue], sizes: SHOE_SIZES, desc: "로커 지오메트리 미드솔로 추진력을 더한 장거리 트레일 러닝화." },
    { id: "SH-003", cat: "shoes", type: "boot",    sub: "등산화",   name: "크레스트 GTX 백패킹 부츠",       price: 299000, sale: 0,      badge: "new",  colors: [C.gray, C.olive], sizes: SHOE_SIZES, desc: "무거운 짐을 진 장거리 산행용. TPU 섕크로 비틀림을 막아줍니다." },
    { id: "SH-004", cat: "shoes", type: "mule",    sub: "윈터슈즈", name: "써멀 패딩 뮬",               price: 109000, sale: 0,      badge: "",     colors: [C.black, C.sand, C.red], sizes: SHOE_SIZES, desc: "캠핑장과 일상용 패딩 뮬. 미끄럼 방지 고무 아웃솔." },
    { id: "SH-005", cat: "shoes", type: "runner",  sub: "트레일러닝", name: "플라이트 테크 레이스 쇼즈",     price: 249000, sale: 0,      badge: "",     colors: [C.white, C.yellow], sizes: SHOE_SIZES, desc: "카본 플레이트 내장 트레일 레이싱화. 가볍고 반발력이 뛰어납니다." },
    { id: "SH-006", cat: "shoes", type: "boot",    sub: "윈터슈즈", name: "체나 스노우 부츠",               price: 199000, sale: 169000, badge: "sale", colors: [C.black, C.brown], sizes: SHOE_SIZES, soldOut: ["240"], desc: "200g 인슐레이션과 방수 가죽. 영하의 눈길에서도 따뜻하게." },
    { id: "SH-007", cat: "shoes", type: "runner",  sub: "트레일러닝", name: "하이퍼 그립 어프로치 슈즈",     price: 169000, sale: 0,      badge: "new",  colors: [C.green, C.gray], sizes: SHOE_SIZES, desc: "바위 구간에 강한 스티키 러버 토캡. 등반 접근로 전용 설계." },
    { id: "SH-008", cat: "shoes", type: "mule",    sub: "윈터슈즈", name: "퀼티드 다운 부티",                 price: 139000, sale: 0,      badge: "best", colors: [C.black, C.navy, C.white], sizes: SHOE_SIZES, desc: "퀼팅 다운 부티. 뒤꿈치를 접어 슬리퍼처럼 신을 수 있습니다." },

    // ---------- 바지 ----------
    { id: "PT-001", cat: "pants", type: "cargo",   sub: "카고",     name: "릿지 립스탑 카고 팬츠",          price: 149000, sale: 0,      badge: "best", colors: [C.olive, C.black, C.sand], sizes: PANT_SIZES, desc: "튼튼한 립스탑 원단과 대용량 사이드 포켓. 조절 가능한 밑단." },
    { id: "PT-002", cat: "pants", type: "hiking",  sub: "등산바지", name: "트래버스 컨버터블 팬츠",       price: 129000, sale: 99000,  badge: "sale", colors: [C.gray, C.sand, C.black], sizes: PANT_SIZES, desc: "지퍼로 반바지 전환. 자외선 차단과 속건 기능." },
    { id: "PT-003", cat: "pants", type: "shell",   sub: "방수바지", name: "알파인 3L 쉘 팬츠",              price: 359000, sale: 0,      badge: "new",  colors: [C.black, C.red], sizes: PANT_SIZES, soldOut: ["28"], desc: "풀 사이드 집으로 부츠를 신은 채 착용. 크램폰 가드 적용." },
    { id: "PT-004", cat: "pants", type: "jogger",  sub: "조거",     name: "트레일 플리스 조거",             price: 89000,  sale: 0,      badge: "",     colors: [C.navy, C.gray, C.black], sizes: PANT_SIZES, desc: "기모 안감의 편안한 조거. 캠핑과 리커버리 웨어로 추천." },
    { id: "PT-005", cat: "pants", type: "hiking",  sub: "등산바지", name: "익스플로러 스트레치 팬츠",       price: 139000, sale: 0,      badge: "best", colors: [C.black, C.navy, C.olive], sizes: PANT_SIZES, desc: "4방향 스트레치와 무릎 다트 패턴. 사계절 산행용 기본 바지." },
    { id: "PT-006", cat: "pants", type: "cargo",   sub: "카고",     name: "유틸리티 와이드 카고",           price: 159000, sale: 129000, badge: "sale", colors: [C.sand, C.brown], sizes: PANT_SIZES, desc: "여유 있는 와이드 핏. 캔버스 질감의 내구성 높은 코튼 블렌드." },
    { id: "PT-007", cat: "pants", type: "shell",   sub: "방수바지", name: "패커블 레인 팬츠",           price: 119000, sale: 0,      badge: "",     colors: [C.black, C.navy], sizes: PANT_SIZES, desc: "가볍게 챙기는 방수 오버 팬츠. 스터프 색 포함." },
    { id: "PT-008", cat: "pants", type: "jogger",  sub: "조거",     name: "인슐레이티드 윈터 팬츠",       price: 199000, sale: 0,      badge: "new",  colors: [C.black, C.green], sizes: PANT_SIZES, desc: "보온 충전재를 넣은 겨울 조거. 발목 스냅으로 냉기 차단." },
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

  function pantsArt(type, hex) {
    const dk = shade(hex, -36), lt = shade(hex, 22);
    const trim = isLight(hex) ? "#3a3a3a" : "#111";
    const wide = type === "cargo" ? 14 : 0;
    const taper = type === "jogger" ? 12 : 0;
    let extra = "";
    if (type === "cargo") {
      extra = '<rect x="104" y="250" width="44" height="58" rx="3" fill="' + dk + '"/><rect x="104" y="250" width="44" height="14" fill="' + shade(hex, -50) + '"/>' +
              '<rect x="252" y="250" width="44" height="58" rx="3" fill="' + dk + '"/><rect x="252" y="250" width="44" height="14" fill="' + shade(hex, -50) + '"/>';
    } else if (type === "shell") {
      extra = '<path d="M118 140l-16 290M282 140l16 290" stroke="' + trim + '" stroke-width="4" stroke-dasharray="2 6"/>' +
              '<path d="M108 330h80M212 330h80" stroke="' + lt + '" stroke-width="6" opacity=".5"/>';
    } else if (type === "hiking") {
      extra = '<path d="M112 300q38 10 76 0M212 300q38 10 76 0" fill="none" stroke="' + dk + '" stroke-width="3"/>' +
              '<path d="M108 250h80M212 250h80" stroke="' + trim + '" stroke-width="3" stroke-dasharray="6 4"/>';
    }
    const cuff = type === "jogger"
      ? '<path d="M' + (112 + taper) + ' 410h' + (72 - taper) + 'v24h-' + (72 - taper) + 'zM' + (216) + ' 410h' + (72 - taper) + 'v24h-' + (72 - taper) + 'z" fill="' + dk + '"/>'
      : "";
    return wrap(
      '<path d="M126 132h148l' + (16 + wide) + ' ' + (302) + 'h-' + (82 + wide - taper) + 'L200 200l-8 234h-' + (82 + wide - taper) + 'z" fill="' + hex + '"/>' +
      '<rect x="124" y="104" width="152" height="30" fill="' + dk + '"/>' +
      '<path d="M140 104v30M170 104v30M230 104v30M260 104v30" stroke="' + shade(hex, -60) + '" stroke-width="4"/>' +
      '<path d="M200 134v62" stroke="' + dk + '" stroke-width="3"/>' +
      '<path d="M136 150q22 22 46 8M264 150q-22 22-46 8" fill="none" stroke="' + dk + '" stroke-width="3"/>' +
      extra + cuff +
      '<g transform="translate(236 370)"><path d="M0 18L10 3l10 15z" fill="none" stroke="' + (isLight(hex) ? "#1b1b1b" : "#fff") + '" stroke-width="3" stroke-linejoin="round"/></g>'
    );
  }

  function shoeArt(type, hex) {
    const dk = shade(hex, -40), lt = shade(hex, 30);
    const sole = isLight(hex) ? "#2b2b2b" : "#f2efe8";
    const outsole = "#1c1c1c";
    if (type === "mule") {
      return wrap(
        '<path d="M52 340h300q16 0 12 18l-4 14H58q-14 0-14-14z" fill="' + outsole + '"/>' +
        '<path d="M56 312h292q14 0 14 16v14H48v-14q0-16 8-16z" fill="' + sole + '"/>' +
        '<path d="M66 314q-4-52 40-84q70-48 150-20q60 22 96 104z" fill="' + hex + '"/>' +
        '<g stroke="' + dk + '" stroke-width="4" fill="none" opacity=".8"><path d="M110 236q60 30 70 78"/><path d="M160 214q60 30 70 100"/><path d="M216 208q50 34 56 106"/></g>' +
        '<g transform="translate(286 268)"><path d="M0 20L11 3l11 17z" fill="none" stroke="' + (isLight(hex) ? "#1b1b1b" : "#fff") + '" stroke-width="3" stroke-linejoin="round"/></g>'
      );
    }
    const high = type === "boot";
    const collarY = high ? 150 : 210;
    return wrap(
      // outsole
      '<path d="M44 348h318q14 0 10 16l-6 16H56q-16 0-16-14z" fill="' + outsole + '"/>' +
      '<path d="M60 380l10-12M90 380l10-12M120 380l10-12M150 380l10-12M180 380l10-12M210 380l10-12M240 380l10-12M270 380l10-12M300 380l10-12M330 380l10-12" stroke="#444" stroke-width="3"/>' +
      // midsole
      '<path d="M50 318h306q20 0 16 30H44q-4-30 6-30z" fill="' + sole + '"/>' +
      // upper
      '<path d="M56 320q-8-' + (high ? 120 : 70) + ' 30-' + (high ? 170 : 110) + 'h' + (high ? 70 : 64) + 'q14 ' + (high ? 70 : 34) + ' 54 ' + (high ? 100 : 70) + 'l120 46q34 14 30 64z" fill="' + hex + '"/>' +
      // toe cap & heel
      '<path d="M300 288q50 10 54 32H264q4-26 36-32z" fill="' + dk + '"/>' +
      '<path d="M56 320q-8-50 8-96l30 8q-10 46 0 88z" fill="' + dk + '"/>' +
      // collar
      '<path d="M86 ' + collarY + 'h' + (high ? 70 : 64) + '" stroke="' + lt + '" stroke-width="10" stroke-linecap="round"/>' +
      // tongue + laces
      '<path d="M' + (high ? 156 : 150) + ' ' + (collarY - 6) + 'q30 ' + (high ? 40 : 20) + ' 50 ' + (high ? 100 : 66) + '" stroke="' + lt + '" stroke-width="16" fill="none" stroke-linecap="round"/>' +
      '<g stroke="' + (isLight(hex) ? "#333" : "#f2f2f2") + '" stroke-width="5" stroke-linecap="round">' +
        (high
          ? '<path d="M150 176l26-6M158 200l28-6M168 224l28-6M182 246l28-6M198 266l28-6"/>'
          : '<path d="M160 228l26-8M172 248l26-8M188 266l26-8M204 282l26-8"/>') +
      "</g>" +
      // logo
      '<g transform="translate(96 ' + (high ? 250 : 268) + ')"><path d="M0 20L11 3l11 17z" fill="none" stroke="' + (isLight(hex) ? "#1b1b1b" : "#fff") + '" stroke-width="3.5" stroke-linejoin="round"/></g>' +
      (type === "runner" ? '<path d="M110 300q90-40 170-6" stroke="' + lt + '" stroke-width="6" fill="none" opacity=".8"/>' : "")
    );
  }

  function renderProductArt(product, colorIndex) {
    const color = product.colors[colorIndex || 0] || product.colors[0];
    if (product.cat === "shoes") return shoeArt(product.type, color.hex);
    if (product.cat === "pants") return pantsArt(product.type, color.hex);
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
