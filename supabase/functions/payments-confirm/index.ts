// F-01 결제 최종 확정
// POST { paymentKey, orderId, amount } → DB 주문과 대조, 재고 차감 → 토스 승인 API → 주문 상태 반영
// 시크릿 키는 Supabase Secrets 의 TOSS_SECRET_KEY 를 씁니다. 없으면 토스 문서 공개 테스트 키(결제위젯용)를 씁니다.
import { createClient } from "jsr:@supabase/supabase-js@2";

const DOCS_TEST_SECRET = "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6";
const SECRET = Deno.env.get("TOSS_SECRET_KEY") || DOCS_TEST_SECRET;
const AUTH = "Basic " + btoa(SECRET + ":");
const TOSS = "https://api.tosspayments.com/v1";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const SUMMARY_COLS =
  "order_id, order_name, status, amount, subtotal, discount, shipping_fee, coupon_code, method, approved_at, " +
  "receipt_url, virtual_account, customer_name, customer_email, address, address2, items, payment_key";

async function summary(orderId: string, paymentKey: string) {
  const { data } = await db.from("orders").select(SUMMARY_COLS).eq("order_id", orderId).maybeSingle();
  if (!data) return null;
  // 결제 키가 맞는 사람에게만 주문 상세를 돌려줍니다
  if (data.payment_key !== paymentKey) return { order_id: data.order_id, status: data.status };
  const { payment_key: _omit, ...rest } = data;
  return rest;
}

async function finish(orderId: string, ok: boolean, payment: unknown, code = "", message = "") {
  const { error } = await db.rpc("confirm_finish", {
    p_order_id: orderId, p_ok: ok, p_payment: payment, p_code: code, p_message: message,
  });
  if (error) console.error("confirm_finish", orderId, error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);

  const body = await req.json().catch(() => ({}));
  const paymentKey = typeof body.paymentKey === "string" ? body.paymentKey : "";
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const amount = Number(body.amount);
  if (!paymentKey || paymentKey.length > 200 || !/^[A-Za-z0-9_-]{6,64}$/.test(orderId) || !Number.isInteger(amount) || amount <= 0) {
    return json({ code: "INVALID_REQUEST", message: "결제 정보가 올바르지 않습니다." }, 400);
  }

  // 1) DB 검증 + 재고·쿠폰 확보
  const begin = await db.rpc("confirm_begin", { p_order_id: orderId, p_amount: amount, p_payment_key: paymentKey });
  if (begin.error) {
    console.error("confirm_begin", orderId, begin.error);
    return json({ code: "SERVER_ERROR", message: "주문을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500);
  }
  const b = begin.data as { ok: boolean; code?: string; message?: string };
  if (!b.ok) {
    if (b.code === "ALREADY_PROCESSED") return json({ ok: true, already: true, order: await summary(orderId, paymentKey) });
    return json({ code: b.code, message: b.message }, 400);
  }

  // 2) 토스 승인 (주문번호를 멱등키로 써서 재시도해도 한 번만 승인)
  let res: Response;
  try {
    res = await fetch(TOSS + "/payments/confirm", {
      method: "POST",
      headers: { Authorization: AUTH, "Content-Type": "application/json", "Idempotency-Key": "confirm-" + orderId },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
  } catch (e) {
    // 승인 여부를 알 수 없으므로 재고는 잡아 둔 채 재시도를 안내합니다
    console.error("toss confirm network", orderId, e);
    return json({ code: "TOSS_UNREACHABLE", message: "결제사에 연결하지 못했습니다. 새로고침해 다시 시도해 주세요." }, 502);
  }
  let data = await res.json().catch(() => ({}));

  if (!res.ok && data.code === "ALREADY_PROCESSED_PAYMENT") {
    const g = await fetch(TOSS + "/payments/" + encodeURIComponent(paymentKey), { headers: { Authorization: AUTH } });
    if (g.ok) { data = await g.json(); res = g; }
  }
  if (!res.ok) {
    await finish(orderId, false, null, data.code || "CONFIRM_FAILED", data.message || "결제 승인에 실패했습니다.");
    return json({ code: data.code || "CONFIRM_FAILED", message: data.message || "결제 승인에 실패했습니다." }, res.status >= 500 ? 502 : 400);
  }
  if (data.orderId !== orderId || data.totalAmount !== amount) {
    console.error("toss payment mismatch", orderId, data.orderId, data.totalAmount);
  }

  // 3) 주문 상태 반영
  await finish(orderId, true, data);
  return json({ ok: true, order: await summary(orderId, paymentKey) });
});
