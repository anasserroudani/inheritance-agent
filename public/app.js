const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");

let history = []; // only the visible text: { role, content }

const SUGGESTIONS = [
  { tag: "مسألة", title: "زوجة وابن وبنتان", text: "توفي رجل عن زوجة وابن وبنتين، وتركته 900000 درهم. كيف تُقسَّم؟" },
  { tag: "مسألة", title: "زوج وأم وجد وأخت", text: "توفيت امرأة عن زوج وأم وجد وأخت شقيقة" },
  { tag: "مفهوم", title: "ما هو العول؟", text: "ما هو العول في الميراث وكيف يتم التعامل معه؟" },
  { tag: "قانون", title: "موانع الإرث", text: "ما هي موانع الإرث في مدونة الأسرة؟" },
];

const SPECIAL_NAMES = {
  awl: "العول", radd: "الرد", akdariyya: "المسألة الأكدرية", malikiyya: "المسألة المالكية",
  shibh_malikiyya: "شبه المالكية", mushtarakah: "المسألة المشتركة", umariyya: "العمرية (الغراوين)",
  minbariyya: "المسألة المنبرية", kharqa: "الخرقاء", muadah: "المعادة",
};

const WAITING = ["جارٍ تحليل المسألة", "جارٍ احتساب الأنصبة بالمحرك الشرعي", "البحث في المصادر المعتمدة", "جارٍ إعداد الجواب"];

const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const SVG_SCALE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M6 21h12M5 7h14M5 7l-3 7a4 4 0 0 0 6 0L5 7Zm14 0-3 7a4 4 0 0 0 6 0l-3-7Z"/></svg>';
const SVG_STAR = '<svg viewBox="0 0 64 64" width="56" height="56"><path d="M32 2l7 15 16-7-7 16 15 7-15 7 7 16-16-7-7 15-7-15-16 7 7-16L2 33l15-7-7-16 16 7z" fill="currentColor"/></svg>';

// ---------- helpers ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function scrollDown() { chat.scrollTop = chat.scrollHeight; }

// "7/16" -> 43.75
function percent(share) {
  const m = String(share).match(/^(\d+)(?:\/(\d+))?$/);
  if (!m) return null;
  return (Number(m[1]) / Number(m[2] || 1)) * 100;
}

// ---------- answer text: small, safe markdown (everything is added as text, never as HTML) ----------

function addInline(parent, text) {
  text.split(/(\*\*[^*]+\*\*)/).forEach((part) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) parent.appendChild(el("strong", "", part.slice(2, -2)));
    else if (part) parent.appendChild(document.createTextNode(part.replace(/\*\*/g, "")));
  });
}

const cells = (line) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

function renderText(container, text) {
  const lines = text.split("\n");
  let list = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // table: a header line, then a |---|---| line
    if (line.includes("|") && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || "")) {
      list = null;
      const table = el("table");
      const head = el("tr");
      cells(line).forEach((c) => { const th = el("th"); addInline(th, c); head.appendChild(th); });
      table.appendChild(head);
      i += 2;
      for (; i < lines.length && lines[i].includes("|"); i++) {
        const tr = el("tr");
        cells(lines[i]).forEach((c) => { const td = el("td"); addInline(td, c); tr.appendChild(td); });
        table.appendChild(tr);
      }
      i--;
      const wrap = el("div", "scroll-x");
      wrap.appendChild(table);
      container.appendChild(wrap);
      continue;
    }

    const heading = line.match(/^\s*#{1,4}\s+(.*)/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (heading) {
      list = null;
      const h = el("h3"); addInline(h, heading[1]); container.appendChild(h);
    } else if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      if (!list || list.tagName.toLowerCase() !== kind) { list = el(kind); container.appendChild(list); }
      const li = el("li"); addInline(li, (bullet || numbered)[1]); list.appendChild(li);
    } else {
      list = null;
      if (/^\s*-{3,}\s*$/.test(line)) continue;
      if (line.trim()) { const p = el("p"); addInline(p, line); container.appendChild(p); }
    }
  }
}

// ---------- parts of a bot message ----------

function resultCard(calc) {
  const card = el("section", "result");

  const head = el("div", "result-head");
  head.appendChild(el("h3", "", "نتيجة القسمة الشرعية"));
  const badges = el("div", "badges");
  (calc.special || []).forEach((s) => badges.appendChild(el("span", "badge", SPECIAL_NAMES[s] || s)));
  if (calc.awl_base) badges.appendChild(el("span", "badge", `يُعال إلى ${calc.awl_base}`));
  if (badges.children.length) head.appendChild(badges);
  card.appendChild(head);

  if (calc.net_estate) card.appendChild(el("p", "estate", `صافي التركة: ${money.format(calc.net_estate)}`));

  const showAmount = calc.heirs.some((h) => h.amount != null);
  const table = el("table");
  const hr = el("tr");
  ["الوارث", "العدد", "النصيب", "النسبة", ...(showAmount ? ["المبلغ"] : [])].forEach((t) => hr.appendChild(el("th", "", t)));
  table.appendChild(hr);

  const hasWhy = calc.heirs.some((h) => h.why);
  calc.heirs.forEach((h) => {
    const row = el("tr", (h.blocked ? "blocked " : "") + (h.why ? "has-why" : ""));
    const name = el("td", "heir");
    if (h.why) name.appendChild(el("span", "chev", "‹"));
    name.appendChild(document.createTextNode(h.heir));
    if (h.blocked) name.appendChild(el("span", "tag-blocked", "محجوب"));
    row.appendChild(name);
    row.appendChild(el("td", "", String(h.count)));
    const share = el("td"); share.appendChild(el("span", "fraction", h.blocked ? "0" : h.share));
    row.appendChild(share);
    const p = h.blocked ? 0 : percent(h.share);
    const pc = el("td"); pc.appendChild(el("span", "num", p == null ? "—" : `${Math.round(p * 100) / 100}%`));
    row.appendChild(pc);
    if (showAmount) {
      const am = el("td", "money");
      am.appendChild(el("span", "num", h.amount != null ? money.format(h.amount) : "—"));
      row.appendChild(am);
    }
    table.appendChild(row);

    if (h.why) {
      const why = el("tr", "why");
      why.hidden = true;
      const td = el("td"); td.colSpan = showAmount ? 5 : 4;
      td.appendChild(document.createTextNode(h.why));
      if (h.each && h.count > 1) td.appendChild(el("div", "", `نصيب الفرد: ${h.each}`));
      why.appendChild(td);
      table.appendChild(why);
      row.addEventListener("click", () => { why.hidden = !why.hidden; row.classList.toggle("open", !why.hidden); });
    }
  });

  const wrap = el("div", "table-wrap");
  wrap.appendChild(table);
  card.appendChild(wrap);

  if (calc.special_case?.title) {
    const box = el("div", "case");
    box.appendChild(el("strong", "", calc.special_case.title));
    if (calc.special_case.ruling) box.appendChild(document.createTextNode(` — ${calc.special_case.ruling}`));
    card.appendChild(box);
  }

  if (calc.steps?.length) {
    const d = el("details", "steps");
    d.appendChild(el("summary", "", "خطوات الحساب"));
    const ol = el("ol");
    calc.steps.forEach((s) => {
      const li = el("li");
      if (s.title) li.appendChild(el("b", "", s.title + ": "));
      li.appendChild(document.createTextNode(s.text || ""));
      ol.appendChild(li);
    });
    d.appendChild(ol);
    card.appendChild(d);
  }

  if (calc.shares_sum === "1") card.appendChild(el("p", "sum", "✓ مجموع الأنصبة = 1 (التركة كاملة)"));
  if (hasWhy) card.appendChild(el("p", "hint", "اضغط على أي وارث لعرض سبب نصيبه."));
  return card;
}

function sourcesBox(sources) {
  const box = el("section", "sources");
  box.appendChild(el("h4", "", "المصادر المذكورة في الجواب"));
  const chips = el("div", "chips");
  const quote = el("blockquote", "quote");
  quote.hidden = true;
  let current = null;

  sources.forEach((s) => {
    const label = s.kind === "law" ? `المادة ${s.article}` : `دروس في الفرائض${s.page ? " · ص " + s.page : ""}`;
    const b = el("button", "chip", label);
    b.type = "button";
    b.addEventListener("click", () => {
      if (current === b) { quote.hidden = true; b.classList.remove("active"); current = null; return; }
      current?.classList.remove("active");
      current = b; b.classList.add("active");
      quote.replaceChildren();
      const meta = el("div", "meta");
      meta.appendChild(el("strong", "", label));
      const detail = s.kind === "law" ? [s.book, s.section].filter(Boolean).join(" · ") : s.title;
      if (detail) meta.appendChild(el("span", "", detail));
      quote.appendChild(meta);
      quote.appendChild(el("p", "", s.text || ""));
      quote.hidden = false;
    });
    chips.appendChild(b);
  });
  box.appendChild(chips);
  box.appendChild(quote);
  return box;
}

// ---------- messages ----------

function addUser(text) {
  chat.appendChild(el("div", "msg user", text));
  scrollDown();
}

function addBot({ text, calc, sources, error }) {
  const wrap = el("div", "bot-wrap");
  const avatar = el("div", "avatar"); avatar.innerHTML = SVG_SCALE; // fixed icon, no user text
  const bot = el("div", "bot" + (error ? " error" : ""));

  if (calc?.heirs?.length) bot.appendChild(resultCard(calc));
  if (text) { const t = el("div", "text"); t.dir = "auto"; renderText(t, text); bot.appendChild(t); }
  if (sources?.length) bot.appendChild(sourcesBox(sources));
  if (text && !error) {
    const copy = el("button", "copy", "نسخ");
    copy.type = "button";
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(text); copy.textContent = "تم النسخ ✓"; setTimeout(() => (copy.textContent = "نسخ"), 1600); } catch { /* clipboard blocked */ }
    });
    bot.appendChild(copy);
  }
  wrap.append(avatar, bot);
  chat.appendChild(wrap);
  scrollDown();
}

function showWaiting() {
  const wrap = el("div", "bot-wrap");
  const avatar = el("div", "avatar"); avatar.innerHTML = SVG_SCALE;
  const status = el("div", "status");
  const dots = el("span", "dots"); dots.innerHTML = "<i></i><i></i><i></i>";
  const label = el("span", "", WAITING[0]);
  status.append(dots, label);
  wrap.append(avatar, status);
  chat.appendChild(wrap);
  scrollDown();
  let i = 0;
  const timer = setInterval(() => { i = Math.min(i + 1, WAITING.length - 1); label.textContent = WAITING[i]; }, 3500);
  return () => { clearInterval(timer); wrap.remove(); };
}

function welcome() {
  const box = el("div", "welcome");
  const star = el("div", "star"); star.innerHTML = SVG_STAR;
  box.appendChild(star);
  box.appendChild(el("h2", "", "كيف يمكنني مساعدتك؟"));
  box.appendChild(el("p", "lead", "اشرح مسألتك بكلماتك، أو اسأل عن حكم في الإرث. تُحسب الأنصبة بالمحرك الشرعي، ويُستشهد في الجواب بمواد مدونة الأسرة وبكتاب «دروس في الفرائض» فقط."));
  const cards = el("div", "cards");
  SUGGESTIONS.forEach((s) => {
    const b = el("button", "card");
    b.type = "button";
    b.append(el("span", "tag", s.tag), el("strong", "", s.title), el("span", "txt", s.text));
    b.addEventListener("click", () => ask(s.text));
    cards.appendChild(b);
  });
  box.appendChild(cards);
  return box;
}

// ---------- sending ----------

async function ask(text) {
  if (sendBtn.disabled) return;
  chat.querySelector(".welcome")?.remove();
  addUser(text);
  input.value = "";
  resize();
  sendBtn.disabled = true;
  const stopWaiting = showWaiting();
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: text, history }),
    });
    const data = await res.json().catch(() => ({}));
    stopWaiting();
    if (!res.ok) throw new Error(data.error || "حدث خطأ، حاول مرة أخرى.");
    addBot({ text: data.answer || "…", calc: data.calc, sources: data.sources });
    history.push({ role: "user", content: text }, { role: "assistant", content: data.answer || "" });
  } catch (e) {
    stopWaiting();
    addBot({ text: e.message, error: true });
  } finally {
    sendBtn.disabled = !input.value.trim();
    input.focus();
  }
}

function resize() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 140) + "px";
}

function start() {
  chat.replaceChildren(welcome());
  history = [];
  sendBtn.disabled = true;
  input.focus();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (text) ask(text);
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
});
input.addEventListener("input", () => { resize(); sendBtn.disabled = !input.value.trim(); });
document.getElementById("reset").addEventListener("click", start);

fetch("/api/health").then((r) => r.json()).then((h) => { if (h.demo) document.getElementById("demo-banner").hidden = false; }).catch(() => {});
start();
