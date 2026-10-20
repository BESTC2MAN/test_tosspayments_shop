# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

축구복·바람막이 쇼핑몰 "RIDGELINE"의 정적 퍼블리싱(HTML/CSS/바닐라 JS)과 토스페이먼츠 결제위젯 v2 연동 예제입니다. 빌드 도구, 패키지 매니저, 테스트, 린터가 없습니다. 원격 저장소는 `BESTC2MAN/test_tosspayments_shop`이고 Vercel에 빌드 없이 정적 배포됩니다.

## 실행

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1          # http://localhost:8080
powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 3000
```

- 토스페이먼츠 결제위젯은 `file://`에서 동작하지 않습니다. 반드시 http 서버로 엽니다(`checkout.js`가 `file:`이면 경고 배너를 띄움).
- `serve.ps1`은 Node/Python 없이 쓰는 단일 스레드 `HttpListener` 서버입니다. `/`를 `jerseys.html`로 보냅니다. Vercel에서는 같은 역할을 `vercel.json`(redirect)과 `index.html`이 맡습니다. 첫 화면을 바꿀 때는 세 곳을 함께 고칩니다.
- 결제 흐름 확인은 `checkout.html`에서 토스 샌드박스 결제창이 뜨는지까지 보고, 결과 페이지는 `success.html?paymentKey=…&orderId=…&amount=…`, `fail.html?code=…&message=…`로 직접 열어 확인합니다.

## 구조

### 스크립트 로드 순서와 전역 네임스페이스

모든 페이지는 `js/config.js` → `js/products.js` → `js/app.js` 순서로 로드하고, 결제 페이지는 그 뒤에 `db.js` → `checkout.js`, 결과 페이지(`success.html`)는 `db.js` → `result.js`를 붙입니다. 모듈 시스템 없이 전역 객체로 이어집니다.

- `window.SHOP_CONFIG` (`config.js`): 클라이언트 키, 배송비(`SHIPPING_FEE`), 무료배송 기준(`FREE_SHIPPING_OVER`), 승인 서버 주소(`CONFIRM_ENDPOINT`), Supabase 주소와 publishable 키(`SUPABASE_URL`, `SUPABASE_KEY`)
- `window.Shop` (`products.js`가 만들고 `app.js`가 확장): `PRODUCTS`, `CATEGORIES`, `findProduct`, `renderProductArt`, `Cart`, `won`, `esc`, `toast`
- `window.ShopDB` (`db.js`): `createOrder`, `markAuthorized`. 실패해도 예외를 던지지 않고 `false`를 반환해 결제 흐름을 막지 않습니다.

### 상품 목록 페이지

`jerseys.html`(축구복, 첫 화면)과 `windbreakers.html`(바람막이)은 마크업이 거의 같고, `<body data-category="…">` 값(`jersey`/`windbreaker`)만으로 `app.js`의 `initListing()`이 해당 카테고리 상품과 세부 필터 칩(`sub` 값에서 자동 생성)을 그립니다. `windbreakers.html`은 `jerseys.html`을 복제해 히어로와 문구만 바꾼 것이므로 헤더, 푸터, 장바구니 패널, 퀵뷰 모달을 고치면 두 파일 모두 반영해야 합니다. `checkout.html`, `success.html`, `fail.html`은 별도의 간소화된 헤더를 씁니다.

### 상품 데이터와 이미지

- 상품은 `products.js`의 `PRODUCTS` 배열에 하드코딩되어 있습니다. `sale: 0`이면 할인 없음, `soldOut`은 품절 사이즈 목록, `badge`는 `best`/`new`/`sale`입니다.
- 실제 이미지 대신 `renderProductArt(product, colorIndex)`가 SVG를 생성합니다. 축구복(`cat: "jersey"`)은 `jerseyArt()`가 `kit()`로 만든 컬러웨이(`body`, `stripe`, `sleeve`, `trim`)로 저지를 그리고, 바람막이는 `topArt(type, hex)`(현재 `shell`만 사용)로 그립니다. 사진으로 바꿀 때는 이 함수만 교체하면 목록, 퀵뷰, 장바구니, 주문 요약에 모두 반영됩니다.
- 축구복의 색상 옵션은 홈/어웨이 컬러웨이입니다. 줄무늬 저지는 `kit()`가 만든 `swatch`(그라디언트)를 색상 칩 배경으로 씁니다(`app.js`는 `c.swatch || c.hex`).
- 축구복에는 실제 구단명(프리미어리그 빅6, 아틀레티코, 레알, 바르샤)을 상품명으로만 씁니다. 구단 엠블럼, 스폰서·용품사 로고, "공식/레플리카" 같은 표현은 쓰지 않고, 비공식 데모 상품이라는 안내(`NOTE`, 푸터 문구)를 유지합니다. 바람막이와 상점 브랜드는 가상 브랜드이며, 실제 스포츠·아웃도어 브랜드의 이름, 로고, 제품 라인명은 쓰지 않습니다.
- `jerseyArt()`는 `clipPath`를 쓰므로 한 페이지에 여러 장을 그릴 때 id가 겹치지 않도록 `artSeq`로 매번 새 id를 만듭니다.

### 상태 저장

- 장바구니: `localStorage`의 `ridgeline_cart_v1`. 항목 키는 `상품ID|색상인덱스|사이즈`입니다. 변경 시 `document`에 `cart:change` 이벤트를 발생시키고, 헤더 배지와 장바구니 패널이 이를 구독합니다.
- 결제 대기 주문: `checkout.js`가 `requestPayment` 직전에 `sessionStorage`의 `ridgeline_pending_order`에 저장하고, `result.js`가 `orderId`와 `amount`를 URL 파라미터와 대조합니다.
- 주문 DB: Supabase 프로젝트 `ridgeline-shop`(ref `uvvyedkoyelpjrydzheh`, 서울 리전)의 `public.orders`. 상태는 `pending` → `authorized`(성공 페이지) → `confirmed`(승인 서버, 미구현) / `failed`입니다. RLS가 켜져 있고 정책이 없어 anon은 직접 읽거나 쓸 수 없고, SECURITY DEFINER 함수 `create_order`, `mark_order_authorized`(금액이 일치하는 `pending` 주문만 변경)로만 씁니다. 스키마를 바꿀 때는 마이그레이션으로 적용합니다. 프론트엔드에는 publishable 키만 넣고 service_role 키는 넣지 않습니다.

### 결제 흐름 (토스페이먼츠 결제위젯 v2)

1. `checkout.html`이 `https://js.tosspayments.com/v2/standard`를 로드합니다.
2. `TossPayments(clientKey).widgets({ customerKey: TossPayments.ANONYMOUS })` → `setAmount`를 렌더링보다 먼저 호출 → `renderPaymentMethods('#payment-method')`, `renderAgreement('#agreement')`
3. `requestPayment`의 `successUrl`/`failUrl`은 `new URL("success.html", location.href)`로 만들어 배포 경로와 무관하게 동작합니다.
4. 결제 확정(`POST /v1/payments/confirm`)은 시크릿 키가 필요해 서버에서 해야 합니다. 이 저장소에는 서버가 없습니다. `CONFIRM_ENDPOINT`가 비어 있으면 `success.html`은 "Payment Authorized"(인증까지만 완료)를 표시하고, 값이 있으면 그 주소로 `{ paymentKey, orderId, amount }`를 POST합니다. 서버 예시 코드는 `js/result.js` 상단 주석에 있습니다.
5. `TOSS_CLIENT_KEY`는 토스 문서에 공개된 결제위젯 테스트 키(`test_gck_docs_…`)입니다. 결제위젯 연동에는 `gck` 계열 키가 필요하고, API 개별 연동 키(`ck`)는 위젯에서 동작하지 않습니다.

## 주의할 점

- 주문서 폼에는 `name="name"` 입력이 있어 `form.name`이 폼 자체의 name 속성과 충돌합니다. 폼 값은 항상 `form.elements.<name>`으로 읽습니다.
- 금액 계산(`Cart.totals()`)은 할인가(`sale`) 기준이고, 배송비는 `FREE_SHIPPING_OVER` 미만일 때만 붙습니다. 위젯 `setAmount`, 결제 버튼 문구, 주문 요약이 모두 이 값을 씁니다.
- 스타일은 `css/style.css` 한 파일이며 색상, 폰트 등은 `:root` 변수로 관리합니다. 반응형 기준점은 1100px, 860px(모바일 내비게이션 전환), 520px입니다.
