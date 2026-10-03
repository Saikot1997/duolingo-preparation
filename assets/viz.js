"use strict";
/* Inline SVG diagrams. Colors come from CSS variables so light/dark mode both work. */
const DEFS = '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--mu)"/></marker></defs>';
const fig = (h, body, cap) => `<figure class="viz"><svg viewBox="0 0 860 ${h}" role="img" aria-label="${cap}">${DEFS}${body}</svg><figcaption class="ex">${cap}</figcaption></figure>`;
const box = (x, y, w, h, t, cls) => `<rect class="${cls || "b"}" x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/>` +
  t.split("|").map((l, i, a) => `<text class="${cls === "a" ? "w" : ""}" x="${x + w / 2}" y="${y + h / 2 + 5 + (i - (a.length - 1) / 2) * 17}">${l}</text>`).join("");
const arrow = (x1, y1, x2, y2) => `<line class="ln" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;

/* steps: [label|sublabel, ...]; up to 4 per row, rows connected by an elbow arrow. last: highlight index (or -1) */
function chain(steps, cap, hl) {
  const per = 4, W = steps.length < 4 ? 250 : 185, H = 66, GX = 40, rows = Math.ceil(steps.length / per), RH = 105;
  let o = "";
  steps.forEach((t, i) => {
    const r = Math.floor(i / per), c = i % per, n = Math.min(per, steps.length - r * per);
    const x0 = (860 - (n * W + (n - 1) * GX)) / 2, x = x0 + c * (W + GX), y = 15 + r * RH;
    o += box(x, y, W, H, t, i === hl ? "a" : "b");
    if (c < n - 1) o += arrow(x + W, y + H / 2, x + W + GX - 2, y + H / 2);
    if (c === n - 1 && i < steps.length - 1) {
      const nx0 = (860 - (Math.min(per, steps.length - (r + 1) * per) * W + (Math.min(per, steps.length - (r + 1) * per) - 1) * GX)) / 2;
      o += `<path class="ln" d="M${x + W / 2} ${y + H} V${y + H + 18} H${nx0 + W / 2} V${y + RH - 2}"/>`;
    }
  });
  return fig(rows * RH + 10, o, cap);
}

const V = {
  flow: () => chain(["Quick Setup|(স্কোরে নয়)", "Adaptive tasks|Read, Listen, Type", "Interactive|Reading + Listening", "Photo, Writing,|Speaking tasks", "Writing Sample|(৫ মিনিট)", "Speaking Sample|(৩ মিনিট, ভিডিও)"], "DET-এর ধাপসমূহ (সরল চিত্র; ক্রম বদলাতে পারে)", 5),
  adapt: () => {
    const p = [[40, 150], [170, 100], [300, 50], [430, 95], [560, 60], [690, 20], [820, 60]];
    let o = `<polyline points="${p.map(a => a.join(",")).join(" ")}" fill="none" stroke="var(--ac)" stroke-width="3"/>`;
    p.forEach(a => o += `<circle cx="${a[0]}" cy="${a[1]}" r="6" fill="var(--ac)"/>`);
    o += `<text x="235" y="62" class="ok">✔ ঠিক → কঠিন প্রশ্ন</text><text x="365" y="40" class="no">✘ ভুল → সহজ প্রশ্ন</text><text x="60" y="190">শুরু</text><text x="800" y="100">স্কোর ↑</text>`;
    return fig(200, o, "Adaptive অংশ: উত্তরের ওপর পরের প্রশ্নের কঠিনতা বদলায়");
  },
  ir: () => chain(["Complete the|Sentences", "Complete the|Passage", "Highlight|the Answer ×২", "Identify|the Idea", "Title|the Passage"], "Interactive Reading: একটি অনুচ্ছেদ, ছয়টি কাজ (৭–৮ মিনিট)"),
  il: () => chain(["Listen and|Complete", "Listen and|Respond (৫–৬টি)", "Summarize the|Conversation (৭৫ সেকেন্ড)"], "Interactive Listening: একই দৃশ্যের তিনটি অংশ", 2),
  iw: () => chain(["Step 1|৩০ সেকেন্ড ভাবা + ৫ মিনিট", "Step 2|একই বিষয়, নতুন দিক — ৩ মিনিট"], "Interactive Writing: দুই ধাপ", 1),
  photo: () => chain(["১. সামগ্রিক দৃশ্য|I can see…", "২. সামনে|In the foreground…", "৩. পেছনে|In the background…", "৪. অনুমান|It seems / probably…"], "ছবি বর্ণনার ৪ ধাপ", 3),
  prep: () => chain(["P — Point|মত বলুন", "R — Reason|কারণ", "E — Example|উদাহরণ", "P — Point|শেষ কথা"], "PREP: বলা ও লেখার উত্তর সাজানোর সূত্র", 3),
  essay: () => chain(["Introduction|মত/উত্তর", "Point 1|কারণ + উদাহরণ", "Point 2|কারণ + উদাহরণ", "Conclusion|সংক্ষেপে শেষ"], "Writing/Speaking Sample-এর কাঠামো", 3),
  tense: () => {
    let o = `<line x1="30" y1="90" x2="830" y2="90" stroke="var(--mu)" stroke-width="3" marker-end="url(#ar)"/><circle cx="430" cy="90" r="9" fill="var(--ac)"/><text x="430" y="125" style="font-weight:700">এখন (now)</text>`;
    o += box(40, 15, 250, 50, "Past simple|yesterday, ago, in 2020") + box(305, 150, 250, 50, "Present perfect|since 2015, for two years, already") + box(570, 15, 250, 50, "Future|tomorrow, will, going to");
    return fig(215, o, "টাইমলাইনে tense-সংকেত");
  },
  sub: () => {
    const top = ["Listening", "Speaking", "Reading", "Writing"], combo = [["Comprehension", 0, 2], ["Conversation", 0, 1], ["Literacy", 2, 3], ["Production", 1, 3]];
    let o = "";
    top.forEach((t, i) => o += box(25 + i * 205, 10, 170, 44, t, "a"));
    combo.forEach((c, i) => {
      const x = 25 + i * 205, y = 130;
      o += box(x, y, 170, 44, c[0]);
      [c[1], c[2]].forEach(j => o += `<line class="ln" x1="${25 + j * 205 + 85}" y1="54" x2="${x + 85}" y2="${y - 2}"/>`);
    });
    return fig(195, o, "চার সাবস্কোর (উপরে) এবং তাদের গড় থেকে চার combined সাবস্কোর (নিচে); মোট স্কোর = চার সাবস্কোরের গড়");
  },
  score: () => {
    const r = [["১০–৮৫", "বানান, মৌলিক grammar", 60], ["৯০–১১৫", "Interactive tasks, PREP, উচ্চারণ", 120], ["১২০–১৬০", "জটিল বাক্য, সময়, নির্ভুলতা", 200]];
    let o = "";
    r.forEach((a, i) => { const y = 15 + i * 55; o += `<rect class="${i === 2 ? "a" : "b"}" x="130" y="${y}" width="${a[2] * 3.5}" height="40" rx="8"/><text x="65" y="${y + 26}">${a[0]}</text><text class="${i === 2 ? "w" : ""}" x="${130 + a[2] * 3.5 / 2}" y="${y + 26}">${a[1]}</text>`; });
    return fig(185, o, "স্কোর পরিসর অনুযায়ী ফোকাস");
  }
};
const LESSON_VIZ = { ir: "ir", il: "il", iw: "iw", wp: "photo", sp: "photo", rts: "prep", is: "prep", ss: "essay", ws: "essay", gram: "tense" };

window.addViz = () => {
  const m = document.querySelector("#m"), p = PAGE.p, k = PAGE.k; if (!m) return;
  if (p === "home") { const t = m.querySelector(".tbl"); if (t) t.insertAdjacentHTML("beforebegin", V.flow() + V.adapt()); }
  else if (p === "tips") m.querySelector("h2").insertAdjacentHTML("afterend", V.adapt());
  else if (p === "plan") m.insertAdjacentHTML("beforeend", V.score());
  else if (p === "ref" && k === "sc") m.querySelector("h2").insertAdjacentHTML("afterend", V.sub());
  else if (p === "lesson" && LESSON_VIZ[k]) m.querySelector("h2").insertAdjacentHTML("afterend", V[LESSON_VIZ[k]]());
};
