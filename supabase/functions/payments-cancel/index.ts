// F-15 결제 취소·환불 (관리자 전용)
// POST { orderId, reason, lines?: [{ index, qty }], requestId } + Authorization: Bearer <관리자 로그인 토큰>
// lines 가 없으면 전체 취소. 토스 취소 API 성공 후 apply_cancel 로 주문 상태·재고를 반영합니다.
import { createClient } from "jsr:@supabase/supabase-js@2";

const DOCS_TEST_SECRET = "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6";
const SECRET = Deno.env.get("TOSS_SECRET_KEY") || DOCS_TEST_SECRET;
const AUTH = "Basic " + btoa(SECRET + ":");

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

const CANCELABLE = ["waiting_deposit", "confirmed", "preparing", "shipping", "delivered", "partial_canceled"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);

  // 1) 관리자 확인
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await db.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." }, 401);
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return json({ code: "FORBIDDEN", message: "관리자만 취소할 수 있습니다." }, 403);

  // 2) 요청 검증
  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const reason = String(body.reason || "").trim().slice(0, 200);
  const requestId = String(body.requestId || "").slice(0, 64);
  if (!orderId || !reason || !requestId) return json({ code: "INVALID_REQUEST", message: "취소 사유를 입력해 주세요." }, 400);

  const { data: o } = await db.from("orders").select("order_id, status, amount, canceled_amount, items, payment_key")
    .eq("order_id", orderId).maybeSingle();
  if (!o) return json({ code: "ORDER_NOT_FOUND", message: "주문을 찾을 수 없습니다." }, 404);
  if (!CANCELABLE.includes(o.status) || !o.payment_key) {
    return json({ code: "NOT_CANCELABLE", message: "취소할 수 없는 주문 상태입니다." }, 400);
  }

  let lines: { index: number; qty: number }[] | null = null;
  let cancelAmount: number | undefined;
  if (Array.isArray(body.lines) && body.lines.length) {
    if (o.status === "waiting_deposit") return json({ code: "NOT_CANCELABLE", message: "입금 전 주문은 전체 취소만 할 수 있습니다." }, 400);
    lines = [];
    let sum = 0;
    for (const l of body.lines) {
      const it = o.items[l.index];
      const qty = Number(l.qty);
      if (!it || !Number.isInteger(qty) || qty < 1 || qty > it.qty - (it.canceledQty || 0)) {
        return json({ code: "INVALID_LINES", message: "취소 수량이 올바르지 않습니다." }, 400);
      }
      lines.push({ index: l.index, qty });
      sum += it.unit * qty;
    }
    // 쿠폰·배송비가 있어도 결제 금액을 넘겨 환불하지 않도록 남은 금액으로 제한
    cancelAmount = Math.min(sum, o.amount - o.canceled_amount);
    if (cancelAmount <= 0) return json({ code: "NOTHING_TO_REFUND", message: "환불할 금액이 남아 있지 않습니다." }, 400);
  }

  // 3) 토스 취소
  const res = await fetch("https://api.tosspayments.com/v1/payments/" + encodeURIComponent(o.payment_key) + "/cancel", {
    method: "POST",
    headers: { Authorization: AUTH, "Content-Type": "application/json", "Idempotency-Key": "cancel-" + requestId },
    body: JSON.stringify(cancelAmount ? { cancelReason: reason, cancelAmount } : { cancelReason: reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json({ code: data.code || "CANCEL_FAILED", message: data.message || "결제를 취소하지 못했습니다." }, 400);
  }

  // 4) DB 반영 (전체 취소면 남은 금액 전부)
  const { data: applied, error } = await db.rpc("apply_cancel", {
    p_order_id: orderId, p_lines: lines, p_amount: cancelAmount ?? o.amount - o.canceled_amount, p_reason: reason,
  });
  if (error) {
    console.error("apply_cancel", orderId, error);
    return json({ code: "DB_UPDATE_FAILED", message: "결제는 취소됐지만 주문 상태를 바꾸지 못했습니다. 관리자에게 확인하세요." }, 500);
  }
  return json({ ok: true, order: applied, refunded: cancelAmount ?? o.amount - o.canceled_amount });
});
