// Stress test: random families through the same path the agent uses.
// Checks: no crash, shares add up to exactly 1, nobody gets a negative or NaN amount,
// the money adds up to the estate. Run: npm run eval:engine
import { runCalculate, HEIR_CODES } from "../agent/tool.js";

// small seeded random generator, so a failure can be repeated
let seed = Number(process.env.SEED) || 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const notes = {}; // things worth telling the user at the end
const SINGLE = new Set(["FATHER", "MOTHER", "PATERNAL_GRANDFATHER", "PATERNAL_GREAT_GRANDFATHER", "PATERNAL_GRANDMOTHER", "MATERNAL_GRANDMOTHER", "MATERNAL_GREAT_GRANDMOTHER", "PATERNAL_GREAT_GRANDMOTHER", "MATERNAL_PATERNAL_GREAT_GRANDMOTHER"]);
const PEOPLE = HEIR_CODES.filter((c) => c !== "HUSBAND" && c !== "WIFE");

function randomFamily() {
  const female = rnd() < 0.5; // deceased gender
  const heirs = [];
  if (rnd() < 0.55) heirs.push(female ? { relationship: "HUSBAND", count: 1 } : { relationship: "WIFE", count: 1 + Math.floor(rnd() * 4) });
  const n = Math.floor(rnd() * 5);
  const used = new Set();
  for (let i = 0; i < n; i++) {
    const code = pick(PEOPLE);
    if (used.has(code)) continue;
    used.add(code);
    heirs.push({ relationship: code, count: SINGLE.has(code) ? 1 : 1 + Math.floor(rnd() * 4) });
  }
  return { deceased_gender: female ? "female" : "male", heirs, total_estate_value: 100000 };
}

const num = (f) => { const [a, b = 1] = String(f).split("/"); return Number(a) / Number(b); };
const SIBLINGS = ["FULL_BROTHER", "FULL_SISTER", "PATERNAL_BROTHER", "PATERNAL_SISTER", "MATERNAL_BROTHER", "MATERNAL_SISTER"];
const FAR_MALES = ["NEPHEW_FULL", "NEPHEW_PATERNAL", "GREAT_NEPHEW_FULL", "GREAT_NEPHEW_PATERNAL", "UNCLE_FULL", "UNCLE_PATERNAL", "COUSIN_FULL", "COUSIN_PATERNAL"];

// legal rules that must always be true (Maliki school / Moudawana)
function legalProblems(r) {
  const share = Object.fromEntries(r.heirs.map((h) => [h.relationship, num(h.total_share)]));
  const each = Object.fromEntries(r.heirs.map((h) => [h.relationship, num(h.share_each)]));
  const has = (c) => c in share;
  const out = [];
  if (has("SON")) for (const c of [...SIBLINGS, ...FAR_MALES, "GRANDSON", "GRANDDAUGHTER"]) if (share[c] > 0) out.push(`${c} inherits although there is a SON`);
  if (has("FATHER")) for (const c of [...SIBLINGS, "PATERNAL_GRANDFATHER", ...FAR_MALES]) if (share[c] > 0) out.push(`${c} inherits although the FATHER is alive`);
  if (has("FATHER") && (has("MATERNAL_GRANDMOTHER") || has("PATERNAL_GRANDMOTHER")) && has("MOTHER")) for (const c of ["MATERNAL_GRANDMOTHER", "PATERNAL_GRANDMOTHER"]) if (share[c] > 0) out.push(`${c} inherits although the MOTHER is alive`);
  const kids = ["SON", "DAUGHTER", "GRANDSON"].some((c) => has(c) && share[c] > 0);
  if (kids || has("FATHER") || has("PATERNAL_GRANDFATHER") && share.PATERNAL_GRANDFATHER > 0) for (const c of ["MATERNAL_BROTHER", "MATERNAL_SISTER"]) if (share[c] > 0) out.push(`${c} inherits although there is a child or father/grandfather`);
  const effective = r.heirs.filter((h) => num(h.total_share) > 0); // heirs who really get something
  const spouseAlone = effective.length === 1 && (has("HUSBAND") || has("WIFE"));
  if (spouseAlone) { notes.spouseAlone = (notes.spouseAlone || 0) + 1; }
  else {
    if (has("HUSBAND") && share.HUSBAND > 0.5 + 1e-9) out.push("HUSBAND gets more than 1/2");
    if (has("WIFE") && share.WIFE > 0.25 + 1e-9) out.push("WIVES get more than 1/4");
  }
  if (has("SON") && has("DAUGHTER") && Math.abs(each.SON - 2 * each.DAUGHTER) > 1e-9) out.push("a son does not get twice a daughter");
  if (has("FULL_BROTHER") && has("FULL_SISTER") && share.FULL_BROTHER > 0 && !has("DAUGHTER") && !has("GRANDDAUGHTER") && !has("PATERNAL_GRANDFATHER") && Math.abs(each.FULL_BROTHER - 2 * each.FULL_SISTER) > 1e-9) out.push("a full brother does not get twice a full sister");
  return out;
}

const N = Number(process.env.N) || 20000;
const seen = {};
const problems = new Map();
let ok = 0, noHeirs = 0, engineErrors = 0;

for (let i = 0; i < N; i++) {
  const input = randomFamily();
  if (!input.heirs.length) { noHeirs++; continue; }
  const r = runCalculate(input);
  const fail = (kind) => { if (!problems.has(kind)) problems.set(kind, []); problems.get(kind).push(input); };

  if (!r.ok) { if (r.errors.some((e) => e.startsWith("Engine error"))) { engineErrors++; fail("engine crash: " + r.errors[0].slice(0, 80)); } continue; }
  if (r.shares_sum !== "1") fail(`shares add up to ${r.shares_sum}, not 1`);
  const money = r.heirs.reduce((s, h) => s + (h.amount_total ?? 0), 0);
  if (Math.abs(money - r.net_estate) > 1) fail(`money adds up to ${money}, estate is ${r.net_estate}`);
  if (r.heirs.some((h) => !Number.isFinite(h.amount_total) || h.amount_total < 0)) fail("negative or NaN amount");
  if (r.heirs.some((h) => h.count > 0 && typeof h.total_share !== "string")) fail("missing share");
  for (const msg of legalProblems(r)) fail("legal rule: " + msg);
  for (const [flag, on] of Object.entries(r.flags)) if (on) seen[flag] = (seen[flag] || 0) + 1;
  ok++;
}

if (notes.spouseAlone) console.log(`note: ${notes.spouseAlone} families where a spouse is the only heir. The engine gives the spouse the whole estate (radd). Ask a scholar if this is the wanted rule.`);
console.log("special cases reached:", Object.entries(seen).map(([k, v]) => `${k} ${v}`).join(", "));
console.log(`families tested: ${N - noHeirs} | all checks passed: ${ok} | engine crashes: ${engineErrors}`);
if (problems.size) {
  console.log("\nproblems:");
  for (const [kind, list] of problems) {
    console.log(`  ${list.length}x ${kind}`);
    console.log("     example:", JSON.stringify(list[0].heirs.map((h) => `${h.relationship}${h.count > 1 ? "x" + h.count : ""}`).join(" + ")), list[0].deceased_gender);
  }
  process.exitCode = 1;
}