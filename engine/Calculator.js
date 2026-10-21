/**
 * @file Calculator.js
 * @description Main orchestrator for Islamic inheritance calculations and statutory Mandatory Bequests (الوصية الواجبة).
 * Coordinates debt deductions, mandatory bequests, voluntary wills, fixed shares, residuary distribution,
 * Awl, Radd, Treasury fallbacks, and multi-step solver pedagogical breakdowns.
 */

import Fraction from "../fraction.js";
import { distributeResidue } from "./Asabah.js";
import { checkAndApplyAwl } from "./Awl.js";
import {
  applyBlockingRules,
  checkIsPregnancyBlocked,
} from "./BlockingRules.js";
import { HEIR_NAMES_AR, getParentDesignation } from "./Explanations.js";
import { calculateFixedShares } from "./FixedShares.js";
import {
  calculateGrandfatherWithSiblings,
  hasGrandfatherWithSiblings,
  isAkdariyya,
  isMalikiyyah,
  isShibhMalikiyyah,
} from "./Grandfather.js";
import { isMushtarakah, calculateMushtarakah } from "./Mushtarakah.js";
import { calculateGrandmothersShare } from "./Grandmothers.js";
import { calculateMafqoudCase } from "./Mafqoud.js";
import { calculateIqrarCase } from "./Iqrar.js";
import { calculateMandatoryBequests } from "./MandatoryBequest.js";
import { calculateMunasakhatCase } from "./Munasakhat.js";
import { executeWills, prepareFinalResults } from "./PrepareResults.js";
import { checkAndApplyRadd } from "./Radd.js";
import { getMandatoryBequestSteps, getStandardSteps } from "./SolverDetails.js";
import { detectSpecialCase } from "./SpecialCases.js";
import { calculateDebtsBreakdown } from "./Debts.js";

/**
 * @typedef {Object} RawHeirInput
 * @property {string} relationship - Standard relationship code (e.g. 'WIFE', 'SON').
 * @property {number} [count=1] - Number of heirs for this relationship.
 */

/**
 * @typedef {Object} MandatoryBequestInput
 * @property {string} id - Unique identifier for the bequest branch.
 * @property {'son'|'daughter'} type - Branch gender type.
 * @property {number} [sonsCount=0] - Number of living sons in this branch.
 * @property {number} [daughtersCount=0] - Number of living daughters in this branch.
 * @property {number} [greatSonsCount=0] - Number of living great-grandsons in this branch.
 * @property {number} [greatDaughtersCount=0] - Number of living great-granddaughters in this branch.
 * @property {boolean} [spouseAlive=false] - True if the deceased child's spouse is alive.
 * @property {boolean} [motherAlive=false] - True if the deceased child's mother is alive.
 * @property {boolean} [greatSpouseAlive=false] - True if the deceased grandson's spouse is alive.
 */

/**
 * @typedef {Object} CaseData
 * @property {string} [id] - Unique case identifier.
 * @property {string} [name] - Name of the deceased.
 * @property {'male'|'female'} [gender] - Gender of the deceased.
 * @property {number} total_estate_value - Total gross estate value.
 * @property {number} [funeral_expenses=0] - Pre-distribution funeral costs.
 * @property {number} [debts=0] - Debts and obligations.
 * @property {RawHeirInput[]} heirs - List of surviving primary heirs.
 * @property {import('./PrepareResults.js').WillInput[]} [wills] - List of voluntary wills.
 * @property {boolean} [heirsApprovedExcess=false] - Whether heirs approved wills exceeding 1/3.
 * @property {MandatoryBequestInput[]} [mandatoryBequests] - Mandatory bequest configurations.
 * @property {boolean} [hasMissingPerson=false] - Whether a missing person exists.
 * @property {string} [missingPersonType] - Relationship key of the missing person.
 * @property {number} [missingPersonCount=1] - Count of missing persons.
 */

/**
 * Main Islamic Inheritance Calculator engine class.
 *
 * Life Cycle of Calculation:
 * 1. Deduct funeral expenses and debts from gross estate -> Net Estate (التركة الصافية).
 * 2. If Mandatory Bequests (الوصية الواجبة) exist:
 *    - Calculate hypothetical share of deceased children via preliminary problem (العمل التمهيدي).
 *    - Deduct virtual spouse, mother/paternal grandmother, and grandfather shares in sub-problems.
 *    - Distribute branch residue to living grandchildren and great-grandchildren.
 *    - Cap total mandatory bequests at 1/3 of the net estate.
 * 3. Process Voluntary Wills (الوصية الاختيارية) against remaining estate portion.
 * 4. Apply Islamic Blocking Rules (حجب الحرمان) across all primary heirs.
 * 5. Allocate Quranic Fixed Shares (أصحاب الفروض) and Grandmothers' share.
 * 6. Distribute remaining residue to Residuary Heirs (العصبات) or Maliki Grandfather-Sibling division.
 * 7. Apply Al-Awl (العول) if total shares > 1.
 * 8. Apply Al-Radd (الرد) if total shares < 1 with no Asabah.
 * 9. Fallback to Islamic Treasury (بيت المال) if no surviving heirs exist.
 * 10. Generate pedagogical steps and compile final normalized distributions.
 */
export class InheritanceCalculator {
  /**
   * Initializes the InheritanceCalculator instance with case parameters.
   *
   * @param {CaseData} caseData - The inheritance case input model.
   */
  constructor(caseData) {
    this.case = caseData;
    this.gender =
      caseData.gender ||
      (caseData.heirs &&
      caseData.heirs.some((h) => h.relationship === "HUSBAND")
        ? "female"
        : "male");
    this.heirs = {};

    // 1. Initialize primary heirs (with alias normalization)
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

    for (const h of caseData.heirs || []) {
      const rel = REL_ALIASES[h.relationship] || h.relationship;
      this.heirs[rel] = {
        relationship: rel,
        count: h.count || 1,
        is_blocked: false,
        blocked_by: null,
        displayName: HEIR_NAMES_AR[rel] || HEIR_NAMES_AR[h.relationship] || rel,
      };
    }

    // 2. Register living grandchildren from mandatory bequest branches into heirs map
    if (caseData.mandatoryBequests && caseData.mandatoryBequests.length > 0) {
      let sonIndex = 0;
      for (const mb of caseData.mandatoryBequests) {
        if (mb.type === "son") {
          sonIndex++;
          const parentDesignation = getParentDesignation(mb, sonIndex);

          const totalSons = parseInt(mb.sonsCount, 10) || 0;
          const totalDaughters = parseInt(mb.daughtersCount, 10) || 0;
          const totalGreatSons = parseInt(mb.greatSonsCount, 10) || 0;
          const totalGreatDaughters = parseInt(mb.greatDaughtersCount, 10) || 0;

          const addBranchHeir = (key, count, name) => {
            if (count <= 0) return;
            if (!this.heirs[key]) {
              this.heirs[key] = {
                relationship: key,
                count: count,
                is_blocked: false,
                blocked_by: null,
                displayName: `${name} ${parentDesignation}`,
                branches: [
                  {
                    id: mb.id,
                    designation: parentDesignation,
                    count: count,
                  },
                ],
              };
            } else {
              if (!this.heirs[key].branches) {
                this.heirs[key].branches = [
                  {
                    id: "initial",
                    designation: "",
                    count: this.heirs[key].count,
                  },
                ];
              }
              this.heirs[key].count += count;
              this.heirs[key].displayName += ` و ${parentDesignation}`;
              this.heirs[key].branches.push({
                id: mb.id,
                designation: parentDesignation,
                count: count,
              });
            }
          };

          addBranchHeir("GRANDSON", totalSons, "ابن ابن");
          addBranchHeir("GRANDDAUGHTER", totalDaughters, "بنت ابن");
          addBranchHeir("GREAT_GRANDSON", totalGreatSons, "ابن ابن ابن");
          addBranchHeir(
            "GREAT_GRANDDAUGHTER",
            totalGreatDaughters,
            "بنت ابن ابن",
          );
        }
      }
    }

    const total = parseFloat(caseData.total_estate_value) || 0;
    const funeral = parseFloat(caseData.funeral_expenses) || 0;
    const debtsBreakdown = calculateDebtsBreakdown(
      total,
      caseData.debtsList || caseData.debts,
    );
    const debts = debtsBreakdown.totalDebts;

    this.total_estate = total;
    this.funeral_expenses = funeral;
    this.debts_breakdown = debtsBreakdown;
    this.debts_total = debts;
    this.net_estate = Math.max(0, total - (funeral + debts));
    this.is_insufficient_estate =
      debtsBreakdown.isInsufficient ||
      (total > 0 && total - (funeral + debts) < 0);
    this.is_estate_exhausted =
      debtsBreakdown.isExhausted ||
      (total > 0 && total - (funeral + debts) <= 0);
    this.wills_input = caseData.wills || [];
    this.heirs_approved_excess = caseData.heirsApprovedExcess === true;
    this.has_pregnancy = caseData.hasPregnancy === true;
    this.pregnancy_relation = caseData.pregnancyRelation || "SON_OR_DAUGHTER";

    this.results = {};
    this.explanations = {};
  }

  /**
   * Calculates statutory Mandatory Bequests (الوصية الواجبة) under Moroccan Law (Articles 369-372 of the Family Code).
   * Delegated to the specialized `MandatoryBequest.js` module.
   *
   * @returns {{cost: number, fraction: Fraction, isScaled: boolean, list: Array<Object>}} Result summary.
   */
  calculateMandatoryBequests() {
    if (this.is_estate_exhausted) {
      return { cost: 0, fraction: new Fraction(0), isScaled: false, list: [] };
    }
    return calculateMandatoryBequests({
      heirs: this.heirs,
      caseData: this.case,
      wills_input: this.wills_input,
      heirs_approved_excess: this.heirs_approved_excess,
      net_estate: this.net_estate,
      CalculatorClass: InheritanceCalculator,
    });
  }

  /**
   * Executes the complete inheritance calculation pipeline.
   *
   * @returns {import('./PrepareResults.js').FinalDistribution[]|Object} Result payload with formatted distributions and step breakdowns.
   */
  calculate() {
    if (this.case.hasMunasakhat && !this.case._isSubCase) {
      return calculateMunasakhatCase({
        CalculatorClass: InheritanceCalculator,
        baseCaseData: {
          ...this.case,
          _isSubCase: true,
        },
        munasakhatCases: this.case.munasakhatCases || [],
      });
    }

    if (this.case.hasMissingPerson && !this.case._isSubCase) {
      return calculateMafqoudCase({
        CalculatorClass: InheritanceCalculator,
        caseData: {
          ...this.case,
          _isSubCase: true,
        },
      });
    }

    if (this.case.hasIqrar && !this.case._isSubCase) {
      return calculateIqrarCase({
        CalculatorClass: InheritanceCalculator,
        caseData: {
          ...this.case,
          _isSubCase: true,
        },
      });
    }

    // Run blocking rules temporarily to see who is blocked
    applyBlockingRules(this.heirs, {});

    // Evaluate pregnancy blocking if active
    this.is_pregnancy_blocked = this.has_pregnancy
      ? checkIsPregnancyBlocked(this.pregnancy_relation, this.heirs)
      : false;

    // 1. Process Mandatory Bequests (الوصية الواجبة)
    const mbResult = this.calculateMandatoryBequests();
    this.mandatory_bequests_result = mbResult;

    const netEstateForWillsAndHeirs = this.net_estate - mbResult.cost;

    // Limit for voluntary wills: remaining portion of 1/3 after mandatory bequests
    let voluntaryLimitFraction = new Fraction(0);
    if (mbResult.fraction.lessThan(new Fraction(1, 3))) {
      const numerator = new Fraction(1, 3).sub(mbResult.fraction);
      const denominator = new Fraction(1).sub(mbResult.fraction);
      voluntaryLimitFraction = numerator.div(denominator);
    }

    // Scale the voluntary wills input to the remaining estate basis
    const mbFract = mbResult.fraction;
    const scaleRemaining = new Fraction(1).sub(mbFract);
    const scaledWillsInput = this.wills_input.map((will) => {
      let newValue = will.value;
      if (scaleRemaining.valueOf() > 0) {
        if (will.valueType === "fraction") {
          const parts = (will.value || "1/3").split("/");
          const num = parseInt(parts[0], 10) || 0;
          const den = parts[1] ? parseInt(parts[1], 10) : 1;
          const scaledFract = new Fraction(num, den).div(scaleRemaining);
          newValue = scaledFract.toString();
        } else if (will.valueType === "percentage") {
          const val = parseFloat(will.value) || 0;
          const scaledFract = new Fraction(Math.round(val * 100), 10000).div(
            scaleRemaining,
          );
          newValue = (scaledFract.valueOf() * 100).toString();
        }
      }
      return {
        ...will,
        value: newValue,
        original_value: will.value,
      };
    });

    // Process Voluntary Wills on the remaining estate
    const willsResult = executeWills(
      scaledWillsInput,
      netEstateForWillsAndHeirs,
      this.heirs_approved_excess,
      voluntaryLimitFraction,
    );
    this.wills_executed = willsResult.processedWills;
    this.total_wills_cost = willsResult.finalWillsCost;
    this.net_estate_for_heirs = willsResult.netEstateForHeirs;

    // Scale heirs fraction to account for mandatory bequests and voluntary wills
    this.heirs_scale_fraction = willsResult.heirsScaleFraction.mul(
      new Fraction(1).sub(mbResult.fraction),
    );
    this.wills_explanation = willsResult.willsExplanation;
    this.is_wills_scaled = willsResult.isWillsScaled;

    const originalNetEstate = this.net_estate;

    // 2. Apply Islamic Blocking Rules (حجب الحرمان)
    for (const h of Object.values(this.heirs)) {
      h.is_blocked = false;
      h.blocked_by = null;
    }
    applyBlockingRules(this.heirs, this.explanations);

    // 3. Calculate Quranic Shares and Residue
    let remaining = new Fraction(1);

    // Standard fixed shares (excluding Grandfather if sharing with siblings)
    remaining = calculateFixedShares(
      this.heirs,
      this.results,
      this.explanations,
      remaining,
    );

    // Grandmothers share
    remaining = calculateGrandmothersShare(
      this.heirs,
      this.results,
      this.explanations,
      remaining,
    );

    // Check if Al-Akdariyya (المسألة الأكدرية)
    this.is_akdariyya = isAkdariyya(this.heirs);
    this.is_malikiyyah = isMalikiyyah(this.heirs);
    this.is_shibh_malikiyyah = isShibhMalikiyyah(this.heirs);
    this.is_mushtarakah = isMushtarakah(this.heirs);

    // Save prescribed Quranic fixed shares (الفرائض الشرعية المقدرة) before residue distribution
    this.prescribed_shares = {};
    for (const [rel, d] of Object.entries(this.results)) {
      let pShare = d.share;
      if (
        [
          "PATERNAL_GRANDMOTHER",
          "MATERNAL_GRANDMOTHER",
          "MATERNAL_GREAT_GRANDMOTHER",
          "MATERNAL_PATERNAL_GREAT_GRANDMOTHER",
        ].includes(rel) &&
        !d.asabah &&
        d.share &&
        !d.share.equals(new Fraction(0))
      ) {
        pShare = new Fraction(1, 6);
      }
      this.prescribed_shares[rel] = {
        share: pShare,
        count: d.count,
        asabah: Boolean(d.asabah),
      };
    }

    if (this.is_akdariyya) {
      const gfKey = [
        "PATERNAL_GRANDFATHER",
        "PATERNAL_GREAT_GRANDFATHER",
      ].find(
        (r) =>
          this.heirs[r] &&
          !this.heirs[r].is_blocked &&
          this.heirs[r].count > 0,
      );
      const sisterKey =
        this.heirs["FULL_SISTER"] &&
        !this.heirs["FULL_SISTER"].is_blocked &&
        this.heirs["FULL_SISTER"].count > 0
          ? "FULL_SISTER"
          : "PATERNAL_SISTER";

      if (gfKey) {
        this.prescribed_shares[gfKey] = {
          share: new Fraction(1, 6),
          count: 1,
          asabah: false,
        };
      }
      if (sisterKey) {
        this.prescribed_shares[sisterKey] = {
          share: new Fraction(1, 2),
          count: 1,
          asabah: false,
        };
      }
    }

    if (this.is_mushtarakah) {
      this.prescribed_shares["FULL_BROTHER"] = {
        share: new Fraction(1, 3),
        count: this.heirs["FULL_BROTHER"]?.count || 1,
        asabah: false,
        mushtarakah: true,
      };
      if (this.heirs["FULL_SISTER"] && !this.heirs["FULL_SISTER"].is_blocked) {
        this.prescribed_shares["FULL_SISTER"] = {
          share: new Fraction(1, 3),
          count: this.heirs["FULL_SISTER"]?.count || 1,
          asabah: false,
          mushtarakah: true,
        };
      }
      remaining = calculateMushtarakah(
        this.heirs,
        this.results,
        this.explanations,
      );
    } else if (hasGrandfatherWithSiblings(this.heirs)) {
      const otherFixedHeirsExist = [
        "HUSBAND",
        "WIFE",
        "MOTHER",
        "DAUGHTER",
        "GRANDDAUGHTER",
        "GREAT_GRANDDAUGHTER",
        "PATERNAL_GRANDMOTHER",
        "MATERNAL_GRANDMOTHER",
        "MATERNAL_GREAT_GRANDMOTHER",
        "PATERNAL_GREAT_GRANDMOTHER",
        "MATERNAL_PATERNAL_GREAT_GRANDMOTHER",
      ].some((r) => this.heirs[r] && !this.heirs[r].is_blocked);

      remaining = calculateGrandfatherWithSiblings(
        this.heirs,
        this.results,
        this.explanations,
        remaining,
        otherFixedHeirsExist,
      );

      const gfKey = [
        "PATERNAL_GRANDFATHER",
        "PATERNAL_GREAT_GRANDFATHER",
      ].find((r) => this.heirs[r] && !this.heirs[r].is_blocked);

      if (gfKey && this.results[gfKey]) {
        if (this.results[gfKey].is_fard_third) {
          this.prescribed_shares[gfKey] = {
            share: new Fraction(1, 3),
            count: 1,
            asabah: false,
          };
        } else if (this.results[gfKey].is_fard_sixth) {
          this.prescribed_shares[gfKey] = {
            share: new Fraction(1, 6),
            count: 1,
            asabah: false,
          };
        }
      }

      if (this.results["FULL_SISTER"] && !this.results["FULL_SISTER"].asabah) {
        this.prescribed_shares["FULL_SISTER"] = {
          share: this.results["FULL_SISTER"].share,
          count: this.heirs["FULL_SISTER"]?.count || 1,
          asabah: false,
        };
      }
    } else {
      distributeResidue(this.heirs, this.results, this.explanations, remaining);
    }

    // Save initial jurisprudential shares before Awl or Radd for pedagogical step breakdown
    this.initial_shares = {};
    for (const [rel, d] of Object.entries(this.results)) {
      this.initial_shares[rel] = {
        share: d.share,
        count: d.count,
        asabah: d.asabah,
      };
    }

    // 4. Apply Al-Awl (العول)
    const awlResult = checkAndApplyAwl(this.results, this.explanations);

    // 5. Apply Al-Radd (الرد) if no Awl occurred
    let raddResult = null;
    if (!awlResult.isAul) {
      raddResult = checkAndApplyRadd(
        this.results,
        this.explanations,
        this.heirs,
        this.initial_shares,
        originalNetEstate - this.total_wills_cost,
      );
      this.radd_result = raddResult;
    }

    // 6. Fallback to Islamic Treasury (بيت المال) if there are no surviving active heirs
    const activeHeirsCount = Object.values(this.heirs).filter(
      (h) => h.count > 0 && !h.is_blocked,
    ).length;
    if (activeHeirsCount === 0) {
      this.results["TREASURY"] = {
        relationship: "TREASURY",
        count: 1,
        share: remaining,
      };
      this.explanations["TREASURY"] =
        "يذهب باقي التركة لبيت مال المسلمين لعدم وجود وريث شرعي.";
    }

    // 7. Format and Prepare Final Results
    const specialCase = detectSpecialCase(
      this.heirs,
      {
        aul_base: awlResult.awlBase,
        is_aul: awlResult.isAul,
        base_origin: awlResult.baseOrigin,
        is_akdariyya: this.is_akdariyya,
        is_malikiyyah: this.is_malikiyyah,
        is_shibh_malikiyyah: this.is_shibh_malikiyyah,
        is_mushtarakah: this.is_mushtarakah,
      },
      this,
    );
    this.special_case = specialCase;
    this.is_umariyyah = specialCase?.id?.startsWith("umariyyah") || false;
    this.is_minbariyya = specialCase?.id === "minbariyya" || false;
    this.is_kharqa = specialCase?.id === "kharqa" || false;
    this.is_muadah = specialCase?.id === "muadah" || false;

    const mandatoryBequestSteps = getMandatoryBequestSteps(this);
    const standardSteps = getStandardSteps(this, awlResult);

    return prepareFinalResults({
      results: this.results,
      heirs: this.heirs,
      explanations: this.explanations,
      caseData: this.case,
      gender: this.gender,
      netEstate: originalNetEstate - this.total_wills_cost,
      originalNetEstate,
      totalWillsCost: this.total_wills_cost,
      willsExecuted: this.wills_executed,
      willsExplanation: this.wills_explanation,
      isWillsScaled: this.is_wills_scaled,
      isAul: awlResult.isAul,
      totalShares: awlResult.sumShares,
      awlBase: awlResult.awlBase,
      baseOrigin: awlResult.baseOrigin,
      raddResult: this.radd_result,
      heirsScaleFraction: this.heirs_scale_fraction,
      mandatoryBequestsResult: this.mandatory_bequests_result,
      mandatoryBequestSteps,
      standardSteps,
      prescribedShares: this.prescribed_shares,
      hasPregnancy: this.has_pregnancy,
      pregnancyRelation: this.pregnancy_relation,
      isPregnancyBlocked: this.is_pregnancy_blocked,
      isAkdariyya: this.is_akdariyya,
      isMalikiyyah: this.is_malikiyyah,
      isShibhMalikiyyah: this.is_shibh_malikiyyah,
      isMushtarakah: this.is_mushtarakah,
      specialCase,
      isUmariyyah: this.is_umariyyah,
      isMinbariyya: this.is_minbariyya,
      isKharqa: this.is_kharqa,
      isMuadah: this.is_muadah,
      debtsBreakdown: this.debts_breakdown,
      debtsList: this.debts_breakdown?.items || [],
      debtsTotal: this.debts_total,
      isInsufficientEstate: this.is_insufficient_estate,
      isEstateExhausted: this.is_estate_exhausted,
    });
  }
}
