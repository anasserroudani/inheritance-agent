// Everything the web endpoint needs. Used by server.js (local) and api/chat.js (Vercel).
import { runTurn, citedArticles } from "./agent.js";

const MAX_HISTORY = 30;
const MAX_CHARS = 4000;
const LIMIT_PER_MINUTE = 20;

// The browser only sends back the visible chat (user and assistant text).
// Tool results are never accepted from the browser, so nobody can fake a calculation.
export function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  const out = [];
  for (const m of history.slice(-MAX_HISTORY)) {
    if (typeof m?.content !== "string") continue;
    const content = m.content.slice(0, MAX_CHARS);
    if (m.role === "user") out.push({ role: "user", content });
    else if (m.role === "assistant") out.push({ role: "assistant", content, toolCalls: [] });
  }
  return out;
}

// The page shows only the sources that the answer really mentions (article numbers, book pages),
// and only if a search result contains them. So a source on screen was read by the assistant.
const EAST = "٠١٢٣٤٥٦٧٨٩";
// "87-89" -> 87, 88, 89
function pageNumbers(page) {
  const m = String(page ?? "").match(/\d+/g) ?? [];
  if (m.length === 2 && +m[1] > +m[0] && +m[1] - +m[0] < 20) return Array.from({ length: +m[1] - +m[0] + 1 }, (_, i) => String(+m[0] + i));
  return m;
}

export function citedSources(answer, found) {
  const text = String(answer).replace(/[٠-٩]/g, (d) => EAST.indexOf(d));
  const articles = citedArticles(text);
  const out = [];
  const seen = new Set();
  for (const f of found) {
    let keep = false;
    let key;
    if (f.kind === "law") {
      key = `law-${f.article}`;
      keep = articles.has(f.article);
    } else {
      key = `book-${f.page ?? f.title}`;
      const nums = pageNumbers(f.page);
      keep = nums.some((n) => new RegExp(`(?:ص|صفحة|صفحات|pp?\\.?|page)\\s*\\.?\\s*(?:\\d+\\s*[-–،,و]\\s*)*${n}(?!\\d)`, "i").test(text));
    }
    if (!keep || seen.has(key)) continue;
    seen.add(key);
    out.push(f.kind === "law"
      ? { kind: "law", article: f.article, book: f.book, section: f.section, text: f.text }
      : { kind: "book", page: f.page, title: f.title, text: f.text });
  }
  return out;
}

// very simple limit per IP, so a public page can not burn the API key
const hits = new Map();
export function rateLimit(ip, now = Date.now()) {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length <= LIMIT_PER_MINUTE;
}

export async function handleChat(provider, body) {
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) throw Object.assign(new Error("message is empty"), { status: 400 });
  if (message.length > MAX_CHARS) throw Object.assign(new Error("message is too long"), { status: 400 });

  // keep the last successful calculation, the page shows it as a table
  let calc = null;
  const found = []; // everything the search tools returned in this turn
  const r = await runTurn(provider, cleanHistory(body.history), message, {
    onTool: (call, out) => {
      if (call.name === "calculate_inheritance" && !out.isError) calc = out.content;
      if (call.name === "search_moudawana" && Array.isArray(out.content)) found.push(...out.content.map((a) => ({ kind: "law", ...a })));
      if (call.name === "search_fiqh_book" && Array.isArray(out.content)) found.push(...out.content.map((p) => ({ kind: "book", ...p })));
    },
  });
  return { answer: r.answer, calc, sources: citedSources(r.answer, found), usage: r.usage };
}

// returns { status, json }, the caller only has to send it
export async function chatEndpoint(provider, ip, body) {
  if (!rateLimit(ip)) return { status: 429, json: { error: "Too many questions, wait a minute." } };
  try {
    return { status: 200, json: await handleChat(provider, body) };
  } catch (e) {
    if (e.status === 400) return { status: 400, json: { error: e.message } };
    console.error("chat error:", e.message); // the real reason stays in the server log
    return { status: 500, json: { error: "Something went wrong. Please try again." } };
  }
}