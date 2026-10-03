"use strict";
/* DET Prep engine — works offline from file:// (no network needed). */
const R = PAGE.root ? "" : "../", $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const KEYS = Object.keys(S);
const NAV = [["index.html", "Home"], ["lessons/index.html", "Lessons"], ["exam/index.html", "Exams"], ["lessons/tips.html", "Tips"],
  ["exam/mock.html", "Mock Test"], ["lessons/plan.html", "Plan"], ["lessons/grammar.html", "Grammar"],
  ["lessons/vocabref.html", "Vocabulary"], ["lessons/pron.html", "Pronunciation"], ["lessons/scoring.html", "Scoring"]];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const bn = n => String(n).replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[d]);
const fmt = s => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
const r1 = n => Math.round(n * 10) / 10;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("det2_" + k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem("det2_" + k, JSON.stringify(v)); } catch (e) {} },
  clear() { try { Object.keys(localStorage).filter(k => /^det2?_/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {} }
};

document.body.insertAdjacentHTML("afterbegin",
  `<header><h1>Duolingo English Test Prep</h1><nav>${NAV.map(n => `<a href="${R}${n[0]}">${n[1]}</a>`).join("")}</nav></header><main id="m"></main>`);
$$("nav a").forEach(a => { if (a.href === location.href) a.setAttribute("aria-current", "page"); });
const pg = (h, title) => { $("#m").innerHTML = h; document.title = (title ? title + " · " : "") + "DET Prep"; };

/* ---------- cards & shared pieces ---------- */
const bestTxt = k => { const r = store.get(k); if (!r) return ""; return r.b != null ? ` · Best: ${r.b}%` : ` · Done ×${r.n}`; };
const cards = (d, grp) => `<div class="g">${KEYS.filter(k => S[k].g === grp).map(k => `<a class="c" href="${R}${d}/${k}.html"><b>${S[k].t}</b><br><span class="ex">${S[k].d}</span><br><span class="ex">${S[k].f}${d === "exam" ? bestTxt(k) : ""}</span></a>`).join("")}</div>`;
const cardsAll = d => `<h3>Official DET tasks</h3>${cards(d, "task")}<h3>Skill practice (not official tasks)</h3>${cards(d, "skill")}`;
const scoreTable = () => `<div class="tbl"><table><tr><th>DET</th><th>CEFR</th><th>IELTS</th><th>TOEFL iBT</th></tr>${SC.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</table></div><p class="ex">আনুমানিক তুলনা (Duolingo-র প্রকাশিত তালিকা অনুযায়ী)। প্রতিষ্ঠানের ন্যূনতম স্কোর তাদের সাইটে দেখুন।</p>`;
const refCards = a => a.map(x => `<div class="c"><b>${x[0]}</b><br>${x[1]}</div>`).join("");

/* ---------- speech (browser TTS) ---------- */
let voices = [];
const loadVoices = () => { try { voices = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); } catch (e) {} };
if (window.speechSynthesis) { loadVoices(); try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {} }
function speak(lines) {
  if (!window.speechSynthesis) return false;
  speechSynthesis.cancel();
  const arr = typeof lines === "string" ? [["A", lines]] : lines, who = [...new Set(arr.map(l => l[0]))];
  arr.forEach(l => {
    const u = new SpeechSynthesisUtterance(l[1]); u.lang = "en-US"; u.rate = .92;
    const idx = who.indexOf(l[0]);
    if (voices.length > 1) u.voice = voices[idx % voices.length]; else u.pitch = idx ? 1.25 : .9;
    speechSynthesis.speak(u);
  });
  return true;
}
const stopSpeech = () => { try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} };

/* ---------- recording (optional, needs mic permission) ---------- */
window.rec = async (i, btn) => {
  try {
    if (btn.mr && btn.mr.state === "recording") { btn.mr.stop(); btn.textContent = "🎙 আবার রেকর্ড"; return; }
    const s = await navigator.mediaDevices.getUserMedia({ audio: true }), mr = new MediaRecorder(s), ch = [];
    btn.mr = mr; mr.ondataavailable = e => ch.push(e.data);
    mr.onstop = () => { s.getTracks().forEach(t => t.stop()); const a = $("#au" + i); a.src = URL.createObjectURL(new Blob(ch)); a.hidden = false; };
    mr.start(); btn.textContent = "⏹ থামান";
  } catch (e) { btn.textContent = "মাইক পাওয়া যায়নি"; }
};

/* ---------- question types ---------- */
const BL = /\{([^|}]+)\|([^}]+)\}/g;
const CK = {
  wr: "চেকলিস্ট: ১) প্রশ্নের সব অংশের উত্তর? ২) কারণ/উদাহরণ আছে? ৩) linking words? ৪) বানান ও punctuation? ৫) একই শব্দ বারবার নয়?",
  sp: "চেকলিস্ট: ১) প্রশ্নের সব অংশের উত্তর? ২) মত → কারণ → উদাহরণ? ৩) থামা কম, পুরো সময় বলেছেন? ৪) পরিষ্কার উচ্চারণ ও stress?"
};
const words = s => s.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
function lcs(a, b) {
  const d = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]);
  return d[a.length][b.length];
}
const typeOf = (x, o) => x.t || o.k;
const playBtn = (i, lim) => `<button type="button" class="pl" data-i="${i}">▶ শুনুন</button> <span id="p${i}" class="ex">${lim ? "০/" + bn(lim) : "যতবার খুশি"}</span> `;
const audioBtn = (x, i) => (x.s || x.lines) ? playBtn(i, x.pl || 0) : "";
const imgTag = x => x.img ? `<img src="${R}assets/img/${x.img}" data-r="${x.u}" loading="lazy" alt="photo">` : "";
const pass = x => x.p ? `<div class="c pas">${x.p}</div>` : "";

/* Each type: r(x,i,it) -> html ; g(x,i,it) -> {got,tot,html} */
const T = {
  mc: {
    r(x, i, it) { it.ord = shuffle(x.o.map((_, j) => j)); return audioBtn(x, i) + "<div>" + it.ord.map(j => `<label><input type="radio" name="q${i}" value="${j}"> ${x.o[j]}</label>`).join("") + "</div>"; },
    g(x, i) { const c = document.querySelector(`input[name=q${i}]:checked`), ok = !!c && +c.value === x.a;
      return { got: ok ? 1 : 0, tot: 1, html: `<p class="${ok ? "ok" : "no"}">${ok ? "✔ Correct" : "✘ Wrong"} — <span class="ex">সঠিক উত্তর: ${x.o[x.a]}। ${x.e || ""}</span></p>` }; }
  },
  yn: {
    r(x, i) { return `<div class="yn"><label><input type="radio" name="q${i}" value="1"> Yes (real word)</label><label><input type="radio" name="q${i}" value="0"> No (not a word)</label></div>`; },
    g(x, i) { const c = document.querySelector(`input[name=q${i}]:checked`), ok = !!c && +c.value === x.a;
      return { got: ok ? 1 : 0, tot: 1, html: `<p class="${ok ? "ok" : "no"}">${ok ? "✔ Correct" : "✘ Wrong"} — <span class="ex">${x.e}</span></p>` }; }
  },
  ty: { /* Fill in the Blanks / Read and Complete share the inline-blank renderer */
    r(x, i, it) { it.ans = []; return `<p class="bp">${x.q.replace(BL, (m, p, r) => { it.ans.push(r); return `${esc(p)}<input type="text" class="bl" id="b${i}_${it.ans.length - 1}" size="${r.length + 1}" maxlength="${r.length + 3}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="missing letters">`; })}</p>`; },
    g(x, i, it) { let got = 0; const full = x.q.replace(BL, (m, p, r) => `<b>${esc(p + r)}</b>`);
      it.ans.forEach((a, n) => { if ($(`#b${i}_${n}`).value.trim().toLowerCase() === a.toLowerCase()) got++; });
      const all = got === it.ans.length;
      return { got, tot: it.ans.length, html: `<p class="${all ? "ok" : "no"}">${all ? "✔ Correct" : `✘ ${bn(got)}/${bn(it.ans.length)} সঠিক`} — <span class="ex">${full}</span></p>` }; }
  },
  ls: {
    r(x, i) { return playBtn(i, 3) + `<br><input type="text" id="a${i}" autocomplete="off" spellcheck="false" placeholder="যা শুনলেন লিখুন">`; },
    g(x, i) { const ref = words(x.a), us = words($("#a" + i).value), r = us.length ? lcs(ref, us) / Math.max(ref.length, us.length) : 0, pc = Math.round(r * 100);
      return { got: r, tot: 1, html: `<p class="${r === 1 ? "ok" : "no"}">${r === 1 ? "✔ Perfect" : `✘ ${bn(pc)}% মিল`} — <span class="ex">সঠিক বাক্য: ${esc(x.a)}</span></p>` }; }
  },
  wr: {
    r(x, i) {
      const f = x.f || [""], aud = audioBtn(x, i);
      return imgTag(x) + (aud ? `<div>${aud}</div>` : "") + f.map((lab, n) => `<div class="fld">${lab ? `<label for="w${i}_${n}">${lab}</label>` : ""}${x.sh ? `<input type="text" id="w${i}_${n}" autocomplete="off">` : `<textarea id="w${i}_${n}" rows="${f.length > 1 ? 4 : 5}" data-wc></textarea><span class="ex wc">০ শব্দ${x.min ? " · লক্ষ্য: কমপক্ষে " + bn(x.min) : ""}</span>`}</div>`).join("");
    },
    g(x) { return { got: 0, tot: 0, html: (x.m ? `<div class="c">${x.m}</div>` : "") + (x.sh ? "" : `<p class="ex">${CK.wr}</p>`) }; }
  },
  sp: {
    r(x, i) {
      const aud = audioBtn(x, i), hide = x.s && window.speechSynthesis;
      return imgTag(x) + (aud ? `<div>${aud}</div>` : "") + (hide ? `<p class="ex">(প্রশ্নটি অডিওতে — মন দিয়ে শুনুন; শেষে লেখা দেখানো হবে)</p>` : "") +
        `<button type="button" onclick="rec(${i},this)">🎙 রেকর্ড করুন</button> <audio id="au${i}" controls hidden></audio>`;
    },
    g(x) { return { got: 0, tot: 0, html: (x.s ? `<p class="ex">প্রশ্ন: ${x.q}</p>` : "") + (x.m ? `<div class="c">${x.m}</div>` : "") + `<p class="ex">${CK.sp}</p>` }; }
  }
};
T.pc = { r: T.ty.r, g: T.ty.g };

/* ---------- sampling: groups stay together; groups (or single items) are shuffled ---------- */
function sample(o, n) {
  const m = new Map(), gs = [];
  o.q.forEach((x, i) => { const g = x.g != null ? x.g : "_" + i; if (!m.has(g)) { m.set(g, []); gs.push(g); } m.get(g).push(x); });
  let list = shuffle(gs.map(g => m.get(g)));
  if (n) list = list.slice(0, n);
  return list.flat();
}

/* ---------- exam runner (used by single exams and the mock test) ---------- */
function run(o, key, items, opt) {
  opt = opt || {};
  let left = o.time, paused = 0, done = 0, started = 0, iv;
  const its = items.map(x => ({ x, pl: 0 }));
  const body = its.map((it, i) => {
    const x = it.x, ty = typeOf(x, o), tp = T[ty];
    const hideQ = x.s && ty === "sp" && window.speechSynthesis;
    let q;
    if (ty === "ty" || ty === "pc") q = `<b>${i + 1}.${x.h ? " " + x.h : ""}</b>`;
    else q = `<b>${i + 1}. ${x.sec ? "[" + x.sec + "] " : ""}${ty === "yn" ? `<span class="word">${esc(x.q)}</span>` : (hideQ ? "Listen to the question" : (x.q || "Type the sentence"))}</b>`;
    return pass(x) + `<div class="c" id="i${i}">${q}<div class="body">${tp.r(x, i, it)}</div><div id="r${i}"></div></div>`;
  }).join("");
  const links = `<p><a href="${R}exam/index.html">← All exams</a>${opt.lesson ? ` · <a href="${R}lessons/${key}.html">Read the lesson</a>` : ""} · <a href="${R}index.html">Home</a></p>`;
  pg(links + `<h2>${o.t}</h2><p>${o.d}</p>${o.f ? `<p class="ex">${o.f}</p>` : ""}<div class="bar"><span id="tm">${fmt(left)}</span><button class="pri" id="st">Start</button><button id="ps" disabled>Pause</button><button id="sb" disabled>Submit</button></div><div id="box" class="box off">${body}</div><div id="res" class="c" hidden></div>`, o.t);

  const box = $("#box");
  box.addEventListener("click", e => {
    const b = e.target.closest("button.pl"); if (!b || paused || done || !started) return;
    const i = +b.dataset.i, it = its[i], x = it.x, lim = x.pl != null ? x.pl : (typeOf(x, o) === "ls" ? 3 : 0);
    if (lim && it.pl >= lim) return;
    if (!speak(x.lines || x.s || x.a)) { alert("এই ব্রাউজারে অডিও চালানো যায় না; Chrome ব্যবহার করুন।"); return; }
    it.pl++; $("#p" + i).textContent = lim ? bn(it.pl) + "/" + bn(lim) : bn(it.pl) + " বার";
  });
  box.addEventListener("input", e => {
    if (!e.target.matches("textarea[data-wc]")) return;
    const n = e.target.value.trim().split(/\s+/).filter(Boolean).length, el = e.target.nextElementSibling;
    if (el) el.textContent = bn(n) + " শব্দ";
  });
  window.onbeforeunload = () => (started && !done) ? "পরীক্ষা চলছে — পৃষ্ঠা ছাড়লে অগ্রগতি হারাবেন।" : undefined;

  $("#st").onclick = () => {
    started = 1; $("#st").disabled = true; $("#ps").disabled = false; $("#sb").disabled = false; box.classList.remove("off");
    iv = setInterval(() => { if (paused) return; left--; $("#tm").textContent = fmt(Math.max(left, 0)); if (left <= 0) end(); }, 1000);
  };
  $("#ps").onclick = () => { paused = !paused; stopSpeech(); $("#ps").textContent = paused ? "Resume" : "Pause"; box.classList.toggle("off", paused); };
  $("#sb").onclick = end;

  function end() {
    if (done) return; done = 1; clearInterval(iv); stopSpeech(); window.onbeforeunload = null;
    box.classList.remove("off"); $("#ps").disabled = $("#sb").disabled = true;
    let got = 0, tot = 0; const by = {};
    its.forEach((it, i) => {
      const x = it.x, r = T[typeOf(x, o)].g(x, i, it);
      $("#r" + i).innerHTML = r.html; got += r.got; tot += r.tot;
      if (x.sec) { by[x.sec] = by[x.sec] || [0, 0]; by[x.sec][0] += r.got; by[x.sec][1] += r.tot; }
    });
    $$("#box input,#box textarea").forEach(e => e.disabled = true);
    const Rz = $("#res"); Rz.hidden = false;
    const prev = store.get(key) || { n: 0, b: null }, again = location.pathname.split("/").pop() || "index.html";
    const nav = `<p><a href="${again}">Try again</a>${opt.lesson ? ` · <a href="${R}lessons/${key}.html">Lesson</a>` : ""} · <a href="${R}index.html">Home</a></p>`;
    if (tot > 0) {
      const pc = Math.round(got * 100 / tot), est = Math.max(10, Math.min(160, Math.round((10 + got / tot * 150) / 5) * 5)), val = opt.mock ? est : pc;
      store.set(key, { n: prev.n + 1, b: Math.max(val, prev.b || 0) });
      Rz.innerHTML = opt.mock
        ? `<b>Correct: ${r1(got)}/${tot} · Estimated score: ${est}/160</b><p class="ex">এটি অনুশীলনের মোটামুটি আনুমানিক মান; আসল DET adaptive এবং Writing/Speaking-সহ স্কোর হয়। Production অংশ আলাদা exam-এ দিন।</p>` + Object.keys(by).map(k => `<div>${k}: ${r1(by[k][0])}/${by[k][1]}</div>`).join("") + nav
        : `<b>Score: ${r1(got)}/${tot} (${pc}%)</b> · Best: ${Math.max(pc, prev.b || 0)}%` + nav;
    } else {
      store.set(key, { n: prev.n + 1, b: null });
      Rz.innerHTML = `সময় শেষ। নমুনা উত্তর ও চেকলিস্টের সাথে নিজের উত্তর মিলান।` + nav;
    }
    if (Rz.scrollIntoView) Rz.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  window._det = { its, end, state: () => ({ done, started }) };
}

/* ---------- pages ---------- */
const P = {
  home() {
    const hasDone = KEYS.filter(k => store.get(k)).length, mk = store.get("mock");
    pg(`<h2>Exam structure</h2><p>Duolingo English Test (DET) একটি অনলাইন, কম্পিউটার-অ্যাডাপটিভ পরীক্ষা; সময় প্রায় ১ ঘণ্টা; স্কোর ১০–১৬০; ফলাফল সাধারণত ২ দিনের মধ্যে।</p>
<div class="tbl"><table><tr><th>Task</th><th>কী করতে হবে</th><th>সংখ্যা</th><th>সময়</th></tr>${ST.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("")}</table></div>
<p class="ex">সংখ্যা, সময় ও ক্রম বদলাতে পারে (সূত্র: Duolingo Scoring Guide 2026) — পরীক্ষার আগে অফিসিয়াল সাইট দেখে নিন।</p>
<div class="c"><b>Your progress:</b> ${hasDone}/${KEYS.length} exam চেষ্টা করেছেন${mk ? " · সেরা Mock estimate: " + mk.b + "/160" : ""} · <a href="${R}lessons/plan.html">Study plan</a></div>
<h2>Lessons</h2>${cardsAll("lessons")}<h2>Practice exams (timer + pause)</h2>${cardsAll("exam")}
<h2>More</h2><p><a href="${R}lessons/tips.html">All tips</a> · <a href="${R}lessons/scoring.html">Scoring &amp; criteria</a> · <a href="${R}exam/mock.html">Mock Test</a></p>`);
  },
  lessons() { pg(`<h2>Lessons</h2>${cardsAll("lessons")}<p><a href="${R}lessons/tips.html">Tips &amp; tricks</a></p>`, "Lessons"); },
  exams() { pg(`<h2>Practice exams</h2><p class="ex">প্রতিটি exam-এ প্রশ্ন এলোমেলো হয়; আবার দিলে নতুন প্রশ্ন/ক্রম আসে।</p>${cardsAll("exam")}<p><a href="${R}exam/mock.html"><b>Full Mock Test →</b></a></p>`, "Exams"); },
  tips() { pg(`<h2>Tips &amp; tricks</h2>` + TIPS.map(t => `<div class="c"><b>${t[0]}</b><br>${t[1]}</div>`).join(""), "Tips"); },
  lesson() {
    const k = PAGE.k, o = S[k];
    pg(`<h2>Lesson: ${o.t}</h2><p class="ex">${o.f}</p>` + L[k].map(x => `<div class="c"><b>${x[0]}</b><br>${x[1]}</div>`).join("") +
      `<p><a href="${R}exam/${k}.html"><b>Practice this task now →</b></a> · <a href="${R}lessons/index.html">All lessons</a> · <a href="${R}index.html">Home</a></p>`, o.t);
  },
  exam() { const k = PAGE.k, o = S[k]; run(o, k, sample(o, o.n), { lesson: 1 }); },
  mock() {
    const spec = [["rs", 8], ["fb", 4], ["rc", 1], ["lt", 4], ["ir", 1], ["il", 1], ["gram", 3]], items = [];
    spec.forEach(([k, n]) => sample(S[k], n).forEach(x => { const t = typeOf(x, S[k]); if (["mc", "yn", "ty", "pc", "ls"].includes(t)) items.push(Object.assign({}, x, { t, sec: S[k].t })); }));
    const o = { t: "Full Mock Test (Reading & Listening)", time: 1500, d: `${items.length}টি প্রশ্ন · ২৫ মিনিট · বিরতি নেওয়া যায়। শেষে আনুমানিক স্কোর (১০–১৬০)। Writing/Speaking-এর জন্য <a href="${R}exam/index.html">আলাদা exam</a> দিন।`, f: "" };
    run(o, "mock", items, { mock: 1 });
  },
  plan() {
    let tot = 0, dn = 0;
    const h = PLAN.map((w, wi) => `<h3>${w[0]}</h3>` + w[1].map((t, di) => { const id = "p" + wi + "_" + di, c = store.get(id) === 1; tot++; if (c) dn++;
      return `<label class="c" style="display:block"><input type="checkbox" data-id="${id}" ${c ? "checked" : ""}> Day ${di + 1}: ${t}</label>`; }).join("")).join("");
    const mk = store.get("mock");
    pg(`<h2>4-week study plan &amp; progress</h2><p>সম্পন্ন: <b id="pc">${Math.round(dn * 100 / tot)}%</b> (সেরা Mock estimate: ${mk ? mk.b : "—"})</p><div class="prog"><div id="pb" style="width:${dn * 100 / tot}%"></div></div>${h}
<h3>স্কোর অনুযায়ী ফোকাস</h3><div class="c"><b>৯০-র নিচে:</b> বানান, মৌলিক grammar, Read and Select/Fill in the Blanks, Listen and Type ও সহজ বাক্যে লেখা।<br><b>৯০–১১৫:</b> Read and Complete, Interactive tasks, PREP কাঠামো, linking words, উচ্চারণ।<br><b>১২০+:</b> জটিল বাক্য, বৈচিত্র্যময় শব্দ, সময় ব্যবস্থাপনা, নির্ভুল বানান ও fluency।</div>
<p><button type="button" id="rs">Reset all progress</button></p>`, "Plan");
    $("#m").addEventListener("change", e => {
      if (!e.target.matches("input[type=checkbox]")) return; store.set(e.target.dataset.id, e.target.checked ? 1 : 0);
      const b = $$("main input[type=checkbox]"), n = b.filter(x => x.checked).length, p = Math.round(n * 100 / b.length);
      $("#pc").textContent = p + "%"; $("#pb").style.width = p + "%";
    });
    $("#rs").onclick = () => { if (confirm("সব অগ্রগতি মুছে ফেলবেন?")) { store.clear(); location.reload(); } };
  },
  ref() {
    const o = REF[PAGE.k];
    pg(`<h2>${o[0]}</h2>` + refCards(o[1]) + (PAGE.k === "sc" ? `<h3>DET vs CEFR / IELTS / TOEFL</h3>${scoreTable()}` : "") +
      `<p><a href="${R}lessons/plan.html">Study plan</a> · <a href="${R}index.html">Home</a></p>`, o[0]);
  }
};

/* image fallback: local file -> online URL -> placeholder (SVG) */
document.addEventListener("error", ev => {
  const t = ev.target; if (!t || t.tagName !== "IMG") return;
  if (t.dataset.r && !t.dataset.t) { t.dataset.t = 1; t.src = t.dataset.r; }
  else if (!t.dataset.x) { t.dataset.x = 1; t.src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><rect width="480" height="270" fill="#dfe8e1"/><circle cx="170" cy="110" r="26" fill="#9bb0a4"/><path d="M60 220l90-80 60 50 50-40 120 70z" fill="#7d9a8b"/><text x="240" y="255" font-size="14" text-anchor="middle" fill="#46564d" font-family="sans-serif">Image unavailable (offline)</text></svg>'); }
}, true);

P[PAGE.p]();
try { if (window.addViz) addViz(); } catch (e) { console.error(e); }
