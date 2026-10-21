/**
 * @file SolverDetails.js
 * @description Generates pedagogical, step-by-step breakdown data structures (خطوات الحل والشرح الفقهي)
 * for standard inheritance cases and Moroccan mandatory bequest (الوصية الواجبة) workflows.
 */

import Fraction from "../fraction.js";
import {
  HEIR_NAMES_AR,
  getParentDesignation,
  getParentLabel,
} from "./Explanations.js";

/**
 * Computes the Greatest Common Divisor of two numbers.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
const gcd = (a, b) => {
  const x = Math.abs(Number(a));
  const y = Math.abs(Number(b));
  return y === 0 ? x : gcd(y, x % y);
};

const lcm = (a, b) => {
  const x = Math.abs(Number(a));
  const y = Math.abs(Number(b));
  if (!x || !y) return 0;
  return (x * y) / gcd(x, y);
};

/**
 * Determines the specific Ta'seeb category (عصبة بالنفس، بالغير، أو مع الغير)
 * according to classical Maliki jurisprudence and Moroccan Family Code (Articles 348-350).
 * @param {string} rel - Heir relationship key.
 * @param {Object} heirs - Heirs dictionary.
 * @returns {{type: string, note: string}}
 */
export function getAsabahType(rel, heirs) {
  // 1. Asabah bil-Ghayr (عصبة بالغير - المادة 348)
  if (rel === "DAUGHTER" && heirs["SON"] && !heirs["SON"].is_blocked && heirs["SON"].count > 0) {
    return { type: "عصبة بالغير", note: "عصبة بالغير مع الابن بقاعدة: للذكر مثل حظ الأنثيين (المادة 348 من مدونة الأسرة)" };
  }
  if (rel === "SON" && heirs["DAUGHTER"] && !heirs["DAUGHTER"].is_blocked && heirs["DAUGHTER"].count > 0) {
    return { type: "عصبة بالغير", note: "يعصب أخواته بالغير بقاعدة: للذكر مثل حظ الأنثيين (المادة 348 من مدونة الأسرة)" };
  }
  if (rel === "GRANDDAUGHTER" && heirs["GRANDSON"] && !heirs["GRANDSON"].is_blocked && heirs["GRANDSON"].count > 0) {
    return { type: "عصبة بالغير", note: "عصبة بالغير مع ابن الابن المساوي لها في الدرجة (المادة 348 من مدونة الأسرة)" };
  }
  if (rel === "GRANDSON" && heirs["GRANDDAUGHTER"] && !heirs["GRANDDAUGHTER"].is_blocked && heirs["GRANDDAUGHTER"].count > 0) {
    return { type: "عصبة بالغير", note: "يعصب بنت الابن بالغير بقاعدة: للذكر مثل حظ الأنثيين (المادة 348 من مدونة الأسرة)" };
  }
  if (rel === "FULL_SISTER" && heirs["FULL_BROTHER"] && !heirs["FULL_BROTHER"].is_blocked && heirs["FULL_BROTHER"].count > 0) {
    return { type: "عصبة بالغير", note: "عصبة بالغير مع الأخ الشقيق بقاعدة: للذكر مثل حظ الأنثيين (المادة 348 من مدونة الأسرة)" };
  }
  if (rel === "FULL_BROTHER" && heirs["FULL_SISTER"] && !heirs["FULL_SISTER"].is_blocked && heirs["FULL_SISTER"].count > 0) {
    return { type: "عصبة بالغير", note: "يعصب الأخت الشقيقة بالغير بقاعدة: للذكر مثل حظ الأنثيين (المادة 348 من مدونة الأسرة)" };
  }
  if (rel === "PATERNAL_SISTER" && heirs["PATERNAL_BROTHER"] && !heirs["PATERNAL_BROTHER"].is_blocked && heirs["PATERNAL_BROTHER"].count > 0) {
    return { type: "عصبة بالغير", note: "عصبة بالغير مع الأخ لأب بقاعدة: للذكر مثل حظ الأنثيين (المادة 348 من مدونة الأسرة)" };
  }
  if (rel === "PATERNAL_BROTHER" && heirs["PATERNAL_SISTER"] && !heirs["PATERNAL_SISTER"].is_blocked && heirs["PATERNAL_SISTER"].count > 0) {
    return { type: "عصبة بالغير", note: "يعصب الأخت لأب بالغير بقاعدة: للذكر مثل حظ الأنثيين (المادة 348 من مدونة الأسرة)" };
  }

  // 2. Asabah ma'al-Ghayr (عصبة مع الغير - المادة 350)
  const hasDaughterBranch =
    (heirs["DAUGHTER"] && !heirs["DAUGHTER"].is_blocked && heirs["DAUGHTER"].count > 0) ||
    (heirs["GRANDDAUGHTER"] && !heirs["GRANDDAUGHTER"].is_blocked && heirs["GRANDDAUGHTER"].count > 0);
  if (rel === "FULL_SISTER" && hasDaughterBranch) {
    return { type: "عصبة مع الغير", note: "عصبة مع الغير لوجود الفرع الوارث المؤنث؛ لقوله ﷺ: «اجعلوا الأخوات مع البنات عصبة» (المادة 350 من مدونة الأسرة)" };
  }
  if (rel === "PATERNAL_SISTER" && hasDaughterBranch) {
    return { type: "عصبة مع الغير", note: "عصبة مع الغير لوجود الفرع الوارث المؤنث؛ لقوله ﷺ: «اجعلوا الأخوات مع البنات عصبة» (المادة 350 من مدونة الأسرة)" };
  }

  // 3. Asabah bin-Nafs (عصبة بالنفس - المادة 349)
  return { type: "عصبة بالنفس", note: "عصبة بالنفس يحوز جميع التركة عند الانفراد أو ما بقي بعد أصحاب الفروض (المادة 349 من مدونة الأسرة)" };
}

/**
 * Explains sequential comparison of 3 or more denominators using the Four Relations (الأنظار الأربعة).
 * @param {number[]} dens
 * @returns {string}
 */
function explainMultipleDenominators(dens) {
  let currentOrigin = dens[0];
  const notes = [];
  for (let i = 1; i < dens.length; i++) {
    const nextD = dens[i];
    const prev = currentOrigin;
    const g = gcd(prev, nextD);
    if (prev === nextD) {
      notes.push(`بين (${prev} و ${nextD}) تماثل فنكتفي بأحدهما (${prev})`);
    } else if (Math.max(prev, nextD) % Math.min(prev, nextD) === 0) {
      const maxVal = Math.max(prev, nextD);
      notes.push(`بين (${prev} و ${nextD}) تداخل فنأخذ الأكبر (${maxVal})`);
      currentOrigin = maxVal;
    } else if (g > 1) {
      const w = prev / g;
      currentOrigin = w * nextD;
      notes.push(`بين (${prev} و ${nextD}) توافق بالقاسم (${g})، فنضرب وفق الأول (${prev}÷${g}=${w}) في كامل الثاني (${w} × ${nextD} = ${currentOrigin})`);
    } else {
      currentOrigin = prev * nextD;
      notes.push(`بين (${prev} و ${nextD}) تباين، فنضرب الأول في الثاني (${prev} × ${nextD} = ${currentOrigin})`);
    }
  }
  return notes.join("، ثم ");
}

/**
 * Generates pedagogical steps for standard inheritance cases (without mandatory bequests).
 *
 * Step 1: Jurisprudential Blocking & Share Assignment (حصر الورثة وتوجيه الفروض والعصوبات).
 * Step 2: Base Origin Determination (تأصيل الفريضة واستخراج أصل المسألة بالأنظار الأربعة).
 * Step 3: Breakdown & Currency Distribution (تصحيح الفريضة وإزالة الانكسار وإخراج الأنصبة).
 *
 * @param {import('./Calculator.js').InheritanceCalculator} calc - Calculator instance.
 * @param {Object} awlResult - Result from checkAndApplyAwl.
 * @returns {Array<{id: string, title: string, desc: string, table: Array<Object>}>} Array of step objects.
 */
export function getStandardSteps(calc, awlResult) {
  const steps = [];

  // =========================================================================
  // Step 1: Explanations Table (حصر الورثة وتوجيه الفروض والعصوبات والحجب)
  // =========================================================================
  const step1Table = [];
  for (const h of Object.values(calc.heirs)) {
    const rel = h.relationship;
    let shareStr = "—";
    let asabahInfo = null;

    if (h.is_blocked) {
      shareStr = "—";
    } else if (
      calc.is_mushtarakah &&
      (rel === "FULL_BROTHER" || rel === "FULL_SISTER")
    ) {
      shareStr = "1/3 بالتشريك";
    } else if (
      calc.is_mushtarakah &&
      (rel === "MATERNAL_BROTHER" || rel === "MATERNAL_SISTER")
    ) {
      shareStr = "1/3 بالتشريك";
    } else if (calc.prescribed_shares && calc.prescribed_shares[rel]) {
      // Default prescribed Quranic share (الفرض الشرعي المقدر)
      const pShare = calc.prescribed_shares[rel].share;
      if (
        rel === "MOTHER" &&
        (calc.is_umariyyah ||
          (calc.explanations[rel] &&
            (calc.explanations[rel].includes("المسألة العمرية") ||
              calc.explanations[rel].includes("الغراو") ||
              calc.explanations[rel].includes("ثلث الباقي"))))
      ) {
        shareStr = "1/3 الباقي";
      } else {
        shareStr = pShare.toString();
      }
    } else if (
      (rel === "PATERNAL_GRANDFATHER" ||
        rel === "PATERNAL_GREAT_GRANDFATHER") &&
      calc.results[rel]?.is_third_of_remainder
    ) {
      shareStr = "1/3 الباقي";
    } else {
      // Agnatic heirs inheriting the residue by Ta'seeb (العصبات)
      const expl = calc.explanations[rel] || "";
      if (
        expl.includes("تعصيب") ||
        expl.includes("عصبة") ||
        (calc.results[rel] && !calc.prescribed_shares?.[rel])
      ) {
        asabahInfo = getAsabahType(rel, calc.heirs);
        shareStr = "الباقي تعصيباً";
      } else if (calc.results[rel]) {
        shareStr = calc.results[rel].share.toString();
      }
    }

    let whyText =
      calc.explanations[rel] ||
      (h.is_blocked ? "محجوب من الميراث." : "يرث نصيبه الشرعي.");
    if (asabahInfo && !h.is_blocked) {
      if (
        !whyText.includes("المادة 348") &&
        !whyText.includes("المادة 349") &&
        !whyText.includes("المادة 350")
      ) {
        whyText = `${whyText} [${asabahInfo.note}].`;
      }
    }

    step1Table.push({
      name: h.displayName,
      share: shareStr,
      why: whyText,
    });
  }

  if (calc.results["TREASURY"]) {
    step1Table.push({
      name: "بيت المال",
      share:
        calc.results["TREASURY"].share?.valueOf() === 1
          ? "التركة كاملة"
          : "الباقي",
      why:
        calc.explanations["TREASURY"] ||
        "يذهب باقي التركة لبيت مال المسلمين لعدم وجود وريث شرعي.",
    });
  }

  steps.push({
    id: "std_step1",
    title: "أولاً: حصر الورثة وتوجيه الفروض والعصوبات وأحكام الحجب",
    desc: "تحديد صفة إرث كل وارث بالفرض أو التعصيب (بالنفس، بالغير، أو مع الغير)، مع بيان أحكام الحجب (حجب حرمان أو حجب نقصان) وفق المنهج المتداول بالمغرب وقواعد مدونة الأسرة:",
    table: step1Table,
  });

  // =========================================================================
  // Step 2: Base Origin Table (تأصيل المسألة والقاسم المشترك لمخارج الفروض)
  // =========================================================================
  let baseOrigin = 1;
  const fixedDenominators = [];

  // Filter active heirs (non-blocked)
  const activeEntries = Object.entries(calc.results).filter(([rel]) => {
    const heir = calc.heirs[rel];
    return (heir && !heir.is_blocked) || rel === "TREASURY";
  });

  // Extract denominators from Quranic fixed shares (including Father/Grandfather 1/6)
  if (
    calc.prescribed_shares &&
    Object.keys(calc.prescribed_shares).length > 0
  ) {
    for (const [rel, pItem] of Object.entries(calc.prescribed_shares)) {
      const heir = calc.heirs[rel];
      if (heir && !heir.is_blocked) {
        const str = pItem.share.toString();
        if (str.includes("/")) {
          const den = parseInt(str.split("/")[1], 10) || 1;
          fixedDenominators.push(den);
          baseOrigin = lcm(baseOrigin, den);
        }
      }
    }
  } else {
    for (const [, d] of activeEntries) {
      if (!d.asabah) {
        const str = d.share.toString();
        if (str.includes("/")) {
          const den = parseInt(str.split("/")[1], 10) || 1;
          fixedDenominators.push(den);
          baseOrigin = lcm(baseOrigin, den);
        }
      }
    }
  }

  // If Grandfather takes 1/3 of remainder alongside siblings, the base of fixed shares is multiplied by 3
  const gfTakesThirdOfRemainder = [
    "PATERNAL_GRANDFATHER",
    "PATERNAL_GREAT_GRANDFATHER",
  ].some((r) => calc.results[r]?.is_third_of_remainder);
  if (gfTakesThirdOfRemainder && baseOrigin > 1) {
    baseOrigin = baseOrigin * 3;
    fixedDenominators.push(baseOrigin);
  }

  // If no fixed share heirs exist, base origin is total heads of Asabah
  if (fixedDenominators.length === 0 && activeEntries.length > 0) {
    let totalHeads = 0;
    const hasMale = activeEntries.some(([rel]) =>
      [
        "SON",
        "FULL_BROTHER",
        "PATERNAL_BROTHER",
        "GRANDSON",
        "PATERNAL_GRANDFATHER",
        "PATERNAL_GREAT_GRANDFATHER",
      ].includes(rel),
    );
    const hasFemale = activeEntries.some(([rel]) =>
      ["DAUGHTER", "FULL_SISTER", "PATERNAL_SISTER", "GRANDDAUGHTER"].includes(
        rel,
      ),
    );
    const isMixed = hasMale && hasFemale;

    for (const [rel, d] of activeEntries) {
      const heir = calc.heirs[rel];
      const count = d.count || (heir ? heir.count : 1);
      if (
        isMixed &&
        [
          "SON",
          "FULL_BROTHER",
          "PATERNAL_BROTHER",
          "GRANDSON",
          "PATERNAL_GRANDFATHER",
          "PATERNAL_GREAT_GRANDFATHER",
        ].includes(rel)
      ) {
        totalHeads += count * 2;
      } else if (
        isMixed &&
        [
          "DAUGHTER",
          "FULL_SISTER",
          "PATERNAL_SISTER",
          "GRANDDAUGHTER",
        ].includes(rel)
      ) {
        totalHeads += count * 1;
      } else {
        totalHeads += count;
      }
    }
    baseOrigin = totalHeads > 0 ? totalHeads : 1;
  }

  const step2Table = [];
  let sumFixedNumerators = 0;
  const asabahEntries = [];

  for (const [rel, d] of activeEntries) {
    const heir = calc.heirs[rel];
    const isAsabah =
      Boolean(d.asabah) ||
      (!calc.prescribed_shares?.[rel] &&
        (!calc.initial_shares?.[rel] || calc.initial_shares[rel].asabah) &&
        !d.is_third_of_remainder &&
        !d.is_fard_third &&
        !d.is_fard_sixth);

    const initialItem = !isAsabah
      ? calc.prescribed_shares?.[rel] ||
        (calc.initial_shares?.[rel] && !calc.initial_shares[rel].asabah
          ? calc.initial_shares[rel]
          : null)
      : null;

    if (initialItem) {
      const fractionVal = parseFloat(initialItem.share.valueOf());
      const numeratorInBase = Math.round(fractionVal * baseOrigin);
      sumFixedNumerators += numeratorInBase;
      const totalVal = parseFloat(d.share.valueOf());
      const totalNumInBase = Math.round(totalVal * baseOrigin);
      const displayNum =
        d.asabah && totalNumInBase > numeratorInBase
          ? totalNumInBase
          : numeratorInBase;
      const heirName =
        heir?.displayName || (rel === "TREASURY" ? "بيت المال" : rel);
      step2Table.push({
        name: heirName,
        share: `${displayNum}/${baseOrigin}`,
        rowSpan: 1,
        isCovered: false,
      });
    } else {
      asabahEntries.push({ rel, heir, d });
    }
  }

  if (asabahEntries.length > 0) {
    const remainingNumerator = Math.max(0, baseOrigin - sumFixedNumerators);
    if (asabahEntries.length === 1) {
      const entryName =
        asabahEntries[0].heir?.displayName ||
        (asabahEntries[0].rel === "TREASURY"
          ? "بيت المال"
          : asabahEntries[0].rel);
      step2Table.push({
        name: entryName,
        share: `${remainingNumerator}/${baseOrigin}`,
        rowSpan: 1,
        isCovered: false,
      });
    } else {
      // Multiple Asabah heirs sharing the remainder (e.g. Grandfather + Sister, or Son + Daughter)
      const canSplitCleanly = asabahEntries.every((item) => {
        const fractionVal = parseFloat(item.d.share.valueOf());
        const numInBase = fractionVal * baseOrigin;
        return Math.abs(numInBase - Math.round(numInBase)) < 0.001;
      });

      if (canSplitCleanly) {
        for (const item of asabahEntries) {
          const fractionVal = parseFloat(item.d.share.valueOf());
          const numInBase = Math.round(fractionVal * baseOrigin);
          const entryName =
            item.heir?.displayName ||
            (item.rel === "TREASURY" ? "بيت المال" : item.rel);
          step2Table.push({
            name: entryName,
            share: `${numInBase}/${baseOrigin}`,
            rowSpan: 1,
            isCovered: false,
          });
        }
      } else {
        const remainderShareStr = `${remainingNumerator}/${baseOrigin}`;
        asabahEntries.forEach((item, aIdx) => {
          const entryName =
            item.heir?.displayName ||
            (item.rel === "TREASURY" ? "بيت المال" : item.rel);
          step2Table.push({
            name: entryName,
            share: remainderShareStr,
            rowSpan: aIdx === 0 ? asabahEntries.length : 1,
            isCovered: aIdx > 0,
          });
        });
      }
    }
  }

  let step2ResultText = "";
  let sumInitialSharesVal = 0;
  for (const [, d] of activeEntries) {
    sumInitialSharesVal += parseFloat(d.share.valueOf());
  }

  if (awlResult && awlResult.isAul) {
    const awlOrigin = Math.round(awlResult.sumShares.mul(baseOrigin).valueOf());
    step2ResultText = `أصل الفريضة المستخرج من مخارج الفروض هو (${baseOrigin})، ومجموع السهام المفروضة (${awlOrigin}) زاد على أصلها، فعالت المسألة من (${baseOrigin}) إلى (${awlOrigin}). وصار أصل المسألة العائل هو (${awlOrigin})، ليدخل النقص على جميع أصحاب الفروض بنسبة سهامهم الشرعية عملاً بالمادة 366 من مدونة الأسرة المغربية.\n\n📌 خلاصة للحفظ: العول هو زيادة في مجموع السهام ونقص في مقادير الأنصبة، ويتحول أصل المسألة إلى مجموع السهام مباشرة.`;
  } else if (activeEntries.length === 1 && activeEntries[0][0] === "TREASURY") {
    step2ResultText =
      "أصل المسألة هو 1، وجميع التركة لبيت مال المسلمين لعدم وجود وريث شرعي.";
  } else if (
    sumInitialSharesVal < 0.999 &&
    activeEntries.length === 1 &&
    (calc.heirs["HUSBAND"] || calc.heirs["WIFE"])
  ) {
    const spouseKey = calc.heirs["HUSBAND"] ? "HUSBAND" : "WIFE";
    const spouseShare = calc.initial_shares
      ? calc.initial_shares[spouseKey].share.toString()
      : "1/4";
    step2ResultText = `أصل الفريضة هو (${baseOrigin}) [مخرج فرض ${spouseShare}]، ورُدّ باقي التركة (${baseOrigin - 1} أسهم من أصل ${baseOrigin}) إلى ${calc.heirs[spouseKey].displayName} بالرد لانفرادها وعدم وجود وارث نسبي معها، فاستغرقت التركة كاملة.\n\n📌 خلاصة للحفظ: يُرد الباقي على أحد الزوجين عند انفراده التام وعدم وجود أي وارث نسبي.`;
  } else if (
    sumInitialSharesVal < 0.999 &&
    !activeEntries.some(([, d]) => d.asabah)
  ) {
    const hasSpouse = Boolean(calc.heirs["HUSBAND"] || calc.heirs["WIFE"]);
    const sumSharesNum = step2Table.reduce((acc, row) => {
      const num = parseInt(row.share.split("/")[0], 10) || 0;
      return acc + num;
    }, 0);
    if (hasSpouse) {
      step2ResultText = `أصل مسألة الفروض هو (${baseOrigin})، ومجموع السهام المفروضة (${sumSharesNum}) أقل من أصل المسألة وبقي من التركة قدر لم تستغرقه الفروض ولا يوجد عاصب حائز له. وبما أنه يوجد أحد الزوجين، فلا يُرد عليه مع وجود ذوي الفروض النسبية عملاً بالمادة 363 من مدونة الأسرة المغربية والمذهب المالكي؛ وإنما يستوفي فرضه فقط، ويُرد الباقي على أصحاب الفروض النسبية بنسبة فروضهم (بمسألة الزوجية ومسألة الرد والجامعة بينهما).`;
    } else {
      step2ResultText = `أصل المسألة هو (${baseOrigin})، ومجموع سهام الفروض (${sumSharesNum}) أقل من أصل المسألة ولا يوجد عاصب؛ فرُدّت المسألة إلى مجموع السهام (${sumSharesNum}) عملاً بالمادة 363 من مدونة الأسرة المغربية، وصار مجموع السهام هو أصل مسألة الرد.\n\n📌 خلاصة للحفظ: عند عدم وجود الزوجين والعاصب، يُرد الباقي على أصحاب الفروض ويصير أصل المسألة هو مجموع سهامهم.`;
    }
  } else if (gfTakesThirdOfRemainder) {
    step2ResultText = `أصل المسألة هو (${baseOrigin}) [مخرج ثلث الباقي للجد مع الإخوة (3) مضروباً في مخرج الفروض (${baseOrigin / 3})].`;
  } else {
    // Moroccan Faraidh derivation of base origin
    const uniqueDens = [...new Set(fixedDenominators)];
    const hasAsabah = activeEntries.some(([, entry]) => entry.asabah);
    const asabahNote = hasAsabah ? " والباقي للعصبة تعصيباً." : "";

    if (uniqueDens.length === 0) {
      // Pure Asabah
      let headsDetails = "";
      const sons = calc.heirs["SON"]?.count || 0;
      const daughters = calc.heirs["DAUGHTER"]?.count || 0;
      const fullBrothers = calc.heirs["FULL_BROTHER"]?.count || 0;
      const fullSisters = calc.heirs["FULL_SISTER"]?.count || 0;
      const patBrothers = calc.heirs["PATERNAL_BROTHER"]?.count || 0;
      const patSisters = calc.heirs["PATERNAL_SISTER"]?.count || 0;

      if (sons > 0 && daughters > 0) {
        headsDetails = ` وتفصيل حساب الرؤوس: (${sons} أبناء × 2 = ${sons * 2}) + (${daughters} بنات × 1 = ${daughters}) = ${sons * 2 + daughters} رؤوس.`;
      } else if (fullBrothers > 0 && fullSisters > 0) {
        headsDetails = ` وتفصيل حساب الرؤوس: (${fullBrothers} إخوة × 2 = ${fullBrothers * 2}) + (${fullSisters} أخوات × 1 = ${fullSisters}) = ${fullBrothers * 2 + fullSisters} رؤوس.`;
      } else if (patBrothers > 0 && patSisters > 0) {
        headsDetails = ` وتفصيل حساب الرؤوس: (${patBrothers} إخوة لأب × 2 = ${patBrothers * 2}) + (${patSisters} أخوات لأب × 1 = ${patSisters}) = ${patBrothers * 2 + patSisters} رؤوس.`;
      }

      step2ResultText = `الفريضة عصبة محضة بدون أصحاب فروض؛ فيكون أصل المسألة (${baseOrigin}) مستخرجاً مباشرة من مجموع عدد رؤوس العصبة. قاعدة احتساب الرؤوس المعتمدة في الفرائض بالمغرب (المادة 348 من مدونة الأسرة): كل ذكر برأسين وكل أنثى برأس واحد (للذكر مثل حظ الأنثيين).${headsDetails}\n\n📌 خلاصة للحفظ: في العصبة المحضة: أصل المسألة = مجموع عدد الرؤوس.`;
    } else if (uniqueDens.length === 1) {
      const d = uniqueDens[0];
      if (fixedDenominators.length === 1) {
        step2ResultText = `في الفريضة فرضٌ واحد مخرجه (${d})، فيكون أصل المسألة هو مخرج ذلك الفرض عينه (${baseOrigin}).${asabahNote}\n\n📌 خلاصة للحفظ: عند وجود فرض واحد فقط، فأصل المسألة هو مخرجه عينه.`;
      } else {
        step2ResultText = `في الفريضة أصحاب فروض اتحد مخرجها وهو (${d})، فيكون أصل المسألة هو مخرج ذلك الفرض عينه (${baseOrigin}).${asabahNote}\n\n📌 خلاصة للحفظ: عند اتحاد مخارج الفروض، نكتفي بمخرجها المتماثل ليكون أصل المسألة.`;
      }
    } else {
      // Analyze relations between denominators (الأنظار الأربعة)
      let relationNote = "";
      if (uniqueDens.length === 2) {
        const [d1, d2] = uniqueDens.sort((a, b) => a - b);
        const g = gcd(d1, d2);
        if (d1 === d2) {
          relationNote = `بين مخرجي الفرضين (${d1} و ${d2}) تماثل تام؛ والقاعدة عند الفرضيين بالمغرب: عند التماثل نكتفي بأحد العددين، فيكون أصل المسألة هو (${baseOrigin}).\n\n📌 خلاصة للحفظ: تماثل ← نأخذ أحد العددين.`;
        } else if (d2 % d1 === 0) {
          relationNote = `بين مخرجي الفرضين (${d1} و ${d2}) تداخل (لأن الأكبر ${d2} ينقسم على الأصغر ${d1} بغير كسر)؛ والقاعدة عند الفرضيين بالمغرب: عند التداخل نكتفي بالعدد الأكبر (${d2})، فيكون أصل المسألة هو (${baseOrigin}).\n\n📌 خلاصة للحفظ: تداخل ← نأخذ العدد الأكبر.`;
        } else if (g > 1) {
          const w1 = d1 / g;
          relationNote = `بين مخرجي الفرضين (${d1} و ${d2}) توافق؛ فالقاسم المشترك الأكبر بينهما هو (${g})، ونستخرج "الوفق" بقسمة أحد المخرجين على القاسم: ${d1} ÷ ${g} = ${w1} (وفق ${d1}). والقاعدة عند الفرضيين بالمغرب: عند التوافق نضرب وفق أحد المخرجين في كامل الآخر (${w1} × ${d2} = ${baseOrigin})، فيكون أصل المسألة هو (${baseOrigin}).\n\n📌 خلاصة للحفظ: توافق ← نأخذ وفق أحدهما ونضربه في كامل الآخر.`;
        } else {
          relationNote = `بين مخرجي الفرضين (${d1} و ${d2}) تباين (لا يقبلان القسمة على عدد مشترك سوى 1)؛ والقاعدة عند الفرضيين بالمغرب: عند التباين نضرب كامل أحد العددين في كامل الآخر (${d1} × ${d2} = ${baseOrigin})، فيكون أصل المسألة هو (${baseOrigin}).\n\n📌 خلاصة للحفظ: تباين ← نضرب كامل أحد العددين في كامل الآخر.`;
        }
      } else {
        const multiDerivation = explainMultipleDenominators(uniqueDens);
        relationNote = `استُخرج أصل المسألة (${baseOrigin}) بالمقارنة المتسلسلة بين مخارج الفروض (${uniqueDens.join("، ")}) بالأنظار الأربعة المعتمدة عند علماء الفرائض بالمغرب: ${multiDerivation}.\n\n📌 قاعدة الأنظار الأربعة للحفظ: التماثل ← نأخذ أحدهما | التداخل ← نأخذ الأكبر | التوافق ← نضرب وفق أحدهما في الآخر | التباين ← نضرب كامل أحدهما في الآخر.`;
      }
      step2ResultText = `أصل المسألة هو (${baseOrigin}). ${relationNote}`;
    }
  }

  if (calc.is_akdariyya) {
    baseOrigin = 6;
    step2Table.length = 0;
    step2Table.push({
      name: calc.heirs["HUSBAND"]?.displayName || "الزوج",
      share: "3/6",
    });
    step2Table.push({
      name: calc.heirs["MOTHER"]?.displayName || "الأم",
      share: "2/6",
    });
    const gfKey = ["PATERNAL_GRANDFATHER", "PATERNAL_GREAT_GRANDFATHER"].find(
      (r) =>
        calc.heirs[r] && !calc.heirs[r].is_blocked && calc.heirs[r].count > 0,
    );
    if (gfKey) {
      step2Table.push({
        name: calc.heirs[gfKey]?.displayName || "الجد",
        share: "1/6",
      });
    }
    const sisterKey =
      calc.heirs["FULL_SISTER"] &&
      !calc.heirs["FULL_SISTER"].is_blocked &&
      calc.heirs["FULL_SISTER"].count > 0
        ? "FULL_SISTER"
        : "PATERNAL_SISTER";
    if (calc.heirs[sisterKey]) {
      step2Table.push({
        name: calc.heirs[sisterKey]?.displayName || "الأخت",
        share: "3/6",
      });
    }
    step2ResultText =
      "أصل المسألة المستخرج من مخارج الفروض (2، 3، 6) هو 6. ومجموع السهام المفروضة هو 9 (3 للزوج + 2 للأم + 1 للجد + 3 للأخت)، فعالت المسألة من 6 إلى 9 (المسألة الأكدرية).\n\n📌 خلاصة للحفظ: في الأكدرية عالت إلى 9 وضُربت في 3 رؤوس فصحت من 27.";
  } else if (calc.is_kharqa || calc.special_case?.id === "kharqa") {
    step2ResultText =
      "أصل المسألة هو 3 (مخرج فرض الثلث للأم). للأم الثلث (سهم واحد)، وبقي سهمان (2) اقتسمهما الجد والأخت تعصيباً للذكر مثل حظ الأنثيين في مسألة الخرقاء (المادة 364 من مدونة الأسرة).\n\n📌 خلاصة للحفظ: في الخرقاء أصلها 3 وضُربت في 3 رؤوس فصحت من 9.";
  } else if (calc.is_malikiyyah) {
    step2ResultText =
      "أصل المسألة هو 6 (مخرج فرضي النصف والسدس). للزوج النصف (3 سهام)، وللأم أو الجدة السدس (سهم واحد)، وأخذ الجد جميع الباقي تعصيباً (سهمان من 6 = 2/6 = 1/3 التركة) في المسألة المالكية (المادة 362 من مدونة الأسرة)، وسقط الأخ للأب، وحُجب الإخوة لأم بالجد بإجماع.\n\n📌 خلاصة للحفظ: في المالكية يسقط الأخ لأب ويحوز الجد كل الباقي تعصيباً.";
  } else if (calc.is_shibh_malikiyyah) {
    step2ResultText =
      "أصل المسألة هو 6 (مخرج فرضي النصف والسدس). للزوج النصف (3 سهام)، وللأم أو الجدة السدس (سهم واحد)، وأخذ الجد جميع الباقي تعصيباً (سهمان من 6 = 2/6 = 1/3 التركة) في مسألة شبه المالكية (المادة 363 من مدونة الأسرة)، وسقط الأخ الشقيق، وحُجب الإخوة لأم بالجد بإجماع.\n\n📌 خلاصة للحفظ: في شبه المالكية يسقط الأخ الشقيق ويحوز الجد كل الباقي تعصيباً.";
  } else if (calc.is_mushtarakah) {
    baseOrigin = 6;
    step2Table.length = 0;
    step2Table.push({
      name: calc.heirs["HUSBAND"]?.displayName || "الزوج",
      share: "3/6",
      rowSpan: 1,
      isCovered: false,
    });
    if (calc.heirs["MOTHER"] && !calc.heirs["MOTHER"].is_blocked) {
      step2Table.push({
        name: calc.heirs["MOTHER"]?.displayName || "الأم",
        share: "1/6",
        rowSpan: 1,
        isCovered: false,
      });
    } else {
      const activeGMs = [
        "PATERNAL_GRANDMOTHER",
        "MATERNAL_GRANDMOTHER",
        "MATERNAL_GREAT_GRANDMOTHER",
        "MATERNAL_PATERNAL_GREAT_GRANDMOTHER",
      ].filter(
        (g) =>
          calc.heirs[g] && !calc.heirs[g].is_blocked && calc.heirs[g].count > 0,
      );
      if (activeGMs.length === 1) {
        step2Table.push({
          name: calc.heirs[activeGMs[0]]?.displayName || "الجدة",
          share: "1/6",
          rowSpan: 1,
          isCovered: false,
        });
      } else {
        activeGMs.forEach((gm, idx) => {
          step2Table.push({
            name: calc.heirs[gm]?.displayName || "الجدة",
            share: "1/6 مشترك",
            rowSpan: idx === 0 ? activeGMs.length : 1,
            isCovered: idx > 0,
          });
        });
      }
    }

    const mushtarakahSiblings = [
      "FULL_BROTHER",
      "FULL_SISTER",
      "MATERNAL_BROTHER",
      "MATERNAL_SISTER",
    ].filter(
      (s) =>
        calc.heirs[s] && !calc.heirs[s].is_blocked && calc.heirs[s].count > 0,
    );
    mushtarakahSiblings.forEach((s, idx) => {
      step2Table.push({
        name: calc.heirs[s]?.displayName || s,
        share: "2/6 بالتشريك",
        rowSpan: idx === 0 ? mushtarakahSiblings.length : 1,
        isCovered: idx > 0,
      });
    });

    const totalSharingHeads =
      (calc.heirs["MATERNAL_BROTHER"]?.count || 0) +
      (calc.heirs["MATERNAL_SISTER"]?.count || 0) +
      (calc.heirs["FULL_BROTHER"]?.count || 0) +
      (calc.heirs["FULL_SISTER"]?.count || 0);
    const activeGMs = [
      "PATERNAL_GRANDMOTHER",
      "MATERNAL_GRANDMOTHER",
      "MATERNAL_GREAT_GRANDMOTHER",
      "MATERNAL_PATERNAL_GREAT_GRANDMOTHER",
    ].filter(
      (g) =>
        calc.heirs[g] && !calc.heirs[g].is_blocked && calc.heirs[g].count > 0,
    );
    const hasMultipleGMs = !calc.heirs["MOTHER"] && activeGMs.length > 1;

    let tasheehExplain = "";
    if (hasMultipleGMs) {
      const siblingMultiplier =
        totalSharingHeads % 2 === 0
          ? totalSharingHeads / 2
          : totalSharingHeads;
      const gmMultiplier = activeGMs.length;
      const fullMultiplier = lcm(gmMultiplier, siblingMultiplier);
      const finalBase = 6 * fullMultiplier;
      tasheehExplain = `وقع الانكسار على فريقين: فريق الجدات (سهم واحد على ${activeGMs.length} جدات؛ جزء سهمهن ${gmMultiplier})، وفريق الإخوة الشركاء (سهمان على ${totalSharingHeads} رؤوس؛ جزء سهمهم ${siblingMultiplier}). وبين جزأي السهم (${gmMultiplier} و ${siblingMultiplier}) تباين فنضرب أحدهما في الآخر لاستخراج جزء السهم الجامع (${fullMultiplier})، ونضرب أصل المسألة (6) في جزء السهم (${fullMultiplier}) فتصح الفريضة من (${finalBase}).`;
    } else {
      const siblingMultiplier =
        totalSharingHeads % 2 === 0
          ? totalSharingHeads / 2
          : totalSharingHeads;
      const finalBase = 6 * siblingMultiplier;
      tasheehExplain = `انكسرت سهام الثلث (2) على رؤوس الإخوة الشركاء (${totalSharingHeads} رؤوس بالتساوي للذكر مثل الأنثى)، جزء السهم هو (${siblingMultiplier})، فضرب أصل المسألة (6) في جزء السهم (${siblingMultiplier}) فصحت الفريضة من (${finalBase}).`;
    }

    step2ResultText = `أصل المسألة هو 6 (مخرج الفروض الشرعية: النصف 3، السدس 1، والثلث 2). وفي المسألة المشتركة (المادة 365 من مدونة الأسرة ومذهب المالكية والشافعية) يُشرك الإخوة الأشقاء مع الإخوة لأم في الثلث بالتساوي للذكر مثل الأنثى على عدد رؤوسهم. ${tasheehExplain}\n\n📌 خلاصة للحفظ: في المسألة المشتركة يُشرك الأشقاء مع الإخوة لأم في الثلث بالسوية.`;
  }

  steps.push({
    id: "std_step2",
    title: "ثانياً: تأصيل الفريضة واستخراج أصل المسألة",
    desc: "استخراج أصل الفريضة بالأنظار الفقهية الأربعة (التماثل، التداخل، التوافق، التباين) بين مخارج الفروض، وتوزيع السهام المستحقة قبل التصحيح:",
    table: step2Table,
    result_text: step2ResultText,
  });

  // =========================================================================
  // Step 3: Original Heirs Shares Table (تصحيح المسألة وإخراج نصيب كل فرد)
  // IMPORTANT: Shows original Islamic shares BEFORE voluntary wills deduction!
  // =========================================================================
  const activeHeirsStep3 = activeEntries.map(([rel, d]) => {
    const heirObj = calc.heirs[rel];
    let displayName = heirObj ? heirObj.displayName : rel;
    if (rel === "TREASURY") displayName = "بيت المال";

    const count = d.count || (heirObj ? heirObj.count : 1);
    const indShare = count > 1 ? d.share.div(new Fraction(count)) : d.share;
    const indPercentage =
      Math.round(parseFloat(indShare.valueOf()) * 10000) / 100;

    return {
      name: displayName,
      count: count,
      shareObj: indShare,
      indShare: indShare,
      percentage: indPercentage,
    };
  });

  let commonDen3 = 1;
  for (const h of activeHeirsStep3) {
    if (h.indShare && h.indShare.d > 0) {
      commonDen3 = lcm(commonDen3, h.indShare.d);
    }
  }

  const step3FormattedTable = activeHeirsStep3.map((h) => {
    let scaledNum = 0;
    if (h.indShare && Number(h.indShare.d) > 0) {
      scaledNum = Math.round(
        Number(h.indShare.n) * (commonDen3 / Number(h.indShare.d)),
      );
    }
    const value = calc.net_estate * (h.indShare ? h.indShare.valueOf() : 0);
    return {
      name: h.name,
      count: h.count,
      share: `${scaledNum}/${commonDen3}`,
      percentage: h.percentage,
      value: value,
    };
  });

  let step3Desc = "";
  if (calc.is_akdariyya) {
    step3Desc =
      "المسألة الأكدرية (المادة 361 من مدونة الأسرة): بعد عول المسألة إلى 9، لا تُعطى الأخت نصيبها كاملاً ولا يُحرم الجد، بل يُجمع سهم الجد (1) مع سهام الأخت (3) ليصيرا 4 سهام، ويقتسمانها بالتعصيب (للذكر مثل حظ الأنثيين، على 3 رؤوس). ولانكسار السهام (4 لا تنقسم على 3 والرؤوس 3 مباينة للأربعة)، يُضرب أصل المسألة العائل (9) في عدد الرؤوس (3): 9 × 3 = 27 (المصح النهائي للأكدرية). فيكون للزوج 3×3 = 9، وللأم 2×3 = 6، وللجد ثلثا الأربعة (4×2 = 8)، وللأخت ثلثها (4×1 = 4).\n\n💡 قاعدة للحفظ: مصح الأكدرية = 9 × 3 = 27.";
  } else if (calc.is_kharqa || calc.special_case?.id === "kharqa") {
    step3Desc =
      "مسألة الخرقاء (المادة 364 من مدونة الأسرة): أصل المسألة من 3؛ للأم الثلث (سهم واحد)، وبقي سهمان (2) للجد والأخت تعصيباً للذكر مثل حظ الأنثيين على 3 رؤوس (سهمان للجد وسهم للأخت). ولانكسار السهام (2 لا تنقسم على 3 والرؤوس تباين السهام)، يُضرب أصل المسألة (3) في عدد الرؤوس (3): 3 × 3 = 9 (مصح الخرقاء). فيكون للأم 1×3 = 3، وللجد 2×2 = 4، وللأخت 1×2 = 2.\n\n💡 قاعدة للحفظ: مصح الخرقاء = 3 × 3 = 9.";
  } else if (calc.is_malikiyyah) {
    step3Desc =
      "المسألة المالكية (المادة 362 من مدونة الأسرة): أصل المسألة 6؛ للزوج النصف (3 سهام)، وللأم أو الجدة السدس (سهم واحد)، واستأثر الجد بجميع الباقي تعصيباً (سهمان من 6 = 2/6 = 1/3 التركة)، وسقط الأخ للأب لعدم بقاء شيء له، وحُجب الإخوة لأم بالجد بإجماع.";
  } else if (calc.is_shibh_malikiyyah) {
    step3Desc =
      "مسألة شبه المالكية (المادة 363 من مدونة الأسرة): أصل المسألة 6؛ للزوج النصف (3 سهام)، وللأم أو الجدة السدس (سهم واحد)، واستأثر الجد بجميع الباقي تعصيباً (سهمان من 6 = 2/6 = 1/3 التركة)، وسقط الأخ الشقيق لعدم بقاء شيء له، وحُجب الإخوة لأم بالجد بإجماع.";
  } else if (commonDen3 > baseOrigin) {
    const tasheehMult = Math.round(commonDen3 / baseOrigin);
    let breakdownDetails = "";
    const sons = calc.heirs["SON"]?.count || 0;
    const daughters = calc.heirs["DAUGHTER"]?.count || 0;
    const fullBrothers = calc.heirs["FULL_BROTHER"]?.count || 0;
    const fullSisters = calc.heirs["FULL_SISTER"]?.count || 0;
    const patBrothers = calc.heirs["PATERNAL_BROTHER"]?.count || 0;
    const patSisters = calc.heirs["PATERNAL_SISTER"]?.count || 0;
    const grandsons = calc.heirs["GRANDSON"]?.count || 0;
    const granddaughters = calc.heirs["GRANDDAUGHTER"]?.count || 0;
    const wives = calc.heirs["WIFE"]?.count || 0;

    if (sons > 0 && daughters > 0) {
      const heads = sons * 2 + daughters;
      breakdownDetails = ` بيان حساب عدد رؤوس العصبة بالغير: كل ذكر برأسين (${sons} أبناء × 2 = ${sons * 2}) وكل أنثى برأس واحد (${daughters} بنات × 1 = ${daughters})؛ فمجموع عدد الرؤوس = ${heads} رؤوس، والسهام لا تنقسم عليها بغير كسر (انكسار).`;
    } else if (fullBrothers > 0 && fullSisters > 0) {
      const heads = fullBrothers * 2 + fullSisters;
      breakdownDetails = ` بيان حساب عدد رؤوس العصبة بالغير: كل أخ شقيق برأسين (${fullBrothers} إخوة × 2 = ${fullBrothers * 2}) وكل أخت شقيقة برأس واحد (${fullSisters} أخوات × 1 = ${fullSisters})؛ فمجموع عدد الرؤوس = ${heads} رؤوس، والسهام لا تنقسم عليها بغير كسر (انكسار).`;
    } else if (patBrothers > 0 && patSisters > 0) {
      const heads = patBrothers * 2 + patSisters;
      breakdownDetails = ` بيان حساب عدد رؤوس العصبة بالغير: كل أخ لأب برأسين (${patBrothers} إخوة لأب × 2 = ${patBrothers * 2}) وكل أخت لأب برأس واحد (${patSisters} أخوات لأب × 1 = ${patSisters})؛ فمجموع عدد الرؤوس = ${heads} رؤوس، والسهام لا تنقسم عليها بغير كسر (انكسار).`;
    } else if (grandsons > 0 && granddaughters > 0) {
      const heads = grandsons * 2 + granddaughters;
      breakdownDetails = ` بيان حساب عدد رؤوس العصبة بالغير: كل ابن ابن برأسين (${grandsons} × 2 = ${grandsons * 2}) وكل بنت ابن برأس واحد (${granddaughters} × 1 = ${granddaughters})؛ فمجموع عدد الرؤوس = ${heads} رؤوس، والسهام لا تنقسم عليها بغير كسر (انكسار).`;
    } else if (wives > 1) {
      breakdownDetails = ` انكسرت سهام الزوجية على عدد الزوجات (${wives} زوجات).`;
    } else if (daughters > 1 && sons === 0) {
      breakdownDetails = ` انكسرت سهام الثلثين على عدد البنات (${daughters} بنات).`;
    }

    step3Desc = `انكسرت السهام على الرؤوس فأجرينا التصحيح وفق قواعد علم الفرائض بالمغرب: استُخرج "جزء السهم" وهو (${tasheehMult}) بالنظر بين السهام والرؤوس، ثم ضربنا أصل المسألة (${baseOrigin}) في جزء السهم (${tasheehMult}) ليكون مصح المسألة النهائي هو (${commonDen3}): (${baseOrigin} × ${tasheehMult} = ${commonDen3}). ثم ضربنا سهم كل وارث من أصل المسألة في جزء السهم نفسه لينال حظه صحيحاً بلا كسر.${breakdownDetails}\n\n💡 قاعدة التصحيح للحفظ: مصح المسألة = أصل المسألة (أو عولها) × جزء السهم. وكل وارث يأخذ: سهمه في الأصل × جزء السهم.`;
  } else {
    step3Desc = `السهام منقسمة على عدد رؤوس الورثة بدون انكسار؛ فالفريضة صحيحة من أصلها (${baseOrigin}) ولا تحتاج إلى تصحيح ولا إلى ضرب في جزء سهم. وبيان نصيب كل وارث بالسهام والكسر والنسبة والقيمة المالية كالتالي:\n\n💡 قاعدة للحفظ: إذا انقسمت السهام على الرؤوس بلا كسر صَحّت المسألة من أصلها.`;
  }

  steps.push({
    id: "std_step3",
    title: calc.is_akdariyya
      ? "ثالثاً: تصحيح الفريضة في الأكدرية (المصح 27)"
      : calc.is_kharqa || calc.special_case?.id === "kharqa"
        ? "ثالثاً: تصحيح الفريضة في الخرقاء (المصح 9)"
        : calc.is_malikiyyah
          ? "ثالثاً: الأنصبة الشرعية في المسألة المالكية"
          : calc.is_shibh_malikiyyah
            ? "ثالثاً: الأنصبة الشرعية في شبه المالكية"
            : commonDen3 > baseOrigin
              ? `ثالثاً: تصحيح الفريضة وإزالة الانكسار (المصح ${commonDen3})`
              : `ثالثاً: قسمة السهام وتوزيع الأنصبة (الفريضة صحيحة من أصلها ${baseOrigin})`,
    desc: step3Desc,
    table: step3FormattedTable,
  });

  // =========================================================================
  // Step 4: Voluntary Wills & Final Distribution Table (التقسيم النهائي بعد الوصية الإرادية)
  // Added when voluntary wills exist
  // =========================================================================
  if (calc.wills_executed && calc.wills_executed.length > 0) {
    const step4Items = [];

    // 1. Add Voluntary Wills
    for (const will of calc.wills_executed) {
      const executedFraction =
        will.executed_fraction_obj ||
        new Fraction(will.executed_fraction_share || "0");
      const pct =
        calc.net_estate > 0
          ? (will.executed_value / calc.net_estate) * 100
          : parseFloat(executedFraction.valueOf()) * 100;
      const willName =
        will.name?.includes("مُوصَىٰ له") || will.name?.includes("موصى له")
          ? will.name
          : `مُوصَىٰ له بـ ${will.original_value || will.name}`;
      step4Items.push({
        name: willName,
        count: "-",
        shareObj: executedFraction,
        percentage: Number.isFinite(pct) ? Math.round(pct * 100) / 100 : 0,
        value: will.executed_value || 0,
      });
    }

    // 2. Add Heirs' Final Net Shares
    const scaleFactor4 = calc.heirs_scale_fraction || new Fraction(1);
    for (const [rel, d] of activeEntries) {
      const heirObj = calc.heirs[rel];
      let displayName = heirObj ? heirObj.displayName : rel;
      if (rel === "TREASURY") displayName = "بيت المال";

      const finalShare = d.share.mul(scaleFactor4);
      const count = d.count || (heirObj ? heirObj.count : 1);
      const indFinalShare =
        count > 1 ? finalShare.div(new Fraction(count)) : finalShare;
      const pct = parseFloat(indFinalShare.valueOf()) * 100;
      const val = calc.net_estate * parseFloat(indFinalShare.valueOf());

      step4Items.push({
        name: displayName,
        count: count,
        shareObj: indFinalShare,
        percentage: Math.round(pct * 100) / 100,
        value: val,
      });
    }

    let commonDen4 = 1;
    for (const item of step4Items) {
      if (item.shareObj && Number(item.shareObj.d) > 0) {
        commonDen4 = lcm(commonDen4, Number(item.shareObj.d));
      }
    }

    const step4Table = step4Items.map((item) => {
      let scaledNum = 0;
      if (item.shareObj && Number(item.shareObj.d) > 0) {
        scaledNum = Math.round(
          Number(item.shareObj.n) * (commonDen4 / Number(item.shareObj.d)),
        );
      }
      return {
        name: item.name,
        count: item.count,
        share: `${scaledNum}/${commonDen4}`,
        percentage: item.percentage,
        value: item.value,
      };
    });

    steps.push({
      id: "std_step4",
      title: "رابعاً: التقسيم النهائي بعد الوصية ",
      desc: "توزيع الوصايا الإرادية المنفذة وبيان الأجزاء المخصصة لها من التركة مع الأنصبة المتبقية للورثة:",
      table: step4Table,
      result_text: `تنويه: الوصية لشخص وارث بأى مقدار لا تُنفذّ إلا بإذن باقى الورثة لقوله ﷺ: «إِنَّ اللَّهَ قَدْ أَعْطَى كُلَّ ذِي حَقٍّ حَقَّهُ فَلَا وَصِيَّةَ لِوَارِثٍ». أما الوصية لشخص غير وارث تُنفذ بدون إذن باقى الورثة إن لم تزد عن الثلث فإن زادت لابد أن يأذن باقى الورثة في تنفيذها.`,
    });
  }

  return steps;
}

/**
 * Generates pedagogical step-by-step breakdown tables for Moroccan Mandatory Bequests (قانون الوصية الواجبة المغربي).
 *
 * Steps Produced:
 * - Step 1: Checking eligibility without mandatory bequest (التحقق من استحقاق الوصية الواجبة).
 * - Step 2: Preliminary case assuming deceased parent is alive (العمل التمهيدي).
 * - Step 3: Sub-problem distributing each branch's share to descendants (قسمة مقدار الوصية الواجبة على أصحابها).
 * - Step 4: Final consolidated distribution table across all heirs and bequest beneficiaries.
 *
 * @param {import('./Calculator.js').InheritanceCalculator} calc - Calculator instance.
 * @returns {Array<{id: string, title: string, desc: string, table: Array<Object>, result_text?: string}>} Array of step objects.
 */
export function getMandatoryBequestSteps(calc) {
  if (
    !calc.case.mandatoryBequests ||
    calc.case.mandatoryBequests.length === 0
  ) {
    return [];
  }

  const steps = [];

  let voluntaryWillsFraction = new Fraction(0);
  if (!calc.heirs_approved_excess) {
    for (const will of calc.wills_input || []) {
      if (will.valueType === "fraction") {
        const parts = (will.value || "1/3").split("/");
        const num = parseInt(parts[0], 10) || 0;
        const den = parseInt(parts[1], 10) || 1;
        voluntaryWillsFraction = voluntaryWillsFraction.add(
          new Fraction(num, den),
        );
      } else if (will.valueType === "percentage") {
        const val = parseInt(will.value, 10) || 0;
        voluntaryWillsFraction = voluntaryWillsFraction.add(
          new Fraction(val, 100),
        );
      }
    }
    if (voluntaryWillsFraction.greaterThan(new Fraction(1, 3))) {
      voluntaryWillsFraction = new Fraction(1, 3);
    }
  }
  const scaleFactorForWills = new Fraction(1).sub(voluntaryWillsFraction);

  // =========================================================================
  // STEP 1: Dry run to check who inherits without mandatory bequest
  // =========================================================================
  const step1HeirsList = [];
  for (const h of calc.case.heirs) {
    step1HeirsList.push({ relationship: h.relationship, count: h.count || 1 });
  }

  let step1SonIndex = 0;
  let step1DaughterIndex = 0;
  for (const mb of calc.case.mandatoryBequests) {
    if (mb.type === "son") {
      step1SonIndex++;
      const parentDesig = getParentDesignation(mb, step1SonIndex);
      const totalSons = parseInt(mb.sonsCount, 10) || 0;
      const totalDaughters = parseInt(mb.daughtersCount, 10) || 0;
      const totalGreatSons = parseInt(mb.greatSonsCount, 10) || 0;
      const totalGreatDaughters = parseInt(mb.greatDaughtersCount, 10) || 0;
      if (totalSons > 0)
        step1HeirsList.push({
          relationship: "GRANDSON",
          count: totalSons,
          displayName: `ابن ابن ${parentDesig}`,
        });
      if (totalDaughters > 0)
        step1HeirsList.push({
          relationship: "GRANDDAUGHTER",
          count: totalDaughters,
          displayName: `بنت ابن ${parentDesig}`,
        });
      if (totalGreatSons > 0)
        step1HeirsList.push({
          relationship: "GREAT_GRANDSON",
          count: totalGreatSons,
          displayName: `ابن ابن ابن ${parentDesig}`,
        });
      if (totalGreatDaughters > 0)
        step1HeirsList.push({
          relationship: "GREAT_GRANDDAUGHTER",
          count: totalGreatDaughters,
          displayName: `بنت ابن ابن ${parentDesig}`,
        });
    } else if (mb.type === "daughter") {
      step1DaughterIndex++;
    }
  }

  const step1Case = {
    ...calc.case,
    heirs: step1HeirsList,
    mandatoryBequests: [],
  };
  const calc1 = new calc.constructor(step1Case);
  for (const h of step1HeirsList) {
    if (h.displayName && calc1.heirs[h.relationship]) {
      calc1.heirs[h.relationship].displayName = h.displayName;
    }
  }
  const res1 = calc1.calculate();

  const step1Table = res1.distributions.map((d) => {
    const heirObj = calc1.heirs[d.relationship];
    const isBlocked = heirObj ? heirObj.is_blocked : false;
    return {
      name: d.relationship_display,
      count: d.count,
      share: isBlocked ? "—" : d.share_fraction,
      percentage: isBlocked ? 0 : d.percentage,
      status: isBlocked
        ? "غير وارث ويستحق الوصية الواجبة"
        : "وارث بدون الوصية الواجبة",
      why: isBlocked
        ? d.why
          ? `${d.why} وبما أنه غير وارث في الإرث العادي، فيستحق الوصية الواجبة .`
          : "محجوب عن الإرث، فيستحق الوصية الواجبة شرعاً وقانوناً."
        : d.why,
    };
  });

  // Manually add daughter's non-heir children to step 1 table
  let step1DaughterIndex2 = 0;
  for (const mb of calc.case.mandatoryBequests) {
    if (mb.type === "daughter") {
      step1DaughterIndex2++;
      const parentDesig = getParentDesignation(mb, step1DaughterIndex2);
      const totalSons = parseInt(mb.sonsCount, 10) || 0;
      const totalDaughters = parseInt(mb.daughtersCount, 10) || 0;
      if (totalSons > 0) {
        step1Table.push({
          name: `ابن بنت ${parentDesig}`,
          count: totalSons,
          share: "—",
          percentage: 0,
          status: "غير وارث ويستحق الوصية الواجبة",
          why: "ولد البنت لا يرث مع وجود صاحب فرض أو عاصب لأنه من ذوي الأرحام.",
        });
      }
      if (totalDaughters > 0) {
        step1Table.push({
          name: `بنت بنت ${parentDesig}`,
          count: totalDaughters,
          share: "—",
          percentage: 0,
          status: "غير وارث ويستحق الوصية الواجبة",
          why: "ولد البنت لا يرث مع وجود صاحب فرض أو عاصب لأنه من ذوي الأرحام.",
        });
      }
    }
  }

  steps.push({
    id: "step1",
    title: "أولاً: التحقق من شروط استحقاق الوصية الواجبة (المادة 369 من مدونة الأسرة)",
    desc: "بيان حكم الفروع وموقعهم من الإرث الشرعي العادي؛ فإن كان الفرع محجوباً أو غير وارث، ولم يعطه المورث ما ينوب أصله بهبة أو وصية اختيارية، استحق الوصية الواجبة بمقدار حصة أصله في حدود الثلث الشرعي وفقاً لأحكام المواد 369-372 من مدونة الأسرة المغربية:",
    table: step1Table,
  });

  // =========================================================================
  // STEP 2: Preliminary calculation assuming all deceased children are alive
  // =========================================================================
  const tempHeirsMap = {};
  for (const h of Object.values(calc.heirs)) {
    if (!h.is_blocked && h.count > 0) {
      tempHeirsMap[h.relationship] = h.count;
    }
  }

  let deceasedSonsCount = 0;
  let deceasedDaughtersCount = 0;
  let virtualGrandsonCount = 0;

  const hasLivingGrandchildrenAsHeirs =
    (calc.heirs["GRANDSON"] && !calc.heirs["GRANDSON"].is_blocked) ||
    (calc.heirs["GRANDDAUGHTER"] && !calc.heirs["GRANDDAUGHTER"].is_blocked);

  for (const mb of calc.case.mandatoryBequests) {
    if (mb.type === "son") {
      if (hasLivingGrandchildrenAsHeirs) {
        virtualGrandsonCount++;
      } else {
        deceasedSonsCount++;
      }
    } else if (mb.type === "daughter") {
      deceasedDaughtersCount++;
    }
  }

  if (deceasedSonsCount > 0) {
    tempHeirsMap["SON"] = (tempHeirsMap["SON"] || 0) + deceasedSonsCount;
  }
  if (virtualGrandsonCount > 0) {
    tempHeirsMap["GRANDSON"] =
      (tempHeirsMap["GRANDSON"] || 0) + virtualGrandsonCount;
  }
  if (deceasedDaughtersCount > 0) {
    tempHeirsMap["DAUGHTER"] =
      (tempHeirsMap["DAUGHTER"] || 0) + deceasedDaughtersCount;
  }

  const step2HeirsList = Object.entries(tempHeirsMap).map(
    ([relationship, count]) => ({
      relationship,
      count,
    }),
  );

  const step2Case = {
    ...calc.case,
    heirs: step2HeirsList,
    mandatoryBequests: [],
  };
  const calc2 = new calc.constructor(step2Case);
  if (calc2.heirs["SON"]) calc2.heirs["SON"].displayName = "ابن";
  if (calc2.heirs["DAUGHTER"]) calc2.heirs["DAUGHTER"].displayName = "بنت";
  if (calc2.heirs["GRANDSON"]) calc2.heirs["GRANDSON"].displayName = "ابن ابن";
  const res2 = calc2.calculate();

  const step2Table = res2.distributions.map((d) => {
    const heirObj = calc2.heirs[d.relationship];
    const isBlocked = heirObj ? heirObj.is_blocked : false;
    return {
      name: d.relationship_display,
      count: d.count,
      share: isBlocked ? "—" : d.share_fraction,
      percentage: isBlocked ? 0 : d.percentage,
      why: d.why,
    };
  });

  let singleSonShare = new Fraction(0);
  if (res2.distributions.find((d) => d.relationship === "SON")) {
    const d = res2.distributions.find((d) => d.relationship === "SON");
    const parts = d.share_fraction.split("/");
    const num = parseInt(parts[0], 10) || 0;
    const den = parts[1] ? parseInt(parts[1], 10) : 1;
    singleSonShare = new Fraction(num, den)
      .mul(scaleFactorForWills)
      .div(new Fraction(d.count || 1));
  }
  let singleDaughterShare = new Fraction(0);
  if (res2.distributions.find((d) => d.relationship === "DAUGHTER")) {
    const d = res2.distributions.find((d) => d.relationship === "DAUGHTER");
    const parts = d.share_fraction.split("/");
    const num = parseInt(parts[0], 10) || 0;
    const den = parts[1] ? parseInt(parts[1], 10) : 1;
    singleDaughterShare = new Fraction(num, den)
      .mul(scaleFactorForWills)
      .div(new Fraction(d.count || 1));
  }
  let singleGrandsonShare = new Fraction(0);
  if (res2.distributions.find((d) => d.relationship === "GRANDSON")) {
    const d = res2.distributions.find((d) => d.relationship === "GRANDSON");
    const parts = d.share_fraction.split("/");
    const num = parseInt(parts[0], 10) || 0;
    const den = parts[1] ? parseInt(parts[1], 10) : 1;
    singleGrandsonShare = new Fraction(num, den)
      .mul(scaleFactorForWills)
      .div(new Fraction(d.count || 1));
  }

  const resultTextParts = [];
  let sIdx2 = 0;
  let dIdx2 = 0;
  for (const mb of calc.case.mandatoryBequests) {
    if (mb.type === "son") sIdx2++;
    else if (mb.type === "daughter") dIdx2++;

    const label =
      mb.type === "son" ? getParentLabel(mb, sIdx2) : getParentLabel(mb, dIdx2);

    let parentShare = new Fraction(0);
    if (mb.type === "son") {
      parentShare = hasLivingGrandchildrenAsHeirs
        ? singleGrandsonShare
        : singleSonShare;
    } else {
      parentShare = singleDaughterShare;
    }

    resultTextParts.push(
      `مناب ${label} الافتراضي في التركة هو: ${parentShare.toString()}`,
    );
  }

  steps.push({
    id: "step2",
    title: "ثانياً: الفريضة التمهيدية (افتراض حياة أصول الفروع المتوفين لاستخراج منابهم)",
    desc: "تأصيل فريضة مفترضة بتقدير حياة الابن أو البنت المتوفاة في حياة المورث مع سائر الورثة الأحياء، لمعرفة ما كان سينوبه من التركة لو بقي حياً:",
    table: step2Table,
    result_text: resultTextParts.join("\n"),
  });

  // =========================================================================
  // STEP 3: Sub-problem distributions within each branch
  // =========================================================================
  let bSonIdx = 0;
  let bDaughterIdx = 0;
  const multipleBranches = calc.case.mandatoryBequests.length > 1;

  for (let bIdx = 0; bIdx < calc.case.mandatoryBequests.length; bIdx++) {
    const mb = calc.case.mandatoryBequests[bIdx];
    if (mb.type === "son") bSonIdx++;
    else if (mb.type === "daughter") bDaughterIdx++;

    const branchLabel =
      mb.type === "son"
        ? getParentLabel(mb, bSonIdx)
        : getParentLabel(mb, bDaughterIdx);

    let parentShare = new Fraction(0);
    if (mb.type === "son") {
      parentShare = hasLivingGrandchildrenAsHeirs
        ? singleGrandsonShare
        : singleSonShare;
    } else {
      parentShare = singleDaughterShare;
    }
    const parentShareStr = parentShare.toString();

    const step3HeirsList = [];
    const totalSons = parseInt(mb.sonsCount, 10) || 0;
    const totalDaughters = parseInt(mb.daughtersCount, 10) || 0;
    const totalGreatSons = parseInt(mb.greatSonsCount, 10) || 0;
    const totalGreatDaughters = parseInt(mb.greatDaughtersCount, 10) || 0;
    const hasGreat = totalGreatSons > 0 || totalGreatDaughters > 0;

    if (hasGreat) {
      // Deceased is the grandson
      if (totalGreatSons > 0)
        step3HeirsList.push({
          relationship: "SON",
          count: totalGreatSons,
          displayName: "ابن",
        });
      if (totalGreatDaughters > 0)
        step3HeirsList.push({
          relationship: "DAUGHTER",
          count: totalGreatDaughters,
          displayName: "بنت",
        });
      if (mb.greatSpouseAlive) {
        step3HeirsList.push({
          relationship: "WIFE",
          count: 1,
          displayName: "زوجـة",
        });
      }
      if (mb.spouseAlive) {
        step3HeirsList.push({
          relationship: "MOTHER",
          count: 1,
          displayName: "أم",
        });
      }
      if (mb.motherAlive) {
        step3HeirsList.push({
          relationship: "FATHER_MOTHER",
          count: 1,
          displayName: "أم الأب",
        });
      }
      const hasGF = calc.case.heirs.some(
        (h) =>
          h.relationship === "PATERNAL_GRANDFATHER" ||
          h.relationship === "FATHER",
      );
      if (hasGF) {
        step3HeirsList.push({
          relationship: "PATERNAL_GRANDFATHER",
          count: 1,
          displayName: "أب أب الأب",
        });
      }
      const hasGM = calc.case.heirs.some(
        (h) =>
          h.relationship === "MOTHER" ||
          h.relationship === "MATERNAL_GRANDMOTHER" ||
          h.relationship === "PATERNAL_GRANDMOTHER",
      );
      if (hasGM) {
        step3HeirsList.push({
          relationship: "MOTHER_MOTHER",
          count: 1,
          displayName: "أم أب الأب",
        });
      }
    } else {
      // Deceased is the son/daughter
      if (totalSons > 0)
        step3HeirsList.push({
          relationship: "SON",
          count: totalSons,
          displayName: "ابن",
        });
      if (totalDaughters > 0)
        step3HeirsList.push({
          relationship: "DAUGHTER",
          count: totalDaughters,
          displayName: "بنت",
        });
      if (mb.spouseAlive) {
        const spouseRel = mb.type === "son" ? "WIFE" : "HUSBAND";
        const spouseName = mb.type === "son" ? "زوجـة" : "زوج";
        step3HeirsList.push({
          relationship: spouseRel,
          count: 1,
          displayName: spouseName,
        });
      }
      const isFemale =
        calc.case.gender === "female" ||
        calc.case.deceased_gender === "female" ||
        calc.case.heirs.some((h) => h.relationship === "HUSBAND");

      if (isFemale) {
        const hasHusband = calc.case.heirs.some(
          (h) => h.relationship === "HUSBAND",
        );
        if (hasHusband) {
          step3HeirsList.push({
            relationship: "FATHER",
            count: 1,
            displayName: "أب",
          });
        }
        const hasGM = calc.case.heirs.some(
          (h) =>
            h.relationship === "MOTHER" ||
            h.relationship === "MATERNAL_GRANDMOTHER",
        );
        if (hasGM) {
          step3HeirsList.push({
            relationship: "MATERNAL_GRANDMOTHER",
            count: 1,
            displayName: "أم الأم (جدة)",
          });
        }
      } else {
        if (mb.motherAlive) {
          step3HeirsList.push({
            relationship: "MOTHER",
            count: 1,
            displayName: "أم",
          });
        } else {
          const hasGM = calc.case.heirs.some(
            (h) =>
              h.relationship === "MOTHER" ||
              h.relationship === "MATERNAL_GRANDMOTHER" ||
              h.relationship === "PATERNAL_GRANDMOTHER",
          );
          if (hasGM) {
            step3HeirsList.push({
              relationship: "PATERNAL_GRANDMOTHER",
              count: 1,
              displayName: "أم الأب",
            });
          }
        }
        const hasGF = calc.case.heirs.some(
          (h) =>
            h.relationship === "PATERNAL_GRANDFATHER" ||
            h.relationship === "FATHER",
        );
        if (hasGF) {
          step3HeirsList.push({
            relationship: "PATERNAL_GRANDFATHER",
            count: 1,
            displayName: "أب الأب",
          });
        }
      }
    }

    const step3Case = {
      ...calc.case,
      heirs: step3HeirsList.map((h) => ({
        relationship: h.relationship,
        count: h.count,
      })),
      mandatoryBequests: [],
    };
    const calc3 = new calc.constructor(step3Case);
    for (const h of step3HeirsList) {
      if (h.displayName && calc3.heirs[h.relationship]) {
        calc3.heirs[h.relationship].displayName = h.displayName;
      }
    }

    const res3 = calc3.calculate();

    const step3Table = res3.distributions.map((d) => {
      return {
        name: d.relationship_display,
        count: d.count,
        share: d.share_fraction,
        percentage: d.percentage,
        why: d.why,
      };
    });

    const mbResultEntry = calc.mandatory_bequests_result.list.find(
      (l) => l.id === mb.id,
    );
    let branchBequestFract = "0";
    if (mbResultEntry) {
      let sum = new Fraction(0);
      for (const kid of mbResultEntry.kids) {
        sum = sum.add(kid.share);
      }
      branchBequestFract = sum.toString();
    }

    const titlePrefix = multipleBranches ? `ثالثاً (${bIdx + 1}):` : "ثالثاً:";
    steps.push({
      id: `step3_${mb.id}`,
      title: `${titlePrefix} قسمة مناب الوصية الواجبة لفرع ${branchLabel} على مستحقيه (للذكر مثل حظ الأنثيين)`,
      desc: `قسمة مناب ${branchLabel} الافتراضي (${parentShareStr}) على أولاده بعد استنزال أنصبة ورثته الافتراضيين، وتطبيق قاعدة: للذكر مثل حظ الأنثيين (المادة 370 من مدونة الأسرة) على عدد رؤوس الأحفاد:`,
      table: step3Table,
      result_text: `مناب الفرد من التركة العامة هو حاصل ضرب نصيبه في الفرع في حصة أصله الافتراضية (${parentShareStr}). إجمالي ما استحقه هذا الفرع هو (${branchBequestFract})، وهو في حدود الثلث الشرعي المقرّر قانوناً.`,
    });
  }

  // =========================================================================
  // STEP 4: Distribution of remaining estate across all parties
  // =========================================================================
  const scaleFactor4 = calc.heirs_scale_fraction || new Fraction(1);
  const activeHeirs = [];
  for (const [rel, d] of Object.entries(calc.results)) {
    const heirObj = calc.heirs[rel];
    const finalShare = d.share.mul(scaleFactor4);
    if (heirObj && heirObj.branches && heirObj.branches.length > 1) {
      const count = d.count;
      const indShare =
        count > 1 ? finalShare.div(new Fraction(count)) : finalShare;
      for (const b of heirObj.branches) {
        const bShare = indShare.mul(new Fraction(b.count));
        const nameMap = {
          GRANDSON: "ابن ابن",
          GRANDDAUGHTER: "بنت ابن",
          GREAT_GRANDSON: "ابن ابن ابن",
          GREAT_GRANDDAUGHTER: "بنت ابن ابن",
        };
        const baseName = nameMap[rel] || HEIR_NAMES_AR[rel] || rel;
        const bDisplayName = b.designation
          ? `${baseName} ${b.designation}`
          : baseName;
        activeHeirs.push({
          name: bDisplayName,
          count: b.count,
          share: bShare.toString(),
          percentage: Math.round(parseFloat(bShare.valueOf()) * 10000) / 100,
        });
      }
    } else {
      let displayName = heirObj ? heirObj.displayName : rel;
      if (rel === "TREASURY") {
        displayName = "بيت المال";
      }
      activeHeirs.push({
        name: displayName,
        count: d.count,
        share: finalShare.toString(),
        percentage: Math.round(parseFloat(finalShare.valueOf()) * 10000) / 100,
      });
    }
  }

  if (calc.mandatory_bequests_result && calc.mandatory_bequests_result.list) {
    let mbSonIndex = 0;
    let mbDaughterIndex = 0;
    for (const mb of calc.mandatory_bequests_result.list) {
      let parentDesig = "";
      if (mb.type === "son") {
        mbSonIndex++;
        parentDesig = getParentDesignation(mb, mbSonIndex);
      } else {
        mbDaughterIndex++;
        parentDesig = getParentDesignation(mb, mbDaughterIndex);
      }
      for (const kid of mb.kids) {
        let relationshipDisplay = "";
        if (kid.type === "grandson")
          relationshipDisplay = `ابن ابن ${parentDesig}`;
        else if (kid.type === "granddaughter")
          relationshipDisplay = `بنت ابن ${parentDesig}`;
        else if (kid.type === "great_grandson")
          relationshipDisplay = `ابن ابن ابن ${parentDesig}`;
        else if (kid.type === "great_granddaughter")
          relationshipDisplay = `بنت ابن ابن ${parentDesig}`;
        else if (kid.type === "grandson_of_daughter")
          relationshipDisplay = `ابن بنت ${parentDesig}`;
        else if (kid.type === "granddaughter_of_daughter")
          relationshipDisplay = `بنت بنت ${parentDesig}`;

        activeHeirs.push({
          name: relationshipDisplay,
          count: kid.count,
          share: kid.share.mul(new Fraction(kid.count)).toString(),
          percentage:
            Math.round(parseFloat(kid.share.valueOf()) * kid.count * 10000) /
            100,
        });
      }
    }
  }

  if (calc.wills_executed && calc.wills_executed.length > 0) {
    const mbFract =
      (calc.mandatory_bequests_result &&
        calc.mandatory_bequests_result.fraction) ||
      new Fraction(0);
    const scaleRemaining = new Fraction(1).sub(mbFract);
    for (const will of calc.wills_executed) {
      const executedFraction =
        will.executed_fraction_obj ||
        new Fraction(will.executed_fraction_share || "0");
      const willEntireEstateFraction = executedFraction.mul(scaleRemaining);
      const willName =
        will.name?.includes("مُوصَىٰ له") || will.name?.includes("موصى له")
          ? will.name
          : `مُوصَىٰ له بـ ${will.name || will.original_value || "وصية"}`;
      activeHeirs.push({
        name: willName,
        count: "-",
        share: willEntireEstateFraction.toString(),
        percentage:
          Math.round(parseFloat(willEntireEstateFraction.valueOf()) * 10000) /
          100,
      });
    }
  }

  let commonDen = 1;
  for (const h of activeHeirs) {
    if (h.share.includes("/")) {
      const den = parseInt(h.share.split("/")[1], 10) || 1;
      commonDen = lcm(commonDen, den);
    }
  }

  const step4Table = activeHeirs.map((h) => {
    let num = parseInt(h.share, 10) || 0;
    let den = 1;
    if (h.share.includes("/")) {
      num = parseInt(h.share.split("/")[0], 10) || 0;
      den = parseInt(h.share.split("/")[1], 10) || 1;
    }
    const scaledNum = num * (commonDen / den);
    return {
      name: h.name,
      count: h.count,
      share: `${scaledNum}/${commonDen}`,
      percentage: h.percentage,
      status: "نصيب نهائي من التركة",
    };
  });

  steps.push({
    id: "step4",
    title: "رابعاً: الفريضة الجامعة وتوزيع التركة بين الورثة ومستحقي الوصية",
    desc: "بعد إخراج مناب الوصية الواجبة من أصل التركة، يتم استخراج الفريضة الجامعة وبسط سهام الورثة ومستحقي الوصية وتوزيع التركة المالية بمقتضاها:",
    table: step4Table,
  });

  return steps;
}
