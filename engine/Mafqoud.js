/**
 * @file Mafqoud.js
 * @description Engine module for computing evaluations of inheritance when one or more
 * Missing Persons (المفقود / المفقودين) are present.
 * Evaluates all combinations of living and deceased states (2^N تقادير) according to
 * Islamic jurisprudence and Articles 330 & 332 of the Moroccan Family Code (مدونة الأسرة المغربية).
 */

import Fraction, { lcm } from "../fraction.js";
import { HEIR_NAMES_AR } from "./Explanations.js";

/**
 * Helper to compute a canonical key for matching heirs between cases,
 * particularly for descendants from mandatory bequest branches who may be regular heirs
 * in one case and mandatory will beneficiaries in the other.
 */
function getCanonicalHeirKey(d) {
  if (!d || !d.relationship) return "";
  const rel = d.relationship;

  const mbMatch = rel.match(
    /^MANDATORY_WILL_(.+?)_(great_granddaughter|great_grandson|granddaughter|grandson)$/i,
  );
  if (mbMatch) {
    const branchId = mbMatch[1];
    const heirType = mbMatch[2].toUpperCase();
    return `BRANCH_${branchId}_${heirType}`;
  }

  const branchMatch = rel.match(
    /^(GREAT_GRANDDAUGHTER|GREAT_GRANDSON|GRANDDAUGHTER|GRANDSON)_(.+)$/i,
  );
  if (branchMatch) {
    const heirType = branchMatch[1].toUpperCase();
    const branchId = branchMatch[2];
    return `BRANCH_${branchId}_${heirType}`;
  }

  if (
    [
      "GRANDSON",
      "GRANDDAUGHTER",
      "GREAT_GRANDSON",
      "GREAT_GRANDDAUGHTER",
    ].includes(rel.toUpperCase())
  ) {
    const disp = d.relationship_display || "";
    const match = disp.match(/\(من\s+[^#]*#(\d+)\)/);
    if (match) {
      return `BRANCH_${match[1]}_${rel.toUpperCase()}`;
    }
  }

  return rel;
}

/**
 * Helper to compute the problem base (أصل المسألة / عول / مصح) for a sub-problem result.
 */
function extractProblemBase(subResult) {
  if (!subResult) return 1;
  let base = 1;

  for (const d of subResult.distributions || []) {
    if (d.is_blocked) continue;
    const fracStr = d.individual_share_fraction || d.share_fraction;
    if (fracStr && fracStr.includes("/")) {
      const parts = fracStr.split("/");
      const den = parseInt(parts[1], 10);
      if (den > 1) {
        base = lcm(base, den);
      }
    }
  }

  const step2 = subResult.standard_steps?.find((s) => s.id === "std_step2");
  const step3 = subResult.standard_steps?.find((s) => s.id === "std_step3");

  if (subResult.radd_result?.correctedBase) {
    base = Math.max(base, subResult.radd_result.correctedBase);
  } else if (subResult.radd_result?.initialOrigin) {
    base = Math.max(base, subResult.radd_result.initialOrigin);
  } else if (subResult.is_aul && subResult.aul_base) {
    base = Math.max(base, subResult.aul_base);
  } else if (step3?.table?.[0]?.share?.includes("/")) {
    base = Math.max(base, parseInt(step3.table[0].share.split("/")[1], 10) || 1);
  } else if (step2?.table?.[0]?.share?.includes("/")) {
    base = Math.max(base, parseInt(step2.table[0].share.split("/")[1], 10) || 1);
  }

  return base > 1 ? base : 1;
}

/**
 * Generates all combinations of alive counts for missing persons.
 */
function generateCombinations(types, countsMap) {
  const results = [];
  function helper(idx, current) {
    if (idx === types.length) {
      results.push({ ...current });
      return;
    }
    const type = types[idx];
    const maxCount = countsMap[type];
    for (let aliveCount = maxCount; aliveCount >= 0; aliveCount--) {
      current[type] = aliveCount;
      helper(idx + 1, current);
    }
  }
  helper(0, {});
  return results;
}

/**
 * Builds a descriptive Arabic label for each scenario.
 */
function getScenarioLabel(comb, types, countsMap) {
  if (types.length === 1) {
    const type = types[0];
    const maxCnt = countsMap[type];
    const aliveCnt = comb[type];
    const name = HEIR_NAMES_AR[type] || type;
    if (aliveCnt === maxCnt) {
      return maxCnt > 1
        ? `تقدير حياة المفقودين (${name} عدد ${maxCnt})`
        : `تقدير حياة المفقود (${name})`;
    }
    if (aliveCnt === 0) {
      return maxCnt > 1
        ? `تقدير وفاة المفقودين (${name} عدد ${maxCnt})`
        : `تقدير وفاة المفقود (${name})`;
    }
    return `تقدير حياة ${aliveCnt} ووفاة ${maxCnt - aliveCnt} من ${name}`;
  }

  const aliveList = [];
  const deadList = [];
  for (const t of types) {
    const aliveCnt = comb[t];
    const maxCnt = countsMap[t];
    const name = HEIR_NAMES_AR[t] || t;
    if (aliveCnt === maxCnt) {
      aliveList.push(maxCnt > 1 ? `${name} (${maxCnt})` : name);
    } else if (aliveCnt === 0) {
      deadList.push(maxCnt > 1 ? `${name} (${maxCnt})` : name);
    } else {
      aliveList.push(`${name} (${aliveCnt})`);
      deadList.push(`${name} (${maxCnt - aliveCnt})`);
    }
  }

  if (deadList.length === 0) {
    return "حياة المفقودين معاً";
  }
  if (aliveList.length === 0) {
    return "موتهما معاً";
  }
  return `حياة ${aliveList.join(" و")} وموت ${deadList.join(" و")}`;
}

/**
 * Calculates multi-scenario evaluation for missing person cases.
 *
 * @param {Object} params
 * @param {Function} params.CalculatorClass - InheritanceCalculator class reference.
 * @param {Object} params.caseData - Case input data containing missing person properties.
 * @returns {Object} Final formatted results with disbursed and reserved breakdowns.
 */
export function calculateMafqoudCase({ CalculatorClass, caseData }) {
  // Normalize missing persons list
  let missingList = [];
  if (
    Array.isArray(caseData.missingPersons) &&
    caseData.missingPersons.length > 0
  ) {
    missingList = caseData.missingPersons;
  } else {
    missingList = [
      {
        type: caseData.missingPersonType || "SON",
        count: parseInt(caseData.missingPersonCount, 10) || 1,
      },
    ];
  }

  // Map total missing count per relationship key
  const missingCountsMap = {};
  for (const item of missingList) {
    if (!item || !item.type) continue;
    const cnt = parseInt(item.count, 10) || 1;
    missingCountsMap[item.type] = (missingCountsMap[item.type] || 0) + cnt;
  }

  const missingTypes = Object.keys(missingCountsMap);
  const firstMissingType = missingTypes[0] || "SON";
  const firstMissingCount = missingCountsMap[firstMissingType] || 1;

  // Base heirs array containing all present and missing heirs
  const baseHeirs = [...(caseData.heirs || [])];
  for (const [mType, mCount] of Object.entries(missingCountsMap)) {
    if (!baseHeirs.some((h) => h.relationship === mType)) {
      baseHeirs.push({
        relationship: mType,
        count: mCount,
      });
    }
  }

  // Determine present (non-missing) counts
  const presentCountsMap = {};
  for (const h of baseHeirs) {
    const mCnt = missingCountsMap[h.relationship] || 0;
    const pCnt = Math.max(0, (h.count || 1) - mCnt);
    presentCountsMap[h.relationship] = pCnt;
  }

  // Generate all scenario combinations
  const combinations = generateCombinations(missingTypes, missingCountsMap);

  // Execute calculations for all scenarios
  const scenarios = [];
  for (let sIdx = 0; sIdx < combinations.length; sIdx++) {
    const comb = combinations[sIdx];
    const scenarioHeirs = baseHeirs
      .map((h) => {
        const rel = h.relationship;
        if (rel in missingCountsMap) {
          const pCnt = presentCountsMap[rel] || 0;
          const aCnt = comb[rel] || 0;
          return { ...h, count: pCnt + aCnt };
        }
        return { ...h };
      })
      .filter((h) => h.count > 0);

    const scenarioCalc = new CalculatorClass({
      ...caseData,
      heirs: scenarioHeirs,
      hasMissingPerson: false,
      missingPersons: [],
    });
    const scenarioResult = scenarioCalc.calculate();

    if (scenarioResult.error) {
      return scenarioResult;
    }

    const label = getScenarioLabel(comb, missingTypes, missingCountsMap);
    const base = extractProblemBase(scenarioResult);
    scenarios.push({
      id: `scenario_${sIdx}`,
      comb,
      label,
      result: scenarioResult,
      base,
      isAllAlive: sIdx === 0,
      isAllDead: sIdx === combinations.length - 1,
    });
  }

  const resultAlive = scenarios[0].result;
  const resultDead = scenarios[scenarios.length - 1].result;

  const netEstate =
    resultAlive.original_net_estate || caseData.total_estate_value;

  // Determine Jameah Base across all scenarios
  const jameahBase = scenarios.reduce((acc, s) => lcm(acc, s.base), 1);
  for (const s of scenarios) {
    s.multiplier = s.base > 0 ? Math.round(jameahBase / s.base) : 1;
  }

  // Collect all canonical keys preserving logical order
  const allKeys = [];
  for (const s of scenarios) {
    for (const d of s.result.distributions || []) {
      const k = getCanonicalHeirKey(d);
      if (!allKeys.includes(k)) allKeys.push(k);
    }
  }

  const mafqoudDistributions = [];
  let totalDisbursedCash = 0;

  // Determine first missing person relationship display name
  const firstMissingDist = resultAlive.distributions.find(
    (d) => d.relationship === firstMissingType,
  );
  let firstMissingDisplayName = firstMissingDist
    ? firstMissingDist.relationship_display
    : "المفقود";
  firstMissingDisplayName = firstMissingDisplayName.replace(/\s*\(\d+\)$/, "");

  for (const key of allKeys) {
    // Find distribution of this heir in each scenario
    const distPerScenario = scenarios.map(
      (s) =>
        s.result.distributions.find((d) => getCanonicalHeirKey(d) === key) ||
        null,
    );

    const baseItem = distPerScenario.find((d) => d !== null);
    if (!baseItem) continue;

    const rel =
      distPerScenario.find((d) => d && d.relationship in missingCountsMap)
        ?.relationship || baseItem.relationship;

    const isMissingRel = rel in missingCountsMap;

    if (isMissingRel) {
      const missingCount = missingCountsMap[rel];
      const presentCount = presentCountsMap[rel] || 0;

      // 1. Present non-missing portion of this relationship
      if (presentCount > 0) {
        let minIndShare = null;
        let maxIndShare = null;

        for (let sIdx = 0; sIdx < scenarios.length; sIdx++) {
          const d_s = distPerScenario[sIdx];
          const frac = d_s
            ? new Fraction(d_s.individual_share_fraction || "0")
            : new Fraction(0);
          if (minIndShare === null || frac.lessThan(minIndShare))
            minIndShare = frac;
          if (maxIndShare === null || frac.greaterThan(maxIndShare))
            maxIndShare = frac;
        }

        minIndShare = minIndShare || new Fraction(0);
        maxIndShare = maxIndShare || new Fraction(0);
        const diffIndShare = maxIndShare.sub(minIndShare);

        const indDisbursedVal = minIndShare.valueOf() * netEstate;
        const indReservedVal = diffIndShare.valueOf() * netEstate;
        const totalDisbursedVal = indDisbursedVal * presentCount;
        const totalReservedVal = indReservedVal * presentCount;

        const totalDisbursedFraction = minIndShare.mul(
          new Fraction(presentCount),
        );
        const totalReservedFraction = diffIndShare.mul(
          new Fraction(presentCount),
        );

        totalDisbursedCash += totalDisbursedVal;

        const disp =
          resultDead.distributions.find((d) => d.relationship === rel)
            ?.relationship_display ||
          resultAlive.distributions.find((d) => d.relationship === rel)
            ?.relationship_display ||
          baseItem.relationship_display;

        mafqoudDistributions.push({
          relationship: rel,
          relationship_display: disp,
          count: presentCount,
          is_mafqoud: false,
          individual_disbursed_fraction: minIndShare.toString(),
          individual_disbursed_percentage:
            Math.round(minIndShare.valueOf() * 10000) / 100,
          individual_disbursed_value: Math.round(indDisbursedVal * 100) / 100,

          total_disbursed_fraction: totalDisbursedFraction.toString(),
          total_disbursed_value: Math.round(totalDisbursedVal * 100) / 100,

          individual_reserved_fraction: diffIndShare.toString(),
          individual_reserved_percentage:
            Math.round(diffIndShare.valueOf() * 10000) / 100,
          individual_reserved_value: Math.round(indReservedVal * 100) / 100,

          total_reserved_fraction: totalReservedFraction.toString(),
          total_reserved_value: Math.round(totalReservedVal * 100) / 100,
          why: baseItem.why,
        });
      }

      // 2. Missing Person portion specifically
      let maxAliveIndShare = null;
      for (let sIdx = 0; sIdx < scenarios.length; sIdx++) {
        const s = scenarios[sIdx];
        if (s.comb[rel] > 0) {
          const d_s = distPerScenario[sIdx];
          const frac = d_s
            ? new Fraction(d_s.individual_share_fraction || "0")
            : new Fraction(0);
          if (maxAliveIndShare === null || frac.greaterThan(maxAliveIndShare)) {
            maxAliveIndShare = frac;
          }
        }
      }
      maxAliveIndShare = maxAliveIndShare || new Fraction(0);

      const missingTotalShareAlive = maxAliveIndShare.mul(
        new Fraction(missingCount),
      );
      const missingReservedVal = missingTotalShareAlive.valueOf() * netEstate;
      const missingIndReservedVal = maxAliveIndShare.valueOf() * netEstate;

      let rawName =
        baseItem.relationship_display || HEIR_NAMES_AR[rel] || "المفقود";
      rawName = rawName.replace(/\s*\(\d+\)$/, "").replace(/^ال/, "");
      const missingLabel = HEIR_NAMES_AR[rel]
        ? `المفقود (${HEIR_NAMES_AR[rel]})`
        : `المفقود (${rawName})`;

      mafqoudDistributions.push({
        relationship: `${rel}_MAFQOUD`,
        relationship_display: missingLabel,
        count: missingCount,
        is_mafqoud: true,
        individual_disbursed_fraction: "0",
        individual_disbursed_percentage: 0,
        individual_disbursed_value: 0,

        total_disbursed_fraction: "0",
        total_disbursed_value: 0,

        individual_reserved_fraction: maxAliveIndShare.toString(),
        individual_reserved_percentage:
          Math.round(maxAliveIndShare.valueOf() * 10000) / 100,
        individual_reserved_value:
          Math.round(missingIndReservedVal * 100) / 100,

        total_reserved_fraction: missingTotalShareAlive.toString(),
        total_reserved_value: Math.round(missingReservedVal * 100) / 100,
        why: `نصيب المفقود المفترض حياً وفق مدونة الأسرة المغربية (موقوف لحين تبين حاله).`,
      });

      continue;
    }

    // Standard heirs (not missing)
    const count = baseItem.count || 1;
    const numCount = parseInt(count, 10) || 1;

    let minIndShare = null;
    let maxIndShare = null;

    for (let sIdx = 0; sIdx < scenarios.length; sIdx++) {
      const d_s = distPerScenario[sIdx];
      const frac = d_s
        ? new Fraction(d_s.individual_share_fraction || "0")
        : new Fraction(0);
      if (minIndShare === null || frac.lessThan(minIndShare)) minIndShare = frac;
      if (maxIndShare === null || frac.greaterThan(maxIndShare)) maxIndShare = frac;
    }

    minIndShare = minIndShare || new Fraction(0);
    maxIndShare = maxIndShare || new Fraction(0);
    const diffIndShare = maxIndShare.sub(minIndShare);

    const indDisbursedVal = minIndShare.valueOf() * netEstate;
    const indReservedVal = diffIndShare.valueOf() * netEstate;

    const totalDisbursedVal = indDisbursedVal * numCount;
    const totalReservedVal = indReservedVal * numCount;

    const totalDisbursedFraction = minIndShare.mul(new Fraction(numCount));
    const totalReservedFraction = diffIndShare.mul(new Fraction(numCount));

    totalDisbursedCash += totalDisbursedVal;

    const displayName = baseItem.relationship_display || rel;
    const whyText = baseItem.why || "";

    mafqoudDistributions.push({
      relationship: rel,
      relationship_display: displayName,
      count: count,
      is_mafqoud: false,
      individual_disbursed_fraction: minIndShare.toString(),
      individual_disbursed_percentage:
        Math.round(minIndShare.valueOf() * 10000) / 100,
      individual_disbursed_value: Math.round(indDisbursedVal * 100) / 100,

      total_disbursed_fraction: totalDisbursedFraction.toString(),
      total_disbursed_value: Math.round(totalDisbursedVal * 100) / 100,

      individual_reserved_fraction: diffIndShare.toString(),
      individual_reserved_percentage:
        Math.round(diffIndShare.valueOf() * 10000) / 100,
      individual_reserved_value: Math.round(indReservedVal * 100) / 100,

      total_reserved_fraction: totalReservedFraction.toString(),
      total_reserved_value: Math.round(totalReservedVal * 100) / 100,
      why: whyText,
    });
  }

  // Calculate actual total disbursed fraction across all heirs
  let totalDisbursedFrac = new Fraction(0);
  for (const d of mafqoudDistributions) {
    if (d.total_disbursed_fraction) {
      totalDisbursedFrac = totalDisbursedFrac.add(
        new Fraction(d.total_disbursed_fraction),
      );
    }
  }

  // Total reserved fraction is the remainder of the estate (1 - totalDisbursed)
  let totalReservedFrac = new Fraction(1).sub(totalDisbursedFrac);
  if (totalReservedFrac.lessThan(new Fraction(0))) {
    totalReservedFrac = new Fraction(0);
  }

  const finalTotalReservedCash = Math.max(0, netEstate - totalDisbursedCash);
  const totalDisbursedPercentage =
    Math.round(totalDisbursedFrac.valueOf() * 10000) / 100;
  const totalReservedPercentage =
    Math.round(totalReservedFrac.valueOf() * 10000) / 100;

  // Build reserved breakdowns for every scenario
  const reservedBreakdowns = [];

  for (let sIdx = 0; sIdx < scenarios.length; sIdx++) {
    const s = scenarios[sIdx];
    const items = [];

    for (const mDist of mafqoudDistributions) {
      const rel = mDist.relationship;
      const isM = mDist.is_mafqoud;
      const targetRel = isM ? rel.replace(/_MAFQOUD$/, "") : rel;

      if (isM) {
        if (s.comb[targetRel] > 0) {
          const d_s = s.result.distributions.find(
            (d) => d.relationship === targetRel,
          );
          if (d_s) {
            const indFrac = new Fraction(d_s.individual_share_fraction || "0");
            const totFrac = indFrac.mul(new Fraction(mDist.count || 1));
            const val = totFrac.valueOf() * netEstate;
            items.push({
              relationship: rel,
              relationship_display: mDist.relationship_display,
              count: mDist.count,
              is_mafqoud: true,
              contingent_fraction: totFrac.toString(),
              contingent_percentage:
                Math.round(totFrac.valueOf() * 10000) / 100,
              contingent_value: Math.round(val * 100) / 100,
              note: "نصيب المفقود المفترض كاملاً",
            });
          }
        }
      } else {
        const d_s = s.result.distributions.find(
          (d) => d.relationship === targetRel,
        );
        if (d_s) {
          const indFrac = new Fraction(d_s.individual_share_fraction || "0");
          const totFrac = indFrac.mul(new Fraction(mDist.count || 1));
          const disbursedFrac = new Fraction(
            mDist.total_disbursed_fraction || "0",
          );
          const diffFrac = totFrac.sub(disbursedFrac);

          if (diffFrac.greaterThan(new Fraction(0))) {
            const val = diffFrac.valueOf() * netEstate;
            items.push({
              relationship: rel,
              relationship_display: mDist.relationship_display,
              count: mDist.count,
              is_mafqoud: false,
              contingent_fraction: diffFrac.toString(),
              contingent_percentage:
                Math.round(diffFrac.valueOf() * 10000) / 100,
              contingent_value: Math.round(val * 100) / 100,
              note: s.isAllDead
                ? "نصيبه/تكملة فرضه على تقدير وفاة المفقود"
                : "استكمال فرضه الشرعي في هذا التقدير",
            });
          }
        }
      }
    }

    reservedBreakdowns.push({
      scenarioId: s.id,
      label: s.label,
      isAllAlive: s.isAllAlive,
      isAllDead: s.isAllDead,
      items,
    });
  }

  const reservedBreakdownAlive = reservedBreakdowns[0]?.items || [];
  const reservedBreakdownDead =
    reservedBreakdowns[reservedBreakdowns.length - 1]?.items || [];

  return {
    ...resultAlive,
    has_mafqoud: true,
    missing_person_type: firstMissingType,
    missing_person_count: firstMissingCount,
    missing_person_name: firstMissingDisplayName,
    missing_persons_map: missingCountsMap,
    mafqoud_distributions: mafqoudDistributions,
    total_disbursed_fraction: totalDisbursedFrac.toString(),
    total_disbursed_percentage: totalDisbursedPercentage,
    total_disbursed_cash: Math.round(totalDisbursedCash * 100) / 100,
    total_reserved_fraction: totalReservedFrac.toString(),
    total_reserved_percentage: totalReservedPercentage,
    total_reserved_cash: Math.round(finalTotalReservedCash * 100) / 100,
    reserved_breakdowns: reservedBreakdowns,
    reserved_breakdown_alive: reservedBreakdownAlive,
    reserved_breakdown_dead: reservedBreakdownDead,
    scenarios: scenarios,
    result_alive: resultAlive,
    result_dead: resultDead,
  };
}
