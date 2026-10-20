# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

축구복·바람막이 쇼핑몰 "RIDGELINE"입니다. 화면은 정적 HTML/CSS/바닐라 JS이고, 데이터·회원·결제 확정은 Supabase(Postgres + Auth + Storage + Edge Functions), 결제는 토스페이먼츠 결제위젯 v2입니다. 빌드 도구, 패키지 매니저, 테스트, 린터가 없습니다. 원격 저장소는 `BESTC2MAN/test_tosspayments_shop`이고 Vercel에 빌드 없이 정적 배포됩니다. `main`에 푸시하면 운영 사이트가 바로 바뀌고, 다른 브랜치를 푸시하면 Vercel 미리보기 배포가 만들어집니다. 기능 정의는 `PRD.md`(F-01~F-17)에 있습니다.

## 실행

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1          # http://localhost:8080
powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 3000
```

- 토스페이먼츠 결제위젯은 `file://`에서 동작하지 않습니다. 반드시 http 서버로 엽니다(`checkout.js`가 `file:`이면 경고 배너를 띄움).
- `serve.ps1`은 Node/Python 없이 쓰는 단일 스레드 `HttpListener` 서버입니다. `/`를 `jerseys.html`로 보냅니다. Vercel에서는 같은 역할을 `vercel.json`(redirect)과 `index.html`이 맡습니다. 첫 화면을 바꿀 때는 세 곳을 함께 고칩니다.
- **Supabase는 개발용과 운영용이 나뉘지 않은 프로젝트 하나뿐입니다.** 마이그레이션·Edge Function 배포는 곧바로 운영 사이트(`main`)에도 적용되므로, 운영 중인 화면 코드가 깨지지 않게 함수 시그니처를 호환되게 바꿉니다. 로컬에서 결제 버튼을 누르면 실제 `orders`에 행이 생기니 테스트가 끝나면 지웁니다(테스트 주문번호는 `TEST-` 접두사를 쓰면 찾기 쉽습니다).
- DB 함수는 `execute_sql`로 직접 호출해 검증할 수 있습니다. `raise notice`는 결과로 오지 않으므로 임시 테이블에 로그를 넣고 마지막에 `select` 합니다.
- 토스 샌드박스 결제창은 "테스트용 비밀번호 000000" 같은 PIN 입력이 필요합니다. 끝까지 결제해 보는 테스트는 사용자에게 직접 입력을 부탁합니다.

## 구조

### 페이지

| 페이지 | 역할 | 페이지 스크립트 |
|---|---|---|
| `jerseys.html`, `windbreakers.html` | 상품 목록, 퀵뷰, 장바구니 패널 | (`app.js`) |
| `checkout.html` | 주문서, 쿠폰, 결제위젯 | `checkout.js` |
| `success.html`, `fail.html` | 결제 승인·실패 처리 | `result.js` |
| `orders.html` | 비회원 주문 조회 | 인라인 스크립트 |
| `login.html` | 로그인·가입·비밀번호 재설정 | `login.js` |
| `account.html` | 마이페이지(주문·리뷰 쓰기·찜·배송지·회원 정보) | `account.js` |
| `admin.html` | 관리자(대시보드·주문/배송/취소·상품/재고/사진·쿠폰) | `admin.js` |
| `privacy.html` | 개인정보 처리방침(예시 문서) | 없음 |

`jerseys.html`과 `windbreakers.html`은 마크업이 거의 같고 `<body data-category="…">`(`jersey`/`windbreaker`)만으로 `initListing()`이 상품과 세부 필터 칩을 그립니다. 헤더, 푸터, 장바구니 패널, 퀵뷰 모달을 고치면 두 파일 모두 반영합니다. 나머지 페이지는 간소화된 `.checkout-header`를 씁니다.

### 스크립트 로드 순서와 전역 네임스페이스

모든 페이지(관리자 포함): supabase-js UMD(`cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4`) → `config.js` → `products.js` → `db.js` → `app.js` → `member.js`(관리자 제외) → (`order-view.js`) → 페이지 스크립트. 모듈 시스템 없이 전역 객체로 이어집니다.

- `window.SHOP_CONFIG` (`config.js`): 토스 클라이언트 키, 표시용 배송비 규칙, Supabase 주소·publishable 키, `CONFIRM_ENDPOINT`(= `payments-confirm` Edge Function)
- `window.Shop` (`products.js` + `app.js` + `order-view.js`): `PRODUCTS`, `setProducts`, `fromRow`, `stockOf`, `isSoldOutAll`, `renderProductArt`, `Cart`, `ready`/`onReady`, `openQuickView`, `won`, `esc`, `toast`, 주문 표시 헬퍼(`STATUS`, `orderCardHTML`, `statusHTML`, `fmtDate`, `COURIERS`)
- `window.ShopDB` (`db.js`): Supabase 호출 래퍼. 모든 함수가 예외 대신 `{ ok, data }` / `{ ok: false, code, message, raw }`를 돌려줍니다. DB 함수는 `raise exception '<코드>' using hint = '<손님용 문구>'` 규칙을 써서 `code`에 코드, `message`에 hint가 담깁니다.
- `window.ShopMember` (`member.js`): 헤더 계정 아이콘, 회원 장바구니 동기화, 주문서 자동 입력

**상품은 DB에서 비동기로 불러옵니다.** 화면 초기화는 반드시 `Shop.onReady(fn)` 안에서 합니다(`fn(catalogOk)`). 그 전에 `Cart.load()`를 부르면 상품 검증 없이 캐시됩니다.

### 상품 데이터와 이미지

- 상품은 `public.products`(색상 `colors` jsonb, `sizes`, `images`, `rating_avg`/`review_count`, `active`, `sort`)와 재고 `public.product_stock`(상품·색상인덱스·사이즈별 `qty`)에 있고, 관리자 화면에서 고칩니다. `fromRow()`가 화면용 객체로 바꾸며 축구복 설명 뒤에 비공식 안내 `NOTE`를 붙입니다.
- `colors`는 축구복이면 `kit()` 옵션(`{name, body, stripe, sleeve, trim, collar, pattern, num}`), 바람막이면 `{name, hex}`입니다. 주문·재고·장바구니가 **색상 인덱스**로 연결되므로 기존 색상의 순서를 바꾸거나 지우지 않습니다(관리자 화면도 기존 색상 삭제를 막음).
- 별점·리뷰 수는 `reviews` 트리거가 집계합니다. 리뷰가 없으면 별점을 숨깁니다.
- `renderProductArt(product, colorIndex, view)`: `images.front`가 있으면 사진 상품으로 보고 `images[view]`를 `<img class="art">`로 그리며, 없는 각도는 빈 문자열을 돌려줍니다(목록 카드는 뒷면이 없으면 `.no-back`으로 호버 전환을 끄고, 퀵뷰는 있는 각도만 썸네일로 보여줌). 사진이 없으면 SVG 일러스트(`jerseyArt()`/`windbreakerArt()`, `uid()`로 매번 새 id)를 그립니다. 사진은 색상과 상관없이 한 장이라 색상 칩을 바꿔도 사진은 그대로입니다.
- 현재 상품 사진은 Unsplash 무료 사진 핫링크입니다(`20261020100800_product_photos.sql`, `front`는 4:5 크롭, `detail`은 같은 사진의 2배 확대 크롭). 관리자 페이지에서 올리면 Storage(`product-images`) 주소로 바뀝니다. 리버풀(빨간 유니폼 선수들)과 아틀레티코(경기장)는 Unsplash에 유니폼 단독 사진이 없어 대체 사진입니다.
- 축구복 사진은 사용자 결정으로 실제 구단 유니폼 사진(엠블럼·스폰서 로고 포함)을 씁니다. 상표권 위험이 있으므로 비공식 데모 안내(`NOTE`, 푸터)를 유지하고, 실제 판매 전에는 직접 촬영한 사진으로 바꿉니다. "공식/레플리카" 표현은 쓰지 않습니다. 바람막이와 상점 브랜드는 가상 브랜드라 로고가 보이지 않는 사진만 씁니다.
- 히어로·기획전·마킹 배너 사진은 Unsplash 핫링크입니다.

### 상태 저장

- 장바구니: `localStorage`의 `ridgeline_cart_v1`(키 `상품ID|색상인덱스|사이즈`). 변경 시 `cart:change` 이벤트, 다른 기기 내용으로 바뀌면 `detail.synced: true`. 로그인 회원은 `cart_items` 테이블과 동기화하며, `ridgeline_cart_owner`에 동기화한 회원 ID를 둡니다(처음 한 번만 비회원 장바구니를 합치고, 이후 서버가 기준). 로그아웃하면 로컬 장바구니를 비웁니다.
- 주문: `public.orders`. 상태 흐름은 `pending`(주문 생성) → `authorized`(성공 페이지 도착) → `confirmed`(토스 승인) 또는 `waiting_deposit`(가상계좌) → `preparing` → `shipping` → `delivered`, 그리고 `partial_canceled`/`canceled`/`failed`/`expired`. 화면 문구는 `Shop.STATUS`.
- 재고는 결제 확정 직전(`confirm_begin`)에 차감하고(`stock_reserved`), 승인 실패·취소·만료 때 `release_order_resources`가 되돌립니다. 쿠폰 사용 횟수도 같은 시점에 늘고 줄어듭니다(`coupon_counted`).
- pg_cron `expire-stale-orders`(10분마다)가 1시간 넘은 결제 대기 주문과 입금 기한이 지난 가상계좌 주문을 만료시킵니다.
- 회원: Supabase Auth + `profiles`(`role`이 `admin`이면 관리자, 본인이 바꿀 수 없음). 가입 시 트리거가 `profiles` 행을 만듭니다. 배송지 `addresses`(회원당 10개, 기본 배송지 1개), 찜 `wishlist`, 리뷰 `reviews`(구매 확정 주문의 상품마다 1회, `create_review`).
- 관리자 지정: `update public.profiles set role = 'admin' where id = (select id from auth.users where email = '…');`

### 보안 원칙

- 금액·할인·배송비·재고는 **항상 DB 함수가 다시 계산**합니다(`create_order`, `coupon_discount`, `shop_shipping_fee`). `config.js`의 배송비 값은 화면 표시용이라 바꿀 때 `shop_shipping_fee`도 함께 고칩니다.
- 손님이 직접 부르는 함수: `create_order`, `check_coupon`, `mark_order_authorized`, `mark_order_failed`, `lookup_order`(주문번호 + 휴대폰/이메일 일치), 회원 전용 `replace_cart`, `create_review`, `set_default_address`. 관리자 전용 `admin_stats`, `admin_update_order`는 내부에서 `is_admin()`을 확인합니다.
- `confirm_begin`, `confirm_finish`, `release_order_resources`, `apply_cancel`, `sync_payment_status`, `expire_stale_orders`는 service_role 전용입니다(Edge Function과 pg_cron만 호출).
- 테이블 RLS: 상품·재고·리뷰는 누구나 읽기, 주문은 본인·관리자 읽기, 배송지·찜·장바구니는 본인만, 상품·재고·쿠폰 쓰기와 Storage 업로드는 관리자만.
- 프론트엔드에는 publishable 키만 넣습니다. 스키마 변경은 `supabase/migrations/`에 파일을 남기고 마이그레이션으로 적용합니다. Supabase 보안 점검(advisors)에 남는 "anon/authenticated가 SECURITY DEFINER 함수 실행 가능" 경고는 위의 공개 함수들이라 의도된 것입니다.

### 결제 흐름 (토스페이먼츠 결제위젯 v2 + Edge Functions)

1. `checkout.js`: `TossPayments(clientKey).widgets({ customerKey })`(회원은 회원 ID, 비회원은 `ANONYMOUS`) → `setAmount`를 렌더링보다 먼저 → 결제수단·약관 렌더. 쿠폰을 적용하면 `setAmount`를 다시 호출합니다.
2. 결제 버튼: `create_order`로 주문을 먼저 저장합니다(실패하면 결제창을 열지 않음). 그다음 `requestPayment`. 결제창을 닫으면 `mark_order_failed`.
3. `success.html` → `result.js`가 `mark_order_authorized` 후 `payments-confirm` Edge Function에 `{ paymentKey, orderId, amount }`를 보냅니다. 함수는 `confirm_begin`(주문 금액 대조, 재고·쿠폰 확보) → 토스 `POST /v1/payments/confirm`(멱등키 `confirm-<orderId>`) → `confirm_finish` 순서로 처리합니다. 실패하면 `fail.html?…&confirmed=1`로 보냅니다.
4. `payments-cancel`(관리자 로그인 토큰 필요): 전체/부분 취소 후 `apply_cancel`. `payments-webhook`: 토스 웹훅을 받아 결제를 토스에서 다시 조회한 뒤 `sync_payment_status`. 웹훅 주소는 토스 개발자센터에 등록해야 동작합니다.
5. Edge Function은 `verify_jwt: false`로 배포하고 함수 안에서 검증합니다(publishable 키는 JWT가 아님). 시크릿 키는 Supabase Secrets `TOSS_SECRET_KEY`를 쓰고, 없으면 토스 문서 공개 테스트 키(`test_gsk_docs_…`)를 씁니다. 실제 판매 전에 `TOSS_SECRET_KEY`와 `config.js`의 `TOSS_CLIENT_KEY`를 같은 상점의 라이브 키로 함께 바꿉니다. 소스는 `supabase/functions/`에 있습니다.
6. `TOSS_CLIENT_KEY`는 결제위젯용 `gck` 계열이어야 합니다(API 개별 연동 `ck` 키는 위젯에서 동작하지 않음).

### 외부 설정이 필요한 것

- 카카오·구글 로그인: Supabase 대시보드 Authentication > Providers에서 켜고 키를 넣어야 합니다. 꺼져 있으면 `login.js`가 `/auth/v1/settings`를 보고 "준비 중" 안내만 띄웁니다.
- 가입 인증·비밀번호 재설정 메일의 링크(`account.html`, `login.html?mode=update`)가 동작하려면 Authentication > URL Configuration의 Site URL과 Redirect URLs에 배포 주소와 `http://localhost:8080`을 넣습니다. 기본 메일 발송은 시간당 횟수 제한이 있습니다.

## 주의할 점

- 주문서 폼에는 `name="name"` 입력이 있어 `form.name`이 폼 자체의 name 속성과 충돌합니다. 폼 값은 항상 `form.elements.<name>`으로 읽습니다.
- `Cart.totals(coupon)`은 할인가 기준이고, 무료배송 기준은 쿠폰 적용 전 상품 금액입니다. 서버(`create_order`)도 같은 규칙입니다.
- 스타일은 `css/style.css` 한 파일이며 `:root` 변수로 색상·폰트를 관리합니다. 반응형 기준점은 1100px, 860px, 520px입니다. DB 연동 기능 스타일은 파일 끝 "DB 연동 기능" 구역에 있고, `[hidden]`이 `display` 지정보다 우선하도록 맨 끝에 `!important` 규칙이 있습니다.
- 상품 이미지 칸은 `aspect-ratio` 상자 안에 SVG를 `position: absolute`로 채웁니다. 그리드 열은 `minmax(0, 1fr)`로 씁니다. 상품 이미지 상자 안에 다른 아이콘 SVG를 넣으면 이 규칙을 받으므로 따로 덮어씁니다(찜 하트 참고).
- 860px 이하에서는 카드 호버로 뒷면을 보여주지 않습니다.
