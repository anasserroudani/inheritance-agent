import { InheritanceCalculator, HEIR_NAMES_AR } from "../engine.js";

// the engine has a few alternative names for the same heir, we don't show those to the model
const ALIASES = new Set([
  "PATERNAL_UNCLE", "FULL_UNCLE", "PATERNAL_UNCLE_PATERNAL", "FULL_NEPHEW",
  "PATERNAL_NEPHEW", "FULL_COUSIN", "PATERNAL_COUSIN",
]);
export const HEIR_CODES = Object.keys(HEIR_NAMES_AR).filter((c) => !ALIASES.has(c));

// these can only exist once for one person
const ONLY_ONE = new Set([
  "HUSBAND", "FATHER", "MOTHER", "PATERNAL_GRANDFATHER", "PATERNAL_GREAT_GRANDFATHER",
  "PATERNAL_GRANDMOTHER", "MATERNAL_GRANDMOTHER", "MATERNAL_GREAT_GRANDMOTHER",
  "PATERNAL_GREAT_GRANDMOTHER", "MATERNAL_PATERNAL_GREAT_GRANDMOTHER",
]);
const MAX_WIVES = 4;

export const CALCULATE_TOOL = {
  name: "calculate_inheritance",
  description:
    "Calculates the share of each heir (Maliki school, Moroccan Moudawana) with exact fractions. " +
    "Always use it for any share or amount, never calculate yourself. " +
    "Only list heirs who are ALIVE at the time of death. Relationships are from the point of view of the deceased.",
  input_schema: {
    type: "object",
    properties: {
      deceased_gender: {
        type: "string",
        enum: ["male", "female"],
        description: "Gender of the deceased. A WIFE means the deceased is male, a HUSBAND means female.",
      },
      heirs: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            relationship: {
              type: "string",
              enum: HEIR_CODES,
              description: "Heir code. In Arabic: " + HEIR_CODES.map((c) => `${c}=${HEIR_NAMES_AR[c]}`).join("; "),
            },
            count: { type: "integer", minimum: 1, description: "How many living heirs of this type. Default 1." },
          },
          required: ["relationship"],
        },
      },
      total_estate_value: { type: "number", minimum: 0, description: "Value of the estate in any currency. Use 0 if unknown, you still get the fractions." },
      debts: { type: "number", minimum: 0, description: "Debts to pay first. Default 0." },
      funeral_expenses: { type: "number", minimum: 0, description: "Funeral costs. Default 0." },
    },
    required: ["heirs"],
  },
};

// The engine does not check its input, so we do it here.
export function validateInput(input) {
  const errors = [];
  const heirs = [];
  if (!input || !Array.isArray(input.heirs) || input.heirs.length === 0) {
    return { errors: ["heirs is empty. Ask the user which relatives are alive."] };
  }

  const seen = new Set();
  for (const h of input.heirs) {
    const code = h?.relationship;
    const count = h?.count ?? 1;
    if (!HEIR_CODES.includes(code)) { errors.push(`Unknown relationship code "${code}".`); continue; }
    if (!Number.isInteger(count) || count < 1) {
      errors.push(`${code}: count must be a whole number >= 1 (got ${count}). Leave out heirs who are not alive.`);
      continue;
    }
    if (seen.has(code)) { errors.push(`${code} is listed twice. Use one line with a count.`); continue; }
    seen.add(code);
    if (ONLY_ONE.has(code) && count !== 1) errors.push(`${code} (${HEIR_NAMES_AR[code]}) can only be 1.`);
    if (code === "WIFE" && count > MAX_WIVES) errors.push(`WIFE: maximum is ${MAX_WIVES}.`);
    heirs.push({ relationship: code, count });
  }

  let gender = input.deceased_gender;
  if (seen.has("HUSBAND") && seen.has("WIFE")) {
    errors.push("HUSBAND and WIFE cannot both be heirs of the same person.");
  } else {
    if (seen.has("WIFE")) {
      if (gender === "female") errors.push("deceased_gender is female but a WIFE is listed.");
      gender = "male";
    }
    if (seen.has("HUSBAND")) {
      if (gender === "male") errors.push("deceased_gender is male but a HUSBAND is listed.");
      gender = "female";
    }
  }
  if (!gender) gender = "male"; // no spouse, so it does not change any share

  for (const key of ["total_estate_value", "debts", "funeral_expenses"]) {
    const v = input[key];
    if (v !== undefined && !(typeof v === "number" && v >= 0)) errors.push(`${key} must be a number >= 0.`);
  }

  return { errors, gender, heirs };
}

// adds fractions like "1/8" exactly (BigInt, no rounding)
function sumFractions(list) {
  const gcd = (a, b) => (b === 0n ? a : gcd(b, a % b));
  let n = 0n;
  let d = 1n;
  for (const f of list) {
    const [top, bottom = "1"] = String(f).split("/");
    n = n * BigInt(bottom) + BigInt(top) * d;
    d = d * BigInt(bottom);
    const g = gcd(n < 0n ? -n : n, d) || 1n;
    n /= g;
    d /= g;
  }
  return d === 1n ? String(n) : `${n}/${d}`;
}

export function runCalculate(input) {
  const v = validateInput(input);
  if (v.errors.length) return { ok: false, errors: v.errors };

  let r;
  try {
    r = new InheritanceCalculator({
      gender: v.gender,
      heirs: v.heirs,
      total_estate_value: input.total_estate_value ?? 0,
      debts: input.debts ?? 0,
      funeral_expenses: input.funeral_expenses ?? 0,
    }).calculate();
  } catch (e) {
    return { ok: false, errors: [`Engine error: ${e.message}`] };
  }

  const sc = r.special_case;
  return {
    ok: true,
    net_estate: r.net_estate,
    // the engine writes its own derivation (base, correction of the breakage, awl, radd).
    // The first step only lists the heirs (we send their reasons separately), so we skip it.
    steps: (r.standard_steps ?? [])
      .slice(1)
      .map((st) => ({ title: st.title, text: [st.desc, st.result_text].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 900) })),
    awl_base: r.is_aul ? r.aul_base : undefined,
    radd_type: r.is_radd ? r.radd_result?.type : undefined,
    flags: {
      awl: !!r.is_aul,
      radd: !!r.is_radd,
      akdariyya: !!r.is_akdariyya,
      malikiyya: !!r.is_malikiyyah,
      shibh_malikiyya: !!r.is_shibh_malikiyyah,
      mushtarakah: !!r.is_mushtarakah,
      umariyya: !!r.is_umariyyah,
      minbariyya: !!r.is_minbariyya,
      kharqa: !!r.is_kharqa,
      muadah: !!r.is_muadah,
    },
    special_case: sc && typeof sc === "object" ? { name: sc.name, title: sc.title, summary: sc.summary, ruling: sc.ruling } : null,
    heirs: r.distributions.map((d) => ({
      relationship: d.relationship,
      name_ar: d.relationship_display,
      count: d.count,
      total_share: d.share_fraction,
      share_each: d.individual_share_fraction,
      amount_total: d.total_value,
      amount_each: d.per_person_value,
      blocked: d.share_fraction === "0",
      why_ar: d.why,
    })),
    // all shares together must be exactly 1
    shares_sum: sumFractions(r.distributions.map((d) => d.share_fraction)),
  };
}

// smaller version for the model, fewer tokens = cheaper
export function forModel(r, { withAmounts = true } = {}) {
  if (!r.ok) return { ok: false, errors: r.errors };
  const flags = Object.entries(r.flags).filter(([, on]) => on).map(([name]) => name);
  return {
    ok: true,
    special: flags.length ? flags : undefined,
    special_case: r.special_case ? { title: r.special_case.title, ruling: r.special_case.ruling } : undefined,
    steps: r.steps?.length ? r.steps : undefined,
    awl_base: r.awl_base,
    radd_type: r.radd_type,
    net_estate: withAmounts ? r.net_estate : undefined,
    shares_sum: r.shares_sum,
    heirs: r.heirs.map((h) => ({
      heir: h.name_ar,
      code: h.relationship,
      count: h.count,
      share: h.total_share,
      each: h.count > 1 ? h.share_each : undefined,
      amount: withAmounts ? h.amount_total : undefined,
      blocked: h.blocked || undefined,
      why: h.why_ar,
    })),
  };
}
