/**
 * @file PrepareResults.js
 * @description Aggregates and formats the final inheritance distributions, voluntary wills, mandatory bequests,
 * and excluded heir summaries into standardized output models.
 */

import Fraction from "../fraction.js";
import {
  formatExplanation,
  getParentDesignation,
  HEIR_NAMES_AR,
} from "./Explanations.js";

/**
 * @typedef {Object} WillInput
 * @property {string} [name] - Optional name or description of the bequest beneficiary.
 * @property {number|string} value - Value of the bequest (fixed amount, percentage string, or fraction string).
 * @property {'amount'|'percentage'|'fraction'} [valueType] - Type of the bequest value.
 * @property {string} [original_value] - Original input string before scaling.
 */

/**
 * @typedef {Object} ProcessedWill
 * @property {string} name - Beneficiary or bequest name.
 * @property {number} requested_value - Requested monetary amount.
 * @property {number} executed_value - Actually executed monetary amount after limits/approvals.
 * @property {string} type - Value type ('amount'|'percentage'|'fraction').
 * @property {string} original_value - Original raw input string.
 * @property {string} requested_fraction_share - Fraction string of requested share.
 * @property {string} executed_fraction_share - Fraction string of executed share.
 * @property {Fraction} executed_fraction_obj - Fraction object of executed share.
 */

/**
 * Executes voluntary wills (الوصية الاختيارية) in accordance with Sharia rules.
 *
 * Rules:
 * 1. Wills are limited to a maximum of 1/3 of the net estate (or the remaining portion of 1/3 after mandatory bequests).
 * 2. If wills exceed the 1/3 limit without heir approval, they are reduced pro-rata (تخفيض بالحصص) to fit within the limit.
 * 3. If heirs approve the excess, wills are executed in full up to the total estate value.
 *
 * @param {WillInput[]} willsInput - Array of raw will inputs.
 * @param {number} netEstate - Net estate value available for wills and heirs.
 * @param {boolean} heirsApprovedExcess - True if surviving heirs approved exceeding the 1/3 limit.
 * @param {Fraction} [limitFraction=new Fraction(1, 3)] - Maximum available fraction for voluntary wills.
 * @returns {{
 *   processedWills: ProcessedWill[],
 *   finalWillsCost: number,
 *   netEstateForHeirs: number,
 *   heirsScaleFraction: Fraction,
 *   willsExplanation: string,
 *   isWillsScaled: boolean
 * }}
 */
export function executeWills(
  willsInput,
  netEstate,
  heirsApprovedExcess,
  limitFraction = new Fraction(1, 3),
) {
  let totalWillsValue = 0;
  const processedWills = [];
  let totalWillsFraction = new Fraction(0);
  const oneThirdFraction = limitFraction;
  const netEstateInt = Math.round(netEstate * 100);

  for (const will of willsInput) {
    let val = 0;
    let reqFraction = new Fraction(0);

    if (will.valueType === "percentage") {
      const pct = parseFloat(will.value) || 0;
      val = (pct / 100) * netEstate;
      reqFraction = new Fraction(Math.round(pct * 100), 10000);
    } else if (will.valueType === "fraction") {
      const parts = (will.value || "1/3").split("/");
      const num = parseInt(parts[0], 10) || 0;
      const den = parseInt(parts[1], 10) || 1;
      val = (num / den) * netEstate;
      reqFraction = new Fraction(num, den);
    } else {
      val = parseFloat(will.value) || 0;
      reqFraction = new Fraction(Math.round(val * 100), netEstateInt || 1);
    }

    totalWillsValue += val;
    totalWillsFraction = totalWillsFraction.add(reqFraction);

    const willValStr =
      will.original_value ||
      will.value ||
      (reqFraction.d > 0 ? reqFraction.toString() : "");
    const autoWillName = willValStr
      ? `مُوصَىٰ له بـ ${willValStr}${will.valueType === "percentage" ? "%" : will.valueType === "amount" ? " د.م." : ""}`
      : "مُوصَىٰ له";

    const cleanInputName = will.name?.trim() || "";
    const willDisplayName =
      cleanInputName && cleanInputName !== "وصية غير مسماة"
        ? cleanInputName
        : autoWillName;

    processedWills.push({
      name: willDisplayName,
      requested_value: val,
      executed_value: val,
      type: will.valueType || "amount",
      original_value: will.original_value || will.value,
      requested_fraction: reqFraction,
      executed_fraction: reqFraction,
    });
  }

  const oneThirdLimit = netEstate * limitFraction.valueOf();
  let finalWillsCost = totalWillsValue;
  let willsExplanation = "";
  let isWillsScaled = false;

  const limitExceeded = totalWillsFraction.greaterThan(oneThirdFraction);

  if (limitExceeded && !heirsApprovedExcess) {
    isWillsScaled = true;
    willsExplanation = `مجموع الوصايا تجاوز الحد الشرعي المسموح به بعد الوصية الواجبة (${oneThirdFraction.toString()}) بدون موافقة الورثة، لذا تم تخفيض الوصايا بالحصص لتصل إلى الحد تماماً.`;

    const scalingFactor = oneThirdFraction.div(totalWillsFraction);
    finalWillsCost = oneThirdLimit;

    for (const will of processedWills) {
      will.executed_fraction = will.requested_fraction.mul(scalingFactor);
      will.executed_value = will.executed_fraction.valueOf() * netEstate;
    }
  } else if (limitExceeded && heirsApprovedExcess) {
    const oneFraction = new Fraction(1);
    if (totalWillsFraction.greaterThan(oneFraction)) {
      isWillsScaled = true;
      willsExplanation = `وافق الورثة على تجاوز الحد، لكن مجموع الوصايا تجاوز كامل التركة فتم تخفيضها بالحصص لتساوي التركة.`;
      const scalingFactor = oneFraction.div(totalWillsFraction);
      finalWillsCost = netEstate;

      for (const will of processedWills) {
        will.executed_fraction = will.requested_fraction.mul(scalingFactor);
        will.executed_value = will.executed_fraction.valueOf() * netEstate;
      }
    } else {
      willsExplanation = `تجاوزت الوصايا الحد المسموح ولكن تم تنفيذها بالكامل لموافقة الورثة على ذلك.`;
    }
  } else if (totalWillsValue > 0) {
    willsExplanation = `تم تنفيذ جميع الوصايا بالكامل لكونها في حدود الثلث المتاح.`;
  }

  let finalWillsFraction = new Fraction(0);
  for (const will of processedWills) {
    will.requested_fraction_share = will.requested_fraction.toString();
    will.executed_fraction_share = will.executed_fraction.toString();
    will.executed_fraction_obj = will.executed_fraction;
    finalWillsFraction = finalWillsFraction.add(will.executed_fraction);
    delete will.requested_fraction;
    delete will.executed_fraction;
  }

  const heirsScaleFraction = new Fraction(1).sub(finalWillsFraction);

  return {
    processedWills,
    finalWillsCost,
    netEstateForHeirs: netEstate - finalWillsCost,
    heirsScaleFraction,
    willsExplanation,
    isWillsScaled,
  };
}

/**
 * @typedef {Object} FinalDistribution
 * @property {string} relationship - Technical key for the beneficiary/heir.
 * @property {string} relationship_display - Arabic display name.
 * @property {number|string} count - Number of individuals.
 * @property {string} share_fraction - Total share fraction string.
 * @property {string} individual_share_fraction - Per-person share fraction string.
 * @property {number} percentage - Total percentage of entire estate (0-100).
 * @property {number} individual_percentage - Per-person percentage (0-100).
 * @property {number} total_value - Total monetary payout.
 * @property {number} per_person_value - Per-person monetary payout.
 * @property {string} why - Legal justification and explanation.
 */

/**
 * Prepares and normalizes the final calculation response payload.
 * Formats fractions, percentages, monetary amounts, and filters redundant blocked heir entries.
 *
 * @param {Object} params - Engine calculation parameters.
 * @returns {Object} Complete structured result object ready for UI display and export.
 */
import { PREGNANCY_OPTIONS } from "../constants/pregnancyConstants.js";

export function prepareFinalResults({
  results,
  heirs,
  explanations,
  caseData,
  gender,
  netEstate,
  originalNetEstate,
  totalWillsCost,
  willsExecuted,
  willsExplanation,
  isWillsScaled,
  isAul,
  totalShares,
  awlBase = null,
  baseOrigin = null,
  heirsScaleFraction,
  mandatoryBequestsResult,
  mandatoryBequestSteps,
  standardSteps,
  prescribedShares = null,
  raddResult = null,
  hasPregnancy = false,
  pregnancyRelation = "SON_OR_DAUGHTER",
  isPregnancyBlocked = false,
  isAkdariyya = false,
  isMalikiyyah = false,
  isShibhMalikiyyah = false,
  isMushtarakah = false,
  specialCase = null,
  isUmariyyah = false,
  isMinbariyya = false,
  isKharqa = false,
  isMuadah = false,
  debtsBreakdown = null,
  debtsList = [],
  debtsTotal = undefined,
  isInsufficientEstate = false,
  isEstateExhausted = false,
}) {
  const distributions = [];
  const scaleFactor =
    heirsScaleFraction && !heirsScaleFraction.equals(new Fraction(1))
      ? heirsScaleFraction
      : null;

  // 1. Format Heirs who received a share
  for (const [relationship, data] of Object.entries(results)) {
    // Skip 0-share entries for blocked heirs already receiving a mandatory bequest
    if (
      data.share.equals(new Fraction(0)) &&
      heirs[relationship] &&
      heirs[relationship].is_blocked
    ) {
      const hasMB =
        mandatoryBequestsResult &&
        mandatoryBequestsResult.list &&
        mandatoryBequestsResult.list.some((mb) => {
          return (
            mb.kids &&
            mb.kids.some((k) => {
              if (
                relationship === "GREAT_GRANDSON" &&
                k.type === "great_grandson"
              )
                return true;
              if (
                relationship === "GREAT_GRANDDAUGHTER" &&
                k.type === "great_granddaughter"
              )
                return true;
              if (relationship === "GRANDSON" && k.type === "grandson")
                return true;
              if (
                relationship === "GRANDDAUGHTER" &&
                k.type === "granddaughter"
              )
                return true;
              return false;
            })
          );
        });
      if (hasMB) continue;
    }

    let shareFraction = data.share;
    const count = data.count;

    if (scaleFactor) {
      shareFraction = shareFraction.mul(scaleFactor);
    }

    const percentage = parseFloat(shareFraction.valueOf()) * 100;
    const totalValue = originalNetEstate * shareFraction.valueOf();
    const perPersonValue = count > 0 ? totalValue / count : 0;

    const heirObj = heirs[relationship];
    let whyText = explanations[relationship] || "";
    if (isAul) {
      whyText += ` (تم تعديل النصيب بالعول نظراً لزيادة السهام عن أصل المسألة).`;
    }
    whyText = formatExplanation(whyText, gender);

    const individualShareFraction =
      count > 1 ? shareFraction.div(new Fraction(count)) : shareFraction;

    if (heirObj && heirObj.branches && heirObj.branches.length > 0) {
      for (const b of heirObj.branches) {
        const bCount = b.count;
        const bShare = individualShareFraction.mul(new Fraction(bCount));
        const bPercentage = (percentage / count) * bCount;
        const bTotalValue = perPersonValue * bCount;
        const nameMap = {
          GRANDSON: "ابن ابن",
          GRANDDAUGHTER: "بنت ابن",
          GREAT_GRANDSON: "ابن ابن ابن",
          GREAT_GRANDDAUGHTER: "بنت ابن ابن",
        };
        const baseName =
          nameMap[relationship] || HEIR_NAMES_AR[relationship] || relationship;
        const bDisplayName = b.designation
          ? `${baseName} ${b.designation}`
          : baseName;
        const bRel =
          b.id && b.id !== "initial" ? `${relationship}_${b.id}` : relationship;

        distributions.push({
          relationship: bRel,
          relationship_display: bDisplayName,
          count: bCount,
          share_fraction: bShare.toString(),
          individual_share_fraction: individualShareFraction.toString(),
          percentage: Math.round(bPercentage * 10000) / 10000,
          individual_percentage:
            Math.round((percentage / count) * 10000) / 10000,
          total_value: Math.round(bTotalValue * 100) / 100,
          per_person_value: Math.round(perPersonValue * 100) / 100,
          why: whyText,
        });
      }
    } else {
      let displayName = heirObj ? heirObj.displayName : relationship;
      if (relationship === "TREASURY") {
        displayName = "بيت المال";
      }

      distributions.push({
        relationship,
        relationship_display: displayName,
        count,
        share_fraction: shareFraction.toFraction
          ? shareFraction.toFraction()
          : shareFraction.toString(),
        individual_share_fraction: individualShareFraction.toFraction
          ? individualShareFraction.toFraction()
          : individualShareFraction.toString(),
        percentage: Math.round(percentage * 10000) / 10000,
        individual_percentage:
          count > 1
            ? Math.round((percentage / count) * 10000) / 10000
            : Math.round(percentage * 10000) / 10000,
        total_value: Math.round(totalValue * 100) / 100,
        per_person_value: Math.round(perPersonValue * 100) / 100,
        why: whyText,
      });
    }
  }

  // 2. Add Executed Mandatory Bequests (الوصية الواجبة)
  if (
    mandatoryBequestsResult &&
    mandatoryBequestsResult.list &&
    mandatoryBequestsResult.list.length > 0
  ) {
    let sonIndex = 0;
    let daughterIndex = 0;
    for (const mb of mandatoryBequestsResult.list) {
      if (mb.type === "son") sonIndex++;
      else if (mb.type === "daughter") daughterIndex++;

      const parentDesignation =
        mb.type === "son"
          ? getParentDesignation(mb, sonIndex)
          : getParentDesignation(mb, daughterIndex);

      for (const kid of mb.kids) {
        const pct =
          originalNetEstate > 0
            ? (kid.value / originalNetEstate) * 100
            : kid.share.valueOf() * 100;
        let relationshipDisplay = "";
        if (kid.type === "grandson")
          relationshipDisplay = `ابن ابن ${parentDesignation}`;
        else if (kid.type === "granddaughter")
          relationshipDisplay = `بنت ابن ${parentDesignation}`;
        else if (kid.type === "great_grandson")
          relationshipDisplay = `ابن ابن ابن ${parentDesignation}`;
        else if (kid.type === "great_granddaughter")
          relationshipDisplay = `بنت ابن ابن ${parentDesignation}`;
        else if (kid.type === "grandson_of_daughter")
          relationshipDisplay = `ابن بنت ${parentDesignation}`;
        else if (kid.type === "granddaughter_of_daughter")
          relationshipDisplay = `بنت بنت ${parentDesignation}`;

        distributions.push({
          relationship: `MANDATORY_WILL_${mb.id}_${kid.type}`,
          relationship_display: relationshipDisplay,
          count: kid.count,
          share_fraction: kid.share.mul(new Fraction(kid.count)).toString(),
          individual_share_fraction: kid.share.toString(),
          percentage: Math.round(pct * kid.count * 10000) / 10000,
          individual_percentage: Math.round(pct * 10000) / 10000,
          total_value: Math.round(kid.value * kid.count * 100) / 100,
          per_person_value: Math.round(kid.value * 100) / 100,
          why: `وصية واجبة للفروع من التركة المستحقة (نصيب المورث الافتراضي: ${mb.executed_parent_share.toString()})`,
        });
      }
    }
  }

  // 3. Add Executed Voluntary Wills (الوصايا الاختيارية)
  if (willsExecuted && willsExecuted.length > 0) {
    const mbFract =
      (mandatoryBequestsResult && mandatoryBequestsResult.fraction) ||
      new Fraction(0);
    const scaleRemaining = new Fraction(1).sub(mbFract);
    for (const will of willsExecuted) {
      const executedFraction =
        will.executed_fraction_obj ||
        new Fraction(will.executed_fraction_share || "0");
      const willEntireEstateFraction = executedFraction.mul(scaleRemaining);
      const willFractStr = willEntireEstateFraction.toString();
      const pct =
        originalNetEstate > 0
          ? (will.executed_value / originalNetEstate) * 100
          : willEntireEstateFraction.valueOf() * 100;
      const resolvedWillName =
        will.name?.trim() && will.name !== "وصية غير مسماة"
          ? will.name.trim()
          : will.original_value
            ? `مُوصَىٰ له بـ ${will.original_value}`
            : "مُوصَىٰ له";

      distributions.push({
        relationship: `WILL_${resolvedWillName}`,
        relationship_display: resolvedWillName,
        count: 1,
        count_display: "-",
        share_fraction: willFractStr,
        individual_share_fraction: willFractStr,
        percentage: Math.round(pct * 10000) / 10000,
        individual_percentage: Math.round(pct * 10000) / 10000,
        total_value: Math.round(will.executed_value * 100) / 100,
        per_person_value: Math.round(will.executed_value * 100) / 100,
        why: `تنفيذ الوصية الشرعية (الكسر المطلوب: ${will.original_value})`,
      });
    }
  }

  // 4. Add Excluded/Blocked Heirs (المحجوبون من الميراث)
  for (const [relationship, heirObj] of Object.entries(heirs)) {
    if (heirObj.is_blocked && !results[relationship]) {
      const hasMB =
        mandatoryBequestsResult &&
        mandatoryBequestsResult.list &&
        mandatoryBequestsResult.list.some((mb) => {
          return (
            mb.kids &&
            mb.kids.some((k) => {
              if (
                relationship === "GREAT_GRANDSON" &&
                k.type === "great_grandson"
              )
                return true;
              if (
                relationship === "GREAT_GRANDDAUGHTER" &&
                k.type === "great_granddaughter"
              )
                return true;
              if (relationship === "GRANDSON" && k.type === "grandson")
                return true;
              if (
                relationship === "GRANDDAUGHTER" &&
                k.type === "granddaughter"
              )
                return true;
              return false;
            })
          );
        });
      if (hasMB) continue;

      let whyText =
        explanations[relationship] ||
        `${heirObj.displayName} محجوب من الميراث.`;
      whyText = formatExplanation(whyText, gender);
      if (heirObj.branches && heirObj.branches.length > 0) {
        for (const b of heirObj.branches) {
          const nameMap = {
            GRANDSON: "ابن ابن",
            GRANDDAUGHTER: "بنت ابن",
            GREAT_GRANDSON: "ابن ابن ابن",
            GREAT_GRANDDAUGHTER: "بنت ابن ابن",
          };
          const baseName =
            nameMap[relationship] || HEIR_NAMES_AR[relationship] || relationship;
          const bDisplayName = b.designation
            ? `${baseName} ${b.designation}`
            : baseName;
          const bRel =
            b.id && b.id !== "initial" ? `${relationship}_${b.id}` : relationship;
          distributions.push({
            relationship: bRel,
            relationship_display: bDisplayName,
            count: b.count,
            share_fraction: "0",
            individual_share_fraction: "0",
            percentage: 0,
            individual_percentage: 0,
            total_value: 0,
            per_person_value: 0,
            why: whyText,
          });
        }
      } else {
        distributions.push({
          relationship,
          relationship_display: heirObj.displayName,
          count: heirObj.count,
          share_fraction: "0",
          individual_share_fraction: "0",
          percentage: 0,
          individual_percentage: 0,
          total_value: 0,
          per_person_value: 0,
          why: whyText,
        });
      }
    }
  }

  const pregnancyOpt = PREGNANCY_OPTIONS.find(
    (o) => o.key === pregnancyRelation,
  );
  const pregnancyRelationLabel = pregnancyOpt
    ? pregnancyOpt.label
    : "ابن أو بنت";

  return {
    case_id: caseData.id,
    deceased_name: caseData.name,
    deceased_gender: gender,
    total_estate: caseData.total_estate_value,
    deductions:
      (caseData.funeral_expenses || 0) +
      (debtsTotal !== undefined ? debtsTotal : (parseFloat(caseData.debts) || 0)),
    debts_breakdown: debtsBreakdown,
    debts_list: debtsList,
    debts: debtsList && debtsList.length > 0 ? debtsList : (caseData.debts || []),
    is_insufficient_estate: Boolean(isInsufficientEstate),
    is_estate_exhausted: Boolean(isEstateExhausted),
    original_net_estate: originalNetEstate,
    net_estate: originalNetEstate,
    total_wills_cost: totalWillsCost,
    mandatory_bequests_cost: mandatoryBequestsResult
      ? mandatoryBequestsResult.cost
      : 0,
    mandatory_bequests_scaled: mandatoryBequestsResult
      ? mandatoryBequestsResult.isScaled
      : false,
    mandatory_bequests_result: mandatoryBequestsResult || null,
    caseData: caseData || null,
    baseOrigin: baseOrigin || null,
    base_origin: baseOrigin || null,
    is_aul: isAul,
    aul_base:
      awlBase ||
      (totalShares && baseOrigin
        ? Math.round(totalShares.valueOf() * baseOrigin)
        : null),
    aul_sum_fractions: awlBase
      ? awlBase.toString()
      : totalShares
        ? totalShares.toString()
        : "1",
    is_akdariyya: Boolean(isAkdariyya),
    is_malikiyyah: Boolean(isMalikiyyah),
    is_shibh_malikiyyah: Boolean(isShibhMalikiyyah),
    is_mushtarakah: Boolean(isMushtarakah),
    is_umariyyah: Boolean(isUmariyyah),
    is_minbariyya: Boolean(isMinbariyya),
    is_kharqa: Boolean(isKharqa),
    is_muadah: Boolean(isMuadah),
    special_case: specialCase || null,
    is_radd: Boolean(raddResult && raddResult.isRadd),
    radd_result: raddResult || null,
    wills_executed: willsExecuted || [],
    wills_explanation: willsExplanation || "",
    is_wills_scaled: isWillsScaled || false,
    mandatory_bequests: caseData.mandatoryBequests || [],
    distributions: distributions.sort((a, b) => b.percentage - a.percentage),
    mandatory_bequest_steps: mandatoryBequestSteps || [],
    standard_steps: standardSteps || [],
    prescribed_shares: prescribedShares || null,
    explanations: explanations || {},
    has_pregnancy: hasPregnancy,
    pregnancy_relation: pregnancyRelation,
    pregnancy_relation_label: pregnancyRelationLabel,
    is_pregnancy_blocked: isPregnancyBlocked,
    pregnancy_notice:
      hasPregnancy && !isPregnancyBlocked
        ? "الراجح عند القانون المغربى هو إنتظار الوضع وعدم تقسيم التركة"
        : null,
  };
}
