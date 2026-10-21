/**
 * @file Iqrar.js
 * @description Engine module for computing inheritance distribution under Bab Al-Iqrar (باب الإقرار).
 * Handles heir acknowledgment cases according to Islamic jurisprudence (Fiqh) and the Moroccan Family Code.
 * Evaluates the Denial Problem (مسألة الإنكار) vs Acknowledgment Problem (مسألة الإقرار),
 * protecting denying heirs and transferring available surpluses from declarants to acknowledged persons.
 */

import Fraction, { gcd, lcm } from "../fraction.js";
import { HEIR_NAMES_AR } from "./Explanations.js";

/**
 * Parses a fraction string like "1/2", "-3/4", "+1/6", "0" into sign, numerator, and denominator.
 *
 * @param {string} str - The fraction string.
 * @returns {{ sign: string, num: number, den: number } | null}
 */
export function parseFractionParts(str) {
  if (!str || typeof str !== "string") return null;
  const clean = str.trim();
  if (
    !clean ||
    clean === "0" ||
    clean === "ــــ" ||
    clean === "—" ||
    clean === "محجوب (0)"
  ) {
    return null;
  }
  let s = clean;
  let sign = "";
  if (s.startsWith("+")) {
    sign = "+";
    s = s.slice(1);
  } else if (s.startsWith("-")) {
    sign = "-";
    s = s.slice(1);
  }
  const parts = s.split("/");
  const num = parseInt(parts[0], 10);
  const den = parts.length > 1 ? parseInt(parts[1], 10) : 1;
  if (isNaN(num) || isNaN(den) || den <= 0 || num === 0) return null;
  return { sign, num, den };
}

/**
 * Scales a fraction string to a target common denominator if divisible.
 *
 * @param {string} str
 * @param {number} targetDen
 * @returns {string}
 */
export function scaleFractionString(str, targetDen) {
  if (!str || typeof str !== "string" || !targetDen || targetDen <= 0) return str;
  const clean = str.trim();
  if (
    !clean ||
    clean === "0" ||
    clean === "ــــ" ||
    clean === "—" ||
    clean === "محجوب (0)"
  ) {
    return str;
  }
  const p = parseFractionParts(str);
  if (!p) return str;

  if (targetDen % p.den === 0) {
    const factor = targetDen / p.den;
    return `${p.sign}${p.num * factor}/${targetDen}`;
  }
  return str;
}

/**
 * Calculates the true operational problem base for a calculation result
 * taking into account individual share denominators, Asabah head counts, and standard steps.
 *
 * @param {Object} res - Calculation result.
 * @returns {number} The integer base of the problem.
 */
export function getProblemBase(res) {
  if (!res) return 1;
  let base = 1;
  for (const d of res.distributions || []) {
    const frac = d.individual_share_fraction || d.share_fraction;
    const p = parseFractionParts(frac);
    if (p && p.den > 1) {
      base = lcm(base, p.den);
    }
  }
  const step2 = res.standard_steps?.find((s) => s.id === "std_step2");
  const step3 = res.standard_steps?.find((s) => s.id === "std_step3");
  if (res.radd_result?.correctedBase) base = Math.max(base, res.radd_result.correctedBase);
  else if (res.radd_result?.initialOrigin) base = Math.max(base, res.radd_result.initialOrigin);
  else if (res.is_aul && res.aul_base) base = Math.max(base, res.aul_base);
  else if (step3?.table?.[0]?.share?.includes("/")) {
    const den = parseInt(step3.table[0].share.split("/")[1], 10) || 1;
    base = Math.max(base, den);
  } else if (step2?.table?.[0]?.share?.includes("/")) {
    const den = parseInt(step2.table[0].share.split("/")[1], 10) || 1;
    base = Math.max(base, den);
  }
  return base > 1 ? base : 1;
}

/**
 * Calculates inheritance under Bab Al-Iqrar.
 *
 * @param {Object} params
 * @param {Function} params.CalculatorClass - InheritanceCalculator class reference.
 * @param {Object} params.caseData - Case data containing iqrarCases.
 * @returns {Object} Final formatted results with original, hypothetical, and final distributions.
 */
export function calculateIqrarCase({ CalculatorClass, caseData }) {
  // 1. Normalize iqrar cases list
  let iqrarList = [];
  if (Array.isArray(caseData.iqrarCases) && caseData.iqrarCases.length > 0) {
    iqrarList = caseData.iqrarCases;
  } else if (caseData.iqrarCase) {
    iqrarList = [caseData.iqrarCase];
  } else {
    // Fallback default structure if triggered with minimal props
    iqrarList = [
      {
        id: "iqrar_default",
        muqirr: caseData.iqrarMuqirr || "SON",
        muqirrCount: parseInt(caseData.iqrarMuqirrCount, 10) || 1,
        muqarrLahu: {
          name: caseData.iqrarMuqarrName || "المقَرّ له",
          relationship: caseData.iqrarMuqarrRelationship || "SON",
          count: parseInt(caseData.iqrarMuqarrCount, 10) || 1,
        },
        approvalType: caseData.iqrarApprovalType || "ALL_DENY",
        approvals: caseData.iqrarApprovals || {},
      },
    ];
  }

  // 2. Compute Base Problem: مسألة الإنكار (Estate without acknowledged persons)
  const baseCaseData = {
    ...caseData,
    hasIqrar: false,
    _isSubCase: true,
  };
  const baseCalc = new CalculatorClass(baseCaseData);
  const resultDenial = baseCalc.calculate();

  const netEstate = resultDenial.net_estate || resultDenial.total_estate || 0;

  // 3. Compute Acknowledgment Problem: مسألة الإقرار (Estate with acknowledged persons added)
  const originalHeirsList = [...(caseData.heirs || [])].filter((h) => h.count > 0);
  const heirsWithAcknowledged = originalHeirsList.map((h) => ({ ...h }));

  // Collect all acknowledged persons
  const acknowledgedPersons = [];
  for (const iq of iqrarList) {
    if (!iq || !iq.muqarrLahu || !iq.muqarrLahu.relationship) continue;
    const rel = iq.muqarrLahu.relationship;
    const count = Math.max(1, parseInt(iq.muqarrLahu.count, 10) || 1);
    const name = iq.muqarrLahu.name || HEIR_NAMES_AR[rel] || rel;

    acknowledgedPersons.push({
      id: iq.id || `ack_${rel}_${acknowledgedPersons.length}`,
      iqrarId: iq.id,
      name,
      relationship: rel,
      relationship_display: `${HEIR_NAMES_AR[rel] || rel} (مُقَرّ له${name ? ` - ${name}` : ""})`,
      count,
      muqirrRel: iq.muqirr,
      approvalType: iq.approvalType || "ALL_DENY",
      approvals: iq.approvals || {},
    });

    const existingIdx = heirsWithAcknowledged.findIndex((h) => h.relationship === rel);
    if (existingIdx >= 0) {
      heirsWithAcknowledged[existingIdx].count += count;
    } else {
      heirsWithAcknowledged.push({
        relationship: rel,
        count,
      });
    }
  }

  const ackCaseData = {
    ...caseData,
    heirs: heirsWithAcknowledged,
    hasIqrar: false,
    _isSubCase: true,
  };
  const ackCalc = new CalculatorClass(ackCaseData);
  const resultAcknowledgment = ackCalc.calculate();

  // Helper to extract fraction for a relationship from a calculation result
  const getShareFractionFromResult = (result, relationship) => {
    if (!result || !result.distributions) return new Fraction(0);
    const d = result.distributions.find((item) => item.relationship === relationship);
    if (!d) return new Fraction(0);
    if (d.individual_share_fraction) return new Fraction(d.individual_share_fraction);
    if (d.share_fraction) return new Fraction(d.share_fraction);
    return new Fraction(0);
  };

  // 4. Classify heirs and calculate roles, base shares, and acknowledgment shares
  const finalDistributions = [];
  let totalDisbursedCash = 0;

  // Helper to extract non-declarant heir keys for an acknowledgment
  const getNonDeclarantHeirKeys = (iq) => {
    const keys = [];
    for (const h of originalHeirsList) {
      const rel = h.relationship;
      const count = h.count;
      if (rel === iq.muqirr) {
        const muqCount = Math.min(count, Math.max(1, parseInt(iq.muqirrCount, 10) || 1));
        for (let i = muqCount + 1; i <= count; i++) {
          keys.push(count > 1 ? `${rel}_${i}` : rel);
        }
      } else {
        if (count === 1) {
          keys.push(rel);
        } else {
          for (let i = 1; i <= count; i++) {
            keys.push(`${rel}_${i}`);
          }
        }
      }
    }
    return keys;
  };

  // Check if ALL acknowledgments have ALL_APPROVE or all heirs confirmed in CUSTOM
  const isUniversallyApproved = iqrarList.every((iq) => {
    if (iq.approvalType === "ALL_APPROVE") return true;
    if (iq.approvalType === "CUSTOM" && iq.approvals) {
      const requiredKeys = getNonDeclarantHeirKeys(iq);
      if (requiredKeys.length === 0) return true;
      return requiredKeys.every((k) => iq.approvals[k] === true);
    }
    return false;
  });

  if (isUniversallyApproved) {
    // If universally approved by all heirs:
    // Everyone receives their exact share from مسألة الإقرار (Acknowledgment Case).
    // Original heirs must remain distinct from acknowledged persons!

    // 1. Process original heirs distinctly
    for (const h of originalHeirsList) {
      const rel = h.relationship;
      const totalCount = h.count;
      const baseFraction = getShareFractionFromResult(resultDenial, rel);
      const ackIndFraction = getShareFractionFromResult(resultAcknowledgment, rel);

      // Determine how many are muqirr in this category
      const muqirrCases = iqrarList.filter((iq) => iq.muqirr === rel);
      let muqirrCount = 0;
      for (const mq of muqirrCases) {
        muqirrCount += Math.max(1, parseInt(mq.muqirrCount, 10) || 1);
      }
      muqirrCount = Math.min(totalCount, muqirrCount);

      const indVal = Math.round(ackIndFraction.valueOf() * netEstate * 100) / 100;
      const baseIndVal = Math.round(baseFraction.valueOf() * netEstate * 100) / 100;
      const indPct = Math.round(ackIndFraction.valueOf() * 10000) / 100;

      const diff = baseFraction.sub(ackIndFraction);
      let surplusDelta = "0";
      if (diff.greaterThan(new Fraction(0))) {
        surplusDelta = `-${diff.toString()}`;
      } else if (diff.lessThan(new Fraction(0))) {
        surplusDelta = `+${diff.abs().toString()}`;
      }

      if (totalCount > 1) {
        for (let i = 1; i <= totalCount; i++) {
          const isThisMuqirr = i <= muqirrCount;
          const role = isThisMuqirr ? "MUQIRR" : "MUSADDIQ";
          const roleLabel = isThisMuqirr ? "مُقِرّ" : "مُصَدِّق";
          const heirName = `${HEIR_NAMES_AR[rel] || rel} #${i}`;
          const relDisplay = `${heirName} (${roleLabel})`;

          totalDisbursedCash += indVal;

          finalDistributions.push({
            key: `${rel}_${i}`,
            memberIndex: i,
            totalCount,
            isMuqirr: isThisMuqirr,
            relationship: rel,
            name: heirName,
            relationship_display: relDisplay,
            role,
            count: 1,
            base_fraction: baseFraction.toString(),
            base_value: baseIndVal,
            iqrar_fraction: ackIndFraction.toString(),
            iqrar_value: indVal,
            individual_share_fraction: ackIndFraction.toString(),
            share_fraction: ackIndFraction.toString(),
            final_fraction: ackIndFraction.toString(),
            total_value: indVal,
            per_person_value: indVal,
            percentage: indPct,
            individual_percentage: indPct,
            surplus_delta: surplusDelta,
            why: isThisMuqirr
              ? `وارث مُقِرّ صادق جميع الورثة على إقراره: تُقسم التركة بمقتضى مسألة الإقرار باتفاق الجميع${diff.greaterThan(new Fraction(0)) ? `، ويُقتطع الفضل وقدره (${diff.toString()}) للمقَرّ له` : ""}.`
              : `وارث مصدِّق للإقرار بالإجماع: تُقسم التركة بمقتضى التصديق التام بين جميع الورثة${diff.greaterThan(new Fraction(0)) ? `، ويُقتطع الفضل وقدره (${diff.toString()}) للمقَرّ له` : ""}.`,
          });
        }
      } else {
        const isThisMuqirr = muqirrCount > 0;
        const role = isThisMuqirr ? "MUQIRR" : "MUSADDIQ";
        const roleLabel = isThisMuqirr ? "مُقِرّ" : "مُصَدِّق";
        const heirName = HEIR_NAMES_AR[rel] || rel;
        const relDisplay = `${heirName} (${roleLabel})`;

        totalDisbursedCash += indVal;

        finalDistributions.push({
          key: rel,
          memberIndex: 1,
          totalCount: 1,
          isMuqirr: isThisMuqirr,
          relationship: rel,
          name: heirName,
          relationship_display: relDisplay,
          role,
          count: 1,
          base_fraction: baseFraction.toString(),
          base_value: baseIndVal,
          iqrar_fraction: ackIndFraction.toString(),
          iqrar_value: indVal,
          individual_share_fraction: ackIndFraction.toString(),
          share_fraction: ackIndFraction.toString(),
          final_fraction: ackIndFraction.toString(),
          total_value: indVal,
          per_person_value: indVal,
          percentage: indPct,
          individual_percentage: indPct,
          surplus_delta: surplusDelta,
          why: isThisMuqirr
            ? `وارث مُقِرّ صادق جميع الورثة على إقراره: تُقسم التركة بمقتضى مسألة الإقرار باتفاق الجميع${diff.greaterThan(new Fraction(0)) ? `، ويُقتطع الفضل وقدره (${diff.toString()}) للمقَرّ له` : ""}.`
            : `وارث مصدِّق للإقرار بالإجماع: تُقسم التركة بمقتضى التصديق التام بين جميع الورثة${diff.greaterThan(new Fraction(0)) ? `، ويُقتطع الفضل وقدره (${diff.toString()}) للمقَرّ له` : ""}.`,
        });
      }
    }

    // 2. Process acknowledged persons separately
    const totalAckByRel = {};
    for (const ap of acknowledgedPersons) {
      const count = Math.max(1, ap.count || 1);
      totalAckByRel[ap.relationship] = (totalAckByRel[ap.relationship] || 0) + count;
    }

    const currentAckIndexByRel = {};

    for (const ap of acknowledgedPersons) {
      const ackIndFraction = getShareFractionFromResult(resultAcknowledgment, ap.relationship);
      const indVal = Math.round(ackIndFraction.valueOf() * netEstate * 100) / 100;
      const indPct = Math.round(ackIndFraction.valueOf() * 10000) / 100;
      const apCount = Math.max(1, ap.count || 1);
      const hasMultipleForRel = (totalAckByRel[ap.relationship] || 1) > 1;

      const surplusDelta = ackIndFraction.greaterThan(new Fraction(0))
        ? `+${ackIndFraction.toString()}`
        : "0";

      for (let i = 1; i <= apCount; i++) {
        totalDisbursedCash += indVal;
        const curIdx = (currentAckIndexByRel[ap.relationship] || 0) + 1;
        currentAckIndexByRel[ap.relationship] = curIdx;

        const hasCustomName =
          ap.name &&
          ap.name !== "المقَرّ له" &&
          ap.name !== (HEIR_NAMES_AR[ap.relationship] || ap.relationship);

        let heirName = "";
        let displayName = "";

        if (hasCustomName) {
          heirName = hasMultipleForRel
            ? `${HEIR_NAMES_AR[ap.relationship] || ap.relationship} المقَرّ له #${curIdx} (${ap.name})`
            : `${HEIR_NAMES_AR[ap.relationship] || ap.relationship} المقَرّ له (${ap.name})`;
          displayName = `${HEIR_NAMES_AR[ap.relationship] || ap.relationship} (مُقَرّ له - ${ap.name})`;
        } else {
          heirName = hasMultipleForRel
            ? `${HEIR_NAMES_AR[ap.relationship] || ap.relationship} المقَرّ له #${curIdx}`
            : `${HEIR_NAMES_AR[ap.relationship] || ap.relationship} المقَرّ له`;
          displayName = hasMultipleForRel
            ? `${HEIR_NAMES_AR[ap.relationship] || ap.relationship} المقَرّ له #${curIdx} (مصدَّق بالإجماع)`
            : `${HEIR_NAMES_AR[ap.relationship] || ap.relationship} (مُقَرّ له - مصدَّق بالإجماع)`;
        }

        finalDistributions.push({
          relationship: ap.relationship,
          name: heirName,
          relationship_display: displayName,
          role: "MUQARR_LAHU",
          count: 1,
          base_fraction: "0",
          base_value: 0,
          iqrar_fraction: ackIndFraction.toString(),
          iqrar_value: indVal,
          individual_share_fraction: ackIndFraction.toString(),
          share_fraction: ackIndFraction.toString(),
          final_fraction: ackIndFraction.toString(),
          total_value: indVal,
          per_person_value: indVal,
          percentage: indPct,
          individual_percentage: indPct,
          surplus_delta: surplusDelta,
          why: `مُقَرّ له مصدّق من جميع الورثة: يُعامل معاملة الوارث الشرعي لتصديق كافة الورثة، ويأخذ كامل فرضه/سهمه بموجب مسألة الإقرار وقدره (${ackIndFraction.toString()}).`,
        });
      }
    }

    const ackBase = getProblemBase(resultAcknowledgment);
    const denialBase = getProblemBase(resultDenial);
    const minFinalDen = lcm(denialBase, ackBase);
    const commonDen = unifyIqrarDistributionsDenominator(finalDistributions, minFinalDen);

    const univProblems = [
      {
        groupId: "universal",
        iqList: iqrarList,
        resultAck: resultAcknowledgment,
        base: ackBase,
      },
    ];

    return {
      ...resultAcknowledgment,
      has_iqrar: true,
      iqrar_type: "UNANIMOUS_APPROVAL",
      iqrar_cases: iqrarList,
      common_denominator: commonDen,
      distributions: finalDistributions,
      iqrar_distributions: finalDistributions,
      result_denial: resultDenial,
      result_acknowledgment: resultAcknowledgment,
      acknowledgment_problems: univProblems,
      total_disbursed_cash: Math.round(totalDisbursedCash * 100) / 100,
      pedagogical_summary: {
        title: "إقرار مع تصديق جميع الورثة (حالة التصديق التام)",
        explanation:
          "أقرّ أحد الورثة بوارث آخر وصادق جميع الورثة الباقين على هذا الإقرار. في هذه الحالة يثبت الحق المالي للمقَرّ له باتفاق الجميع، وتُقسم التركة على الجميع وفق مسألة الإقرار باعتباره وارثاً شرعياً مساوياً لمن في درجته.",
        lineage_ruling:
          "تنبيه شرعي وقضائي: التصديق الجماعي يرتب آثاره المالية في التركة باتفاق الورثة، أما ثبوت النسب الرسمي في الأوراق والوثائق فيخضع للقواعد الإجرائية المقررة قانوناً وقضاءً.",
      },
    };
  }

  // Contested Case (إقرار مع إنكار باقي الورثة أو بعضهم):
  // Helper to test if a specific individual (rel, memberIndex) approves a declaration iq
  const isIndividualApproverForIq = (ind, iq) => {
    const isMuqirr = ind.relationship === iq.muqirr && ind.memberIndex <= (parseInt(iq.muqirrCount, 10) || 1);
    if (isMuqirr) return { isMuqirr: true, isApproved: true };

    if (iq.approvalType === "ALL_APPROVE") {
      return { isMuqirr: false, isApproved: true };
    }
    if (iq.approvalType === "CUSTOM" && iq.approvals) {
      if (iq.approvals[ind.key] !== undefined) {
        return { isMuqirr: false, isApproved: Boolean(iq.approvals[ind.key]) };
      }
      if (ind.totalCount === 1 && iq.approvals[ind.relationship] !== undefined) {
        return { isMuqirr: false, isApproved: Boolean(iq.approvals[ind.relationship]) };
      }
    }
    return { isMuqirr: false, isApproved: false };
  };

  const originalHeirIndividuals = [];
  for (const h of originalHeirsList) {
    const rel = h.relationship;
    const totalCount = h.count;
    const baseIndFraction = getShareFractionFromResult(resultDenial, rel);
    for (let i = 1; i <= totalCount; i++) {
      const key = totalCount > 1 ? `${rel}_${i}` : rel;
      originalHeirIndividuals.push({
        relationship: rel,
        memberIndex: i,
        key,
        totalCount,
        base_ind_fraction: baseIndFraction,
        deductions: new Fraction(0),
        primaryAckFraction: null,
        roles: new Set(),
      });
    }
  }

  // Group declarations by their approver signature (confession groups)
  const confessionGroups = [];
  for (const iq of iqrarList) {
    if (!iq || !iq.muqarrLahu || !iq.muqarrLahu.relationship) continue;
    const approverKeys = [];
    const approvers = [];
    for (const ind of originalHeirIndividuals) {
      const { isMuqirr, isApproved } = isIndividualApproverForIq(ind, iq);
      if (isApproved) {
        approverKeys.push(ind.key);
        approvers.push({ ind, isMuqirr });
      }
    }
    approverKeys.sort();
    const sig = approverKeys.join(",");

    let group = confessionGroups.find((g) => g.sig === sig);
    if (!group) {
      group = { sig, approvers, iqList: [] };
      confessionGroups.push(group);
    }
    group.iqList.push(iq);
  }

  const ackPersonsAllocations = [];
  let totalTransferredAllGroups = new Fraction(0);
  const acknowledgmentProblems = [];

  for (const group of confessionGroups) {
    // Collect all acknowledged persons in this confession group
    const ackHeirsInGroup = [];
    for (const iq of group.iqList) {
      const rel = iq.muqarrLahu.relationship;
      const count = Math.max(1, parseInt(iq.muqarrLahu.count, 10) || 1);
      const existingIdx = ackHeirsInGroup.findIndex((h) => h.relationship === rel);
      if (existingIdx >= 0) {
        ackHeirsInGroup[existingIdx].count += count;
      } else {
        ackHeirsInGroup.push({ relationship: rel, count });
      }
    }

    // Build hypothetical case for this confession group:
    // Original heirs + acknowledged persons in this group
    const heirsInGroupCase = originalHeirsList.map((h) => ({ ...h }));
    for (const ah of ackHeirsInGroup) {
      const existingIdx = heirsInGroupCase.findIndex((h) => h.relationship === ah.relationship);
      if (existingIdx >= 0) {
        heirsInGroupCase[existingIdx].count += ah.count;
      } else {
        heirsInGroupCase.push({ relationship: ah.relationship, count: ah.count });
      }
    }

    const calcGroup = new CalculatorClass({
      ...caseData,
      heirs: heirsInGroupCase,
      hasIqrar: false,
      _isSubCase: true,
    });
    const resultAckGroup = calcGroup.calculate();
    const groupBase = getProblemBase(resultAckGroup);

    group.resultAck = resultAckGroup;
    group.base = groupBase;

    acknowledgmentProblems.push({
      groupId: group.sig,
      iqList: group.iqList,
      approvers: group.approvers,
      ackHeirsInGroup,
      resultAck: resultAckGroup,
      base: groupBase,
    });

    // Compute surplus from each approver in this group
    let totalGroupSurplus = new Fraction(0);
    const approverSurpluses = [];

    // Populate primaryAckFraction for all heirs from this acknowledgment case
    for (const ind of originalHeirIndividuals) {
      const ackFrac = getShareFractionFromResult(resultAckGroup, ind.relationship);
      if (!ind.primaryAckFraction) {
        ind.primaryAckFraction = ackFrac;
      }
    }

    for (const { ind, isMuqirr } of group.approvers) {
      const ackIndFraction = getShareFractionFromResult(resultAckGroup, ind.relationship);
      if (isMuqirr) {
        ind.roles.add("MUQIRR");
      } else {
        ind.roles.add("MUSADDIQ");
      }

      let surplusInd = new Fraction(0);
      if (ind.base_ind_fraction.greaterThan(ackIndFraction)) {
        surplusInd = ind.base_ind_fraction.sub(ackIndFraction);
      }
      approverSurpluses.push({ ind, surplusInd });
      totalGroupSurplus = totalGroupSurplus.add(surplusInd);
    }

    // Compute target entitlements for each declaration in this group
    let totalGroupTarget = new Fraction(0);
    const iqTargets = [];

    for (const iq of group.iqList) {
      const rel = iq.muqarrLahu.relationship;
      const count = Math.max(1, parseInt(iq.muqarrLahu.count, 10) || 1);
      const indAckFraction = getShareFractionFromResult(resultAckGroup, rel);
      const targetTotal = indAckFraction.mul(new Fraction(count));
      totalGroupTarget = totalGroupTarget.add(targetTotal);
      iqTargets.push({ iq, indAckFraction, targetTotal, count });
    }

    // Allocation within this group
    let actualTransferredGroup = new Fraction(0);
    if (totalGroupTarget.greaterThan(new Fraction(0))) {
      if (totalGroupSurplus.lessThan(totalGroupTarget)) {
        actualTransferredGroup = totalGroupSurplus;
      } else {
        actualTransferredGroup = totalGroupTarget;
      }
    }
    totalTransferredAllGroups = totalTransferredAllGroups.add(actualTransferredGroup);

    // Deductions from approvers in this group
    for (const { ind, surplusInd } of approverSurpluses) {
      if (surplusInd.greaterThan(new Fraction(0)) && totalGroupSurplus.greaterThan(new Fraction(0))) {
        const indDeduction = actualTransferredGroup.mul(surplusInd.div(totalGroupSurplus));
        ind.deductions = ind.deductions.add(indDeduction);
      }
    }

    // Distribute to acknowledged persons in this group
    for (const { iq, indAckFraction, targetTotal, count } of iqTargets) {
      let finalGroupFrac = new Fraction(0);
      if (totalGroupTarget.greaterThan(new Fraction(0))) {
        finalGroupFrac = actualTransferredGroup.mul(targetTotal.div(totalGroupTarget));
      }
      const finalIndFrac = finalGroupFrac.div(new Fraction(count));
      ackPersonsAllocations.push({
        iq,
        groupSig: group.sig,
        relationship: iq.muqarrLahu.relationship,
        count,
        targetIndFraction: indAckFraction,
        finalIndFraction: finalIndFrac,
        finalGroupFraction: finalGroupFrac,
      });
    }
  }

  const ackRelationships = new Set(ackPersonsAllocations.map((a) => a.relationship));

  // 1. Finalize Original Heirs shares in original order
  for (const ind of originalHeirIndividuals) {
    let role = "MUNKIR";
    let roleLabel = "مُنكِر";
    if (ind.roles.has("MUQIRR")) {
      role = "MUQIRR";
      roleLabel = "مُقِرّ";
    } else if (ind.roles.has("MUSADDIQ")) {
      role = "MUSADDIQ";
      roleLabel = "مُصَدِّق";
    }

    const indFinalFrac = ind.base_ind_fraction.sub(ind.deductions);
    const totalVal = Math.round(indFinalFrac.valueOf() * netEstate * 100) / 100;
    const baseVal = Math.round(ind.base_ind_fraction.valueOf() * netEstate * 100) / 100;
    const ackFrac = ind.primaryAckFraction || ind.base_ind_fraction;
    const iqrarVal = Math.round(ackFrac.valueOf() * netEstate * 100) / 100;
    const pct = Math.round(indFinalFrac.valueOf() * 10000) / 100;

    totalDisbursedCash += totalVal;

    let surplusDelta = "0";
    if (ind.deductions.greaterThan(new Fraction(0))) {
      surplusDelta = `-${ind.deductions.toString()}`;
    }

    const baseName = HEIR_NAMES_AR[ind.relationship] || ind.relationship;
    const hasSameRelAck = ackRelationships.has(ind.relationship);
    const isFemale = ["DAUGHTER", "MOTHER", "WIFE", "FULL_SISTER", "PATERNAL_SISTER", "MATERNAL_SISTER", "MATERNAL_GRANDMOTHER", "PATERNAL_GRANDMOTHER"].includes(ind.relationship);

    let heirName = baseName;
    if (hasSameRelAck) {
      const suffix = isFemale ? "الأصلية" : "الأصلي";
      heirName = ind.totalCount > 1 ? `${baseName} ${suffix} #${ind.memberIndex}` : `${baseName} ${suffix}`;
    } else {
      heirName = ind.totalCount > 1 ? `${baseName} #${ind.memberIndex}` : baseName;
    }
    const relDisplay = `${heirName} (${roleLabel})`;

    let whyExplanation = "";
    if (role === "MUNKIR") {
      whyExplanation = "وارث مُنكِر للإقرار: لا يُحمَل إقرار غيره عليه عملاً بالقاعدة الشرعية (لا يُحمَل إقرار على منكر)، فيأخذ كامل فرضه/سهمه من مسألة الإنكار دون أي نقص.";
    } else if (ackFrac.valueOf() === 0) {
      whyExplanation = `وارث ${roleLabel}: حُجب بالوارث المقَرّ له في مسألة الإقرار، فدفع كامل نصيبه من مسألة الإنكار للمقَرّ له مؤاخذة بإقراره.`;
    } else if (ind.deductions.greaterThan(new Fraction(0))) {
      whyExplanation = `وارث ${roleLabel}: مؤاخذ بإقراره شرعاً، يدفع الفضل الزائد بين نصيبه الأصلي (${ind.base_ind_fraction.toString()}) ونصيبه بعد الإقرار (${ackFrac.toString()}) وقدره (${ind.deductions.toString()}) للمقَرّ له، ويبقى له (${indFinalFrac.toString()}).`;
    } else {
      whyExplanation = `وارث ${roleLabel}: لم ينقص نصيبه في مسألة الإقرار عن مسألة الإنكار، فلا فضل في يده ليدفعه للمقَرّ له.`;
    }

    finalDistributions.push({
      key: ind.key,
      memberIndex: ind.memberIndex,
      totalCount: ind.totalCount,
      role,
      roles: Array.from(ind.roles),
      isMuqirr: ind.roles.has("MUQIRR"),
      relationship: ind.relationship,
      name: heirName,
      relationship_display: relDisplay,
      count: 1,
      base_fraction: ind.base_ind_fraction.toString(),
      base_value: baseVal,
      iqrar_fraction: ackFrac.toString(),
      iqrar_value: iqrarVal,
      individual_share_fraction: indFinalFrac.toString(),
      share_fraction: indFinalFrac.toString(),
      final_fraction: indFinalFrac.toString(),
      total_value: totalVal,
      per_person_value: totalVal,
      percentage: pct,
      individual_percentage: pct,
      surplus_delta: surplusDelta,
      why: whyExplanation,
    });
  }

  // 2. Finalize Acknowledged Persons shares
  for (const apAlloc of ackPersonsAllocations) {
    const iq = apAlloc.iq;
    const rel = apAlloc.relationship;
    const apCount = apAlloc.count;
    const finalIndFrac = apAlloc.finalIndFraction;
    const perPersonVal = Math.round(finalIndFrac.valueOf() * netEstate * 100) / 100;
    const indPct = Math.round(finalIndFrac.valueOf() * 10000) / 100;

    const baseName = HEIR_NAMES_AR[rel] || rel;
    const isFemale = ["DAUGHTER", "MOTHER", "WIFE", "FULL_SISTER", "PATERNAL_SISTER", "MATERNAL_SISTER", "MATERNAL_GRANDMOTHER", "PATERNAL_GRANDMOTHER"].includes(rel);
    const muqirrName = HEIR_NAMES_AR[iq.muqirr] || iq.muqirr;
    const hasCustomName =
      iq.muqarrLahu.name &&
      iq.muqarrLahu.name !== "المقَرّ له" &&
      iq.muqarrLahu.name !== baseName;

    for (let i = 1; i <= apCount; i++) {
      totalDisbursedCash += perPersonVal;

      let ackName = "";
      if (hasCustomName) {
        ackName = apCount > 1
          ? `${baseName} المستلحق${isFemale ? "ة" : ""} من ${muqirrName} #${i} (${iq.muqarrLahu.name})`
          : `${baseName} المستلحق${isFemale ? "ة" : ""} من ${muqirrName} (${iq.muqarrLahu.name})`;
      } else {
        ackName = apCount > 1
          ? `${baseName} المستلحق${isFemale ? "ة" : ""} من ${muqirrName} #${i}`
          : `${baseName} المستلحق${isFemale ? "ة" : ""} من ${muqirrName}`;
      }
      const displayName = `${baseName} (مُقَرّ له - مستلحق من ${muqirrName})`;

      finalDistributions.push({
        iqId: iq.id,
        groupSig: apAlloc.groupSig,
        muqirrRel: iq.muqirr,
        relationship: rel,
        name: ackName,
        relationship_display: displayName,
        role: "MUQARR_LAHU",
        count: 1,
        base_fraction: "0",
        base_value: 0,
        iqrar_fraction: apAlloc.targetIndFraction.toString(),
        iqrar_value: Math.round(apAlloc.targetIndFraction.valueOf() * netEstate * 100) / 100,
        individual_share_fraction: finalIndFrac.toString(),
        share_fraction: finalIndFrac.toString(),
        final_fraction: finalIndFrac.toString(),
        total_value: perPersonVal,
        per_person_value: perPersonVal,
        percentage: indPct,
        individual_percentage: indPct,
        surplus_delta: finalIndFrac.greaterThan(new Fraction(0)) ? `+${finalIndFrac.toString()}` : "0",
        why:
          apAlloc.targetIndFraction.valueOf() > 0
            ? `مُقَرّ له: أخذ الفضل المقتطع من نصيب الوارث المُقِرّ (${finalIndFrac.toString()}) عملاً بباب الإقرار. ولا يثبت نسبه تجاه المنكرين إلا بحكم قضائي أو بينة شرعية.`
            : "مُقَرّ له: محجوب في مسألة الإقرار، فلا يستحق شيئاً من التركة.",
      });
    }
  }

  let denialBase = getProblemBase(resultDenial);
  let minFinalDen = denialBase;
  for (const ap of acknowledgmentProblems) {
    minFinalDen = lcm(minFinalDen, ap.base);
  }

  const commonDen = unifyIqrarDistributionsDenominator(finalDistributions, minFinalDen);

  return {
    ...resultDenial,
    has_iqrar: true,
    iqrar_type: "CONTESTED_ACKNOWLEDGMENT",
    iqrar_cases: iqrarList,
    common_denominator: commonDen,
    distributions: finalDistributions,
    iqrar_distributions: finalDistributions,
    result_denial: resultDenial,
    result_acknowledgment: resultAcknowledgment,
    acknowledgment_problems: acknowledgmentProblems,
    total_disbursed_cash: Math.round(totalDisbursedCash * 100) / 100,
    total_surplus_transferred: scaleFractionString(totalTransferredAllGroups.toString(), commonDen),
    pedagogical_summary: {
      title: "إقرار مع إنكار بعض أو كافة الورثة الآخرين (المسألة الجامعة)",
      explanation:
        "وفقاً للقواعد الفقهية المستقرة في باب الإقرار، فإن إقرار الوارث حجة قاصرة عليه ولا تتعدى إلى الورثة المنكرين. لذلك استوفى المنكرون كامل أنصبتهم الشرعية من مسألة الإنكار دون نقص، بينما يؤاخذ المقِر بإقراره ويُقتطع الفضل (الفرق بين نصيبه في مسألة الإنكار ومسألة الإقرار) ليُدفع للمقَرّ له بما لا يجاوز حقه في مسألة الإقرار.",
      lineage_ruling:
        "التمييز بين الإقرار وإثبات النسب: هذا التوزيع يمثل الأثر المالي للإقرار في حدود حصة المقِر ولا يثبت به النسب الشرعي للمتوفى في مواجهة المنكرين، حيث إن ثبوت النسب للغير يتطلب بينة شرعية أو حكماً قضائياً باتاً طبقاً للمذهب المالكي ومدونة الأسرة.",
    },
  };
}



/**
 * Unifies the denominators of fraction strings in Bab Al-Iqrar distributions
 * to match the biggest factor (LCM) of EACH column independently,
 * and scales final shares to at least minFinalDen (the true Fiqh Jameah base).
 *
 * @param {Array<Object>} distributions - The list of heir distributions in Iqrar.
 * @param {number} [minFinalDen=1] - Minimum denominator for the final Jameah column.
 * @returns {number} The common denominator computed for the final column.
 */
function unifyIqrarDistributionsDenominator(distributions, minFinalDen = 1) {
  if (!Array.isArray(distributions) || distributions.length === 0) {
    return 1;
  }

  // Helper to compute LCM of denominators in a specific column/field
  const getColumnLCM = (fieldNames) => {
    let colDen = 1;
    for (const d of distributions) {
      for (const field of fieldNames) {
        const p = parseFractionParts(d[field]);
        if (p && p.den > 1) {
          colDen = lcm(colDen, p.den);
        }
      }
    }
    return colDen;
  };

  // 1. Column: النصيب الأصلي (base_fraction)
  const baseDen = getColumnLCM(["base_fraction"]);
  if (baseDen > 1) {
    for (const d of distributions) {
      d.base_fraction = scaleFractionString(d.base_fraction, baseDen);
    }
  }

  // 2. Column: بعد الإقرار (iqrar_fraction)
  const iqrarDen = getColumnLCM(["iqrar_fraction"]);
  if (iqrarDen > 1) {
    for (const d of distributions) {
      d.iqrar_fraction = scaleFractionString(d.iqrar_fraction, iqrarDen);
    }
  }

  // 3. Column: النتيجة النهائية (final_fraction, individual_share_fraction, share_fraction)
  let finalDen = getColumnLCM(["final_fraction", "individual_share_fraction", "share_fraction"]);
  if (minFinalDen && minFinalDen > 1) {
    finalDen = lcm(finalDen, minFinalDen);
  }
  if (finalDen > 1) {
    for (const d of distributions) {
      d.final_fraction = scaleFractionString(d.final_fraction, finalDen);
      d.individual_share_fraction = scaleFractionString(d.individual_share_fraction, finalDen);
      d.share_fraction = scaleFractionString(d.share_fraction, finalDen);
      d.common_denominator = finalDen;
    }
  }

  // 4. Column: الفضل المقتطع (surplus_delta) - matches the final common denominator
  const surplusDen = getColumnLCM(["surplus_delta"]);
  const targetSurplusDen = finalDen > 1 ? lcm(surplusDen, finalDen) : surplusDen;
  if (targetSurplusDen > 1) {
    for (const d of distributions) {
      d.surplus_delta = scaleFractionString(d.surplus_delta, targetSurplusDen);
    }
  }

  return finalDen;
}

