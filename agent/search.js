// Free search over our documents. No embeddings, no API calls (BM25 on Arabic words).
// Two sources: the Moudawana (400 articles, always there) and the fiqh book (only if data/fiqh.json exists).
import fs from "node:fs";
import { tokenize, expandQuery } from "./arabic.js";

const K1 = 1.4;
const B = 0.75;

function loadJson(name) {
  try {
    return JSON.parse(fs.readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));
  } catch {
    return null;
  }
}

function buildIndex(items, textOf) {
  const docs = items.map((item) => {
    const tokens = tokenize(textOf(item));
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    return { item, tokens, tf };
  });
  const df = new Map();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  const avgLen = docs.reduce((s, d) => s + d.tokens.length, 0) / (docs.length || 1);
  return { docs, df, avgLen, N: docs.length };
}

// returns the items, best first
function rank(index, qTokens) {
  const { docs, df, avgLen, N } = index;
  const scored = [];
  for (const d of docs) {
    let s = 0;
    for (const [t, weight] of qTokens) {
      const f = d.tf.get(t);
      if (!f) continue;
      const idf = Math.log(1 + (N - df.get(t) + 0.5) / (df.get(t) + 0.5));
      s += weight * idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.tokens.length) / avgLen)));
    }
    if (s > 0) scored.push({ item: d.item, s });
  }
  return scored.sort((a, b) => b.s - a.s).map((x) => x.item);
}

const cut = (text, max) => (text.length > max ? text.slice(0, max) + "…" : text);

// ---------- Moudawana ----------
// Made by scripts/build-moudawana-index.mjs from the clean text file (data/moudawana-clean.txt).
// The article text counts twice, so it weighs more than the section name.
const ARTICLES = loadJson("moudawana.json") ?? [];
const articleIndex = buildIndex(ARTICLES, (a) => `${a.text} ${a.text} ${a.section ?? ""} ${a.book ?? ""}`);

const toArticle = (a, max) => ({ article: a.number, book: a.book, section: a.section, text: cut(a.text, max) });

export function getArticle(n, max = 1200) {
  const a = ARTICLES.find((x) => x.number === n);
  return a ? toArticle(a, max) : null;
}

// If the query has an article number ("المادة 351") that article comes first.
export function searchMoudawana(query, k = 5, max = 700) {
  const out = [];
  const seen = new Set();
  for (const m of String(query).matchAll(/(?:المادة|الفصل|article|art\.?|مادة)\s*(\d{1,3})/gi)) {
    const r = getArticle(+m[1], max);
    if (r && !seen.has(r.article)) { out.push(r); seen.add(r.article); }
  }
  const q = expandQuery(String(query).replace(/(?:المادة|article|art\.?)\s*\d+/gi, " "), { swapped: false });
  for (const a of rank(articleIndex, q)) {
    if (out.length >= k) break;
    if (!seen.has(a.number)) { out.push(toArticle(a, max)); seen.add(a.number); }
  }
  return out;
}

export const SEARCH_TOOL = {
  name: "search_moudawana",
  description:
    "Searches the text of the Moroccan family code (Moudawana, Arabic). Use it for general legal questions " +
    "(who inherits, conditions, definitions, articles). Write the query in ARABIC. You can include an article number " +
    "(e.g. 'المادة 351'). Returns up to 5 articles, the best first. Quote the article number.",
  input_schema: {
    type: "object",
    properties: { query: { type: "string", description: "Arabic search query, or an article number." } },
    required: ["query"],
  },
};

// ---------- fiqh book (optional) ----------
// Made by scripts/build-fiqh-knowledge.mjs (clean explanation of the book + summary nodes),
// or by scripts/build-fiqh-index.mjs (raw OCR text of the book).
// FIQH_INDEX lets tests point to another file
const PASSAGES = process.env.FIQH_INDEX ? JSON.parse(fs.readFileSync(process.env.FIQH_INDEX, "utf8")) : loadJson("fiqh.json");
export const hasFiqh = Array.isArray(PASSAGES) && PASSAGES.length > 0;
const fiqhIndex = hasFiqh ? buildIndex(PASSAGES, (p) => `${p.title ?? ""} ${p.title ?? ""} ${p.text}`) : null;

export function searchFiqh(query, k = 4, max = 900) {
  if (!hasFiqh) return [];
  return rank(fiqhIndex, expandQuery(String(query), { swapped: false }))
    .slice(0, k)
    .map((p) => ({ source: p.source, page: p.page ?? undefined, title: p.title || undefined, text: cut(p.text, max) }));
}

export const FIQH_TOOL = {
  name: "search_fiqh_book",
  description:
    "Searches a fiqh book about the science of inheritance (الفرائض). Use it when the user asks WHY a rule exists, " +
    "for the reasoning or evidence behind it, for the meaning of a term (العول, الرد, الحجب, ...), or for how a case is solved. " +
    "Write the query in ARABIC. Returns up to 4 passages (explanation of the book, with page numbers when known). " +
    "Quote the page number when there is one. Never add verses or hadith that are not in the passages.",
  input_schema: {
    type: "object",
    properties: { query: { type: "string", description: "Arabic search query." } },
    required: ["query"],
  },
};
