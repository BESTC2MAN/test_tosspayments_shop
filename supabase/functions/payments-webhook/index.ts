// F-16 결제 상태 자동 반영 (토스페이먼츠 웹훅)
// 토스 개발자센터 > 웹훅에 이 함수 주소를 등록합니다: https://<project>.supabase.co/functions/v1/payments-webhook
// 이벤트 본문은 믿지 않고, 시크릿 키로 토스에서 결제를 다시 조회한 결과로만 주문을 바꿉니다.
import { createClient } from "jsr:@supabase/supabase-js@2";

const DOCS_TEST_SECRET = "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6";
const SECRET = Deno.env.get("TOSS_SECRET_KEY") || DOCS_TEST_SECRET;
const AUTH = "Basic " + btoa(SECRET + ":");
const TOSS = "https://api.tosspayments.com/v1";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function ok(body: unknown = { ok: true }) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const body = await req.json().catch(() => null);
  if (!body) return ok({ ignored: "invalid body" });

  // PAYMENT_STATUS_CHANGED: { eventType, data: { paymentKey, orderId, ... } }
  // DEPOSIT_CALLBACK(가상계좌 입금): { orderId, status, secret, ... }
  const data = body.data || body;
  const paymentKey: string | undefined = data.paymentKey;
  const orderId: string | undefined = data.orderId;
  if (!paymentKey && !orderId) return ok({ ignored: "no payment reference" });

  const url = paymentKey
    ? TOSS + "/payments/" + encodeURIComponent(paymentKey)
    : TOSS + "/payments/orders/" + encodeURIComponent(orderId!);
  const res = await fetch(url, { headers: { Authorization: AUTH } });
  if (!res.ok) {
    // 우리 키로 조회되지 않는 결제는 무시 (다른 상점 이벤트·위조 요청)
    console.warn("webhook lookup failed", res.status, paymentKey || orderId);
    return ok({ ignored: "payment not found" });
  }
  const payment = await res.json();

  const { data: status, error } = await db.rpc("sync_payment_status", { p_order_id: payment.orderId, p_payment: payment });
  if (error) {
    console.error("sync_payment_status", payment.orderId, error);
    // 500을 돌려주면 토스가 웹훅을 다시 보냅니다
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
  return ok({ ok: true, orderId: payment.orderId, status });
});
