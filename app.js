/* 靈魂拷問 Soul Questions — 即時互動問答
   學員頁 index.html 與主持人頁 host.html 共用這支程式，用 <body data-role> 區分。 */
(function () {
  "use strict";
  const QS = window.QS, CLOSE_ZH = window.CLOSE_ZH, CLOSE_EN = window.CLOSE_EN;
  const IS_HOST = document.body.dataset.role === "host";
  const L = ["A", "B", "C", "D"];
  const COL = ["var(--oA)", "var(--oB)", "var(--oC)", "var(--oD)"];
  const $ = (s) => document.querySelector(s);
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /* ---------- backend: Firebase, or an in-browser demo that syncs between tabs ---------- */
  const cfg = window.FIREBASE_CONFIG || {};
  const configured = typeof firebase !== "undefined" && cfg.apiKey && !/^YOUR_/.test(cfg.apiKey);
  const DEMO = !configured || /[?&]demo\b/.test(location.search);

  function makeDemoDb() {
    const KEY = "sq-demo-db";
    let data = {};
    try { data = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) {}
    const subs = [];
    const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v === undefined ? null : v)));
    const keys = (p) => p.split("/").filter(Boolean);
    const get = (p) => keys(p).reduce((a, k) => (a == null ? null : a[k] === undefined ? null : a[k]), data);
    const setAt = (p, v) => {
      const ks = keys(p); let o = data;
      ks.slice(0, -1).forEach((k) => { if (typeof o[k] !== "object" || o[k] === null) o[k] = {}; o = o[k]; });
      if (v === null || v === undefined) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = clone(v);
    };
    const snap = (p) => ({ val: () => clone(get(p)) });
    const fire = () => subs.forEach((s) => s.cb(snap(s.path)));
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} fire(); };
    window.addEventListener("storage", (e) => {
      if (e.key !== KEY) return;
      try { data = JSON.parse(e.newValue || "{}") || {}; } catch (_) { data = {}; }
      fire();
    });
    return {
      ref(path) {
        return {
          on(ev, cb) {
            if (path === ".info/connected") { setTimeout(() => cb({ val: () => true }), 0); return; }
            subs.push({ path, cb }); setTimeout(() => cb(snap(path)), 0);
          },
          set(v) { setAt(path, v); save(); return Promise.resolve(); },
          remove() { setAt(path, null); save(); return Promise.resolve(); },
          transaction(fn) { setAt(path, fn(get(path))); save(); return Promise.resolve(); }
        };
      }
    };
  }

  let db, auth;
  if (DEMO) {
    db = makeDemoDb();
  } else {
    firebase.initializeApp(cfg);
    db = firebase.database();
    auth = firebase.auth();
  }

  /* ---------- state ---------- */
  let S = { current: 0, hidden: {}, round: {}, manual: {}, locked: {}, spot: null };
  let VOTES = {};
  let uid = null, view = 0, follow = true, connected = false, firstState = true;
  let hostOpen = true, armed = null, spotDraft = { name: "", o: 0 };

  const rd = (q) => +(S.round["q" + q] || 0);
  const man = (q) => { const m = S.manual["q" + q] || {}; return [0, 1, 2, 3].map((i) => Math.max(0, +m[i] || 0)); };
  const lockd = (q) => { const l = S.locked["q" + q]; return l ? [0, 1, 2, 3].map((i) => +l[i] || 0) : null; };
  const isHidden = (q) => !!S.hidden["q" + q];
  function counts(q) {
    const l = lockd(q); if (l) return l;
    const c = man(q), vq = VOTES["q" + q] || {};
    for (const k in vq) { const v = vq[k]; if (v && v.r === rd(q) && Number.isInteger(v.o) && v.o >= 0 && v.o < 4) c[v.o]++; }
    return c;
  }
  function myVote(q) { const v = (VOTES["q" + q] || {})[uid]; return v && v.r === rd(q) ? v.o : null; }
  function voterCount() {
    const ids = new Set();
    for (const q in VOTES) for (const k in VOTES[q] || {}) ids.add(k);
    return ids.size;
  }

  /* ---------- rendering ---------- */
  function renderTabs() {
    const t = $("#tabs"); t.textContent = "";
    ["一", "二", "三", "四"].forEach((n, i) => {
      const b = el("button", "tab", "Q" + (i + 1)); b.setAttribute("aria-current", String(view === i)); b.title = "靈魂拷問" + n;
      b.onclick = () => go(i); t.appendChild(b);
    });
    const c = el("button", "tab", "Closing 結語"); c.setAttribute("aria-current", String(view === 4));
    c.onclick = () => go(4); t.appendChild(c);
  }

  function go(i) {
    view = i;
    if (IS_HOST) db.ref("state/current").set(i);
    else if (follow && S.current !== i) { follow = false; const f = $("#follow"); if (f) f.checked = false; }
    renderAll();
  }

  function renderQuestion(q) {
    const Q = QS[q], c = counts(q), total = c.reduce((a, b) => a + b, 0), mv = myVote(q);
    const hid = isHidden(q) && !IS_HOST;
    const m = $("#main"); m.textContent = "";
    const head = el("div", "qhead");
    const eb = el("div", "eyebrow", "Soul Question " + (q + 1)); eb.appendChild(el("span", null, "靈魂拷問" + Q.num));
    head.append(eb, el("h1", null, "“" + Q.en + "”"), el("p", "zhsub", "「" + Q.zh + "」"));
    m.appendChild(head);

    const grid = el("div", "opts" + (hid ? " hiddenres" : ""));
    Q.opts.forEach((o, i) => {
      const b = el("button", "opt" + (mv === i ? " mine" : ""));
      b.style.setProperty("--c", COL[i]);
      b.setAttribute("aria-pressed", String(mv === i));
      const pct = total ? Math.round((c[i] * 100) / total) : 0;
      const f = el("span", "fill"); f.style.width = pct + "%";
      const num = el("span", "num"); num.append(el("span", "pct", pct + "%"), el("span", "cnt", c[i] + (c[i] === 1 ? " vote" : " votes")));
      b.append(f, el("span", "letter", L[i]), el("span", "oen", o.en), el("span", "zh", o.zh), num);
      if (mv === i) b.appendChild(el("span", "mark", "YOURS 你的選擇"));
      if (!IS_HOST) b.onclick = () => vote(q, i); else b.style.cursor = "default";
      grid.appendChild(b);
    });
    m.appendChild(grid);

    const meta = el("div", "meta");
    const tot = el("span"); tot.append(el("strong", null, String(total)), " vote" + (total === 1 ? "" : "s") + " · 共 " + total + " 票");
    meta.appendChild(tot);
    if (!IS_HOST) meta.appendChild(el("span", null, mv == null
      ? "Tap an answer to vote; you can change it anytime · 點選答案即可投票，可隨時更改"
      : "Voted — tap another to change · 已投票，可點其他選項更改"));
    if (lockd(q)) meta.appendChild(el("span", "pill lock", "Results locked 結果已鎖定"));
    if (isHidden(q)) meta.appendChild(el("span", "pill", IS_HOST ? "Hidden from students 學員目前看不到結果" : "Results hidden for now 結果稍後揭曉"));
    m.appendChild(meta);

    const sp = S.spot;
    if (sp && sp.q === q && Number.isInteger(sp.o) && Q.opts[sp.o]) {
      const name = String(sp.name || "").trim(), o = Q.opts[sp.o];
      const box = el("div", "spot");
      const en = el("div", "en"); en.append("Now, ", el("em", null, name || "my friend"), ", please tell us why you chose ", el("em", null, L[sp.o] + ": " + o.en.replace(/[.。]+$/, "")), ".");
      const zh = el("div", "zh"); zh.append("現在請 ", el("em", null, name || "這位朋友"), " 告訴我，你為什麼選擇 ", el("em", null, L[sp.o] + "：" + o.zh), "？");
      box.append(en, zh); m.appendChild(box);
    } else {
      const p = el("div", "prompt"); p.append("Now, please tell us why you chose your answer.　", el("span", "zhp2", "現在請ＸＸＸ告訴我，你為什麼選擇ＯＯＯ"));
      m.appendChild(p);
    }
  }

  function renderClosing() {
    const m = $("#main"); m.textContent = "";
    const s = el("section", "closing");
    const eb = el("div", "eyebrow", "Closing reflection"); eb.appendChild(el("span", null, "結語"));
    s.append(eb, el("h1", null, "Who am I, really?"), el("p", "zhsub", "「我」究竟是誰？"));
    const cols = el("div", "cols"), z = el("div", "zhp"), e = el("div", "enp");
    CLOSE_ZH.forEach((t) => z.appendChild(el("p", null, t)));
    CLOSE_EN.forEach((t) => e.appendChild(el("p", null, t)));
    cols.append(e, z); s.appendChild(cols);
    const sum = el("div", "summary");
    QS.forEach((Q, q) => {
      const c = counts(q), tot = c.reduce((a, b) => a + b, 0), hide = isHidden(q) && !IS_HOST;
      const card = el("div", "sum"); card.appendChild(el("h3", null, "Question " + (q + 1) + " · " + (hide ? "—" : tot) + (tot === 1 ? " vote" : " votes")));
      Q.opts.forEach((o, i) => {
        const pct = tot ? Math.round((c[i] * 100) / tot) : 0;
        const r = el("div", "srow"); r.style.setProperty("--c", COL[i]);
        const bar = el("span", "b"), fi = el("i"); fi.style.width = (hide ? 0 : pct) + "%"; bar.appendChild(fi);
        r.append(el("span", "l", L[i]), bar, el("span", "p", hide ? "—" : pct + "%")); r.title = o.en + " / " + o.zh;
        card.appendChild(r);
      });
      sum.appendChild(card);
    });
    s.appendChild(sum); m.appendChild(s);
  }

  function renderStatus() {
    $("#dot").className = "dot" + (connected ? " on" : "");
    const n = voterCount();
    $("#statusText").textContent = (DEMO ? "Demo 示範模式 · " : "") + (connected ? "Connected 已連線" : "Connecting… 連線中") + " · " + n + (n === 1 ? " voter 人已投票" : " voters 人已投票");
    const fw = $("#followWrap"); if (fw) fw.hidden = IS_HOST;
  }

  function renderHost() {
    const mount = $("#hostMount"); if (!mount) return; mount.textContent = "";
    if (view > 3) {
      mount.appendChild(el("p", "note", "結語頁沒有控制項。按上方「拷問一～四」回到題目。"));
      return;
    }
    const q = view, Q = QS[q];
    const d = el("details", "host"); d.open = hostOpen; d.ontoggle = () => { hostOpen = d.open; };
    d.appendChild(el("summary", null, "主持人控制台 Host controls"));
    const g = el("div", "hgrid");

    const r1 = el("div", "hrow"); r1.appendChild(el("label", "t", "現場舉手加減\nManual count"));
    const mc = man(q);
    L.forEach((l, i) => {
      const w = el("span", "man"); w.style.setProperty("--c", COL[i]);
      const minus = el("button", null, "−"), plus = el("button", null, "+");
      minus.setAttribute("aria-label", l + " −1"); plus.setAttribute("aria-label", l + " +1");
      minus.onclick = () => bump(q, i, -1); plus.onclick = () => bump(q, i, 1);
      w.append(el("b", null, l), minus, el("span", null, String(mc[i])), plus); r1.appendChild(w);
    });
    g.appendChild(r1);

    const r2 = el("div", "hrow"); r2.appendChild(el("label", "t", "點名發言\nCall on"));
    const name = el("input"); name.type = "text"; name.id = "spotName"; name.placeholder = "姓名 Name"; name.value = spotDraft.name;
    name.oninput = () => { spotDraft.name = name.value; };
    const sel = el("select"); sel.id = "spotOpt";
    Q.opts.forEach((o, i) => { const op = el("option", null, L[i] + "：" + o.zh); op.value = i; sel.appendChild(op); });
    sel.value = String(spotDraft.o); sel.onchange = () => { spotDraft.o = +sel.value; };
    const show = el("button", "hbtn pri", "顯示 Show");
    show.onclick = () => db.ref("state/spot").set({ q, o: +sel.value, name: name.value.slice(0, 40) });
    const clr = el("button", "hbtn", "清除 Clear"); clr.onclick = () => db.ref("state/spot").remove();
    r2.append(name, sel, show, clr); g.appendChild(r2);

    const r3 = el("div", "hrow"); r3.appendChild(el("label", "t", "本題結果\nResults"));
    const hide = el("button", "hbtn", isHidden(q) ? "對學員揭曉 Reveal" : "對學員隱藏 Hide");
    hide.onclick = () => (isHidden(q) ? db.ref("state/hidden/q" + q).remove() : db.ref("state/hidden/q" + q).set(true));
    const lock = el("button", "hbtn", lockd(q) ? "解除鎖定 Unlock" : "鎖定目前結果 Lock");
    lock.onclick = () => (lockd(q) ? db.ref("state/locked/q" + q).remove() : db.ref("state/locked/q" + q).set(counts(q)));
    const reset = el("button", "hbtn", armed === q ? "再按一次確認清空 Tap again to confirm" : "清空本題重投 Reset");
    reset.onclick = () => {
      if (armed !== q) { armed = q; renderHost(); setTimeout(() => { if (armed === q) { armed = null; renderHost(); } }, 4000); return; }
      armed = null;
      db.ref("state/round/q" + q).transaction((v) => (v || 0) + 1);
      db.ref("state/manual/q" + q).remove();
      db.ref("state/locked/q" + q).remove();
      db.ref("votes/q" + q).remove();
      if (S.spot && S.spot.q === q) db.ref("state/spot").remove();
    };
    r3.append(hide, lock, reset); g.appendChild(r3);

    const r4 = el("div", "hrow"); r4.appendChild(el("label", "t", "邀請學員\nInvite"));
    const qrb = el("button", "hbtn", "顯示 QR Code Show QR"); qrb.onclick = showQR;
    r4.append(qrb); g.appendChild(r4);

    g.appendChild(el("p", "note",
      "學員投票存在資料庫，關掉頁面或手機鎖屏也不會掉票。學員可以改選，每人每題只算一票。\n" +
      "Votes are stored in the database, so they survive closed tabs and locked phones. Each student has one vote per question and can change it.\n" +
      "鍵盤 ← → 可切換題目 · Use ← → to switch questions."));
    d.appendChild(g); mount.appendChild(d);
  }

  function showQR() {
    const url = new URL("index.html", location.href); url.search = DEMO ? "?demo" : "";
    const box = el("div", "qr");
    box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "QR Code");
    box.append(el("h2", null, "掃描條碼進入實驗"), el("p", "en", "Scan to join the experiment"));
    const holder = el("div", "box"); box.appendChild(holder);
    box.append(el("div", "url", url.href));
    const close = el("button", "hbtn pri", "關閉 Close"); close.onclick = () => box.remove(); box.appendChild(close);
    document.body.appendChild(box);
    if (window.QRCode) new QRCode(holder, { text: url.href, width: 300, height: 300, colorDark: "#10151f", colorLight: "#efe8da" });
    else holder.textContent = "QR Code 載入失敗，請直接分享下方網址。";
    close.focus();
  }

  function renderMain() { if (view < 4) renderQuestion(view); else renderClosing(); renderStatus(); }
  function renderAll() { renderTabs(); renderMain(); if (IS_HOST) renderHost(); }

  /* ---------- actions ---------- */
  function vote(q, i) {
    if (!uid) return;
    if (lockd(q)) return;
    const path = "votes/q" + q + "/" + uid, cur = myVote(q);
    VOTES["q" + q] = VOTES["q" + q] || {};
    if (cur === i) { delete VOTES["q" + q][uid]; db.ref(path).remove(); }
    else { VOTES["q" + q][uid] = { o: i, r: rd(q) }; db.ref(path).set({ o: i, r: rd(q) }); }
    renderMain();
  }
  function bump(q, i, d) { db.ref("state/manual/q" + q + "/" + i).transaction((v) => Math.max(0, (v || 0) + d)); }

  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input,select,textarea")) return;
    if (e.key === "ArrowRight" && view < 4) go(view + 1);
    if (e.key === "ArrowLeft" && view > 0) go(view - 1);
  });
  const followBox = $("#follow");
  if (followBox) followBox.onchange = (e) => { follow = e.target.checked; if (follow) { view = S.current; renderAll(); } };

  /* ---------- connect ---------- */
  function listen() {
    db.ref("state").on("value", (s) => {
      const v = s.val() || {};
      S = { current: Number.isInteger(v.current) ? v.current : 0, hidden: v.hidden || {}, round: v.round || {}, manual: v.manual || {}, locked: v.locked || {}, spot: v.spot || null };
      if (IS_HOST) { if (firstState) view = S.current; } else if (follow) view = S.current;
      firstState = false;
      renderAll();
    });
    db.ref("votes").on("value", (s) => { VOTES = s.val() || {}; renderMain(); });
    db.ref(".info/connected").on("value", (s) => { connected = !!s.val(); renderStatus(); });
  }

  function banner(msg) { const b = $("#banner"); if (b) { b.textContent = msg; b.hidden = !msg; } }

  function startStudent() {
    if (DEMO) { uid = sessionStorage.getItem("sq-demo-uid") || ("demo" + Math.random().toString(36).slice(2, 9)); try { sessionStorage.setItem("sq-demo-uid", uid); } catch (e) {} listen(); renderAll(); return; }
    renderAll(); listen();
    auth.signInAnonymously().then((c) => { uid = c.user.uid; renderMain(); })
      .catch((e) => banner("無法連線，請重新整理頁面。Could not connect — please reload. (" + (e.code || e.message) + ")"));
  }

  function startHost() {
    const login = $("#login"), app = $("#app");
    const enter = () => { login.hidden = true; app.hidden = false; listen(); renderAll(); };
    if (DEMO) { enter(); return; }
    let entered = false;
    auth.onAuthStateChanged((u) => {
      if (u && !u.isAnonymous) { if (!entered) { entered = true; enter(); } }
      else { login.hidden = false; app.hidden = true; }
    });
    $("#loginForm").addEventListener("submit", (ev) => {
      ev.preventDefault();
      $("#loginErr").textContent = "";
      auth.signInWithEmailAndPassword($("#email").value.trim(), $("#password").value)
        .catch((e) => { $("#loginErr").textContent = "登入失敗：" + (e.code || e.message); });
    });
    const out = $("#signOut"); if (out) out.onclick = () => { auth.signOut().then(() => location.reload()); };
  }

  if (DEMO) banner(configured ? "示範模式：網址帶有 ?demo，票數只在這個瀏覽器的分頁間同步。" : "示範模式 Demo：尚未設定 Firebase（見 README.md），票數只在同一個瀏覽器的分頁間同步。");
  if (IS_HOST) startHost(); else startStudent();
})();
