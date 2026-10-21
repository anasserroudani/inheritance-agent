// Turns data/moudawana-clean.txt into data/moudawana.json (one entry per article).
// run: npm run build:index
// The clean file has "=== صفحة N ===" markers, "المادة N" headings and some footnotes (official gazette references).
import fs from "node:fs";

const text = fs.readFileSync(new URL("../data/moudawana-clean.txt", import.meta.url), "utf8");
const lines = text.split(/\r?\n/).map((l) => l.replace(/[‎‏‪-‮]/g, "").trim());

const isBook = (l) => /^الكتاب\s+\S+\s*:/.test(l);
const isSection = (l) => /^(القسم|الباب|الفرع)\s/.test(l) && l.length < 70 && !/[.؛]$/.test(l);
const isPage = (l) => /^=== صفحة \d+ ===$/.test(l);
// footnote lines: "4- قرار لوزير العدل ...", "1- الجريدة الرسمية ..."
const isNoteStart = (l) => /^\d{1,2}\s*-\s*(الجريدة|قرار|ظهير|مرسوم|القانون)/.test(l) || /الجريدة الرسمية عدد/.test(l);
// "المادة 82 عند حضور..." : the heading and the first sentence are on the same line in a few places
const heading = (l) => /^المادة\s*(\d{1,3})(?:\s+(\S.*))?$/.exec(l);

const articles = [];
let cur = null, book = null, section = null, inNote = false, last = 0;

for (const l of lines) {
  if (!l) continue;
  if (isPage(l)) { inNote = false; continue; }
  const m = heading(l);
  // headings must be in order (1, 2, 3, ...), this ignores "المادة 16 من القانون ..." inside sentences
  if (m && +m[1] === last + 1) {
    last = +m[1];
    cur = { number: last, book, section, text: [], note: [] };
    articles.push(cur);
    inNote = false;
    if (m[2]) cur.text.push(m[2]);
    continue;
  }
  if (isBook(l)) { book = l; section = null; cur = null; continue; }
  if (isSection(l)) { section = l; continue; }
  if (!cur) continue;
  if (isNoteStart(l)) inNote = true;
  (inNote ? cur.note : cur.text).push(l);
}

const tidy = (arr) => arr.join(" ").replace(/\s+/g, " ").trim();
const out = articles
  .map((a) => ({ number: a.number, book: a.book, section: a.section, text: tidy(a.text), ...(a.note.length ? { note: tidy(a.note) } : {}) }))
  .filter((a) => a.text.length > 0);

fs.writeFileSync(new URL("../data/moudawana.json", import.meta.url), JSON.stringify(out, null, 1));
const nums = new Set(out.map((a) => a.number));
const missing = []; for (let n = 1; n <= 400; n++) if (!nums.has(n)) missing.push(n);
console.log(`articles: ${out.length}, last=${out.at(-1)?.number}, missing(1..400): ${missing.length ? missing.join(",") : "none"}`);
console.log(`with footnotes: ${out.filter((a) => a.note).length}`);
