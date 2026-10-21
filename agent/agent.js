import { CALCULATE_TOOL, runCalculate, forModel } from "./tool.js";
import { SEARCH_TOOL, searchMoudawana, FIQH_TOOL, searchFiqh, hasFiqh } from "./search.js";
import { SYSTEM_PROMPT, FIQH_RULE } from "./prompt.js";

// the fiqh tool only exists if data/fiqh.json was built
export const TOOLS = [CALCULATE_TOOL, SEARCH_TOOL, ...(hasFiqh ? [FIQH_TOOL] : [])];
const SYSTEM = SYSTEM_PROMPT + (hasFiqh ? FIQH_RULE : "");
const MAX_STEPS = 6;

export function executeTool(name, input) {
  try {
    if (name === CALCULATE_TOOL.name) {
      const raw = runCalculate(input);
      const hasEstate = (input?.total_estate_value ?? 0) > 0;
      return { content: forModel(raw, { withAmounts: hasEstate }), isError: !raw.ok };
    }
    if (name === SEARCH_TOOL.name) {
      return { content: searchMoudawana(input?.query ?? ""), isError: false };
    }
    if (name === FIQH_TOOL.name && hasFiqh) {
      return { content: searchFiqh(input?.query ?? ""), isError: false };
    }
    return { content: { error: `Unknown tool ${name}` }, isError: true };
  } catch (e) {
    return { content: { error: String(e.message || e) }, isError: true };
  }
}

// Article numbers that appear in text ("المادة 348", "article 348", "art. 348")
const EAST = "٠١٢٣٤٥٦٧٨٩";
const toWestern = (t) => String(t).replace(/[٠-٩]/g, (d) => EAST.indexOf(d));
export function citedArticles(text) {
  const found = new Set();
  const t = toWestern(text);
  for (const m of t.matchAll(/(?:المادة|المواد|مادة|articles?|art\.?)\s*(\d{1,3})((?:\s*(?:،|,|و|and|et|-)\s*\d{1,3})*)/gi)) {
    found.add(+m[1]);
    for (const n of m[2].matchAll(/\d{1,3}/g)) found.add(+n[0]);
  }
  return found;
}

// Cited articles that no tool result contains. The model sometimes writes article numbers from memory, and they can be wrong.
export function unsupportedArticles(answer, toolContents) {
  const allowed = new Set();
  for (const c of toolContents) {
    for (const n of citedArticles(c)) allowed.add(n);
    for (const m of String(c).matchAll(/"article":\s*(\d{1,3})/g)) allowed.add(+m[1]);
  }
  return [...citedArticles(answer)].filter((n) => !allowed.has(n)).sort((a, b) => a - b);
}

// One user turn. The caller keeps `history` between turns.
// Returns { answer, history, usage }.
export async function runTurn(provider, history, userText, { onTool } = {}) {
  const messages = [...history, { role: "user", content: userText }];
  const usage = { input: 0, output: 0, calls: 0 };
  const toolContents = [];
  let checked = false;

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await provider.chat({ system: SYSTEM, messages, tools: TOOLS });
    usage.calls++;
    usage.input += res.usage?.input ?? 0;
    usage.output += res.usage?.output ?? 0;
    messages.push({ role: "assistant", content: res.text, toolCalls: res.toolCalls });

    if (!res.toolCalls.length) {
      // one check of the cited articles; if one has no source, the model gets one chance to fix it
      const bad = checked ? [] : unsupportedArticles(res.text, toolContents);
      if (!bad.length) return { answer: res.text, history: messages, usage };
      checked = true;
      messages.push({
        role: "user",
        content: `Check failed: you cited article ${bad.join(", ")} but no tool result contains it. Call search_moudawana to confirm the article, or remove it. Then write the full answer again, in the same language, without mentioning this check.`,
      });
      continue;
    }

    const results = res.toolCalls.map((call) => {
      const out = executeTool(call.name, call.input);
      onTool?.(call, out);
      toolContents.push(JSON.stringify(out.content));
      return { id: call.id, name: call.name, content: JSON.stringify(out.content), isError: out.isError };
    });
    messages.push({ role: "tool", results });
  }

  return { answer: "Sorry, I could not finish this one. Can you give the family details again?", history: messages, usage };
}
