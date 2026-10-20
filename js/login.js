/* =========================================================
   로그인 · 회원가입 · 비밀번호 찾기 (F-07)
   간편 로그인(카카오·구글)은 Supabase 대시보드 Authentication > Providers 에서
   켜고 키를 넣어야 동작합니다. 꺼져 있으면 안내 문구를 보여줍니다.
   ========================================================= */
(function () {
  "use strict";

  const DB = window.ShopDB;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const params = new URLSearchParams(location.search);
  // 로그인 후 돌아갈 곳: 같은 사이트의 .html 페이지만 허용
  const nextRaw = params.get("next") || "";
  const next = /^[a-z0-9_-]+\.html([?#][^\s]*)?$/i.test(nextRaw) ? nextRaw : "account.html";

  const AUTH_MSG = [
    [/invalid login credentials/i, "이메일 또는 비밀번호가 맞지 않습니다."],
    [/email not confirmed/i, "이메일 인증이 아직 안 됐어요. 받은 메일의 인증 링크를 눌러 주세요."],
    [/already registered|already been registered|user already exists/i, "이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해 주세요."],
    [/password should be at least|weak password/i, "비밀번호가 너무 짧거나 쉽습니다. 8자 이상으로 정해 주세요."],
    [/rate limit|too many/i, "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."],
    [/provider is not enabled|unsupported provider/i, "이 간편 로그인은 아직 준비 중입니다. 이메일로 로그인해 주세요."],
    [/invalid email|unable to validate email/i, "이메일 주소를 확인해 주세요."],
  ];
  function authMessage(r) {
    for (let i = 0; i < AUTH_MSG.length; i++) if (AUTH_MSG[i][0].test(r.raw || "")) return AUTH_MSG[i][1];
    return r.message;
  }
  function say(form, text, ok) {
    const m = $(".form-msg", form);
    m.textContent = text;
    m.className = "form-msg " + (ok ? "is-ok" : "is-error");
  }
  function busy(form, on) { $("button[type=submit]", form).disabled = on; }

  function show(mode) {
    $$("[data-mode]").forEach(function (s) { s.hidden = s.dataset.mode !== mode; });
    const first = $("[data-mode='" + mode + "'] input");
    if (first) first.focus();
  }
  $$("[data-go]").forEach(function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); show(a.dataset.go); history.replaceState(null, "", "#" + a.dataset.go); });
  });

  window.Shop.onReady(async function () {
    // 비밀번호 재설정 메일 링크로 들어온 경우
    if (params.get("mode") === "update") { show("update"); return; }
    if (location.hash === "#signup" || location.hash === "#reset") show(location.hash.slice(1));
    const s = await DB.session();
    if (s) location.replace(next);
  });
  DB.onAuthChange(function (event) { if (event === "PASSWORD_RECOVERY") show("update"); });

  $("#login-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const f = this;
    const email = f.elements.email.value.trim();
    const pw = f.elements.password.value;
    if (!email || !pw) return say(f, "이메일과 비밀번호를 입력해 주세요.");
    busy(f, true);
    const r = await DB.signIn(email, pw);
    busy(f, false);
    if (!r.ok) return say(f, authMessage(r));
    location.replace(next);
  });

  $("#signup-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const f = this;
    const name = f.elements.name.value.trim();
    const email = f.elements.email.value.trim();
    const pw = f.elements.password.value;
    if (name.length < 2) return say(f, "이름을 2자 이상 입력해 주세요.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say(f, "이메일 주소를 확인해 주세요.");
    if (pw.length < 8) return say(f, "비밀번호는 8자 이상으로 정해 주세요.");
    if (!f.elements.agree.checked) return say(f, "개인정보 처리방침에 동의해 주세요.");
    busy(f, true);
    const r = await DB.signUp(email, pw, name);
    busy(f, false);
    if (!r.ok) return say(f, authMessage(r));
    if (r.data && r.data.session) { location.replace(next); return; }
    // 이미 가입된 이메일이면 Supabase는 빈 identities 를 돌려줍니다
    if (r.data && r.data.user && Array.isArray(r.data.user.identities) && !r.data.user.identities.length) {
      return say(f, "이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해 주세요.");
    }
    f.reset();
    say(f, email + " 으로 인증 메일을 보냈어요. 메일의 링크를 누르면 가입이 완료됩니다.", true);
  });

  $("#reset-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const f = this;
    const email = f.elements.email.value.trim();
    if (!email) return say(f, "이메일을 입력해 주세요.");
    busy(f, true);
    const r = await DB.resetPassword(email);
    busy(f, false);
    if (!r.ok) return say(f, authMessage(r));
    say(f, "가입된 이메일이라면 재설정 링크를 보냈어요. 메일함을 확인해 주세요.", true);
  });

  $("#update-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const f = this;
    const pw = f.elements.password.value;
    if (pw.length < 8) return say(f, "비밀번호는 8자 이상으로 정해 주세요.");
    busy(f, true);
    const r = await DB.updatePassword(pw);
    busy(f, false);
    if (!r.ok) return say(f, authMessage(r).replace("이메일 또는 비밀번호가 맞지 않습니다.", "재설정 링크가 만료됐어요. 다시 요청해 주세요."));
    say(f, "비밀번호를 바꿨어요. 잠시 후 마이페이지로 이동합니다.", true);
    setTimeout(function () { location.replace("account.html"); }, 1200);
  });

  // 대시보드에서 켜진 간편 로그인만 실제로 시작 (꺼진 채 누르면 Supabase 오류 페이지로 이동하므로)
  const providers = fetch(window.SHOP_CONFIG.SUPABASE_URL + "/auth/v1/settings", { headers: { apikey: window.SHOP_CONFIG.SUPABASE_KEY } })
    .then(function (r) { return r.json(); })
    .then(function (s) { return (s && s.external) || {}; })
    .catch(function () { return {}; });
  $$("[data-provider]").forEach(function (b) {
    b.addEventListener("click", async function () {
      const enabled = await providers;
      if (!enabled[b.dataset.provider]) {
        window.Shop.toast((b.dataset.provider === "kakao" ? "카카오" : "Google") + " 로그인은 준비 중입니다. 이메일로 로그인해 주세요.");
        return;
      }
      const r = await DB.signInWithProvider(b.dataset.provider);
      if (!r.ok) window.Shop.toast(authMessage(r));
    });
  });
})();
