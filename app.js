/* AI Learning Map – Bản đồ tri thức của riêng em · giao diện */
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem("bdtt_" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("bdtt_" + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem("bdtt_" + k); } catch (e) {} }
};
const PIN_ICONS = ["🐶", "🐱", "🐰", "🦊", "🐼", "🐸", "🍎", "⭐", "🚗"];
const AVATARS = ["🦁", "🐰", "🐯", "🦋", "🐻", "🐱", "🦊", "🐼", "🐬", "🌻", "🚀", "🐨", "🐸", "🐧", "🦄", "🐳", "🍀", "🌈", "⚽", "🎨", "🐝", "🦒", "🐢", "🍉"];
const TYPE_NAME = { mcq: "Trắc nghiệm", tf: "Đúng / Sai", fill: "Điền đáp án", short: "Trả lời ngắn", photo: "Chụp ảnh vở" };
const LEVEL_NAME = { 1: "Mức 1 · Biết", 2: "Mức 2 · Hiểu", 3: "Mức 3 · Vận dụng" };
const STATE = {
  khoa: { name: "Chưa mở", fill: "#EEE8DA", stroke: "#CFC6B2", icon: "🔒" },
  mo: { name: "Có bài mới", fill: "#FFF0D6", stroke: "#F2A23A", icon: "✏️" },
  dang: { name: "Đang luyện", fill: "#DCEFF3", stroke: "#1F6F8B", icon: "🌱" },
  vung: { name: "Đã vững", fill: "#E2F3E7", stroke: "#3E9B5F", icon: "⭐" }
};

const CFG_API = (window.BDTT_CONFIG && window.BDTT_CONFIG.api) || "";
let API = LS.get("demo", false) ? "" : (LS.get("api", "") || CFG_API);
let SESSION = LS.get("session", null);
let CLASS_CODE = LS.get("code", "");
let TD = null;           // dữ liệu cô
let TVIEW = "tong", seeding = false;
let HOME = null;         // dữ liệu học sinh

/* ---------- link lớp: #lop=MÃ&may=… ---------- */
(function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get("may")) { try { const u = atob(h.get("may").replace(/-/g, "+").replace(/_/g, "/")); if (/^https:\/\/script\.google(usercontent)?\.com\//.test(u)) { API = u; LS.set("api", u); LS.set("demo", false); } } catch (e) {} }
  if (h.get("lop")) { CLASS_CODE = h.get("lop").toUpperCase(); LS.set("code", CLASS_CODE); }
  if (h.get("demo") != null) { API = ""; LS.set("demo", true); setSession(null); }
  if (h.get("lop") || h.get("may")) history.replaceState(null, "", location.pathname);
})();
function classLink() {
  const base = location.origin + location.pathname;
  const p = ["lop=" + encodeURIComponent((TD && TD.settings.classCode) || CLASS_CODE)];
  if (API) p.push("may=" + btoa(API).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  return base + "#" + p.join("&");
}

/* ---------- gọi máy chủ ---------- */
async function api(action, payload) {
  const token = SESSION && SESSION.token;
  if (API) {
    let res;
    try { res = await fetch(API, { method: "POST", body: JSON.stringify({ action, payload, token }) }); }
    catch (e) { throw new Error("Không kết nối được máy chủ lớp. Kiểm tra mạng rồi thử lại."); }
    let j; try { j = await res.json(); } catch (e) { throw new Error("Máy chủ lớp trả lời lỗi. Cô kiểm tra lại link máy chủ trong Cài đặt."); }
    if (!j.ok) { if (j.code === "auth") logout(true); throw new Error(j.error); }
    return j.data;
  }
  const core = Core.make(Demo.adapter);
  let r;
  try { r = core.handle(action, payload, token); } catch (e) { if (e.code === "auth") logout(true); throw e; }
  while (r && r.__ai) { let text = null, err = null; try { text = await Demo.ai(r.__ai, r.json); } catch (x) { err = x; } r = r.then(text, err); }
  return r;
}
function toast(msg, ms = 2600) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), ms); }
async function busy(btn, fn, label) {
  const old = btn && btn.innerHTML; if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spin"></span> ${label || "Đang xử lí…"}`; }
  try { return await fn(); } catch (e) { toast(e.message || String(e), 4200); throw e; } finally { if (btn) { btn.disabled = false; btn.innerHTML = old; } }
}
function setSession(s) { SESSION = s; if (s) LS.set("session", s); else LS.del("session"); }
function logout(expired) { setSession(null); TD = null; HOME = null; if (expired) toast("Phiên đăng nhập đã hết, vui lòng đăng nhập lại."); route(); }
function fmtDate(d) { if (!d) return "—"; const x = new Date(d.length === 10 ? d + "T00:00:00" : d); return x.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }); }
function fmtTime(d) { if (!d) return ""; const x = new Date(d); return x.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }); }
function today(k = 0) { const x = new Date(Date.now() + k * 864e5); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
function starHTML(n, size) { let s = ""; for (let i = 1; i <= 3; i++) s += `<span class="${i <= n ? "" : "off"}">⭐</span>`; return `<span class="stars" style="${size ? "font-size:" + size + "px;letter-spacing:2px" : ""}">${s}</span>`; }
function subjName(id, subjects) { const s = (subjects || []).find(x => x.id === id); return s ? s.name : id; }

/* ---------- đọc to ---------- */
const canSpeak = "speechSynthesis" in window;
function speak(text) {
  if (!canSpeak) return; speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = "vi-VN"; u.rate = .9;
  const v = speechSynthesis.getVoices().find(v => /^vi/i.test(v.lang)); if (v) u.voice = v;
  speechSynthesis.speak(u);
}

/* ---------- khung trang ---------- */
function frame({ nav = false } = {}) {
  $("#demobar").classList.toggle("hidden", !!API);
  $("#demobar").innerHTML = `Bản dùng thử: dữ liệu mẫu chỉ lưu trên máy này. Mã lớp <b>DEMO3A</b> · mật khẩu hình của các em: 🐱🐰🦊🐼 · mật khẩu cô: <b>demo123</b>${CFG_API ? ' · <a href="#" id="exitDemo">Thoát bản dùng thử</a>' : ""}`;
  const xd = $("#exitDemo"); if (xd) xd.onclick = e => { e.preventDefault(); LS.set("demo", false); setSession(null); location.reload(); };
  const me = SESSION ? `<span class="ava">${esc(SESSION.avatar || "👩‍🏫")}</span><span class="small hide-sm"><b>${esc(SESSION.name || "")}</b></span><button class="btn ghost small" id="outBtn">Thoát</button>` : "";
  $("#top").innerHTML = `<a class="logo" href="#" id="homeLink"><span class="mark">🗺️</span><span>AI Learning Map<small>Bản đồ tri thức của riêng em</small></span></a><div class="me">${me}</div>`;
  $("#homeLink").onclick = e => { e.preventDefault(); route(); };
  const ob = $("#outBtn"); if (ob) ob.onclick = () => logout();
  $("#nav").classList.toggle("hidden", !nav);
}
const app = () => $("#app");

function route() {
  if (canSpeak) speechSynthesis.cancel();
  if (!SESSION) return landing();
  if (SESSION.role === "S") return sHome();
  return tApp();
}

/* =================== TRANG ĐẦU =================== */
function landing() {
  frame();
  app().innerHTML = `<section class="hero">
    <h1>Bản đồ tri thức của riêng em</h1>
    <p class="sub">Mỗi bài học là một chặng trên bản đồ. Em làm bài, cô chấm, chặng sáng dần thành ⭐.</p>
    <div class="doors">
      <div class="door" id="dStudent" tabindex="0"><div class="e">🎒</div><b>Em là học sinh</b><span class="muted small">Vào lớp bằng mã lớp và mật khẩu hình</span></div>
      <div class="door" id="dTeacher" tabindex="0"><div class="e">👩‍🏫</div><b>Cô giáo</b><span class="muted small">Soạn bài với AI, giao bài, chấm bài</span></div>
    </div></section>`;
  $("#dStudent").onclick = sLogin; $("#dTeacher").onclick = tLogin;
}

/* =================== HỌC SINH =================== */
async function sLogin() {
  frame();
  if (!CLASS_CODE) return askCode();
  app().innerHTML = `<div class="narrow card"><p class="muted">Đang mở lớp…</p></div>`;
  let info; try { info = await api("hello", { code: CLASS_CODE }); } catch (e) { toast(e.message); CLASS_CODE = ""; LS.del("code"); return askCode(); }
  app().innerHTML = `<div class="narrow"><div class="card"><div class="row between"><h2>Lớp ${esc(info.className)} · Em là bạn nào?</h2><button class="btn ghost small" id="chg">Đổi lớp</button></div>
    <div class="kids">${(info.students || []).map(s => `<button class="kid" data-id="${esc(s.id)}"><span class="e">${esc(s.avatar)}</span>${esc(shortName(s.name))}</button>`).join("") || '<p class="muted">Lớp chưa có danh sách học sinh.</p>'}</div></div></div>`;
  $("#chg").onclick = () => { CLASS_CODE = ""; LS.del("code"); askCode(); };
  $$(".kid").forEach(b => b.onclick = () => pinPad(info.students.find(s => s.id === b.dataset.id)));
}
function shortName(n) { const p = String(n).trim().split(/\s+/); return p.length > 2 ? p.slice(-2).join(" ") : n; }
function askCode() {
  frame();
  app().innerHTML = `<div class="narrow card"><h2>Nhập mã lớp</h2><p class="muted">Cô giáo đã gửi mã lớp (6 chữ) hoặc em quét mã QR trên thẻ của em.</p>
    <input type="text" id="code" placeholder="Ví dụ: K7PQ2M" maxlength="8" style="font-size:24px;text-transform:uppercase;letter-spacing:4px;text-align:center">
    <div class="row" style="margin-top:12px"><button class="btn primary big grow" id="go">Vào lớp</button></div></div>`;
  const go = () => { const v = $("#code").value.trim().toUpperCase(); if (v.length < 4) return toast("Em nhập đủ mã lớp nhé."); CLASS_CODE = v; LS.set("code", v); sLogin(); };
  $("#go").onclick = go; $("#code").onkeydown = e => { if (e.key === "Enter") go(); }; $("#code").focus();
}
function pinPad(st) {
  let pin = "";
  app().innerHTML = `<div class="narrow card" style="text-align:center"><div style="font-size:56px">${esc(st.avatar)}</div><h2>Chào ${esc(shortName(st.name))}!</h2>
    <p class="muted">Em bấm 4 hình bí mật của em</p><div class="pins">${[0, 1, 2, 3].map(i => `<span id="p${i}"></span>`).join("")}</div>
    <div class="pinpad">${PIN_ICONS.map((ic, i) => `<button data-i="${i}" aria-label="hình ${i + 1}">${ic}</button>`).join("")}</div>
    <div class="row" style="justify-content:center"><button class="btn ghost" id="back">← Chọn lại tên</button><button class="btn ghost" id="clr">Xóa</button></div></div>`;
  const show = () => [0, 1, 2, 3].forEach(i => $("#p" + i).textContent = pin[i] != null ? PIN_ICONS[pin[i]] : "");
  $$(".pinpad button").forEach(b => b.onclick = async () => {
    if (pin.length >= 4) return; pin += b.dataset.i; show();
    if (pin.length === 4) {
      try { const r = await api("studentLogin", { sid: st.id, pin }); setSession({ role: "S", token: r.token, sid: st.id, name: shortName(st.name), avatar: st.avatar }); sHome(); }
      catch (e) { toast(e.message); pin = ""; setTimeout(show, 300); }
    }
  });
  $("#clr").onclick = () => { pin = ""; show(); }; $("#back").onclick = sLogin;
}

let STAB = "map", SSUBJ = null;
async function sHome() {
  frame();
  if (!HOME) app().innerHTML = `<p class="muted">Đang mở bản đồ của em…</p>`;
  try { HOME = await api("home", {}); } catch (e) { return; }
  const subs = HOME.subjects.length ? HOME.subjects : [{ id: "toan", name: "Toán" }];
  if (!SSUBJ || !subs.find(s => s.id === SSUBJ)) SSUBJ = subs[0].id;
  const todo = HOME.asgs.filter(a => !a.sub);
  app().innerHTML = `<div class="narrow">
    <div class="card row between"><div class="row"><span class="ava" style="width:54px;height:54px;font-size:32px">${esc(HOME.student.avatar)}</span><div><h2 style="margin:0">${esc(shortName(HOME.student.name))}</h2><span class="muted small">Lớp ${esc(HOME.className)} · ${HOME.starsTotal} ⭐ đã nhận</span></div></div>
    ${todo.length ? `<span class="chip sun">${todo.length} bài cần làm</span>` : `<span class="chip leaf">Em đã làm hết bài</span>`}</div>
    <div class="tabs"><button data-t="map" class="${STAB === "map" ? "on" : ""}">🗺️ Bản đồ của em</button><button data-t="bai" class="${STAB === "bai" ? "on" : ""}">📝 Bài được giao</button></div>
    <div id="sBody"></div></div>`;
  $$(".tabs button").forEach(b => b.onclick = () => { STAB = b.dataset.t; sHome(); });
  const body = $("#sBody");
  if (STAB === "bai") {
    body.innerHTML = HOME.asgs.length ? HOME.asgs.map(a => {
      const st = !a.sub ? `<button class="btn sun" data-do="${a.id}">Làm bài</button>` : a.sub.status === "da_tra" ? `<button class="btn" data-rv="${a.id}">${starHTML(a.sub.stars, 18)} Xem lại</button>` : `<span class="chip">Cô đang chấm</span>`;
      const late = !a.sub && a.due && a.due < today();
      return `<div class="card row between"><div><span class="chip ${a.subject === "tv" ? "berry" : ""}">${esc(subjName(a.subject, HOME.subjects))}</span> <b>${esc(a.title)}</b><div class="small muted">${a.count} câu · hạn ${fmtDate(a.due)} ${late ? '<span class="chip berry">quá hạn</span>' : ""}</div></div>${st}</div>`;
    }).join("") : `<div class="card muted">Cô chưa giao bài nào.</div>`;
  } else {
    body.innerHTML = `<div class="tabs">${subs.map(s => `<button data-s="${s.id}" class="${s.id === SSUBJ ? "on" : ""}">${esc(s.name)}</button>`).join("")}</div>
      ${legend()}<div class="map" id="theMap"></div>`;
    $$("#sBody .tabs button[data-s]").forEach(b => b.onclick = () => { SSUBJ = b.dataset.s; sHome(); });
    const lessons = HOME.lessons.filter(l => l.subject === SSUBJ).sort((a, b) => a.order - b.order);
    $("#theMap").innerHTML = lessons.length ? mapHTML(lessons, id => HOME.mastery[id] || "khoa", { here: true, avatar: HOME.student.avatar }) : `<div class="card muted">Cô chưa vẽ bản đồ môn này.</div>`;
    $$("#theMap .node").forEach(n => { n.onclick = () => lessonSheet(n.dataset.id); n.onkeydown = e => { if (e.key === "Enter") lessonSheet(n.dataset.id); }; });
  }
  $$("[data-do]").forEach(b => b.onclick = () => sDo(b.dataset.do));
  $$("[data-rv]").forEach(b => b.onclick = () => sReview(b.dataset.rv));
}
function legend() { return `<div class="legend">${Object.values(STATE).map(s => `<span><i class="dot" style="background:${s.fill};border:2px solid ${s.stroke}"></i>${s.name}</span>`).join("")}</div>`; }
function wrapText(t, n) {
  const words = String(t).split(/\s+/), lines = [""]; for (const w of words) { const cur = lines[lines.length - 1]; if ((cur + " " + w).trim().length > n && cur) lines.push(w); else lines[lines.length - 1] = (cur + " " + w).trim(); }
  if (lines.length > 3) { lines.length = 3; lines[2] = lines[2].replace(/.{0,2}$/, "") + "…"; } return lines;
}
/* Vẽ bản đồ: mỗi chủ đề là một hòn đảo, các bài nối nhau theo đường uốn khúc */
function mapHTML(lessons, stateOf, opt = {}) {
  const topics = []; lessons.forEach(l => { let t = topics[topics.length - 1]; if (!t || t.name !== l.topic) topics.push(t = { name: l.topic, items: [] }); t.items.push(l); });
  let hereDone = false, num = 0;
  return topics.map((t, ti) => {
    const cols = 3, W = 360, rows = Math.ceil(t.items.length / cols), H = rows * 136 + 20;
    const pts = t.items.map((l, i) => { const r = Math.floor(i / cols), c = i % cols; return { x: r % 2 ? W - 60 - c * 120 : 60 + c * 120, y: 50 + r * 136, l }; });
    let d = ""; pts.forEach((p, i) => { if (!i) d = `M${p.x} ${p.y}`; else { const q = pts[i - 1]; d += q.y === p.y ? ` L${p.x} ${p.y}` : ` C${q.x + (q.x > W / 2 ? 70 : -70)} ${q.y} ${p.x + (p.x > W / 2 ? 70 : -70)} ${p.y} ${p.x} ${p.y}`; } });
    const nV = t.items.filter(l => stateOf(l.id) === "vung").length;
    const nodes = pts.map(p => {
      num++; const st = opt.pct ? null : stateOf(p.l.id), S = st ? STATE[st] : null;
      let fill, stroke, icon, extra = "";
      if (opt.pct) { const v = opt.pct(p.l.id); fill = v == null ? "#EEE8DA" : v >= 80 ? "#BFE3CB" : v >= 50 ? "#E2F3E7" : v > 0 ? "#FFF0D6" : "#FBE4E1"; stroke = v == null ? "#CFC6B2" : v >= 50 ? "#3E9B5F" : "#F2A23A"; icon = v == null ? "–" : v + "%"; }
      else { fill = S.fill; stroke = S.stroke; icon = S.icon; }
      if (opt.here && !hereDone && (st === "mo" || st === "dang")) { hereDone = true; extra = `<g class="here"><circle cx="${p.x + 26}" cy="${p.y - 30}" r="17" fill="#fff" stroke="#F2A23A" stroke-width="2.5"/><text x="${p.x + 26}" y="${p.y - 23}" text-anchor="middle" font-size="19">${esc(opt.avatar || "🙂")}</text></g>`; }
      const ring = st === "mo" ? `<circle class="ring" cx="${p.x}" cy="${p.y}" r="30"/>` : "";
      const lines = wrapText(p.l.title, 15).map((ln, k) => `<tspan x="${p.x}" dy="${k ? 15 : 0}">${esc(ln)}</tspan>`).join("");
      return `<g class="node" tabindex="0" role="button" data-id="${esc(p.l.id)}" aria-label="${esc(p.l.title)}">${ring}<circle class="c" cx="${p.x}" cy="${p.y}" r="30" fill="${fill}" stroke="${stroke}" stroke-width="3.5"/>
        <text x="${p.x}" y="${p.y + (opt.pct ? 5 : 8)}" text-anchor="middle" font-size="${opt.pct ? 15 : 24}" font-weight="700" fill="#2B2A33" font-family="Quicksand">${icon}</text>
        <circle cx="${p.x - 24}" cy="${p.y - 22}" r="11" fill="#fff" stroke="${stroke}" stroke-width="2"/><text x="${p.x - 24}" y="${p.y - 18}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#2B2A33" font-family="Quicksand">${num}</text>
        <text y="${p.y + 52}" text-anchor="middle" font-size="12.5" font-weight="600" fill="#2B2A33" font-family="Quicksand">${lines}</text>${extra}</g>`;
    }).join("");
    return `${ti ? '<div class="bridge"></div>' : ""}<div class="island"><div class="ban"><b>🏝️ ${esc(t.name || "Chủ đề")}</b>${opt.pct ? "" : `<span class="chip leaf">${nV}/${t.items.length} ⭐</span>`}</div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bản đồ chủ đề ${esc(t.name)}"><path d="${d}" fill="none" stroke="#1F6F8B" stroke-opacity=".35" stroke-width="6" stroke-dasharray="2 12" stroke-linecap="round"/>${nodes}</svg></div>`;
  }).join("");
}
function lessonSheet(lid) {
  const l = HOME.lessons.find(x => x.id === lid), st = HOME.mastery[lid] || "khoa", asgs = HOME.asgs.filter(a => a.lessonId === lid);
  const msg = { khoa: "Chặng này cô chưa giao bài. Em chờ cô nhé!", mo: "Có bài mới! Em làm bài để chặng sáng lên nhé.", dang: "Em đang luyện chặng này. Làm bài ôn tập để thành ⭐ nhé!", vung: "Tuyệt vời! Em đã vững bài này." }[st];
  const box = document.createElement("div");
  box.className = "card"; box.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);width:min(560px,calc(100vw - 32px));z-index:50;max-height:70vh;overflow:auto";
  box.innerHTML = `<div class="row between"><span class="chip" style="background:${STATE[st].fill};color:#2B2A33;border:1.5px solid ${STATE[st].stroke}">${STATE[st].icon} ${STATE[st].name}</span><button class="btn ghost small" data-x>Đóng ✕</button></div>
    <h3 style="margin-top:8px">${esc(l.title)}</h3><p class="muted small">${esc(l.topic)}</p><p>${msg}</p>
    ${asgs.map(a => `<div class="row between" style="border-top:1px dashed var(--line);padding:8px 0"><span>${esc(a.title)}</span>${!a.sub ? `<button class="btn sun small" data-do="${a.id}">Làm bài</button>` : a.sub.status === "da_tra" ? `<button class="btn small" data-rv="${a.id}">${starHTML(a.sub.stars, 15)}</button>` : '<span class="chip">Cô đang chấm</span>'}</div>`).join("")}
    ${asgs.length ? `<div class="row" style="margin-top:8px"><button class="btn leaf" data-pr>🎯 Ôn tập 5 câu</button></div>` : ""}`;
  document.body.appendChild(box);
  const close = () => box.remove();
  $("[data-x]", box).onclick = close;
  $$("[data-do]", box).forEach(b => b.onclick = () => { close(); sDo(b.dataset.do); });
  $$("[data-rv]", box).forEach(b => b.onclick = () => { close(); sReview(b.dataset.rv); });
  const pr = $("[data-pr]", box); if (pr) pr.onclick = () => { close(); sPractice(lid); };
}

/* ----- làm bài ----- */
async function sDo(aid) {
  frame();
  app().innerHTML = `<p class="muted">Đang mở bài…</p>`;
  let A; try { A = await api("getAsg", { aid }); } catch (e) { return sHome(); }
  if (A.sub && A.sub.status === "da_tra") return sReview(aid);
  const draftKey = "draft_" + aid + "_" + SESSION.sid;
  const ans = Object.assign({}, (A.sub && A.sub.answers) || {}, LS.get(draftKey, {}));
  const photos = {};
  app().innerHTML = `<div class="narrow"><div class="card"><button class="btn ghost small" id="back">← Bản đồ</button><h2 style="margin-top:8px">${esc(A.title)}</h2>
    <div class="small muted">Hạn nộp ${fmtDate(A.due)} ${A.note ? "· " + esc(A.note) : ""}</div><div class="prog" style="margin-top:10px"><i id="pg" style="width:0"></i></div></div>
    <div id="qs"></div><div class="card row"><button class="btn primary big grow" id="send">📮 Nộp bài cho cô</button></div></div>`;
  $("#back").onclick = sHome;
  $("#qs").innerHTML = A.questions.map((q, i) => `<div class="q" data-q="${q.id}"><div class="qh"><b>Câu ${i + 1}</b><span class="row">${canSpeak ? `<button class="speak" data-sp="${i}">🔊 Nghe</button>` : ""}<span class="chip grey">${q.points} điểm</span></span></div>
    <div class="qt">${esc(q.text)}</div>${inputHTML(q, ans[q.id])}</div>`).join("");
  const progress = () => { const n = A.questions.filter(q => (ans[q.id] != null && ans[q.id] !== "") || photos[q.id]).length; $("#pg").style.width = (n / A.questions.length * 100) + "%"; LS.set(draftKey, ans); };
  $$("[data-sp]").forEach(b => b.onclick = () => { const q = A.questions[b.dataset.sp]; speak(q.text + (q.options ? ". " + q.options.map((o, k) => "ABCD"[k] + ". " + o).join(". ") : "")); });
  A.questions.forEach(q => {
    const el = $(`[data-q="${q.id}"]`);
    $$(".opt", el).forEach(b => b.onclick = () => { $$(".opt", el).forEach(x => x.classList.remove("on")); b.classList.add("on"); ans[q.id] = q.type === "mcq" ? Number(b.dataset.v) : b.dataset.v; progress(); });
    const inp = $("input[type=text],textarea", el); if (inp) inp.oninput = () => { ans[q.id] = inp.value; progress(); };
    const ph = $("[data-photo]", el);
    if (ph) ph.onclick = () => pickImage(async f => { photos[q.id] = await shrink(f, 1400, .72); $(".pv", el).innerHTML = `<img src="${photos[q.id]}" alt="Ảnh bài làm">`; ph.textContent = "📷 Chụp lại"; progress(); });
  });
  progress();
  $("#send").onclick = e => {
    const miss = A.questions.filter(q => q.type === "photo" ? !photos[q.id] : (ans[q.id] == null || ans[q.id] === "")).length;
    if (miss && !confirm(`Em còn ${miss} câu chưa làm. Em vẫn nộp bài chứ?`)) return;
    busy(e.currentTarget, async () => {
      const r = await api("submit", { aid, answers: ans, photos });
      LS.del(draftKey); HOME = null;
      app().innerHTML = `<div class="narrow card" style="text-align:center;padding:30px 16px"><div style="font-size:64px">${r.status === "da_tra" ? "🎉" : "📮"}</div>
        <h2>${r.status === "da_tra" ? "Em đã hoàn thành bài!" : "Em đã nộp bài!"}</h2>
        ${r.status === "da_tra" ? starHTML(r.stars) + `<p>Bài được chấm ngay. Em xem lại các câu nhé.</p>` : `<p>Cô sẽ chấm và trả bài sớm. Chặng này trên bản đồ đang chờ cô ✨</p>`}
        <div class="row" style="justify-content:center;margin-top:10px">${r.status === "da_tra" ? `<button class="btn primary" id="rv">Xem lại bài</button>` : ""}<button class="btn" id="hm">Về bản đồ</button></div></div>`;
      $("#hm").onclick = sHome; const rv = $("#rv"); if (rv) rv.onclick = () => sReview(aid);
    }, "Đang gửi bài…");
  };
}
function inputHTML(q, v) {
  if (q.type === "mcq") return `<div class="opts">${q.options.map((o, k) => `<button class="opt ${Number(v) === k && v !== "" && v != null ? "on" : ""}" data-v="${k}"><span class="k">${"ABCD"[k]}</span>${esc(o)}</button>`).join("")}</div>`;
  if (q.type === "tf") return `<div class="tf"><button class="opt ${v === "true" ? "on" : ""}" data-v="true"><span class="k">✓</span>Đúng</button><button class="opt ${v === "false" ? "on" : ""}" data-v="false"><span class="k">✗</span>Sai</button></div>`;
  if (q.type === "fill") return `<input type="text" style="margin-top:10px;font-size:18px" placeholder="Em viết đáp án" value="${esc(v || "")}">`;
  if (q.type === "short") return `<textarea rows="3" style="margin-top:10px;font-size:17px" placeholder="Em viết câu trả lời">${esc(v || "")}</textarea>`;
  return `<div class="photo-in"><button class="btn sun" data-photo>📷 Chụp ảnh bài làm trong vở</button><div class="pv"></div></div>`;
}
function pickImage(cb) {
  const fp = $("#filePick"); fp.accept = "image/*"; fp.setAttribute("capture", "environment"); fp.value = "";
  fp.onchange = () => fp.files[0] && cb(fp.files[0]); fp.click();
}
function shrink(file, max, q) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", q)); };
    img.onerror = () => rej(new Error("Không đọc được ảnh.")); img.src = url;
  });
}
async function sReview(aid) {
  frame();
  let A; try { A = await api("getAsg", { aid }); } catch (e) { return sHome(); }
  const s = A.sub || {};
  app().innerHTML = `<div class="narrow"><div class="card" style="text-align:center"><button class="btn ghost small" id="back" style="float:left">← Bản đồ</button><div style="clear:both"></div>
    <h2>${esc(A.title)}</h2>${starHTML(s.stars || 0)}<p class="hand" style="font-size:19px;color:var(--sea-3)">“${esc(s.comment || "")}”</p></div>
    ${A.questions.map((q, i) => {
      const a = (s.answers || {})[q.id], auto = (s.auto || {})[q.id], fin = (s.final || {})[q.id];
      let mine = a == null || a === "" ? "<i class='muted'>(em chưa làm)</i>" : q.type === "mcq" ? esc(q.options[a]) : q.type === "tf" ? (a === "true" ? "Đúng" : "Sai") : esc(a);
      if (q.type === "photo") mine = "<i class='muted'>Bài làm trong vở</i>";
      const right = q.type === "mcq" ? q.options[q.answer] : q.type === "tf" ? (q.answer ? "Đúng" : "Sai") : String(q.answer).split("|")[0];
      const ok = q.type in { mcq: 1, tf: 1, fill: 1 } ? auto : (fin != null ? fin >= (q.points || 1) : null);
      return `<div class="q"><div class="qh"><b>Câu ${i + 1}</b>${ok === true ? '<span class="res ok">✓ Đúng</span>' : ok === false ? '<span class="res no">✗ Chưa đúng</span>' : `<span class="chip">${fin != null ? fin + "/" + q.points + " điểm" : ""}</span>`}</div>
        <div class="qt">${esc(q.text)}</div><p class="small">Em trả lời: <b>${mine}</b></p>${ok !== true ? `<p class="small">Đáp án: <b>${esc(right)}</b></p>` : ""}${q.explain ? `<p class="small muted">💡 ${esc(q.explain)}</p>` : ""}</div>`;
    }).join("")}</div>`;
  $("#back").onclick = sHome;
}
async function sPractice(lid) {
  frame();
  let P; try { P = await api("practice", { lessonId: lid }); } catch (e) { return sHome(); }
  const qs = P.questions; if (!qs.length) { toast("Chặng này chưa có câu ôn tập."); return sHome(); }
  let i = 0, correct = 0;
  const l = HOME.lessons.find(x => x.id === lid);
  const step = () => {
    if (i >= qs.length) {
      api("practiceDone", { lessonId: lid, correct, total: qs.length }).catch(() => {}); HOME = null;
      app().innerHTML = `<div class="narrow card" style="text-align:center;padding:30px"><div style="font-size:60px">${correct === qs.length ? "🏆" : "💪"}</div><h2>Em đúng ${correct}/${qs.length} câu</h2>
        <p>${correct === qs.length ? "Giỏi quá! Ôn đúng hết 2 lần là chặng này thành ⭐ nhé." : "Em ôn thêm lần nữa để nhớ lâu hơn nhé!"}</p><div class="row" style="justify-content:center"><button class="btn primary" id="again">Ôn lại</button><button class="btn" id="hm">Về bản đồ</button></div></div>`;
      $("#again").onclick = () => sPractice(lid); $("#hm").onclick = sHome; return;
    }
    const q = qs[i];
    app().innerHTML = `<div class="narrow"><div class="card"><div class="row between"><b>🎯 Ôn tập: ${esc(l ? l.title : "")}</b><span class="chip">${i + 1}/${qs.length}</span></div></div>
      <div class="q" data-q="${q.id}"><div class="qh"><b>Câu ${i + 1}</b>${canSpeak ? '<button class="speak" id="sp">🔊 Nghe</button>' : ""}</div><div class="qt">${esc(q.text)}</div>${inputHTML(q, null)}<div id="fb"></div>
      <div class="row" style="margin-top:10px"><button class="btn primary grow" id="chk">Kiểm tra</button></div></div></div>`;
    let v = null; const el = $(".q");
    const sp = $("#sp"); if (sp) sp.onclick = () => speak(q.text);
    $$(".opt", el).forEach(b => b.onclick = () => { $$(".opt", el).forEach(x => x.classList.remove("on")); b.classList.add("on"); v = q.type === "mcq" ? Number(b.dataset.v) : b.dataset.v; });
    const inp = $("input[type=text]", el); if (inp) inp.oninput = () => v = inp.value;
    $("#chk").onclick = () => {
      if (v == null || v === "") return toast("Em chọn hoặc viết đáp án đã nhé.");
      const ok = q.type === "mcq" ? v === Number(q.answer) : q.type === "tf" ? String(v) === String(q.answer) : String(q.answer).split("|").some(x => x.trim().toLowerCase() === String(v).trim().toLowerCase().replace(",", ".") || x.trim().toLowerCase() === String(v).trim().toLowerCase());
      if (ok) correct++;
      $("#fb").innerHTML = `<p class="res ${ok ? "ok" : "no"}" style="font-size:18px">${ok ? "✓ Đúng rồi!" : "✗ Chưa đúng. Đáp án: " + esc(q.type === "mcq" ? q.options[q.answer] : q.type === "tf" ? (q.answer ? "Đúng" : "Sai") : String(q.answer).split("|")[0])}</p>${q.explain ? `<p class="small muted">💡 ${esc(q.explain)}</p>` : ""}`;
      const b = $("#chk"); b.textContent = i + 1 < qs.length ? "Câu tiếp →" : "Xem kết quả"; b.onclick = () => { i++; step(); };
    };
  };
  step();
}

/* =================== CÔ GIÁO =================== */
async function tLogin() {
  frame();
  app().innerHTML = `<div class="narrow card"><p class="muted">Đang kết nối lớp…</p></div>`;
  let info; try { info = await api("hello", {}); } catch (e) { info = null; }
  if (!info) { app().innerHTML = `<div class="narrow card"><h2>Chưa kết nối được máy chủ lớp</h2><p>Cô kiểm tra mạng hoặc dán lại link máy chủ.</p>${serverBox()}</div>`; bindServerBox(); return; }
  if (info.needSetup) return tSetup();
  app().innerHTML = `<div class="narrow card"><h2>👩‍🏫 Cô giáo lớp ${esc(info.className)}</h2><label class="f">Mật khẩu</label><input type="password" id="pw" autocomplete="current-password">
    <p id="loginErr" class="small" style="color:var(--berry);font-weight:700;margin:6px 0 0"></p><div class="row" style="margin-top:12px"><button class="btn primary grow" id="go">Vào lớp</button></div>
    <details style="margin-top:14px"><summary class="small muted">Đổi máy chủ lớp</summary>${serverBox()}</details></div>`;
  bindServerBox();
  const go = e => busy($("#go"), async () => { $("#loginErr").textContent = ""; const r = await api("teacherLogin", { password: $("#pw").value }); setSession({ role: "T", token: r.token, name: info.teacherName || "Cô giáo", avatar: "👩‍🏫" }); tApp(); }, "Đang vào…").catch(err => { const el = $("#loginErr"); if (el) el.textContent = "⚠️ " + (err.message || err); });
  $("#go").onclick = go; $("#pw").onkeydown = e => { if (e.key === "Enter") go(); }; $("#pw").focus();
}
function serverBox() {
  return `<div style="margin-top:8px"><label class="f">Link máy chủ lớp (Google Apps Script)</label><input type="url" id="srv" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(API)}">
    <div class="row" style="margin-top:8px"><button class="btn" id="srvSave">Lưu link máy chủ</button><button class="btn ghost" id="srvDemo">Dùng bản dùng thử</button></div>
    <p class="tiny muted">Chưa có máy chủ? <a href="huong-dan.html" target="_blank">Xem hướng dẫn cài đặt (10 phút)</a>.</p></div>`;
}
function bindServerBox() {
  const s = $("#srvSave"); if (!s) return;
  s.onclick = () => { const v = $("#srv").value.trim(); if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(v)) return toast("Link cần có dạng https://script.google.com/macros/s/…/exec"); API = v; LS.set("api", v); LS.set("demo", false); setSession(null); toast("Đã lưu link máy chủ."); tLogin(); };
  $("#srvDemo").onclick = () => { API = ""; LS.set("demo", true); setSession(null); tLogin(); };
}
function tSetup() {
  app().innerHTML = `<div class="narrow card"><h2>Chào cô! Cài đặt lớp lần đầu</h2><p class="muted small">Chỉ làm một lần. Mật khẩu này để cô vào phần quản lí lớp.</p>
    <div class="grid2"><div><label class="f">Lớp</label><input type="text" id="cn" placeholder="3A"></div><div><label class="f">Tên cô (hiện với học sinh)</label><input type="text" id="tn" placeholder="Cô Lan"></div></div>
    <label class="f">Trường</label><input type="text" id="sc" placeholder="Trường Tiểu học …">
    <div class="grid2"><div><label class="f">Mật khẩu (ít nhất 6 kí tự)</label><input type="password" id="p1"></div><div><label class="f">Nhập lại mật khẩu</label><input type="password" id="p2"></div></div>
    <div class="row" style="margin-top:14px"><button class="btn primary grow" id="go">Tạo lớp</button></div></div>`;
  $("#go").onclick = e => { if ($("#p1").value !== $("#p2").value) return toast("Hai mật khẩu chưa giống nhau.");
    busy(e.currentTarget, async () => { const r = await api("init", { className: $("#cn").value || "3A", teacherName: $("#tn").value, school: $("#sc").value, password: $("#p1").value });
      setSession({ role: "T", token: r.token, name: $("#tn").value || "Cô giáo", avatar: "👩‍🏫" }); TVIEW = "hs"; tApp(); }); };
}

const TNAV = [["tong", "🏠 Tổng quan"], ["bando", "🗺️ Bản đồ bài học"], ["soan", "✨ Soạn bài với AI"], ["giao", "📚 Bài đã giao"], ["cham", "✅ Chấm bài"], ["hs", "👧 Học sinh"], ["baocao", "📊 Báo cáo"], ["caidat", "⚙️ Cài đặt"]];
async function tApp(view, keep) {
  if (view) TVIEW = view;
  frame({ nav: true });
  if (!keep || !TD) { if (!TD) app().innerHTML = `<p class="muted">Đang tải lớp…</p>`; try { TD = await api("tHome", {}); } catch (e) { return; } }
  if (!TD.lessons.length && API && !seeding) {   // lớp mới: tự nạp danh sách bài Toán, Tiếng Việt 3 từ mục lục sách
    seeding = true;
    try { const d = await (await fetch("bai-hoc-lop3.json")).json(); const all = [];
      Object.keys(d).forEach(sj => d[sj].forEach(l => all.push({ subject: sj, topic: l.topic, title: l.title })));
      for (const sj of Object.keys(d)) await api("saveLessons", { subject: sj, lessons: all.filter(x => x.subject === sj) });
      TD = await api("tHome", {}); toast("Đã nạp sẵn bản đồ bài học Toán và Tiếng Việt lớp 3."); } catch (e) {}
    seeding = false;
  }
  const nWait = TD.subs.filter(s => s.status === "cho_duyet").length;
  $("#nav").innerHTML = TNAV.map(([k, n]) => `<button data-v="${k}" class="${TVIEW === k ? "on" : ""}">${n}${k === "cham" && nWait ? `<span class="badge">${nWait}</span>` : ""}</button>`).join("");
  $$("#nav button").forEach(b => b.onclick = () => tApp(b.dataset.v, true));
  ({ tong: tTong, bando: tBando, soan: tSoan, giao: tGiao, cham: tCham, hs: tHS, baocao: tBaoCao, caidat: tCaiDat })[TVIEW]();
}
const subjects = () => (TD.settings.subjects && TD.settings.subjects.length ? TD.settings.subjects : [{ id: "toan", name: "Toán" }, { id: "tv", name: "Tiếng Việt" }]);
const lessonsOf = sid => TD.lessons.filter(l => l.subject === sid).sort((a, b) => a.order - b.order);
const lessonName = id => { const l = TD.lessons.find(x => x.id === id); return l ? l.title : ""; };
const stuName = id => { const s = TD.students.find(x => x.id === id); return s ? s.name : "?"; };

function tTong() {
  const wait = TD.subs.filter(s => s.status === "cho_duyet"), open = TD.asgs.filter(a => a.status === "giao" && (!a.due || a.due >= today()));
  const given = TD.asgs.filter(a => a.status === "giao"), exp = given.reduce((x, a) => x + a.nTarget, 0), got = given.reduce((x, a) => x + a.nSub, 0);
  const steps = [[TD.students.length > 0, "Nhập danh sách học sinh", "hs"], [TD.lessons.length > 0, "Vẽ bản đồ bài học (AI đọc mục lục sách)", "bando"], [!!TD.hasKey || !API, "Nhập mã AI Gemini", "caidat"], [TD.asgs.length > 0, "Soạn và giao bài đầu tiên", "soan"]];
  app().innerHTML = `<h1>Chào ${esc(TD.settings.teacherName || "cô")}! 🌤️</h1><p class="muted">Lớp ${esc(TD.settings.className)} · ${TD.students.length} học sinh · mã lớp <b>${esc(TD.settings.classCode)}</b></p>
    ${steps.some(s => !s[0]) ? `<div class="card"><h3>Bắt đầu trong 4 bước</h3>${steps.map(s => `<div class="row" style="padding:4px 0"><span>${s[0] ? "✅" : "⬜"}</span><span class="grow">${s[1]}</span>${s[0] ? "" : `<button class="btn small" data-go="${s[2]}">Làm ngay</button>`}</div>`).join("")}</div>` : ""}
    <div class="grid3"><div class="stat"><b>${wait.length}</b>bài chờ cô duyệt</div><div class="stat"><b>${open.length}</b>bài đang mở</div><div class="stat"><b>${exp ? Math.round(got / exp * 100) : 0}%</b>tỉ lệ nộp bài (${got}/${exp})</div></div>
    <div class="card" style="margin-top:14px"><div class="row between"><h3>Bài nộp mới</h3>${wait.length ? `<button class="btn primary small" data-go="cham">Chấm ngay</button>` : ""}</div>
    ${TD.subs.slice().sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || "")).slice(0, 8).map(s => { const a = TD.asgs.find(x => x.id === s.aid);
      return `<div class="row between" style="border-top:1px dashed var(--line);padding:7px 0"><span><b>${esc(s.name)}</b> <span class="muted small">· ${esc(a ? a.title : "")} · ${fmtTime(s.submittedAt)}</span></span>${s.status === "da_tra" ? starHTML(s.stars, 15) : '<span class="chip sun">chờ duyệt</span>'}</div>`; }).join("") || '<p class="muted">Chưa có bài nộp.</p>'}</div>`;
  $$("[data-go]").forEach(b => b.onclick = () => tApp(b.dataset.go, true));
}

/* ----- bản đồ bài học ----- */
let BSUBJ = "toan", BMODE = "lop";
function classPct(lid) {
  const asgs = TD.asgs.filter(a => a.lessonId === lid && a.status === "giao"); if (!asgs.length) return null;
  const n = TD.students.length; if (!n) return null;
  let good = 0;
  TD.students.forEach(st => { const sc = TD.subs.filter(s => s.sid === st.id && s.status === "da_tra" && asgs.some(a => a.id === s.aid)).map(s => s.score10); if (sc.length && sc.reduce((x, y) => x + y, 0) / sc.length >= 8) good++; });
  return Math.round(good / n * 100);
}
function tBando() {
  const subs = subjects(); if (!subs.find(s => s.id === BSUBJ)) BSUBJ = subs[0].id;
  const ls = lessonsOf(BSUBJ);
  app().innerHTML = `<div class="row between"><h1>Bản đồ bài học</h1><div class="tabs">${subs.map(s => `<button data-s="${s.id}" class="${s.id === BSUBJ ? "on" : ""}">${esc(s.name)}</button>`).join("")}</div></div>
    <div class="tabs"><button data-m="lop" class="${BMODE === "lop" ? "on" : ""}">Bản đồ cả lớp</button><button data-m="sua" class="${BMODE === "sua" ? "on" : ""}">Sửa danh sách bài</button></div><div id="bBody"></div>`;
  $$("[data-s]").forEach(b => b.onclick = () => { BSUBJ = b.dataset.s; tBando(); });
  $$("[data-m]").forEach(b => b.onclick = () => { BMODE = b.dataset.m; tBando(); });
  const body = $("#bBody");
  if (BMODE === "lop") {
    body.innerHTML = ls.length ? `<p class="muted small">Mỗi chặng ghi % học sinh đã vững (điểm trung bình các bài của chặng từ 8 trở lên). Bấm vào chặng để giao bài.</p>
      <div class="legend"><span><i class="dot" style="background:#BFE3CB;border:2px solid #3E9B5F"></i>≥ 80%</span><span><i class="dot" style="background:#E2F3E7;border:2px solid #3E9B5F"></i>50–79%</span><span><i class="dot" style="background:#FFF0D6;border:2px solid #F2A23A"></i>dưới 50%</span><span><i class="dot" style="background:#EEE8DA;border:2px solid #CFC6B2"></i>chưa giao bài</span></div>
      <div class="map">${mapHTML(ls, () => "khoa", { pct: classPct })}</div>` : `<div class="card"><h3>Môn này chưa có bản đồ</h3><p>Cô tải PDF sách lên, chọn các trang mục lục, AI sẽ đọc và vẽ bản đồ các bài. Cô cũng có thể tự nhập.</p><button class="btn primary" id="toEdit">Vẽ bản đồ</button></div>`;
    const te = $("#toEdit"); if (te) te.onclick = () => { BMODE = "sua"; tBando(); };
    $$(".node", body).forEach(n => n.onclick = () => { SOAN = newDraft(BSUBJ, n.dataset.id); tApp("soan", true); });
    return;
  }
  let rows = ls.map(l => Object.assign({}, l));
  const draw = () => {
    body.innerHTML = `<div class="card"><h3>✨ AI đọc mục lục sách</h3><p class="small muted">Chọn file PDF sách ${esc(subjName(BSUBJ, subs))}, đánh dấu các trang mục lục, AI liệt kê chủ đề và bài. Sách chỉ mở trên máy của cô, không tải lên mạng.</p>
      <div id="tocPdf"></div><div class="row" style="margin-top:8px"><button class="btn primary" id="tocGo">AI đọc mục lục</button></div></div>
      <div class="card"><div class="row between"><h3>Danh sách bài (${rows.length})</h3><div class="row"><button class="btn small" id="pasteL">📋 Dán danh sách bài</button><button class="btn small" id="addL">+ Thêm bài</button></div></div>
      <div class="scroll"><table class="t"><thead><tr><th>#</th><th>Chủ đề</th><th>Tên bài</th><th></th></tr></thead><tbody>${rows.map((l, i) => `<tr data-i="${i}"><td>${i + 1}</td><td><input type="text" data-f="topic" value="${esc(l.topic)}"></td><td><input type="text" data-f="title" value="${esc(l.title)}"></td>
      <td style="white-space:nowrap"><button class="btn ghost small" data-up="${i}">↑</button><button class="btn ghost small" data-dn="${i}">↓</button><button class="btn ghost small danger" data-rm="${i}">✕</button></td></tr>`).join("")}</tbody></table></div>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="saveL">Lưu bản đồ</button><span class="small muted">Bài đã có bài tập thì nên sửa tên, không nên xóa.</span></div></div>`;
    $$("tr[data-i] input", body).forEach(inp => inp.oninput = () => rows[inp.closest("tr").dataset.i][inp.dataset.f] = inp.value);
    $$("[data-up]", body).forEach(b => b.onclick = () => { const i = +b.dataset.up; if (i) { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; draw(); } });
    $$("[data-dn]", body).forEach(b => b.onclick = () => { const i = +b.dataset.dn; if (i < rows.length - 1) { [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; draw(); } });
    $$("[data-rm]", body).forEach(b => b.onclick = () => { rows.splice(+b.dataset.rm, 1); draw(); });
    $("#pasteL").onclick = () => {
      const ov = document.createElement("div"); ov.style.cssText = "position:fixed;inset:0;background:rgba(43,42,51,.55);z-index:80;display:grid;place-items:center;padding:16px";
      ov.innerHTML = `<div class="card" style="width:min(720px,100%);max-height:90vh;overflow:auto;margin:0"><h3>📋 Dán danh sách bài</h3>
        <p class="small muted">Mỗi dòng một bài. Dòng bắt đầu bằng <b>#</b> là tên chủ đề, các dòng sau nó là bài của chủ đề đó.</p>
        <textarea rows="14" id="pasteBox" placeholder="# Chủ đề 1: Ôn tập và bổ sung&#10;Bài 1. Ôn tập các số đến 1 000&#10;Bài 2. Ôn tập phép cộng, phép trừ"></textarea>
        <div class="row" style="margin-top:10px"><button class="btn primary" id="pasteOk">Thêm vào danh sách</button><button class="btn ghost" id="pasteX">Hủy</button></div></div>`;
      document.body.appendChild(ov); $("#pasteBox", ov).focus();
      $("#pasteX", ov).onclick = () => ov.remove();
      $("#pasteOk", ov).onclick = () => {
        let topic = rows.length ? rows[rows.length - 1].topic : "", add = [];
        $("#pasteBox", ov).value.split(/\n/).map(x => x.trim()).filter(Boolean).forEach(line => {
          if (line.startsWith("#")) { topic = line.replace(/^#+\s*/, ""); return; }
          const parts = line.split("|").map(x => x.trim());
          if (parts.length > 1) { topic = parts[0]; add.push({ subject: BSUBJ, topic, title: parts.slice(1).join(" | ") }); } else add.push({ subject: BSUBJ, topic, title: line });
        });
        ov.remove(); if (!add.length) return toast("Chưa có dòng nào để thêm.");
        rows = rows.concat(add); draw(); toast(`Đã thêm ${add.length} bài. Cô bấm Lưu bản đồ nhé.`);
      };
    };
    $("#addL").onclick = () => { rows.push({ subject: BSUBJ, topic: rows.length ? rows[rows.length - 1].topic : "", title: "" }); draw(); };
    $("#saveL").onclick = e => busy(e.currentTarget, async () => { await api("saveLessons", { subject: BSUBJ, lessons: rows.map(r => Object.assign(r, { subject: BSUBJ })) }); TD = null; toast("Đã lưu bản đồ."); BMODE = "lop"; await tApp("bando"); });
    const picker = pdfPicker($("#tocPdf"), BSUBJ, 4);
    $("#tocGo").onclick = e => busy(e.currentTarget, async () => {
      const pages = picker.selected(); if (!pages.length) throw new Error("Cô chọn ít nhất 1 trang mục lục.");
      const { images, text } = await picker.extract(pages);
      const r = await api("aiToc", { subject: BSUBJ, images, text });
      if (!r.lessons.length) throw new Error("AI chưa đọc được mục lục, cô thử chọn lại trang.");
      if (!rows.length || !confirm(`AI tìm được ${r.lessons.length} bài.\nBấm OK để THÊM vào cuối danh sách hiện tại (ví dụ đọc mục lục tập 2).\nBấm Hủy để THAY toàn bộ danh sách.`)) rows = r.lessons; else rows = rows.concat(r.lessons);
      draw(); toast("AI đã đọc xong mục lục. Cô xem lại rồi bấm Lưu bản đồ.");
    }, "AI đang đọc mục lục…");
  };
  draw();
}

/* ----- chọn trang PDF (sách mở trên máy cô, lưu trong IndexedDB để lần sau khỏi tải lại) ----- */
const BookDB = {
  db() { return new Promise((res, rej) => { const r = indexedDB.open("bdtt_books", 1); r.onupgradeneeded = () => r.result.createObjectStore("b"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async get(k) { try { const d = await this.db(); return await new Promise(res => { const q = d.transaction("b").objectStore("b").get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch (e) { return null; } },
  async set(k, v) { try { const d = await this.db(); await new Promise(res => { const t = d.transaction("b", "readwrite"); t.objectStore("b").put(v, k); t.oncomplete = res; t.onerror = res; }); } catch (e) {} }
};
const pdfCache = {};
async function openPdf(buf) { if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; return pdfjsLib.getDocument({ data: buf }).promise; }
/* Mỗi môn có thể có nhiều quyển (tập 1, tập 2…): danh sách lưu ở "list_<môn>", từng quyển ở "bk_<mã>" */
async function bookList(subject) {
  let list = await BookDB.get("list_" + subject);
  if (!list) {
    list = []; const old = await BookDB.get("book_" + subject);
    if (old) { const id = subject + "_" + Date.now().toString(36); await BookDB.set("bk_" + id, old); list.push({ id, name: old.name }); }
    await BookDB.set("list_" + subject, list);
  }
  return list;
}
function bookLabel(n) { const m = String(n).match(/t[aậ]p\s*(\d)/i); return (m ? "Tập " + m[1] + " · " : "") + String(n).replace(/\.pdf$/i, ""); }
function pdfPicker(el, subject, maxSel) {
  let doc = null, cur = null, list = [], start = 1, sel = [];
  const PER = 12;
  async function open(id) {
    sel = []; start = 1; cur = id; LS.set("curbook_" + subject, id);
    if (pdfCache[id]) { doc = pdfCache[id]; return draw(); }
    el.innerHTML = `<p class="small"><span class="spin"></span> Đang mở sách…</p>`;
    try { const b = await BookDB.get("bk_" + id); doc = await openPdf(b.buf.slice(0)); pdfCache[id] = doc; } catch (e) { doc = null; toast("Không mở được quyển sách này."); }
    draw();
  }
  async function thumb(n, canvas) { const d = doc, p = await d.getPage(n), v = p.getViewport({ scale: 1 }), k = 180 / v.width, vp = p.getViewport({ scale: k }); canvas.width = vp.width; canvas.height = vp.height; await p.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise; }
  function shelf() {
    return `<div class="row">${list.map(b => `<button class="btn small ${b.id === cur ? "primary" : ""}" data-bk="${esc(b.id)}" title="${esc(b.name)}">📗 ${esc(bookLabel(b.name))}</button>`).join("")}
      <button class="btn small ghost" data-up>+ Thêm sách</button>${cur ? `<button class="btn small ghost danger" data-rm title="Chỉ xóa khỏi máy này">Bỏ quyển này</button>` : ""}</div>`;
  }
  function draw() {
    if (!list.length) { el.innerHTML = `<div class="row"><button class="btn" data-up>📄 Chọn file PDF sách</button><span class="small muted">Môn có nhiều tập thì thêm từng quyển. Có thể dán chữ của bài vào ô bên dưới nếu không có PDF.</span></div>`; $("[data-up]", el).onclick = upload; return; }
    if (!doc) { el.innerHTML = shelf() + `<p class="small muted">Bấm vào một quyển để mở.</p>`; bind(); return; }
    const end = Math.min(doc.numPages, start + PER - 1);
    el.innerHTML = shelf() + `<div class="row" style="margin-top:8px"><button class="btn small" data-prev>←</button><span class="small">Trang ${start}–${end} / ${doc.numPages}</span><button class="btn small" data-next>→</button>
      <span class="small">Đi tới trang</span><input type="number" min="1" max="${doc.numPages}" style="width:90px" data-jump><span class="small muted">Đã chọn: ${sel.length ? sel.join(", ") : "chưa có"} (tối đa ${maxSel})</span></div>
      <div class="pages">${Array.from({ length: end - start + 1 }, (_, k) => start + k).map(n => `<div class="pg ${sel.includes(n) ? "on" : ""}" data-n="${n}"><canvas></canvas>Trang ${n}</div>`).join("")}</div>`;
    bind();
    $("[data-prev]", el).onclick = () => { start = Math.max(1, start - PER); draw(); };
    $("[data-next]", el).onclick = () => { if (start + PER <= doc.numPages) { start += PER; draw(); } };
    $("[data-jump]", el).onchange = e => { const n = Math.max(1, Math.min(doc.numPages, +e.target.value || 1)); start = Math.max(1, n - 2); draw(); };
    $$(".pg", el).forEach(d => { thumb(+d.dataset.n, $("canvas", d)).catch(() => {}); d.onclick = () => { const n = +d.dataset.n; if (sel.includes(n)) sel = sel.filter(x => x !== n); else { if (sel.length >= maxSel) return toast(`Chọn tối đa ${maxSel} trang mỗi lần.`); sel.push(n); sel.sort((a, b) => a - b); } draw(); }; });
  }
  function bind() {
    $$("[data-bk]", el).forEach(b => b.onclick = () => b.dataset.bk !== cur && open(b.dataset.bk));
    $("[data-up]", el).onclick = upload;
    const rmb = $("[data-rm]", el); if (rmb) rmb.onclick = async () => {
      if (!confirm("Bỏ quyển sách này khỏi máy? (Bài tập và bản đồ đã lưu không bị ảnh hưởng)")) return;
      list = list.filter(b => b.id !== cur); await BookDB.set("list_" + subject, list); await BookDB.set("bk_" + cur, null); delete pdfCache[cur]; doc = null; cur = null;
      if (list.length) open(list[0].id); else draw();
    };
  }
  function upload() {
    const fp = $("#filePick"); fp.accept = "application/pdf"; fp.removeAttribute("capture"); fp.multiple = true; fp.value = "";
    fp.onchange = async () => { const files = [...fp.files]; fp.multiple = false; if (!files.length) return; el.innerHTML = `<p class="small"><span class="spin"></span> Đang mở sách…</p>`;
      let last = null;
      for (const f of files) { try { const buf = await f.arrayBuffer(); await openPdf(buf.slice(0)); const id = subject + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        await BookDB.set("bk_" + id, { name: f.name, buf }); list.push({ id, name: f.name }); last = id; } catch (e) { toast("Không mở được file " + f.name); } }
      list.sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true })); await BookDB.set("list_" + subject, list);
      if (last) open(last); else draw(); };
    fp.click();
  }
  (async () => { list = await bookList(subject); const want = LS.get("curbook_" + subject, null); const id = list.find(b => b.id === want) ? want : (list[0] && list[0].id); if (id) open(id); else draw(); })();
  return {
    selected: () => sel.slice(),
    async extract(pages) {
      const images = [], texts = [];
      for (const n of pages) {
        const p = await doc.getPage(n), v = p.getViewport({ scale: 1 }), k = Math.min(2.2, 1300 / v.width), vp = p.getViewport({ scale: k }), c = document.createElement("canvas");
        c.width = vp.width; c.height = vp.height; await p.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise; images.push(c.toDataURL("image/jpeg", .72));
        try { const tc = await p.getTextContent(); texts.push(tc.items.map(i => i.str).join(" ")); } catch (e) {}
      }
      return { images, text: texts.join("\n").replace(/\s+/g, " ").trim() };
    }
  };
}

/* ----- soạn bài với AI ----- */
let SOAN = null;
function newDraft(subject, lessonId) { return { subject: subject || subjects()[0].id, lessonId: lessonId || "", title: "", due: today(2), target: "all", note: "", questions: [], status: "giao", n: { 1: 3, 2: 3, 3: 2 }, types: ["mcq", "fill", "tf", "photo"], context: "", pasted: "" }; }
function tSoan() {
  if (!SOAN) SOAN = newDraft(BSUBJ);
  const D = SOAN, subs = subjects(), ls = lessonsOf(D.subject);
  const topics = []; ls.forEach(l => { let t = topics[topics.length - 1]; if (!t || t.name !== l.topic) topics.push(t = { name: l.topic, items: [] }); t.items.push(l); });
  app().innerHTML = `<div class="row between"><h1>${D.id ? "Sửa bài" : "Soạn bài với AI"}</h1>${D.questions.length || D.id ? `<button class="btn ghost small" id="newD">+ Soạn bài mới</button>` : ""}</div>
    <div class="card"><h3>1 · Chọn bài học</h3><div class="grid2"><div><label class="f">Môn</label><select id="sSub">${subs.map(s => `<option value="${s.id}" ${s.id === D.subject ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
    <div><label class="f">Bài (chặng trên bản đồ)</label><select id="sLes"><option value="">— chọn bài —</option>${topics.map(t => `<optgroup label="${esc(t.name)}">${t.items.map(l => `<option value="${l.id}" ${l.id === D.lessonId ? "selected" : ""}>${esc(l.title)}</option>`).join("")}</optgroup>`).join("")}</select></div></div>
    ${ls.length ? "" : `<p class="small muted">Môn này chưa có bản đồ. <a href="#" id="toMap">Vẽ bản đồ trước</a> để bài tập gắn vào chặng.</p>`}</div>
    <div class="card"><h3>2 · Trang sách của bài</h3><p class="small muted">AI đọc các trang này để nắm <b>kiến thức</b> của bài rồi tạo <b>bài tập mới</b> (số liệu và tình huống mới), không chép bài có sẵn trong sách.</p>
    <div id="soanPdf"></div><label class="f">Hoặc dán nội dung bài học</label><textarea id="sTxt" rows="2" placeholder="Ví dụ: Bảng nhân 6; bài toán có lời văn một bước nhân">${esc(D.pasted)}</textarea></div>
    <div class="card"><h3>3 · Yêu cầu cho AI</h3><div class="grid3">${[1, 2, 3].map(k => `<div><label class="f">${LEVEL_NAME[k]}</label><input type="number" min="0" max="10" data-n="${k}" value="${D.n[k]}"></div>`).join("")}</div>
    <label class="f">Dạng câu hỏi</label><div class="row">${Object.entries(TYPE_NAME).map(([k, n]) => `<label class="chip ${D.types.includes(k) ? "" : "grey"}" style="cursor:pointer"><input type="checkbox" data-ty="${k}" ${D.types.includes(k) ? "checked" : ""} style="margin:0 4px 0 0">${n}</label>`).join("")}</div>
    <label class="f">Gợi ý thêm (không bắt buộc)</label><input type="text" id="sCtx" value="${esc(D.context)}" placeholder="Ví dụ: tình huống ở chợ quê, vườn cây; lớp có nhiều em đọc chậm">
    <div class="row" style="margin-top:12px"><button class="btn primary big" id="gen">✨ AI soạn bài tập mới</button>${D.questions.length ? `<span class="small muted">Bấm lại để AI soạn thêm câu (thêm vào cuối).</span>` : ""}</div></div>
    <div id="qEdit"></div>`;
  $("#sSub").onchange = e => { D.subject = e.target.value; D.lessonId = ""; tSoan(); };
  $("#sLes").onchange = e => { D.lessonId = e.target.value; };
  const tm = $("#toMap"); if (tm) tm.onclick = e => { e.preventDefault(); BSUBJ = D.subject; BMODE = "sua"; tApp("bando", true); };
  const nd = $("#newD"); if (nd) nd.onclick = () => { SOAN = newDraft(D.subject); tSoan(); };
  $("#sTxt").oninput = e => D.pasted = e.target.value;
  $("#sCtx").oninput = e => D.context = e.target.value;
  $$("[data-n]").forEach(i => i.oninput = () => D.n[i.dataset.n] = Math.max(0, Math.min(10, +i.value || 0)));
  $$("[data-ty]").forEach(c => c.onchange = () => { D.types = $$("[data-ty]").filter(x => x.checked).map(x => x.dataset.ty); c.parentElement.classList.toggle("grey", !c.checked); });
  const picker = pdfPicker($("#soanPdf"), D.subject, 6);
  $("#gen").onclick = e => busy(e.currentTarget, async () => {
    if (!D.lessonId && !D.pasted) throw new Error("Cô chọn bài hoặc dán nội dung bài học.");
    if (!D.types.length) throw new Error("Cô chọn ít nhất một dạng câu hỏi.");
    if (!(D.n[1] + D.n[2] + D.n[3])) throw new Error("Cô đặt số câu cho ít nhất một mức.");
    let images = [], text = D.pasted;
    const pages = picker.selected(); if (pages.length) { const x = await picker.extract(pages); images = x.images; text = (x.text + "\n" + D.pasted).trim(); }
    const r = await api("aiGen", { subject: D.subject, lessonId: D.lessonId, lessonTitle: D.pasted.slice(0, 80), images, text, n: D.n, types: D.types, context: D.context });
    D.questions = D.questions.concat(r.questions);
    if (!D.title) D.title = "Luyện tập: " + (lessonName(D.lessonId) || "bài mới");
    toast(`AI đã soạn ${r.questions.length} câu. Cô đọc kĩ, sửa nếu cần rồi giao bài.`); drawQEdit(); $("#qEdit").scrollIntoView({ behavior: "smooth" });
  }, "AI đang soạn bài (khoảng 20–40 giây)…");
  drawQEdit();
}
function drawQEdit() {
  const D = SOAN, box = $("#qEdit"); if (!box) return;
  if (!D.questions.length) { box.innerHTML = `<div class="card muted small">Câu hỏi AI soạn sẽ hiện ở đây để cô duyệt. Cô cũng có thể <a href="#" id="addQ0">tự thêm câu</a>.</div>`; $("#addQ0").onclick = e => { e.preventDefault(); addQ(); }; return; }
  const total = D.questions.reduce((x, q) => x + (Number(q.points) || 1), 0);
  box.innerHTML = `<div class="card"><div class="row between"><h3>4 · Cô duyệt câu hỏi (${D.questions.length} câu · ${total} điểm)</h3><button class="btn small" id="addQ">+ Tự thêm câu</button></div>
    <p class="small muted">Viền xanh: mức 1 · vàng: mức 2 · đỏ: mức 3. Câu có nhãn “AI” là AI soạn; cô sửa chữ nào thì câu đó được ghi là “cô đã sửa”.</p>
    ${D.questions.map((q, i) => qEditHTML(q, i)).join("")}</div>
    <div class="card"><h3>5 · Giao bài</h3><div class="grid2"><div><label class="f">Tên bài</label><input type="text" id="aTitle" value="${esc(D.title)}"></div><div><label class="f">Hạn nộp</label><input type="date" id="aDue" value="${esc(D.due)}"></div></div>
    <label class="f">Lời dặn của cô (không bắt buộc)</label><input type="text" id="aNote" value="${esc(D.note)}" placeholder="Ví dụ: Câu chụp ảnh các em làm vào vở ô li nhé">
    <label class="f">Giao cho</label><div class="row"><label><input type="radio" name="tg" value="all" ${D.target === "all" ? "checked" : ""}> Cả lớp</label><label><input type="radio" name="tg" value="some" ${D.target !== "all" ? "checked" : ""}> Chọn học sinh</label></div>
    <div id="tgList" class="${D.target === "all" ? "hidden" : ""} row" style="margin-top:6px">${TD.students.map(s => `<label class="chip grey" style="cursor:pointer"><input type="checkbox" data-st="${s.id}" ${Array.isArray(D.target) && D.target.includes(s.id) ? "checked" : ""}> ${esc(s.name)}</label>`).join("")}</div>
    <div class="row" style="margin-top:14px"><button class="btn primary big" id="give">📤 Giao bài</button><button class="btn" id="saveDraft">Lưu nháp</button></div></div>`;
  $("#addQ").onclick = addQ;
  $("#aTitle").oninput = e => D.title = e.target.value; $("#aDue").oninput = e => D.due = e.target.value; $("#aNote").oninput = e => D.note = e.target.value;
  $$("input[name=tg]").forEach(r => r.onchange = () => { D.target = r.value === "all" ? "all" : []; $("#tgList").classList.toggle("hidden", r.value === "all"); });
  $$("[data-st]").forEach(c => c.onchange = () => { D.target = $$("[data-st]").filter(x => x.checked).map(x => x.dataset.st); });
  D.questions.forEach((q, i) => bindQEdit(q, i));
  const save = status => async () => {
    if (Array.isArray(D.target) && !D.target.length) throw new Error("Cô chọn ít nhất một học sinh.");
    const r = await api("saveAsg", { asg: Object.assign({}, D, { status }) });
    toast(status === "giao" ? "Đã giao bài cho học sinh! 🎉" : "Đã lưu nháp."); SOAN = null; TD = null; await tApp(status === "giao" ? "giao" : "soan");
  };
  $("#give").onclick = e => busy(e.currentTarget, save("giao"), "Đang giao bài…");
  $("#saveDraft").onclick = e => busy(e.currentTarget, save("nhap"));
}
function addQ() { SOAN.questions.push({ id: "", type: "mcq", level: 1, text: "", options: ["", "", "", ""], answer: 0, points: 1, explain: "" }); drawQEdit(); }
function qEditHTML(q, i) {
  let ans = "";
  if (q.type === "mcq") ans = (q.options || []).map((o, k) => `<div class="opt-row"><input type="radio" name="ans${i}" value="${k}" ${Number(q.answer) === k ? "checked" : ""} title="Đáp án đúng"><b>${"ABCD"[k]}</b><input type="text" data-o="${k}" value="${esc(o)}"></div>`).join("") + `<div class="tiny muted">Chấm tròn = đáp án đúng</div>`;
  else if (q.type === "tf") ans = `<label class="f">Đáp án</label><select data-k="answer"><option value="true" ${q.answer === true ? "selected" : ""}>Đúng</option><option value="false" ${q.answer === false ? "selected" : ""}>Sai</option></select>`;
  else if (q.type === "fill") ans = `<label class="f">Đáp án (nhiều cách viết thì ngăn bằng dấu | )</label><input type="text" data-k="answer" value="${esc(q.answer)}">`;
  else ans = `<label class="f">${q.type === "photo" ? "Lời giải mẫu" : "Đáp án gợi ý"}</label><textarea rows="2" data-k="answer">${esc(q.answer)}</textarea><label class="f">Cách cho điểm (AI dựa vào đây để chấm nháp)</label><input type="text" data-k="rubric" value="${esc(q.rubric || "")}">`;
  return `<div class="qe l${q.level}" data-i="${i}"><div class="row between"><div class="row"><b>Câu ${i + 1}</b>${q.ai ? `<span class="chip">${q.edited ? "AI · cô đã sửa" : "AI"}</span>` : '<span class="chip leaf">Cô soạn</span>'}</div>
    <div class="row"><select data-k="type" style="width:auto">${Object.entries(TYPE_NAME).map(([k, n]) => `<option value="${k}" ${q.type === k ? "selected" : ""}>${n}</option>`).join("")}</select>
    <select data-k="level" style="width:auto">${[1, 2, 3].map(k => `<option value="${k}" ${Number(q.level) === k ? "selected" : ""}>Mức ${k}</option>`).join("")}</select>
    <select data-k="points" style="width:auto"><option value="1" ${q.points != 2 ? "selected" : ""}>1 điểm</option><option value="2" ${q.points == 2 ? "selected" : ""}>2 điểm</option></select>
    <button class="btn ghost small" data-mv="-1">↑</button><button class="btn ghost small" data-mv="1">↓</button><button class="btn ghost small danger" data-del>Xóa</button></div></div>
    <label class="f">Đề bài</label><textarea rows="2" data-k="text">${esc(q.text)}</textarea>${ans}<label class="f">Giải thích cho học sinh khi xem lại</label><input type="text" data-k="explain" value="${esc(q.explain || "")}"></div>`;
}
function bindQEdit(q, i) {
  const el = $(`.qe[data-i="${i}"]`), D = SOAN, mark = () => { if (q.ai && !q.edited) { q.edited = true; const c = $(".chip", el); if (c) c.textContent = "AI · cô đã sửa"; } };
  $$("[data-k]", el).forEach(inp => {
    const k = inp.dataset.k;
    const handler = () => {
      let v = inp.value;
      if (k === "level" || k === "points") v = Number(v);
      if (k === "answer" && q.type === "tf") v = v === "true";
      q[k] = v; mark();
      if (k === "type") { if (v === "mcq" && !q.options) { q.options = ["", "", "", ""]; q.answer = 0; } if (v === "tf") q.answer = true; if (v !== "mcq" && v !== "tf" && typeof q.answer !== "string") q.answer = ""; drawQEdit(); }
      if (k === "level") el.className = "qe l" + v;
    };
    inp.oninput = handler; if (inp.tagName === "SELECT") inp.onchange = handler;
  });
  $$("[data-o]", el).forEach(inp => inp.oninput = () => { q.options[+inp.dataset.o] = inp.value; mark(); });
  $$(`input[name=ans${i}]`, el).forEach(r => r.onchange = () => { q.answer = +r.value; mark(); });
  $("[data-del]", el).onclick = () => { D.questions.splice(i, 1); drawQEdit(); };
  $$("[data-mv]", el).forEach(b => b.onclick = () => { const j = i + Number(b.dataset.mv); if (j < 0 || j >= D.questions.length) return; [D.questions[i], D.questions[j]] = [D.questions[j], D.questions[i]]; drawQEdit(); });
}

/* ----- bài đã giao ----- */
function tGiao(openId) {
  const list = TD.asgs.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  if (openId) return tGiaoDetail(openId);
  app().innerHTML = `<h1>Bài đã giao</h1>${list.map(a => `<div class="card"><div class="row between"><div><span class="chip ${a.subject === "tv" ? "berry" : ""}">${esc(subjName(a.subject, subjects()))}</span> ${a.status === "nhap" ? '<span class="chip grey">bản nháp</span>' : ""} <b>${esc(a.title)}</b>
    <div class="small muted">${esc(lessonName(a.lessonId))} · ${a.questions.length} câu · hạn ${fmtDate(a.due)}</div></div>
    <div class="row">${a.nWait ? `<span class="chip sun">${a.nWait} chờ duyệt</span>` : ""}<button class="btn small" data-open="${a.id}">Xem bài nộp</button><button class="btn ghost small" data-edit="${a.id}">Sửa</button><button class="btn ghost small danger" data-del="${a.id}">Xóa</button></div></div>
    ${a.status === "giao" ? `<div class="row" style="margin-top:8px"><div class="prog grow"><i style="width:${a.nTarget ? a.nSub / a.nTarget * 100 : 0}%"></i></div><span class="small">${a.nSub}/${a.nTarget} đã nộp</span></div>` : ""}</div>`).join("") || `<div class="card muted">Chưa có bài nào. Vào “Soạn bài với AI” để soạn bài đầu tiên.</div>`}`;
  $$("[data-open]").forEach(b => b.onclick = () => tGiaoDetail(b.dataset.open));
  $$("[data-edit]").forEach(b => b.onclick = () => { const a = TD.asgs.find(x => x.id === b.dataset.edit); SOAN = Object.assign(newDraft(a.subject, a.lessonId), JSON.parse(JSON.stringify(a))); tApp("soan", true); });
  $$("[data-del]").forEach(b => b.onclick = () => { if (!confirm("Xóa bài này và toàn bộ bài nộp của học sinh?")) return; busy(b, async () => { await api("delAsg", { aid: b.dataset.del }); TD = null; await tApp("giao"); }); });
}
function tGiaoDetail(aid) {
  const a = TD.asgs.find(x => x.id === aid); if (!a) return tGiao();
  const targets = a.target === "all" ? TD.students : TD.students.filter(s => a.target.includes(s.id));
  app().innerHTML = `<button class="btn ghost small" id="back">← Bài đã giao</button><h1 style="margin-top:8px">${esc(a.title)}</h1><p class="muted">${esc(lessonName(a.lessonId))} · hạn ${fmtDate(a.due)}</p>
    <div class="card scroll"><table class="t"><thead><tr><th>Học sinh</th><th>Trạng thái</th><th>Điểm</th><th>Nộp lúc</th><th></th></tr></thead><tbody>${targets.map(st => { const s = TD.subs.find(x => x.aid === aid && x.sid === st.id);
      return `<tr><td>${esc(st.avatar)} ${esc(st.name)}</td><td>${!s ? '<span class="chip grey">chưa nộp</span>' : s.status === "da_tra" ? '<span class="chip leaf">đã trả</span>' : '<span class="chip sun">chờ duyệt</span>'}${s && s.late ? ' <span class="chip berry">muộn</span>' : ""}</td>
      <td>${s && s.status === "da_tra" ? s.score10 + " " + starHTML(s.stars, 13) : s && s.draft10 != null ? `<span class="muted">AI gợi ý ${s.draft10}</span>` : ""}</td><td class="small">${s ? fmtTime(s.submittedAt) : ""}</td><td>${s ? `<button class="btn small" data-sub="${s.id}">${s.status === "da_tra" ? "Xem" : "Chấm"}</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>`;
  $("#back").onclick = () => tGiao();
  $$("[data-sub]").forEach(b => b.onclick = () => { CHAM_ID = b.dataset.sub; tApp("cham", true); });
}

/* ----- chấm bài ----- */
let CHAM_ID = null;
async function tCham() {
  const wait = TD.subs.filter(s => s.status === "cho_duyet").sort((a, b) => (a.submittedAt || "").localeCompare(b.submittedAt || ""));
  if (!CHAM_ID && wait.length) CHAM_ID = wait[0].id;
  const cur = TD.subs.find(s => s.id === CHAM_ID);
  app().innerHTML = `<h1>Chấm bài</h1><div class="cham"><div class="qlist card"><b class="small">Chờ cô duyệt (${wait.length})</b><div style="margin-top:6px">${wait.map(s => { const a = TD.asgs.find(x => x.id === s.aid);
      return `<button data-id="${s.id}" class="${s.id === CHAM_ID ? "on" : ""}"><span class="grow"><b>${esc(s.name)}</b><br><span class="tiny muted">${esc(a ? a.title : "")}</span></span>${s.draft10 != null ? `<span class="chip">${s.draft10}</span>` : ""}</button>`; }).join("") || '<p class="small muted">Không còn bài nào chờ duyệt 🎉</p>'}</div></div>
    <div id="chamBody">${cur ? '<p class="muted">Đang mở bài…</p>' : '<div class="card muted">Chọn một bài bên trái.</div>'}</div></div>`;
  $$(".qlist button").forEach(b => b.onclick = () => { CHAM_ID = b.dataset.id; tCham(); });
  if (!cur) return;
  let G; try { G = await api("getSub", { id: CHAM_ID }); } catch (e) { return; }
  const t0 = Date.now(), s = G.sub, a = G.asg, fin = {};
  a.questions.forEach(q => { const p = Number(q.points) || 1; fin[q.id] = s.final && s.final[q.id] != null ? s.final[q.id] : q.type in { mcq: 1, tf: 1, fill: 1 } ? (s.auto[q.id] ? p : 0) : (s.ai[q.id] && s.ai[q.id].score != null ? s.ai[q.id].score : 0); });
  const total = a.questions.reduce((x, q) => x + (Number(q.points) || 1), 0);
  const calc = () => Math.round(Object.values(fin).reduce((x, y) => x + Number(y || 0), 0) / total * 10);
  const aiOverall = s.aiOverall || "";
  $("#chamBody").innerHTML = `<div class="card"><div class="row between"><div class="row"><span class="ava">${esc(G.student ? G.student.avatar : "🙂")}</span><div><b>${esc(G.student ? G.student.name : "")}</b><div class="small muted">${esc(a.title)} · nộp ${fmtTime(s.submittedAt)} ${s.late ? '<span class="chip berry">muộn</span>' : ""}</div></div></div>
      ${s.status === "da_tra" ? '<span class="chip leaf">đã trả bài</span>' : ""}</div>${s.aiError ? `<div class="aibox">⚠️ AI chưa chấm nháp được: ${esc(s.aiError)} <button class="btn small" id="regrade">AI chấm lại</button></div>` : ""}</div>
    ${a.questions.map((q, i) => {
      const v = (s.answers || {})[q.id], p = Number(q.points) || 1, ai = s.ai[q.id];
      let mine = v == null || v === "" ? "<i class='muted'>(bỏ trống)</i>" : q.type === "mcq" ? esc((q.options || [])[v]) : q.type === "tf" ? (v === "true" ? "Đúng" : "Sai") : esc(v);
      if (q.type === "photo") mine = G.photos[q.id] ? `<img src="${G.photos[q.id].startsWith("data:") ? G.photos[q.id] : "data:image/jpeg;base64," + G.photos[q.id]}" style="max-width:100%;border-radius:10px;border:1.5px solid var(--line);cursor:zoom-in" data-zoom alt="Ảnh bài làm">` : "<i class='muted'>(không có ảnh)</i>";
      const right = q.type === "mcq" ? q.options[q.answer] : q.type === "tf" ? (q.answer ? "Đúng" : "Sai") : q.answer;
      return `<div class="q"><div class="qh"><b>Câu ${i + 1} <span class="chip grey">${TYPE_NAME[q.type]}</span></b><span class="row small">Điểm <input type="number" step="0.5" min="0" max="${p}" value="${fin[q.id]}" data-fin="${q.id}" style="width:74px"> / ${p}</span></div>
        <div class="qt" style="font-size:16px">${esc(q.text)}</div><p class="small" style="margin:6px 0">Bài làm: <b>${mine}</b></p><p class="small muted" style="margin:0">Đáp án: ${esc(right)}</p>
        ${q.type in { mcq: 1, tf: 1, fill: 1 } ? `<p class="res ${s.auto[q.id] ? "ok" : "no"} small">${s.auto[q.id] ? "✓ Máy chấm: đúng" : "✗ Máy chấm: chưa đúng"}</p>` : ai ? `<div class="aibox">🤖 AI gợi ý: <b>${ai.score == null ? "chưa chấm được" : ai.score + "/" + p + " điểm"}</b>${ai.note ? " · " + esc(ai.note) : ""}${ai.comment ? `<br>Nhận xét: “${esc(ai.comment)}”` : ""}</div>` : ""}</div>`;
    }).join("")}
    <div class="card"><div class="row between"><h3>Điểm cả bài: <span id="tot">${calc()}</span>/10 <span id="stz">${starHTML(Core.stars(calc()), 18)}</span></h3>${s.draft10 != null ? `<span class="small muted">AI gợi ý ${s.draft10}/10</span>` : ""}</div>
    <p class="tiny muted">Học sinh chỉ thấy số sao và lời nhận xét, không thấy điểm số.</p>
    <label class="f">Lời nhận xét gửi em ${aiOverall ? '<span class="chip">AI gợi ý, cô sửa thoải mái</span>' : ""}</label><textarea rows="3" id="cmt">${esc(s.status === "da_tra" ? s.teacherComment : aiOverall)}</textarea>
    <div class="row" style="margin-top:10px"><button class="btn leaf big" id="ret">✅ Trả bài</button><button class="btn" id="redo">↺ Cho em làm lại</button></div></div>`;
  $$("[data-fin]").forEach(inp => inp.oninput = () => { fin[inp.dataset.fin] = Math.max(0, Math.min(Number(inp.max), Number(inp.value) || 0)); $("#tot").textContent = calc(); $("#stz").innerHTML = starHTML(Core.stars(calc()), 18); });
  $$("[data-zoom]").forEach(img => img.onclick = () => window.open().document.write(`<img src="${img.src}" style="max-width:100%">`));
  const rg = $("#regrade"); if (rg) rg.onclick = e => busy(e.currentTarget, async () => { await api("regrade", { id: s.id }); tCham(); }, "AI đang chấm…");
  $("#ret").onclick = e => busy(e.currentTarget, async () => {
    await api("review", { id: s.id, score10: calc(), comment: $("#cmt").value, final: fin, ms: Date.now() - t0, usedAiComment: !!aiOverall && $("#cmt").value.trim() === aiOverall.trim() });
    toast("Đã trả bài cho " + (G.student ? shortName(G.student.name) : "em") + " ⭐"); CHAM_ID = null; TD = null; await tApp("cham");
  }, "Đang trả bài…");
  $("#redo").onclick = e => { if (!confirm("Xóa bài nộp này để em làm lại?")) return; busy(e.currentTarget, async () => { await api("review", { id: s.id, action: "redo" }); CHAM_ID = null; TD = null; await tApp("cham"); }); };
}

/* ----- học sinh ----- */
function tHS() {
  let rows = TD.students.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(s => Object.assign({}, s));
  const draw = () => {
    app().innerHTML = `<div class="row between"><h1>Học sinh (${rows.length})</h1><div class="row"><button class="btn" id="paste">📋 Dán danh sách</button><button class="btn" id="xls">📥 Nhập từ Excel</button><button class="btn" id="cards">🖨️ In thẻ đăng nhập</button></div></div>
      <div class="card"><p class="small muted">Mỗi em có 4 hình bí mật để đăng nhập (không cần email). Bấm vào hình đại diện để đổi. Tên học sinh chỉ lưu trong Google Sheet của cô, không gửi cho AI.</p>
      <div class="scroll"><table class="t"><thead><tr><th>#</th><th>Hình</th><th>Họ và tên</th><th>Mật khẩu hình</th><th></th></tr></thead><tbody>
      ${rows.map((s, i) => `<tr data-i="${i}"><td>${i + 1}</td><td><button class="btn ghost" data-av="${i}" style="font-size:22px;padding:2px 8px">${esc(s.avatar || "🙂")}</button></td><td><input type="text" data-name="${i}" value="${esc(s.name)}"></td>
      <td style="font-size:22px;white-space:nowrap">${s.pin ? String(s.pin).split("").map(d => PIN_ICONS[d]).join("") : '<span class="small muted">tự tạo khi lưu</span>'} <button class="btn ghost small" data-pin="${i}">Đổi</button></td><td><button class="btn ghost small danger" data-rm="${i}">✕</button></td></tr>`).join("")}</tbody></table></div>
      <div class="row" style="margin-top:10px"><button class="btn small" id="add">+ Thêm học sinh</button><button class="btn primary" id="save">Lưu danh sách</button></div></div>`;
    $$("[data-name]").forEach(i => i.oninput = () => rows[i.dataset.name].name = i.value);
    $$("[data-av]").forEach(b => b.onclick = () => { const s = rows[b.dataset.av]; s.avatar = AVATARS[(AVATARS.indexOf(s.avatar) + 1) % AVATARS.length]; b.textContent = s.avatar; });
    $$("[data-pin]").forEach(b => b.onclick = () => { rows[b.dataset.pin].pin = randPin(); draw(); });
    $$("[data-rm]").forEach(b => b.onclick = () => { if (confirm("Xóa học sinh này?")) { rows.splice(+b.dataset.rm, 1); draw(); } });
    $("#add").onclick = () => { rows.push({ name: "", avatar: AVATARS[rows.length % AVATARS.length], pin: randPin() }); draw(); };
    $("#save").onclick = e => busy(e.currentTarget, async () => { await api("saveStudents", { students: rows }); TD = null; toast("Đã lưu danh sách."); await tApp("hs"); });
    $("#paste").onclick = () => { const t = prompt("Dán danh sách học sinh, mỗi dòng một tên:"); if (!t) return; addNames(t.split(/\n/)); };
    $("#xls").onclick = () => { const fp = $("#filePick"); fp.accept = ".xlsx,.xls,.csv"; fp.removeAttribute("capture"); fp.value = ""; fp.onchange = async () => {
      try { const wb = XLSX.read(await fp.files[0].arrayBuffer()), aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
        let col = -1, hoCol = -1, startRow = 0;
        for (let r = 0; r < Math.min(15, aoa.length) && col < 0; r++) aoa[r].forEach((c, k) => { const h = String(c).trim().toLowerCase();
          if (col < 0 && /họ.*tên|tên học sinh|^tên$/.test(h)) { col = k; startRow = r + 1; if (h === "tên" && k > 0 && /họ/.test(String(aoa[r][k - 1]).toLowerCase())) hoCol = k - 1; } });
        if (col < 0) { col = Math.max(0, (aoa[0] || []).findIndex(c => /\S+\s+\S+/.test(String(c)) && !/^\d/.test(String(c)))); startRow = 0; }
        const names = []; for (let r = startRow; r < aoa.length; r++) { const v = ((hoCol >= 0 ? String(aoa[r][hoCol] || "").trim() + " " : "") + String(aoa[r][col] || "").trim()).trim(); if (v && !/^\d+$/.test(v)) names.push(v); }
        addNames(names);
      } catch (e) { toast("Không đọc được file Excel."); } }; fp.click(); };
    $("#cards").onclick = printCards;
  };
  const addNames = list => { const clean = list.map(x => String(x).replace(/^\s*\d+[.)\s]+/, "").trim()).filter(Boolean); clean.forEach(n => rows.push({ name: n, avatar: AVATARS[rows.length % AVATARS.length], pin: randPin() })); toast(`Đã thêm ${clean.length} tên. Cô bấm Lưu danh sách nhé.`); draw(); };
  draw();
}
function randPin() { let p = ""; for (let i = 0; i < 4; i++) p += Math.floor(Math.random() * 9); return p; }
function qrSVG(text, cell = 3) { try { const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: cell, margin: 2, scalable: true }); } catch (e) { return ""; } }
function printCards() {
  const link = classLink(), qr = qrSVG(link);
  const w = window.open("", "_blank");
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Thẻ đăng nhập lớp ${esc(TD.settings.className)}</title><style>body{font-family:Quicksand,system-ui,sans-serif;margin:10mm}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm}.c{border:2px dashed #1F6F8B;border-radius:12px;padding:8px;text-align:center;page-break-inside:avoid}.c svg{width:30mm;height:30mm}.e{font-size:30px}.p{font-size:26px;letter-spacing:4px}.n{font-weight:700;font-size:15px}.s{font-size:11px;color:#555}</style>
    <h3>Thẻ đăng nhập – Bản đồ tri thức lớp ${esc(TD.settings.className)} (mã lớp ${esc(TD.settings.classCode)})</h3><div class="g">${TD.students.map(s => `<div class="c"><div class="e">${esc(s.avatar)}</div><div class="n">${esc(s.name)}</div>${qr}<div class="s">Quét mã → chọn tên → bấm 4 hình:</div><div class="p">${String(s.pin).split("").map(d => PIN_ICONS[d]).join("")}</div></div>`).join("")}</div><script>setTimeout(()=>print(),400)<\/script>`);
  w.document.close();
}

/* ----- báo cáo ----- */
async function tBaoCao() {
  app().innerHTML = `<h1>Báo cáo</h1><p class="muted">Đang tính số liệu…</p>`;
  let S; try { S = await api("stats", {}); } catch (e) { return; }
  const days = Object.keys(S.activeDays).sort().slice(-14), mx = Math.max(1, ...days.map(d => S.activeDays[d]));
  const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "—";
  const given = TD.asgs.filter(a => a.status === "giao").sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  app().innerHTML = `<div class="row between"><h1>Báo cáo</h1><div class="row"><button class="btn" id="xl">📤 Xuất bảng điểm Excel</button><button class="btn" id="cp">📋 Sao chép số liệu</button></div></div>
    <p class="muted small">Tất cả số liệu do hệ thống tự ghi lại từ lúc lớp bắt đầu dùng${S.since ? " (" + fmtDate(S.since.slice(0, 10)) + ")" : ""}.</p>
    <div class="grid3">
      <div class="stat"><b>${S.assigned}</b>bài đã giao · ${S.questionsAssigned} câu</div>
      <div class="stat"><b>${S.questionsFromAi}</b>câu do AI soạn được cô duyệt giao${S.questionsEdited ? ` (cô sửa ${S.questionsEdited} câu)` : ""}</div>
      <div class="stat"><b>${S.submissions}</b>bài nộp · tỉ lệ nộp ${pct(S.submissions, S.expected)}</div>
      <div class="stat"><b>${pct(S.onTime, S.submissions)}</b>bài nộp đúng hạn</div>
      <div class="stat"><b>${S.autoReturned + S.aiGraded}</b>bài được chấm tự động hoặc AI chấm nháp</div>
      <div class="stat"><b>${S.avgReviewSec == null ? "—" : S.avgReviewSec < 90 ? S.avgReviewSec + " giây" : Math.round(S.avgReviewSec / 6) / 10 + " phút"}</b>trung bình cô duyệt 1 bài (${S.reviewed} bài)</div>
      <div class="stat"><b>${pct(S.reviewed - S.reviewChanged, S.reviewed)}</b>bài cô giữ nguyên điểm AI gợi ý</div>
      <div class="stat"><b>${S.practices}</b>lượt học sinh tự ôn tập</div>
      <div class="stat"><b>${S.logins}</b>lượt học sinh vào lớp</div>
    </div>
    <div class="card" style="margin-top:14px"><h3>Hoạt động của học sinh 14 ngày gần nhất (lượt nộp bài + ôn tập)</h3>${days.length ? `<div class="bar">${days.map(d => `<i style="height:${S.activeDays[d] / mx * 100}%"><span>${S.activeDays[d]}</span></i>`).join("")}</div><div class="row tiny muted" style="justify-content:space-between">${days.map(d => `<span>${fmtDate(d)}</span>`).join("")}</div>` : '<p class="muted">Chưa có hoạt động.</p>'}</div>
    <div class="card"><h3>Bảng điểm</h3><div class="scroll"><table class="t"><thead><tr><th>Học sinh</th>${given.map(a => `<th title="${esc(a.title)}">${esc(a.title.slice(0, 18))}</th>`).join("")}</tr></thead><tbody>
    ${TD.students.map(st => `<tr><td>${esc(st.name)}</td>${given.map(a => { const s = TD.subs.find(x => x.aid === a.id && x.sid === st.id); return `<td>${!s ? '<span class="muted">–</span>' : s.status === "da_tra" ? s.score10 : '<span class="chip sun">chờ</span>'}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div></div>`;
  $("#xl").onclick = () => {
    const aoa = [["Học sinh"].concat(given.map(a => a.title))].concat(TD.students.map(st => [st.name].concat(given.map(a => { const s = TD.subs.find(x => x.aid === a.id && x.sid === st.id); return s && s.status === "da_tra" ? s.score10 : ""; }))));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Bảng điểm"); XLSX.writeFile(wb, `Bang-diem-lop-${TD.settings.className}.xlsx`);
  };
  $("#cp").onclick = () => {
    const t = `Số liệu Bản đồ tri thức lớp ${TD.settings.className} (từ ${S.since ? fmtDate(S.since.slice(0, 10)) : "—"} đến ${fmtDate(today())}):\n- ${S.students} học sinh, ${S.lessons} bài trên bản đồ\n- ${S.assigned} bài đã giao (${S.questionsAssigned} câu; ${S.questionsFromAi} câu AI soạn, cô sửa ${S.questionsEdited} câu)\n- ${S.submissions} bài nộp, tỉ lệ nộp ${pct(S.submissions, S.expected)}, đúng hạn ${pct(S.onTime, S.submissions)}\n- ${S.autoReturned} bài chấm tự động, ${S.aiGraded} lượt AI chấm nháp, cô duyệt ${S.reviewed} bài (trung bình ${S.avgReviewSec != null ? S.avgReviewSec + " giây/bài" : "—"}), giữ nguyên điểm AI ở ${pct(S.reviewed - S.reviewChanged, S.reviewed)} bài\n- ${S.practices} lượt tự ôn tập, ${S.logins} lượt học sinh vào lớp`;
    navigator.clipboard.writeText(t).then(() => toast("Đã sao chép số liệu."), () => prompt("Sao chép số liệu:", t));
  };
}

/* ----- cài đặt ----- */
function tCaiDat() {
  const st = TD.settings, link = classLink();
  app().innerHTML = `<h1>Cài đặt</h1>
    <div class="card"><h3>Lớp học</h3><div class="grid3"><div><label class="f">Lớp</label><input type="text" id="cn" value="${esc(st.className)}"></div><div><label class="f">Tên cô</label><input type="text" id="tn" value="${esc(st.teacherName)}"></div><div><label class="f">Trường</label><input type="text" id="sc" value="${esc(st.school)}"></div></div>
    <label class="row" style="margin-top:10px"><input type="checkbox" id="ar" ${st.autoReturn !== false ? "checked" : ""}> Bài chỉ có câu chấm tự động (trắc nghiệm, đúng/sai, điền) thì trả ngay cho em</label>
    <div class="row" style="margin-top:10px"><button class="btn primary" id="s1">Lưu</button></div></div>
    <div class="card"><h3>Link vào lớp cho học sinh</h3><div class="row" style="align-items:flex-start"><div style="width:140px">${qrSVG(link, 4)}</div><div class="grow"><p>Mã lớp: <b style="font-size:22px;letter-spacing:3px">${esc(st.classCode)}</b></p>
    <input type="text" readonly value="${esc(link)}" id="lk"><div class="row" style="margin-top:8px"><button class="btn" id="cpl">Sao chép link</button><button class="btn ghost" id="nc">Đổi mã lớp</button></div><p class="tiny muted">Gửi link này vào nhóm Zalo phụ huynh. Phụ huynh mở trên điện thoại, chọn tên con, bấm 4 hình bí mật.</p></div></div></div>
    <div class="card"><h3>AI Gemini</h3><p class="small">${TD.hasKey ? "✅ Đã có mã AI." : "⚠️ Chưa có mã AI."} Mã được cất ở máy chủ của cô${API ? " (Google Sheet)" : " (bản dùng thử: trên máy này)"}, học sinh không nhìn thấy.</p>
    <ol class="small"><li>Mở <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>, đăng nhập Gmail của cô.</li><li>Bấm “Create API key”, sao chép mã (bắt đầu bằng AIza… hoặc AQ.…).</li><li>Dán vào ô dưới rồi bấm Lưu mã.</li></ol>
    <div class="row"><input type="password" id="key" class="grow" placeholder="${TD.hasKey ? "Đã lưu – nhập mã mới nếu muốn đổi" : "Dán mã AI vào đây"}" style="width:auto"><button class="btn primary" id="s2">Lưu mã</button></div>
    <label class="f">Mô hình AI (để trống = tự chọn)</label><input type="text" id="md" value="${esc(st.model || "")}" placeholder="gemini-2.5-flash"></div>
    <div class="card"><h3>Mật khẩu của cô</h3><div class="row"><input type="password" id="np" class="grow" placeholder="Mật khẩu mới (ít nhất 6 kí tự)" style="width:auto"><button class="btn" id="s3">Đổi mật khẩu</button></div></div>
    <div class="card"><h3>Máy chủ lớp</h3><p class="small">${API ? "Đang dùng máy chủ Google Sheet của cô." : "Đang dùng <b>bản dùng thử</b> (dữ liệu mẫu trên máy này)."}</p>${serverBox()}${API ? "" : `<button class="btn danger small" id="rs" style="margin-top:8px">Làm mới dữ liệu mẫu</button>`}</div>`;
  bindServerBox();
  $("#s1").onclick = e => busy(e.currentTarget, async () => { await api("saveSettings", { className: $("#cn").value, teacherName: $("#tn").value, school: $("#sc").value, autoReturn: $("#ar").checked, model: $("#md").value.trim() }); TD = null; toast("Đã lưu."); await tApp("caidat"); });
  $("#s2").onclick = e => busy(e.currentTarget, async () => { const k = $("#key").value.trim(); if (!k) throw new Error("Cô dán mã AI vào ô trước."); await api("saveSettings", { key: k, model: $("#md").value.trim() }); TD = null; toast("Đã lưu mã AI."); await tApp("caidat"); });
  $("#s3").onclick = e => busy(e.currentTarget, async () => { await api("saveSettings", { password: $("#np").value }); $("#np").value = ""; toast("Đã đổi mật khẩu."); });
  $("#cpl").onclick = () => navigator.clipboard.writeText(link).then(() => toast("Đã sao chép link lớp."));
  $("#nc").onclick = e => { if (confirm("Đổi mã lớp? Link và thẻ cũ sẽ không dùng được nữa.")) busy(e.currentTarget, async () => { await api("saveSettings", { newCode: true }); TD = null; await tApp("caidat"); }); };
  const rs = $("#rs"); if (rs) rs.onclick = () => { if (confirm("Xóa dữ liệu dùng thử và tạo lại dữ liệu mẫu?")) { Demo.reset(); TD = null; tApp("tong"); } };
}

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
route();
