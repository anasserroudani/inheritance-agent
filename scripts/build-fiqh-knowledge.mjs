// Builds data/fiqh.json (the book knowledge) from ONE file: data/fiqh-book.txt
// That file is the text of data/faraid.rtf (see scripts/rtf-to-text.py). It has the lesson-by-lesson explanation,
// with page numbers, and at the end 10 short summary nodes.
// run: npm run build:fiqh
import fs from "node:fs";

const raw = fs.readFileSync(new URL("../data/fiqh-book.txt", import.meta.url), "utf8");

// LaTeX pieces like \frac{1}{3} become plain text "1/3"
function plainMath(s) {
  let t = s;
  for (let i = 0; i < 4; i++) t = t.replace(/\\(?:text|mathbf)\{([^{}]*)\}/g, "$1"); // inner pieces first (they can be nested)
  t = t.replace(/\\frac\{\s*(\d+)\s*\}\{\s*(\d+)\s*\}/g, "$1/$2");                    // 1/2
  for (let i = 0; i < 3; i++) t = t.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1) / ($2)"); // longer fractions
  return t
    .replace(/\\(?:quad|,|;)/g, " ")
    .replace(/\\rightarrow/g, "←")   // the text is right-to-left, so the arrow points left
    .replace(/\\times/g, "×")
    .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const BOX = /[│┌┐└┘├┤┬┴┼─▼▲►◄]/;

// one line of the file -> clean text ("" means: drop the line)
function cleanLine(line) {
  let l = line;
  if (/^[\s|+\-=:]+$/.test(l)) return "";                       // table borders and empty table rows
  if (l.includes("|")) l = l.split("|").map((c) => c.trim()).filter(Boolean).join(" — "); // table row -> cells
  if (BOX.test(l)) {                                             // diagram: keep only the words
    l = l.replace(new RegExp(BOX.source, "g"), " ");
    if (!/[؀-ۿ]{2}/.test(l)) return "";
  }
  l = l.replace(/\s*\[\d+(?:\s*[،,]\s*\d+)*\]/g, "");            // citation marks like [37، 38]
  l = plainMath(l);
  return l.replace(/^[-*•]\s+/, "").trim();                      // bullet signs
}

const ORDINALS = "أولاً|ثانياً|ثالثاً|رابعاً|خامساً|سادساً|سابعاً|ثامناً|تاسعاً|عاشراً";
const PART = new RegExp(`^(${ORDINALS})\\s*[:：]`);
const NUMBERED = /^\d{1,2}\.\s+\S/;

// first page number in a heading like "(الصفحة 9)" or "(الصفحتان 9 - 10)" or "(الدرس 32 / الصفحة 90)"
function pageOf(l) {
  const m = /(?:الصفحة|الصفحتان|الصفحات|ص)\s*(\d{1,3})(?:\s*[-–/]\s*(\d{1,3}))?/.exec(l);
  if (!m) return null;
  return m[2] && +m[2] > +m[1] ? `${m[1]}-${m[2]}` : m[1];
}

// the text has a line that introduces the summary nodes ("RAG Knowledge Base & Chunking Nodes ..."): it is about the file, not the book
const nodesStart = raw.search(/^\s*Node\s*0?1\b/m);
const intro = raw.lastIndexOf("RAG Knowledge Base", nodesStart);
const explainedPart = raw.slice(0, intro > 0 ? raw.lastIndexOf("\n", intro) : nodesStart);
const nodesPart = raw.slice(nodesStart);

const MAX = 1000;
const passages = [];
const SOURCE = "كتاب دروس في الفرائض";

// ---- lessons, with page numbers ----
{
  let part = "", title = "", page = null, buf = [];
  const flush = () => {
    const body = buf.join("\n").trim();
    buf = [];
    if (body.length < 40) return;
    let cur = "";
    const pieces = [];
    for (const ln of body.split("\n")) {          // cut long blocks at line ends
      if (cur && cur.length + ln.length > MAX) { pieces.push(cur); cur = ""; }
      cur += (cur ? "\n" : "") + ln;
    }
    if (cur) pieces.push(cur);
    for (const p of pieces) passages.push({ source: SOURCE, page, title: [part, title].filter(Boolean).join(" / "), text: p });
  };
  for (const line of explainedPart.split(/\r?\n/)) {
    const l = cleanLine(line);
    if (!l) continue;
    if (PART.test(l)) { flush(); part = l.replace(/\s*\(.*$/, ""); title = ""; page = pageOf(l) ?? page; continue; }
    if (NUMBERED.test(l) && /\((?:ال)?(?:صفحة|صفحتان|صفحات|درس|دروس|ص\b)/.test(l)) {
      flush(); title = l.replace(/^\d+\.\s*/, "").replace(/\s*\(.*$/, ""); page = pageOf(l) ?? page; buf.push(l); continue;
    }
    buf.push(l);
  }
  flush();
}

// ---- the 10 summary nodes (no page numbers) ----
{
  const parts = nodesPart.split(/^\s*Node\s*\d+\s*:\s*/m).slice(1);
  for (const p of parts) {
    const lines = p.split(/\r?\n/);
    const title = cleanLine(lines[0]);
    const body = lines
      .slice(1)
      .map(cleanLine)
      .filter((l) => l && !/^(Node_ID|Category)\s*:/.test(l))
      .join("\n");
    passages.push({ source: SOURCE + " (ملخص)", page: null, title, text: body });
  }
}

fs.writeFileSync(new URL("../data/fiqh.json", import.meta.url), JSON.stringify(passages, null, 1));
console.log(`passages: ${passages.length} (with page: ${passages.filter((p) => p.page).length}, summary nodes: ${passages.filter((p) => !p.page && p.source.includes("ملخص")).length})`);
console.log(`longest: ${Math.max(...passages.map((p) => p.text.length))} chars, shortest: ${Math.min(...passages.map((p) => p.text.length))} chars`);
