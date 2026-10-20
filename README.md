# RIDGELINE — 토스페이먼츠 연동 쇼핑몰 퍼블리싱

축구복·바람막이 쇼핑몰 정적 퍼블리싱(HTML/CSS/JS)과 토스페이먼츠 결제위젯 v2 연동 예제입니다.

> 축구복은 결제 테스트용 데모 상품입니다. 각 구단의 공식 상품이 아니며, 구단명만 쓰고 엠블럼·스폰서 로고는 넣지 않습니다.

## 페이지

| 파일 | 설명 |
| --- | --- |
| `jerseys.html` | 축구복 상품 목록 (프리미어리그 빅6 / 라리가 3구단, 홈·어웨이) — 첫 화면 |
| `windbreakers.html` | 바람막이 상품 목록 (트레이닝 / 아노락 / 경량) |
| `checkout.html` | 주문서 + 토스페이먼츠 결제위젯 |
| `success.html` | 결제 성공(successUrl) |
| `fail.html` | 결제 실패·취소(failUrl) |

## 실행

토스페이먼츠 결제는 `file://`에서 동작하지 않으므로 http 서버로 열어야 합니다.

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1   # http://localhost:8080
```

Node가 있다면 `npx serve .`, Python이 있다면 `python -m http.server 8080`도 됩니다.

## 결제 흐름

1. `checkout.html`에서 `TossPayments(clientKey).widgets()`로 결제수단·약관 위젯 렌더링
2. `widgets.requestPayment({ orderId, orderName, successUrl, failUrl, ... })`
3. 성공 시 `success.html?paymentKey=&orderId=&amount=` 로 리다이렉트
4. **서버에서** 시크릿 키로 `POST https://api.tosspayments.com/v1/payments/confirm` 호출 → 결제 확정

4번은 서버가 필요합니다. `js/config.js`의 `CONFIRM_ENDPOINT`에 승인 API 주소를 넣으면 `success.html`이 자동으로 요청합니다. 서버 예시는 `js/result.js` 상단 주석을 참고하세요.

## 설정 (`js/config.js`)

- `TOSS_CLIENT_KEY`: 현재 토스페이먼츠 문서에 공개된 **결제위젯 테스트 키**입니다. 개발자센터에서 발급받은 `test_gck_…` / `live_gck_…` 키로 교체하세요.
- 시크릿 키(`…_gsk_…`)는 절대 프론트엔드 코드나 저장소에 넣지 마세요.
- `SHIPPING_FEE`, `FREE_SHIPPING_OVER`: 배송비 / 무료배송 기준 금액
- `SUPABASE_URL`, `SUPABASE_KEY`: 주문을 저장할 Supabase 프로젝트 주소와 publishable 키. 비워 두면 저장하지 않습니다.

## 주문 저장 (Supabase)

- 결제창을 열기 직전에 `create_order`로 `orders` 테이블에 `pending` 주문을 만들고, `success.html`에서 `mark_order_authorized`로 금액이 일치하는 주문만 `authorized`로 바꿉니다.
- `orders` 테이블은 RLS가 켜져 있고 정책이 없어 브라우저에서 직접 읽거나 쓸 수 없습니다. 위 두 함수(SECURITY DEFINER)로만 씁니다.
- 최종 `confirmed` 처리는 결제 승인 서버에서 시크릿 키로 해야 합니다.

## 구조

```
css/style.css      공통 스타일
js/config.js       상점·결제 설정
js/products.js     상품 데이터 + SVG 상품 일러스트
js/app.js          장바구니(localStorage), 헤더, 목록, 퀵뷰
js/checkout.js     주문서 검증 + 결제위젯
js/result.js       결제 결과 처리
js/db.js           Supabase 주문 저장 (REST RPC)
serve.ps1          로컬 정적 서버 (Windows PowerShell)
```
