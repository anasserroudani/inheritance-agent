/**
 * @file Munasakhat.js
 * @description Engine module for calculating Munāsakhāt (المُنَاسَخَات) — consecutive inheritance
 * distributions when one or more heirs die before the original estate is partitioned.
 * Implements the Maliki / Moroccan Family Code (مدونة الأسرة) rules for:
 * 1. Solving the original estate (المسألة الأولى) with accurate Tasheeh / Base.
 * 2. Solving each subsequent deceased heir's estate (مسألة الميت الثاني / التوالي).
 * 3. Computing the consolidated matrix / الجامعة through standard Fiqh arithmetic (التماثل، التداخل، التوافق، والتباين).
 */

import Fraction from "../fraction.js";
import { HEIR_NAMES_AR } from "./Explanations.js";

/**
 * Computes Greatest Common Divisor using Euclidean algorithm.
 */
function gcd(a, b) {
  a = Math.abs(Math.round(Number(a) || 0));
  b = Math.abs(Math.round(Number(b) || 0));
  if (!a && !b) return 1;
  while (b !== 0 && !isNaN(b)) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

/**
 * Computes Least Common Multiple.
 */
function lcm(a, b) {
  a = Math.abs(Math.round(Number(a) || 0));
  b = Math.abs(Math.round(Number(b) || 0));
  if (a === 0 || b === 0) return a || b || 1;
  return Math.abs(a * b) / gcd(a, b);
}

/**
 * Formats currency value with Moroccan Dirham suffix.
 */
function formatCurrency(val) {
  return (
    (val || 0).toLocaleString("ar-MA", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + " د.م."
  );
}

/**
 * Parses a fraction string safely into a Fraction instance.
 */
function parseFraction(fracStr) {
  if (!fracStr || fracStr === "0" || fracStr === "—" || fracStr === "-") {
    return new Fraction(0);
  }
  return new Fraction(fracStr);
}

/**
 * Extracts the true Islamic inheritance Base (أصل المسألة بعد التصحيح) and
 * exact integer shares for each heir distribution.
 *
 * @param {Array} distributions - Distribution objects from Calculator.
 * @returns {{ base: number, items: Array }} Base and adjusted distribution items with shares.
 */
function getProblemBaseAndShares(distributions) {
  const activeDists = (distributions || []).filter(
    (d) =>
      d.percentage > 0 ||
      (d.share_fraction && d.share_fraction !== "0") ||
      (d.share && d.share.toString() !== "0")
  );
  if (activeDists.length === 0) return { base: 1, items: [] };

  // 1. Calculate LCM of all denominators (أصل المسألة الأولي)
  let commonDen = 1;
  for (const d of activeDists) {
    const fracStr = d.share_fraction || (d.share ? d.share.toString() : "0");
    const frac = parseFraction(fracStr);
    if (frac.d > 0) {
      commonDen = lcm(commonDen, frac.d);
    }
  }

  // 2. Determine correction factor (التصحيح) so every individual heir receives an integer share
  let correctionFactor = 1;
  for (const d of activeDists) {
    const fracStr = d.share_fraction || (d.share ? d.share.toString() : "0");
    const frac = parseFraction(fracStr);
    if (frac.d > 0) {
      const count = Math.max(1, parseInt(d.count, 10) || 1);
      const totalShares = Math.round(frac.n * (commonDen / frac.d));
      const g = gcd(totalShares, count);
      const neededMultiplier = Math.round(count / g);
      correctionFactor = lcm(correctionFactor, neededMultiplier);
    }
  }

  const baseOrigin = commonDen;
  commonDen = commonDen * correctionFactor;

  // 3. Calculate exact integer shares
  const items = activeDists.map((d) => {
    const fracStr = d.share_fraction || (d.share ? d.share.toString() : "0");
    const frac = parseFraction(fracStr);
    const totalShares = frac.d > 0 ? Math.round(frac.n * (commonDen / frac.d)) : 0;
    const count = Math.max(1, parseInt(d.count, 10) || 1);
    const sharePerIndividual = Math.round(totalShares / count);

    const isItemAsabah =
      d.share_type === "عصبة" ||
      d.why?.includes("عصبة") ||
      d.why?.includes("تعصيب");
    const isItemWill =
      d.relationship?.startsWith("WILL_") ||
      d.why?.includes("الوصية") ||
      d.share_type?.includes("وصية");
    const isItemMandatory =
      d.is_mandatory ||
      d.relationship?.startsWith("MANDATORY_WILL") ||
      d.why?.includes("الوصية الواجبة");

    const shareType = isItemMandatory
      ? "وصية واجبة"
      : isItemWill
        ? "وصية"
        : isItemAsabah
          ? "عصبة"
          : d.share_type_arabic || d.share_type || "فرض";

    return {
      ...d,
      share_type: shareType,
      share_type_arabic: shareType,
      shares_allocated: totalShares,
      share_per_individual: sharePerIndividual,
      fraction_with_base: `${totalShares}/${commonDen}`,
    };
  });

  return { base: commonDen, baseOrigin, items };
}

/**
 * Expands distributions so multiple individuals of the same category (e.g. 2 Daughters)
 * appear as individual entries (البنت #1, البنت #2) with count: 1 and individual shares/values.
 */
export function expandDistributionsPerIndividual(distributions) {
  if (!Array.isArray(distributions)) return [];
  const expanded = [];
  for (const d of distributions) {
    const count = Math.max(1, parseInt(d.count, 10) || 1);
    const totalShares = d.shares_allocated ?? 0;
    const perPersonShare =
      d.share_per_individual ??
      (count > 0 ? Math.round(totalShares / count) : totalShares);
    const perPersonVal =
      d.per_person_value ??
      (count > 0 ? (d.total_value || 0) / count : d.total_value || 0);

    const isItemAsabah =
      d.share_type === "عصبة" ||
      d.why?.includes("عصبة") ||
      d.why?.includes("تعصيب");
    const isItemWill =
      d.relationship?.startsWith("WILL_") ||
      d.why?.includes("الوصية") ||
      d.share_type?.includes("وصية");
    const isItemMandatory =
      d.is_mandatory ||
      d.relationship?.startsWith("MANDATORY_WILL") ||
      d.why?.includes("الوصية الواجبة");

    const shareType = isItemMandatory
      ? "وصية واجبة"
      : isItemWill
        ? "وصية"
        : isItemAsabah
          ? "عصبة"
          : d.share_type_arabic || d.share_type || "فرض";

    if (count > 1) {
      for (let i = 1; i <= count; i++) {
        expanded.push({
          ...d,
          relationship_display: `${d.relationship_display} #${i}`,
          count: 1,
          share_type: shareType,
          share_type_arabic: shareType,
          shares_allocated: perPersonShare,
          share_per_individual: perPersonShare,
          total_value: perPersonVal,
          per_person_value: perPersonVal,
          individual_index: i,
        });
      }
    } else {
      expanded.push({
        ...d,
        count: 1,
        share_type: shareType,
        share_type_arabic: shareType,
        shares_allocated: totalShares,
        share_per_individual: perPersonShare,
        total_value: d.total_value ?? perPersonVal,
        per_person_value: perPersonVal,
      });
    }
  }
  return expanded;
}

/**
 * Maps a sub-problem relationship back to a corresponding surviving heir in the unified pool.
 */
function findMatchingLivingHeir(
  subRel,
  deceasedHeirType,
  survivingHeirs,
  alreadyMatchedIds = new Set(),
  heirMappings = {},
) {
  // 1. Explicit mapping override if provided in mCase.heirMappings
  if (heirMappings && heirMappings[subRel]) {
    const target = heirMappings[subRel];
    const match = survivingHeirs.find(
      (h) =>
        !alreadyMatchedIds.has(h.id) &&
        (h.id === target ||
          h.uniqueKey === target ||
          h.relationshipType === target ||
          h.relationshipInCurrent === target),
    );
    if (match) return match;
  }

  for (const heir of survivingHeirs) {
    if (alreadyMatchedIds.has(heir.id)) continue;
    const p1Rel = heir.relationshipType;

    // A. Direct same relationship type (e.g. when deceased is a spouse and children are common, or when siblings share parents)
    if (subRel === p1Rel) {
      if (["WIFE", "HUSBAND"].includes(deceasedHeirType) && ["SON", "DAUGHTER"].includes(subRel)) {
        return heir;
      }
      if (
        ["FULL_BROTHER", "PATERNAL_BROTHER", "MATERNAL_BROTHER", "FULL_SISTER", "PATERNAL_SISTER", "MATERNAL_SISTER"].includes(deceasedHeirType) &&
        ["FULL_BROTHER", "PATERNAL_BROTHER", "MATERNAL_BROTHER", "FULL_SISTER", "PATERNAL_SISTER", "MATERNAL_SISTER", "MOTHER", "FATHER"].includes(subRel)
      ) {
        return heir;
      }
    }

    // B. Deceased was a SON
    if (deceasedHeirType === "SON") {
      if (
        ["FULL_SISTER", "PATERNAL_SISTER", "SISTER"].includes(subRel) &&
        p1Rel === "DAUGHTER"
      ) {
        return heir;
      }
      if (
        ["FULL_BROTHER", "PATERNAL_BROTHER", "BROTHER"].includes(subRel) &&
        p1Rel === "SON"
      ) {
        return heir;
      }
      if (subRel === "MOTHER" && p1Rel === "WIFE") {
        return heir;
      }
      if (subRel === "FATHER" && p1Rel === "HUSBAND") {
        return heir;
      }
      if ((subRel === "GRANDFATHER" || subRel === "PATERNAL_GRANDFATHER") && p1Rel === "FATHER") {
        return heir;
      }
      if (
        ["PATERNAL_GRANDMOTHER", "MATERNAL_GRANDMOTHER"].includes(subRel) &&
        p1Rel === "MOTHER"
      ) {
        return heir;
      }
      // Nephew of deceased son is son of his deceased brother (i.e. Grandson from P1 or mandatory bequest beneficiary)
      if (
        [
          "NEPHEW_FULL",
          "FULL_NEPHEW",
          "NEPHEW_PATERNAL",
          "PATERNAL_NEPHEW",
        ].includes(subRel) &&
        (p1Rel === "GRANDSON" || p1Rel?.includes("grandson"))
      ) {
        return heir;
      }
    }
    // C. Deceased was a DAUGHTER
    else if (deceasedHeirType === "DAUGHTER") {
      if (
        ["FULL_BROTHER", "PATERNAL_BROTHER", "BROTHER"].includes(subRel) &&
        p1Rel === "SON"
      ) {
        return heir;
      }
      if (
        ["FULL_SISTER", "PATERNAL_SISTER", "SISTER"].includes(subRel) &&
        p1Rel === "DAUGHTER"
      ) {
        return heir;
      }
      if (subRel === "MOTHER" && p1Rel === "WIFE") {
        return heir;
      }
      if (subRel === "FATHER" && p1Rel === "HUSBAND") {
        return heir;
      }
      if ((subRel === "GRANDFATHER" || subRel === "PATERNAL_GRANDFATHER") && p1Rel === "FATHER") {
        return heir;
      }
      if (
        ["PATERNAL_GRANDMOTHER", "MATERNAL_GRANDMOTHER"].includes(subRel) &&
        p1Rel === "MOTHER"
      ) {
        return heir;
      }
      if (
        [
          "NEPHEW_FULL",
          "FULL_NEPHEW",
          "NEPHEW_PATERNAL",
          "PATERNAL_NEPHEW",
        ].includes(subRel) &&
        (p1Rel === "GRANDSON" || p1Rel?.includes("grandson"))
      ) {
        return heir;
      }
    }
    // D. Deceased was a BROTHER
    else if (
      ["FULL_BROTHER", "PATERNAL_BROTHER", "BROTHER"].includes(
        deceasedHeirType,
      )
    ) {
      if (
        ["FULL_BROTHER", "PATERNAL_BROTHER", "BROTHER"].includes(subRel) &&
        ["FULL_BROTHER", "PATERNAL_BROTHER", "BROTHER"].includes(p1Rel)
      ) {
        return heir;
      }
      if (
        ["FULL_SISTER", "PATERNAL_SISTER", "SISTER"].includes(subRel) &&
        ["FULL_SISTER", "PATERNAL_SISTER", "SISTER"].includes(p1Rel)
      ) {
        return heir;
      }
      if (subRel === "MOTHER" && p1Rel === "MOTHER") {
        return heir;
      }
      if (subRel === "FATHER" && p1Rel === "FATHER") {
        return heir;
      }
      if (
        [
          "NEPHEW_FULL",
          "FULL_NEPHEW",
          "NEPHEW_PATERNAL",
          "PATERNAL_NEPHEW",
        ].includes(subRel) &&
        (p1Rel === "GRANDSON" || p1Rel?.includes("grandson"))
      ) {
        return heir;
      }
    }
    // E. Deceased was a SISTER
    else if (
      ["FULL_SISTER", "PATERNAL_SISTER", "SISTER"].includes(deceasedHeirType)
    ) {
      if (
        ["FULL_BROTHER", "PATERNAL_BROTHER", "BROTHER"].includes(subRel) &&
        ["FULL_BROTHER", "PATERNAL_BROTHER", "BROTHER"].includes(p1Rel)
      ) {
        return heir;
      }
      if (
        ["FULL_SISTER", "PATERNAL_SISTER", "SISTER"].includes(subRel) &&
        ["FULL_SISTER", "PATERNAL_SISTER", "SISTER"].includes(p1Rel)
      ) {
        return heir;
      }
      if (subRel === "MOTHER" && p1Rel === "MOTHER") {
        return heir;
      }
      if (subRel === "FATHER" && p1Rel === "FATHER") {
        return heir;
      }
    }
    // F. Deceased was WIFE
    else if (deceasedHeirType === "WIFE") {
      if (subRel === "SON" && p1Rel === "SON") return heir;
      if (subRel === "DAUGHTER" && p1Rel === "DAUGHTER") return heir;
      if (subRel === "HUSBAND" && p1Rel === "HUSBAND") return heir;
    }
    // G. Deceased was HUSBAND
    else if (deceasedHeirType === "HUSBAND") {
      if (subRel === "SON" && p1Rel === "SON") return heir;
      if (subRel === "DAUGHTER" && p1Rel === "DAUGHTER") return heir;
      if (subRel === "WIFE" && p1Rel === "WIFE") return heir;
    }
    // H. Deceased was GRANDSON (e.g. mandatory bequest beneficiary subsequently dies)
    else if (
      deceasedHeirType === "GRANDSON" ||
      deceasedHeirType?.includes("grandson")
    ) {
      if (
        ["UNCLE_FULL", "FULL_UNCLE", "PATERNAL_UNCLE"].includes(subRel) &&
        p1Rel === "SON"
      ) {
        return heir;
      }
      if (
        ["PATERNAL_GRANDMOTHER", "GRANDMOTHER"].includes(subRel) &&
        p1Rel === "WIFE"
      ) {
        return heir;
      }
      if (
        ["FULL_BROTHER", "BROTHER"].includes(subRel) &&
        (p1Rel === "GRANDSON" || p1Rel?.includes("grandson"))
      ) {
        return heir;
      }
      if (
        ["FULL_SISTER", "SISTER"].includes(subRel) &&
        (p1Rel === "GRANDDAUGHTER" || p1Rel?.includes("granddaughter"))
      ) {
        return heir;
      }
    }
  }
  return null;
}

/**
 * Deduces a surviving heir's relationship to the newly deceased heir.
 */
function getDerivedSubRelationship(livingRelType, deceasedRelType) {
  // 1. If deceased is a FULL_BROTHER or FULL_SISTER
  if (
    ["FULL_BROTHER", "FULL_SISTER", "BROTHER", "SISTER"].includes(
      deceasedRelType,
    )
  ) {
    if (livingRelType === "MOTHER") return "MOTHER";
    if (livingRelType === "FATHER") return "FATHER";
    if (["FULL_BROTHER", "BROTHER"].includes(livingRelType))
      return "FULL_BROTHER";
    if (["FULL_SISTER", "SISTER"].includes(livingRelType))
      return "FULL_SISTER";
    if (livingRelType === "PATERNAL_BROTHER") return "PATERNAL_BROTHER";
    if (livingRelType === "PATERNAL_SISTER") return "PATERNAL_SISTER";
    if (livingRelType === "MATERNAL_BROTHER") return "MATERNAL_BROTHER";
    if (livingRelType === "MATERNAL_SISTER") return "MATERNAL_SISTER";
    if (
      ["PATERNAL_GRANDMOTHER", "MATERNAL_GRANDMOTHER"].includes(livingRelType)
    )
      return livingRelType;
    if (livingRelType === "PATERNAL_GRANDFATHER")
      return "PATERNAL_GRANDFATHER";
  }

  // 2. If deceased is a SON or DAUGHTER
  if (["SON", "DAUGHTER"].includes(deceasedRelType)) {
    if (livingRelType === "WIFE") return "MOTHER";
    if (livingRelType === "HUSBAND") return "FATHER";
    if (livingRelType === "SON") return "FULL_BROTHER";
    if (livingRelType === "DAUGHTER") return "FULL_SISTER";
    if (livingRelType === "MOTHER") return "PATERNAL_GRANDMOTHER";
    if (livingRelType === "FATHER") return "PATERNAL_GRANDFATHER";
    if (livingRelType === "GRANDSON" || livingRelType?.includes("grandson"))
      return "NEPHEW_FULL";
  }

  // 3. If deceased is WIFE or HUSBAND
  if (["WIFE", "HUSBAND"].includes(deceasedRelType)) {
    if (livingRelType === "SON") return "SON";
    if (livingRelType === "DAUGHTER") return "DAUGHTER";
  }

  // 4. If deceased is a GRANDSON
  if (deceasedRelType === "GRANDSON" || deceasedRelType?.includes("grandson")) {
    if (livingRelType === "WIFE") return "PATERNAL_GRANDMOTHER";
    if (livingRelType === "SON") return "UNCLE_FULL";
    if (livingRelType === "GRANDSON" || livingRelType?.includes("grandson"))
      return "FULL_BROTHER";
    if (
      livingRelType === "GRANDDAUGHTER" ||
      livingRelType?.includes("granddaughter")
    )
      return "FULL_SISTER";
  }

  return null;
}


/**
 * Calculates a complete Munasakhat case across multiple consecutive deaths.
 *
 * @param {Object} params
 * @param {Function} params.CalculatorClass - InheritanceCalculator class reference.
 * @param {Object} params.baseCaseData - Input data for original deceased (Estate #1).
 * @param {Array} params.munasakhatCases - Array of subsequent deceased heir configurations.
 * @returns {Object} Comprehensive Munāsakhāt calculation result model.
 */
export function calculateMunasakhatCase({
  CalculatorClass,
  baseCaseData,
  munasakhatCases = [],
}) {
  // 1. Calculate Estate #1 (مسألة الميت الأول)
  const calc1 = new CalculatorClass({
    ...baseCaseData,
    hasMunasakhat: false,
    hasMissingPerson: false,
  });
  const result1 = calc1.calculate();

  const debtsVal =
    Array.isArray(baseCaseData.debtsList) && baseCaseData.debtsList.length > 0
      ? baseCaseData.debtsList.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
      : Array.isArray(baseCaseData.debts)
        ? baseCaseData.debts.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
        : (parseFloat(baseCaseData.debts) || 0);

  const netEstate =
    result1?.original_net_estate !== undefined
      ? result1.original_net_estate
      : result1?.net_estate !== undefined
        ? result1.net_estate
        : Math.max(
            0,
            (parseFloat(baseCaseData.total_estate_value) || 0) -
              (parseFloat(baseCaseData.funeral_expenses) || 0) -
              debtsVal,
          );

  if (!munasakhatCases || munasakhatCases.length === 0) {
    return result1;
  }

  // Extract base of Problem 1 and accurate integer shares
  const p1Data = getProblemBaseAndShares(result1.distributions);
  let currentBase = p1Data.base;
  let currentDistributions = p1Data.items;

  const p1IsMandatory = Boolean(
    result1.mandatory_bequest_steps && result1.mandatory_bequest_steps.length > 0,
  );
  const p1Steps = p1IsMandatory
    ? result1.mandatory_bequest_steps
    : result1.steps || result1.standard_steps || [];

  // Track the history of steps / sub-problems
  const problemSteps = [
    {
      stepIndex: 1,
      title: `المسألة الأولى (تركة ${baseCaseData.name || "المتوفى الأول"})${p1IsMandatory ? " [مشتملة على وصية واجبة]" : ""}`,
      deceasedName: baseCaseData.name || "المتوفى الأول",
      deceasedGender: baseCaseData.gender || "male",
      base: currentBase,
      baseProblem: currentBase,
      distributions: expandDistributionsPerIndividual(currentDistributions),
      rawDistributions: currentDistributions,
      steps: p1Steps,
      isMandatory: p1IsMandatory,
      netEstate: netEstate,
      result: result1,
    },
  ];

  // Unified list of living heirs and their accumulated shares in the current الجامعة
  let unifiedHeirs = [];

  // Initialize unified heirs from Problem 1
  for (const d of currentDistributions) {
    if (d.shares_allocated <= 0 && d.total_value <= 0) continue;
    const numIndividuals = Math.max(1, parseInt(d.count, 10) || 1);
    const sharePerIndividual = d.share_per_individual;
    const valuePerIndividual =
      d.per_person_value ??
      (d.total_value
        ? d.total_value / numIndividuals
        : ((sharePerIndividual || 0) / currentBase) * netEstate);
    const isWill = Boolean(
      d.relationship?.startsWith("WILL_") ||
      d.why?.includes("الوصية الشرعية") ||
      d.share_type?.includes("وصية")
    );
    const isMandatory = Boolean(
      d.is_mandatory ||
      d.relationship?.startsWith("MANDATORY_WILL") ||
      d.why?.includes("الوصية الواجبة")
    );
    const p1Category = isMandatory
      ? "وصية واجبة"
      : isWill
        ? "وصية اختيارية"
        : "إرث";

    for (let idx = 1; idx <= numIndividuals; idx++) {
      const heirId = numIndividuals > 1 ? `${d.relationship}_${idx}` : d.relationship;
      const heirName = numIndividuals > 1
        ? `${d.relationship_display || HEIR_NAMES_AR[d.relationship] || d.relationship} #${idx}`
        : (d.relationship_display || HEIR_NAMES_AR[d.relationship] || d.relationship);

      unifiedHeirs.push({
        id: heirId,
        uniqueKey: `P1_${heirId}`,
        name: heirName,
        relationshipInP1: d.relationship_display || HEIR_NAMES_AR[d.relationship] || d.relationship,
        relationshipInCurrent: d.relationship_display || HEIR_NAMES_AR[d.relationship] || d.relationship,
        relationshipDetails: [
          {
            problemIndex: 1,
            relationship: d.relationship_display || HEIR_NAMES_AR[d.relationship] || d.relationship,
            shareInProblem: sharePerIndividual,
            problemBase: currentBase,
            isMandatoryBequest: isMandatory,
            category: p1Category,
          },
        ],
        shares: sharePerIndividual,
        sharesHistory: { 1: sharePerIndividual },
        subProblemShare: sharePerIndividual,
        cashValue: valuePerIndividual,
        isDeceased: false,
        originProblem: 1,
        individualIndex: idx,
        relationshipType: d.relationship,
        isMandatoryBequest: isMandatory,
        category: p1Category,
      });
    }
  }

  // 2. Process each subsequent deceased heir iteratively (المسألة الثانية، الثالثة، ...)
  let currentJameahBase = currentBase;

  for (let mIdx = 0; mIdx < munasakhatCases.length; mIdx++) {
    const mCase = munasakhatCases[mIdx];
    const problemNumber = mIdx + 2;

    // Find the deceased heir in the unifiedHeirs list
    let targetHeir = null;
    if (mCase.deceasedHeirId) {
      const cleanId = mCase.deceasedHeirId;
      targetHeir = unifiedHeirs.find(
        (h) =>
          !h.isDeceased &&
          (h.id === cleanId ||
            h.uniqueKey === cleanId ||
            (cleanId.startsWith("P1_") && h.id === cleanId.replace("P1_", "")) ||
            (!cleanId.startsWith("P") && h.uniqueKey === `P1_${cleanId}`))
      );
    }
    if (!targetHeir && mCase.deceasedHeirType) {
      targetHeir = unifiedHeirs.find(
        (h) => !h.isDeceased && h.relationshipType === mCase.deceasedHeirType
      );
    }
    if (!targetHeir) {
      targetHeir = unifiedHeirs.find((h) => !h.isDeceased);
    }

    if (!targetHeir) continue;

    // Mark as deceased in current pool
    targetHeir.isDeceased = true;
    targetHeir.deceasedInProblem = problemNumber;
    targetHeir.sharesAtDeath = targetHeir.shares;
    targetHeir.sharesProblemBase = currentJameahBase;
    targetHeir.sharesHistory = targetHeir.sharesHistory || {};
    targetHeir.sharesHistory[problemNumber] = "مات";

    const deceasedHeirName = mCase.name || targetHeir.name;
    const MALE_HEIR_TYPES = [
      "SON", "FATHER", "GRANDSON", "GREAT_GRANDSON",
      "BROTHER", "FULL_BROTHER", "PATERNAL_BROTHER", "MATERNAL_BROTHER",
      "HUSBAND", "GRANDFATHER", "PATERNAL_GRANDFATHER", "PATERNAL_GREAT_GRANDFATHER",
      "NEPHEW_FULL", "FULL_NEPHEW", "NEPHEW_PATERNAL", "PATERNAL_NEPHEW",
      "GREAT_NEPHEW_FULL", "GREAT_NEPHEW_PATERNAL",
      "UNCLE_FULL", "FULL_UNCLE", "PATERNAL_UNCLE", "FULL_PATERNAL_UNCLE",
      "UNCLE_PATERNAL", "PATERNAL_UNCLE_PATERNAL",
      "COUSIN_FULL", "FULL_COUSIN", "COUSIN_PATERNAL", "PATERNAL_COUSIN",
      "GREAT_COUSIN_FULL", "GREAT_COUSIN_PATERNAL",
      "FATHER_UNCLE_FULL", "FATHER_UNCLE_PATERNAL",
      "FATHER_COUSIN_FULL", "FATHER_COUSIN_PATERNAL",
    ];
    const deceasedHeirGender =
      mCase.gender ||
      (MALE_HEIR_TYPES.includes(targetHeir.relationshipType)
        ? "male"
        : "female");

    // Deceased heir's share in the current الجامعة
    const deceasedShares = targetHeir.shares;

    const REL_ALIASES = {
      PATERNAL_UNCLE: "UNCLE_FULL",
      FULL_UNCLE: "UNCLE_FULL",
      FULL_PATERNAL_UNCLE: "UNCLE_FULL",
      PATERNAL_UNCLE_PATERNAL: "UNCLE_PATERNAL",
      FULL_NEPHEW: "NEPHEW_FULL",
      PATERNAL_NEPHEW: "NEPHEW_PATERNAL",
      FULL_COUSIN: "COUSIN_FULL",
      PATERNAL_COUSIN: "COUSIN_PATERNAL",
      GRANDFATHER: "PATERNAL_GRANDFATHER",
    };

    // Build the sub-problem input for deceased heir
    const subHeirsInput = Object.entries(mCase.heirs || {})
      .filter(([_, count]) => count > 0)
      .map(([relationship, count]) => ({
        relationship: REL_ALIASES[relationship] || relationship,
        count,
      }));

    // Auto-include surviving relatives from previous steps who inherit from the deceased under Sharia only when explicitly requested
    if (mCase.autoDeriveRelatives === true) {
      const livingHeirs = unifiedHeirs.filter((h) => !h.isDeceased);
      const providedRelTypes = new Set(subHeirsInput.map((sh) => sh.relationship));

      const derivedCounts = {};
      for (const lh of livingHeirs) {
        // Collateral relatives (brothers/sisters) can ONLY be derived if sharing the same originProblem
        if (lh.originProblem && targetHeir.originProblem && lh.originProblem !== targetHeir.originProblem) {
          const isAscendant = ["FATHER", "MOTHER"].includes(lh.relationshipType);
          if (!isAscendant) continue;
        }

        const derivedRel = getDerivedSubRelationship(
          lh.relationshipType,
          targetHeir.relationshipType,
        );
        if (derivedRel) {
          derivedCounts[derivedRel] = (derivedCounts[derivedRel] || 0) + 1;
        }
      }

      for (const [rel, count] of Object.entries(derivedCounts)) {
        if (!providedRelTypes.has(rel) && count > 0) {
          subHeirsInput.push({
            relationship: rel,
            count,
          });
        }
      }
    }

    if (subHeirsInput.length === 0) {
      continue;
    }

    const deceasedGrossEstate =
      targetHeir.cashValue !== undefined
        ? targetHeir.cashValue
        : netEstate * (deceasedShares / currentJameahBase);

    const mDebts =
      Array.isArray(mCase.debtsList) && mCase.debtsList.length > 0
        ? mCase.debtsList.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
        : Array.isArray(mCase.debts) && mCase.debts.length > 0
          ? mCase.debts.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
          : parseFloat(mCase.debts) || 0;

    // Calculate sub-problem (مسألة الميت الثاني)
    const subCalc = new CalculatorClass({
      name: deceasedHeirName,
      gender: deceasedHeirGender,
      total_estate_value: deceasedGrossEstate,
      debts:
        Array.isArray(mCase.debtsList) && mCase.debtsList.length > 0
          ? mCase.debtsList
          : mDebts,
      funeral_expenses: mCase.funeral_expenses || 0,
      heirs: subHeirsInput,
      wills: mCase.wills || [],
      mandatoryBequests: mCase.mandatoryBequests || [],
      hasMunasakhat: false,
      hasMissingPerson: false,
    });
    const subResult = subCalc.calculate();

    // Extract exact subBase and integer shares for sub-problem
    const subData = getProblemBaseAndShares(subResult.distributions);
    const subBase = subData.base;
    const step2 = subResult.standard_steps?.find((s) => s.id === "std_step2");
    const step2Base = step2?.table?.[0]?.share?.includes("/")
      ? parseInt(step2.table[0].share.split("/")[1], 10)
      : null;
    const subBaseOrigin = step2Base || subData.baseOrigin || subResult.baseOrigin || subResult.awlBase || subBase;
    const hasInkisarInSub = Boolean(subBaseOrigin && subBase > subBaseOrigin);
    const tasheehMultInSub = hasInkisarInSub ? Math.round(subBase / subBaseOrigin) : 1;

    // Attach initial shares in subBaseOrigin for each distribution item
    const subDistributions = subData.items.map((item) => {
      let originShare = item.shares_allocated;
      const isItemAsabah =
        item.share_type === "عصبة" ||
        item.why?.includes("عصبة") ||
        item.why?.includes("تعصيب");

      if (hasInkisarInSub && tasheehMultInSub > 1) {
        if (isItemAsabah) {
          const sumFixed = (subResult.distributions || [])
            .filter(
              (d) =>
                d.share_type !== "عصبة" &&
                !d.why?.includes("عصبة") &&
                !d.why?.includes("تعصيب"),
            )
            .reduce((acc, d) => {
              const frac = parseFraction(d.share_fraction);
              return acc + (frac.d > 0 ? Math.round(frac.n * (subBaseOrigin / frac.d)) : 0);
            }, 0);
          originShare = Math.max(0, subBaseOrigin - sumFixed);
        } else {
          const frac = parseFraction(item.share_fraction);
          originShare = frac.d > 0 ? Math.round(frac.n * (subBaseOrigin / frac.d)) : Math.round(item.shares_allocated / tasheehMultInSub);
        }
      }
      return {
        ...item,
        share_type: isItemAsabah ? "عصبة" : item.share_type || "فرض",
        originShare,
      };
    });

    // Arithmetic relationship between deceasedShares (سهم الميت) and subBase (أصل مسألته)
    const g = gcd(deceasedShares, subBase);
    const juzuSahmPrevious = subBase / g; // جزء سهم المسألة السابقة
    const juzuSahmSub = deceasedShares / g; // جزء سهم المسألة الحالية

    const relationType =
      deceasedShares === subBase
        ? "تماثل"
        : subBase % deceasedShares === 0 || deceasedShares % subBase === 0
          ? "تداخل"
          : g > 1
            ? "توافق"
            : "تباين";

    // New الجامعة base
    const nextJameahBase = currentJameahBase * juzuSahmPrevious;

    // Scale existing surviving heirs' shares
    for (const h of unifiedHeirs) {
      if (!h.isDeceased) {
        h.shares = h.shares * juzuSahmPrevious;
        h.sharesHistory = h.sharesHistory || {};
        h.sharesHistory[problemNumber] = h.shares;
      }
    }

    // Add / distribute sub-problem heirs' shares
    const matchedIdsInProblem = new Set();
    for (const d of subDistributions) {
      if (d.shares_allocated <= 0 && d.total_value <= 0) continue;
      const numIndividuals = Math.max(1, parseInt(d.count, 10) || 1);
      const sharePerIndividual = d.share_per_individual;
      const valuePerIndividual =
        d.per_person_value ??
        (d.total_value ? d.total_value / numIndividuals : 0);

      for (let idx = 1; idx <= numIndividuals; idx++) {
        const subSharesInJameah = sharePerIndividual * juzuSahmSub;
        const rawSubRelLabel =
          d.relationship_display ||
          HEIR_NAMES_AR[d.relationship] ||
          d.relationship;
        const subRelLabel = (rawSubRelLabel || "")
          .replace(/^(WILL_|MANDATORY_WILL_)/, "")
          .trim();

        const livingSurviving = unifiedHeirs.filter((h) => !h.isDeceased);
        const matchedHeir = findMatchingLivingHeir(
          d.relationship,
          targetHeir.relationshipType,
          livingSurviving,
          matchedIdsInProblem,
          mCase.heirMappings || {},
        );

        const isWillInSub = Boolean(
          d.relationship?.startsWith("WILL_") ||
          d.why?.includes("الوصية الشرعية") ||
          d.share_type?.includes("وصية")
        );
        const isMandatoryInSub = Boolean(
          d.is_mandatory ||
          d.relationship?.startsWith("MANDATORY_WILL") ||
          d.why?.includes("الوصية الواجبة")
        );
        const subCategory = isMandatoryInSub
          ? "وصية واجبة"
          : isWillInSub
            ? "وصية اختيارية"
            : "إرث";

        if (matchedHeir) {
          matchedIdsInProblem.add(matchedHeir.id);
          matchedHeir.shares += subSharesInJameah;
          matchedHeir.cashValue = (matchedHeir.cashValue || 0) + valuePerIndividual;
          matchedHeir.sharesHistory = matchedHeir.sharesHistory || {};
          matchedHeir.sharesHistory[problemNumber] = matchedHeir.shares;
          matchedHeir.relationshipDetails.push({
            problemIndex: problemNumber,
            relationship: subRelLabel,
            fromDeceased: deceasedHeirName,
            shareInProblem: sharePerIndividual,
            problemBase: subBase,
            isMandatoryBequest: isMandatoryInSub,
            category: subCategory,
          });
        } else {
          const subName = isWillInSub
            ? (numIndividuals > 1 ? `${subRelLabel} #${idx}` : subRelLabel)
            : (numIndividuals > 1 ? `${subRelLabel} #${idx} (من ${deceasedHeirName})` : `${subRelLabel} (من ${deceasedHeirName})`);
          const newHeirEntry = {
            id: `P${problemNumber}_${d.relationship}_${idx}`,
            uniqueKey: `P${problemNumber}_${d.relationship}_${idx}`,
            name: subName,
            relationshipInP1: "—",
            relationshipInCurrent: subRelLabel,
            relationshipDetails: [
              {
                problemIndex: problemNumber,
                relationship: subRelLabel,
                fromDeceased: deceasedHeirName,
                shareInProblem: sharePerIndividual,
                problemBase: subBase,
                isMandatoryBequest: isMandatoryInSub,
                category: subCategory,
              },
            ],
            shares: subSharesInJameah,
            cashValue: valuePerIndividual,
            sharesHistory: { [problemNumber]: subSharesInJameah },
            subProblemShare: sharePerIndividual,
            isDeceased: false,
            originProblem: problemNumber,
            individualIndex: idx,
            relationshipType: d.relationship,
            isMandatoryBequest: isMandatoryInSub,
            category: subCategory,
          };
          unifiedHeirs.push(newHeirEntry);
        }
      }
    }

    let explanationText = "";
    if (relationType === "تماثل") {
      explanationText = `تماثلت سهام المتوفى (${deceasedShares}) مع أصل فريضته (${subBase}). والقاعدة عند الفرضيين بالمغرب: عند التماثل نكتفي بأحدهما؛ فيكون جزء سهم الفريضة السابقة (1)، وجزء سهم فريضة المتوفى (1)، ويبقى أصل الفريضة الجامعة (${nextJameahBase}) بحاله دون ضرب.\n\n📌 خلاصة للحفظ: تماثل ← نكتفي بأحدهما ويبقى أصل الجامعة السابق كما هو.`;
    } else if (relationType === "تداخل") {
      explanationText = `تداخلت سهام المتوفى (${deceasedShares}) مع أصل فريضته (${subBase}) لأن أحدهما يقسم الآخر بغير باقٍ. جزء سهم الفريضة السابقة هو (${juzuSahmPrevious})، وجزء سهم فريضة المتوفى هو (${juzuSahmSub})، وأصل الفريضة الجامعة الجديد هو (${nextJameahBase}).\n\n📌 خلاصة للحفظ: تداخل ← نأخذ الأكبر أو وفق التداخل ونضربه في أصل المسألة السابقة.`;
    } else if (relationType === "توافق") {
      explanationText = `توافقت سهام المتوفى (${deceasedShares}) مع أصل فريضته (${subBase}) بالقاسم المشترك الأكبر (${g})، فيكون الوفق هو (${subBase / g}). والقاعدة عند الفرضيين بالمغرب: نضرب وفق أصل فريضة المتوفى (${juzuSahmPrevious}) في كامل أصل الفريضة السابقة (${currentJameahBase})، فينتج أصل الفريضة الجامعة (${nextJameahBase}). وجزء سهم الفريضة السابقة هو (${juzuSahmPrevious})، بينما جزء سهم فريضة المتوفى هو (${juzuSahmSub}).\n\n📌 خلاصة للحفظ: توافق ← أصل الجامعة = أصل الفريضة السابقة × وفق أصل فريضة المتوفى.`;
    } else {
      explanationText = `تباينت سهام المتوفى (${deceasedShares}) مع أصل فريضته (${subBase}) لعدم وجود قاسم مشترك بينهما سوى الواحد. والقاعدة عند الفرضيين بالمغرب: عند التباين نضرب كامل أصل فريضة المتوفى (${subBase}) في أصل الفريضة السابقة (${currentJameahBase})، فينتج أصل الفريضة الجامعة (${nextJameahBase}). وجزء سهم الفريضة السابقة هو (${juzuSahmPrevious})، وجزء سهم فريضة المتوفى هو (${juzuSahmSub}).\n\n📌 خلاصة للحفظ: تباين ← أصل الجامعة = أصل الفريضة السابقة × كامل أصل فريضة المتوفى.`;
    }

    // Record this problem step
    problemSteps.push({
      stepIndex: problemNumber,
      title: `المسألة ${problemNumber === 2 ? "الثانية" : problemNumber === 3 ? "الثالثة" : `رقم ${problemNumber}`} (تركة ${deceasedHeirName})`,
      deceasedName: deceasedHeirName,
      deceasedGender: deceasedHeirGender,
      deceasedShareFromPrevious: deceasedShares,
      base: subBase,
      baseProblem: subBase,
      baseOrigin: subBaseOrigin,
      hasInkisar: hasInkisarInSub,
      tasheehMultiplier: tasheehMultInSub,
      gcd: g,
      relationType: relationType,
      juzuSahmPrevious: juzuSahmPrevious,
      juzuSahmCurrent: juzuSahmSub,
      jameahBase: nextJameahBase,
      explanationText,
      distributions: expandDistributionsPerIndividual(subDistributions),
      rawDistributions: subDistributions,
      steps:
        subResult.mandatory_bequest_steps && subResult.mandatory_bequest_steps.length > 0
          ? subResult.mandatory_bequest_steps
          : subResult.steps || subResult.standard_steps || [],
      isMandatory: Boolean(
        subResult.mandatory_bequest_steps && subResult.mandatory_bequest_steps.length > 0,
      ),
      netEstate:
        subResult.net_estate ??
        Math.max(
          0,
          deceasedGrossEstate -
            mDebts -
            (parseFloat(mCase.funeral_expenses) || 0),
        ),
      result: subResult,
    });

    currentJameahBase = nextJameahBase;
  }

  // 3. Final Consolidated Distributions (جدول الجامعة النهائي)
  const survivingHeirs = unifiedHeirs.filter((h) => !h.isDeceased && h.shares > 0);
  const finalBase = currentJameahBase;

  const finalDistributions = survivingHeirs.map((h, i) => {
    const cashValue =
      h.cashValue !== undefined
        ? h.cashValue
        : (h.shares / finalBase) * netEstate;
    const percentage =
      netEstate > 0
        ? (cashValue / netEstate) * 100
        : (h.shares / finalBase) * 100;
    const gFinal = gcd(Math.round(h.shares), finalBase);
    const redN = Math.round(h.shares) / gFinal;
    const redD = finalBase / gFinal;

    const hasInheritance = h.relationshipDetails.some(
      (rd) => !rd.isMandatoryBequest && rd.category !== "وصية واجبة",
    );
    const hasMandatory = h.relationshipDetails.some(
      (rd) => rd.isMandatoryBequest || rd.category === "وصية واجبة",
    );
    let category = "إرث";
    if (hasMandatory && !hasInheritance) {
      category = "وصية واجبة";
    } else if (hasMandatory && hasInheritance) {
      category = "إرث + وصية واجبة";
    }

    return {
      index: i + 1,
      id: h.id,
      name: h.name,
      relationship: h.relationshipType,
      relationship_display: h.name,
      count: 1,
      shares_allocated: Math.round(h.shares),
      fraction: `${Math.round(h.shares)}/${finalBase}`,
      fraction_reduced: `${redN}/${redD}`,
      fraction_object: { n: redN, d: redD },
      share_fraction: `${Math.round(h.shares)}/${finalBase}`,
      individual_share_fraction: `${Math.round(h.shares)}/${finalBase}`,
      percentage: Math.round(percentage * 1000) / 1000,
      percentage_formatted: `${(Math.round(percentage * 100) / 100).toFixed(2)}%`,
      per_person_value: cashValue,
      total_value: cashValue,
      formatted_value: formatCurrency(cashValue),
      is_mandatory_bequest: hasMandatory,
      category: category,
      relationshipDetails: h.relationshipDetails,
      sharesHistory: h.sharesHistory || {},
      originProblem: h.originProblem || 1,
      subProblemShare: h.subProblemShare,
    };
  });

  const deceasedHeirsSummary = unifiedHeirs
    .filter((h) => h.isDeceased)
    .map((dh) => ({
      id: dh.id,
      name: dh.name,
      relationshipType: dh.relationshipType,
      individualIndex: dh.individualIndex,
      deceasedInProblem: dh.deceasedInProblem,
      inherited_shares: dh.sharesAtDeath ?? dh.shares,
      inherited_fraction: `${Math.round(dh.sharesAtDeath ?? dh.shares)}/${dh.sharesProblemBase || finalBase}`,
      relationshipDetails: dh.relationshipDetails,
      sharesHistory: dh.sharesHistory || {},
      originProblem: dh.originProblem || 1,
    }));

  const totalDistributedCash = finalDistributions.reduce(
    (sum, h) => sum + (h.total_value || 0),
    0,
  );

  return {
    ...result1,
    is_munasakhat: true,
    net_estate: netEstate,
    original_net_estate: netEstate,
    munasakhat_result: {
      net_estate: netEstate,
      original_net_estate: netEstate,
      estate: netEstate,
      total_estate: parseFloat(baseCaseData.total_estate_value) || 0,
      total_distributed_cash: totalDistributedCash,
      jameah_base: finalBase,
      problem_steps: problemSteps,
      final_distributions: finalDistributions,
      deceased_heirs: deceasedHeirsSummary,
      unified_heirs: unifiedHeirs,
      surviving_heirs_count: survivingHeirs.length,
      total_distributed_shares: survivingHeirs.reduce((sum, h) => sum + Math.round(h.shares), 0),
    },
  };
}
