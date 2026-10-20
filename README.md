# RIDGELINE — 토스페이먼츠 연동 쇼핑몰 퍼블리싱

아웃도어 스타일 쇼핑몰 정적 퍼블리싱(HTML/CSS/JS)과 토스페이먼츠 결제위젯 v2 연동 예제입니다.

## 페이지

| 파일 | 설명 |
| --- | --- |
| `clothing.html` | 옷 상품 목록 (패딩 / 바람막이 / 플리스) |
| `shoes.html` | 신발 상품 목록 (등산화 / 트레일러닝 / 윈터슈즈) |
| `pants.html` | 바지 상품 목록 (카고 / 등산바지 / 방수바지 / 조거) |
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

## 구조

```
css/style.css      공통 스타일
js/config.js       상점·결제 설정
js/products.js     상품 데이터 + SVG 상품 일러스트
js/app.js          장바구니(localStorage), 헤더, 목록, 퀵뷰
js/checkout.js     주문서 검증 + 결제위젯
js/result.js       결제 결과 처리
serve.ps1          로컬 정적 서버 (Windows PowerShell)
```
