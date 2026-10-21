/**
 * @file Radd.js
 * @description Implements the principle of Al-Radd (الرد) in Islamic inheritance law.
 * When the sum of all prescribed fixed shares is less than 1 and no residuary heir (Asabah) is present,
 * the remaining estate is redistributed proportionally to fixed-share heirs.
 * Follows the Moroccan Family Code (Article 349) and the consensus of Islamic jurisprudence:
 * spouses do not receive Radd when blood relatives (ذوو الفروض النسبية) exist.
 */

import Fraction from "../fraction.js";

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

function lcm(a, b) {
  if (!a || !b) return 0;
  return Math.abs((a * b) / gcd(a, b));
}

/**
 * Checks for and applies Al-Radd (الرد) to eligible fixed-share heirs.
 *
 * Rules of Al-Radd:
 * 1. Standard Case: Spouses (Husband/Wife) take their fixed share only; the remainder is redistributed
 *    proportionally among other blood relatives (ذوو الفروض النسبية: Mother, Daughters, Granddaughters, Sisters, Maternal Siblings).
 * 2. Sole Heir Case: Under modern statutory codes (including Moroccan Mudawwana Art. 349), if a spouse is the sole surviving heir
 *    with no other blood relatives, the entire estate returns to the spouse via Radd.
 *
 * @param {Object.<string, {share: Fraction, count: number}>} results - Distribution results dictionary.
 * @param {Object.<string, string>} explanations - Legal reasons dictionary.
 * @param {import('./Helpers.js').HeirMap} [heirs] - Active heirs map (optional).
 * @param {Object.<string, {share: Fraction, count: number}>} [initialShares] - Unaltered initial shares before Radd/Awl.
 * @param {number} [netEstate] - Net estate monetary amount.
 * @returns {Object} Comprehensive Radd result metadata and step breakdowns.
 */
export function checkAndApplyRadd(
  results,
  explanations,
  heirs,
  initialShares,
  netEstate = 0,
) {
  let sumShares = new Fraction(0);
  let sumSpouses = new Fraction(0);
  let sumOthers = new Fraction(0);

  const spouseKeys = ["HUSBAND", "WIFE"];
  const activeSpouseKeys = [];
  const activeOtherKeys = [];

  for (const key of Object.keys(results)) {
    if (results[key].asabah) {
      return { isRadd: false };
    }
    const share = results[key].share;
    sumShares = sumShares.add(share);
    if (spouseKeys.includes(key)) {
      sumSpouses = sumSpouses.add(share);
      activeSpouseKeys.push(key);
    } else {
      sumOthers = sumOthers.add(share);
      activeOtherKeys.push(key);
    }
  }

  // If sum of shares is not strictly less than 1, Radd does not apply
  if (!sumShares.lessThan(1)) {
    return { isRadd: false };
  }

  const initialSharesMap = initialShares || results;

  // 1. Calculate the initial base origin (أصل مسألة الفروض الأولى)
  let initialOrigin = 1;
  for (const key of Object.keys(results)) {
    const sh = (initialSharesMap[key]?.share || results[key].share).toString();
    if (sh.includes("/")) {
      const den = parseInt(sh.split("/")[1], 10) || 1;
      initialOrigin = lcm(initialOrigin, den);
    }
  }

  let sumInitialNumerators = 0;
  const initialRows = [];
  for (const key of Object.keys(results)) {
    const initShare = initialSharesMap[key]?.share || results[key].share;
    const heirInfo = heirs ? heirs[key] : null;
    const count = results[key].count || (heirInfo ? heirInfo.count : 1);
    const numInBase = Math.round(initShare.valueOf() * initialOrigin);
    sumInitialNumerators += numInBase;
    initialRows.push({
      key,
      name: heirInfo?.displayName || key,
      count,
      isSpouse: spouseKeys.includes(key),
      shareFraction: initShare.toString(),
      sharesInBase: numInBase,
    });
  }

  const surplusShares = initialOrigin - sumInitialNumerators;
  const surplusFraction = new Fraction(surplusShares, initialOrigin);

  // -------------------------------------------------------------------------
  // Case A: Radd with Spouse and Other Blood Relatives (الرد مع وجود أحد الزوجين)
  // -------------------------------------------------------------------------
  if (activeOtherKeys.length > 0 && activeSpouseKeys.length > 0) {
    const spouseKey = activeSpouseKeys[0];
    const spouseOriginalShare =
      initialSharesMap[spouseKey]?.share || results[spouseKey].share;
    const spousalBase =
      parseInt(spouseOriginalShare.toString().split("/")[1], 10) || 1;
    const spousalNumerator =
      parseInt(spouseOriginalShare.toString().split("/")[0], 10) || 1;
    const remainderForOthersNum = spousalBase - spousalNumerator;

    // Calculate non-spouse Radd base (أصل مسألة الرد)
    let raddLcm = 1;
    for (const key of activeOtherKeys) {
      const sh = (
        initialSharesMap[key]?.share || results[key].share
      ).toString();
      if (sh.includes("/")) {
        const den = parseInt(sh.split("/")[1], 10) || 1;
        raddLcm = lcm(raddLcm, den);
      }
    }

    let raddBase = 0;
    const otherInitialNumerators = {};
    for (const key of activeOtherKeys) {
      const initShare = initialSharesMap[key]?.share || results[key].share;
      const numInRaddLcm = Math.round(initShare.valueOf() * raddLcm);
      raddBase += numInRaddLcm;
      otherInitialNumerators[key] = numInRaddLcm;
    }

    let raddGcd = raddBase;
    for (const key of activeOtherKeys) {
      raddGcd = gcd(raddGcd, otherInitialNumerators[key]);
    }
    if (raddGcd > 1) {
      raddBase = raddBase / raddGcd;
      for (const key of activeOtherKeys) {
        otherInitialNumerators[key] = otherInitialNumerators[key] / raddGcd;
      }
    }

    // Combined Problem (أصل الجامعة)
    const jGcd = gcd(remainderForOthersNum, raddBase);
    const factorForSpouse = raddBase / jGcd;
    const factorForOthers = remainderForOthersNum / jGcd;
    const jameahBase = spousalBase * factorForSpouse;

    const jameahShares = {};
    jameahShares[spouseKey] = spousalNumerator * factorForSpouse;
    for (const key of activeOtherKeys) {
      jameahShares[key] = otherInitialNumerators[key] * factorForOthers;
    }

    // Check Inkesar on heads (تصحيح الانكسار على الرؤوس)
    let correctionMultiplier = 1;
    for (const key of Object.keys(results)) {
      const heirInfo = heirs ? heirs[key] : null;
      const count = results[key].count || (heirInfo ? heirInfo.count : 1);
      const shares = jameahShares[key];
      if (count > 1) {
        const g = gcd(shares, count);
        const needed = count / g;
        correctionMultiplier = lcm(correctionMultiplier, needed);
      }
    }

    const correctedBase = jameahBase * correctionMultiplier;

    // Apply redistribution to results dictionary
    const remainingForOthersFrac = new Fraction(1).sub(sumSpouses);
    for (const key of activeOtherKeys) {
      const originalShare = results[key].share;
      const newShare = remainingForOthersFrac.mul(originalShare.div(sumOthers));
      results[key].share = newShare;
      explanations[key] =
        (explanations[key] || "") +
        ` (ردت المسألة: تم زيادة النصيب بالرد لعدم وجود عاصب عملاً بالمادة 349 من مدونة الأسرة، من ${originalShare.toString()} إلى ${newShare.toString()}).`;
    }

    // Build finalized table rows
    const rows = [];
    for (const key of Object.keys(results)) {
      const heirInfo = heirs ? heirs[key] : null;
      const count = results[key].count || (heirInfo ? heirInfo.count : 1);
      const isSpouse = spouseKeys.includes(key);
      const jShares = jameahShares[key];
      const finalShares = jShares * correctionMultiplier;
      const perPersonShares = count > 0 ? finalShares / count : finalShares;
      const shareFrac = results[key].share;
      const pct = Math.round(shareFrac.valueOf() * 10000) / 100;
      const totalVal = netEstate
        ? Math.round(shareFrac.valueOf() * netEstate * 100) / 100
        : 0;
      const perPersonVal =
        count > 0 ? Math.round((totalVal / count) * 100) / 100 : totalVal;

      rows.push({
        key,
        name: heirInfo?.displayName || key,
        count,
        isSpouse,
        role_label: isSpouse ? "فرض زوجية (لا رد)" : "من أهل الرد",
        originalFraction: (
          initialSharesMap[key]?.share || results[key].share
        ).toString(),
        sharesInInitialBase: Math.round(
          (initialSharesMap[key]?.share || results[key].share).valueOf() *
            initialOrigin,
        ),
        jameahShares: jShares,
        correctedShares: finalShares,
        perPersonShares,
        finalFraction: `${finalShares}/${correctedBase}`,
        individualFraction: `${perPersonShares}/${correctedBase}`,
        percentage: pct,
        individualPercentage:
          count > 0 ? Math.round((pct / count) * 100) / 100 : pct,
        totalValue: totalVal,
        perPersonValue: perPersonVal,
      });
    }

    return {
      isRadd: true,
      type: "RADD_WITH_SPOUSE",
      hasSpouse: true,
      initialOrigin,
      sumInitialNumerators,
      surplusShares,
      surplusFraction: surplusFraction.toString(),
      spousalBase,
      spousalNumerator,
      remainderForOthersNum,
      raddBase,
      factorForSpouse,
      factorForOthers,
      jameahBase,
      correctionMultiplier,
      correctedBase,
      initialRows,
      rows,
      legalNote:
        "وفقاً للمادة 349 من مدونة الأسرة المغربية وقواعد الفقه الإسلامي، يُرد الباقي على ذوي الفروض النسبية دون الزوجين؛ إذ يستوفي الزوج/الزوجة فرضه كاملاً فقط ولا يزاحم أهل القرابة النسبية في الرد.",
    };
  }

  // -------------------------------------------------------------------------
  // Case B: Radd without Spouse (الرد في عدم وجود أحد الزوجين)
  // -------------------------------------------------------------------------
  if (activeOtherKeys.length > 0 && activeSpouseKeys.length === 0) {
    let raddBase = 0;
    const otherNumerators = {};
    for (const key of activeOtherKeys) {
      const initShare = initialSharesMap[key]?.share || results[key].share;
      const numInInitial = Math.round(initShare.valueOf() * initialOrigin);
      raddBase += numInInitial;
      otherNumerators[key] = numInInitial;
    }

    let rGcd = raddBase;
    for (const key of activeOtherKeys) {
      rGcd = gcd(rGcd, otherNumerators[key]);
    }
    if (rGcd > 1) {
      raddBase = raddBase / rGcd;
      for (const key of activeOtherKeys) {
        otherNumerators[key] = otherNumerators[key] / rGcd;
      }
    }

    let correctionMultiplier = 1;
    for (const key of activeOtherKeys) {
      const heirInfo = heirs ? heirs[key] : null;
      const count = results[key].count || (heirInfo ? heirInfo.count : 1);
      const shs = otherNumerators[key];
      if (count > 1) {
        const g = gcd(shs, count);
        const needed = count / g;
        correctionMultiplier = lcm(correctionMultiplier, needed);
      }
    }

    const correctedBase = raddBase * correctionMultiplier;

    // Apply redistribution
    for (const key of activeOtherKeys) {
      const originalShare = results[key].share;
      const newShare = originalShare.div(sumOthers);
      results[key].share = newShare;
      explanations[key] =
        (explanations[key] || "") +
        ` (ردت المسألة: تم زيادة النصيب بالرد لعدم وجود عاصب، من ${originalShare.toString()} إلى ${newShare.toString()}).`;
    }

    const rows = [];
    for (const key of activeOtherKeys) {
      const heirInfo = heirs ? heirs[key] : null;
      const count = results[key].count || (heirInfo ? heirInfo.count : 1);
      const baseShares = otherNumerators[key];
      const finalShares = baseShares * correctionMultiplier;
      const perPersonShares = count > 0 ? finalShares / count : finalShares;
      const shareFrac = results[key].share;
      const pct = Math.round(shareFrac.valueOf() * 10000) / 100;
      const totalVal = netEstate
        ? Math.round(shareFrac.valueOf() * netEstate * 100) / 100
        : 0;
      const perPersonVal =
        count > 0 ? Math.round((totalVal / count) * 100) / 100 : totalVal;

      rows.push({
        key,
        name: heirInfo?.displayName || key,
        count,
        isSpouse: false,
        role_label: "من أهل الرد",
        originalFraction: (
          initialSharesMap[key]?.share || results[key].share
        ).toString(),
        sharesInInitialBase: Math.round(
          (initialSharesMap[key]?.share || results[key].share).valueOf() *
            initialOrigin,
        ),
        jameahShares: baseShares,
        correctedShares: finalShares,
        perPersonShares,
        finalFraction: `${finalShares}/${correctedBase}`,
        individualFraction: `${perPersonShares}/${correctedBase}`,
        percentage: pct,
        individualPercentage:
          count > 0 ? Math.round((pct / count) * 100) / 100 : pct,
        totalValue: totalVal,
        perPersonValue: perPersonVal,
      });
    }

    return {
      isRadd: true,
      type: "RADD_WITHOUT_SPOUSE",
      hasSpouse: false,
      initialOrigin,
      sumInitialNumerators,
      surplusShares,
      surplusFraction: surplusFraction.toString(),
      raddBase,
      jameahBase: raddBase,
      correctionMultiplier,
      correctedBase,
      initialRows,
      rows,
      legalNote:
        "لعدم وجود أحد الزوجين ولا عاصب، رُدَّ أصل المسألة مباشرة إلى مجموع سهام أصحاب الفروض النسبية وقُسمت التركة بينهم بنسبة فروضهم الشرعية.",
    };
  }

  // -------------------------------------------------------------------------
  // Case C: Sole Spouse Heir (الرد على أحد الزوجين لانفراده)
  // -------------------------------------------------------------------------
  if (activeSpouseKeys.length > 0 && activeOtherKeys.length === 0) {
    for (const key of activeSpouseKeys) {
      results[key].share = new Fraction(1);
      explanations[key] =
        (explanations[key] || "") +
        ` (ردت المسألة: تم زيادة نصيب الزوج/الزوجة بالرد لعدم وجود أي وارث نسبي آخر عملاً بالمادة 349 من مدونة الأسرة).`;
    }

    const rows = activeSpouseKeys.map((key) => {
      const heirInfo = heirs ? heirs[key] : null;
      const count = results[key].count || (heirInfo ? heirInfo.count : 1);
      return {
        key,
        name: heirInfo?.displayName || key,
        count,
        isSpouse: true,
        role_label: "زوجية مستغرقة بالرد",
        originalFraction: (
          initialSharesMap[key]?.share || results[key].share
        ).toString(),
        sharesInInitialBase: 1,
        jameahShares: 1,
        correctedShares: count,
        perPersonShares: 1,
        finalFraction: "1/1",
        individualFraction: count > 1 ? `1/${count}` : "1/1",
        percentage: 100,
        individualPercentage:
          count > 0 ? Math.round((100 / count) * 100) / 100 : 100,
        totalValue: netEstate,
        perPersonValue:
          count > 0 ? Math.round((netEstate / count) * 100) / 100 : netEstate,
      };
    });

    return {
      isRadd: true,
      type: "RADD_SOLE_SPOUSE",
      hasSpouse: true,
      initialOrigin,
      sumInitialNumerators,
      surplusShares,
      surplusFraction: surplusFraction.toString(),
      raddBase: 1,
      jameahBase: 1,
      correctionMultiplier: 1,
      correctedBase: 1,
      initialRows,
      rows,
      legalNote:
        "وفقاً للمادة 349 من مدونة الأسرة، إذا لم يوجد صاحب فرض من النسب ولا عصبة، يُرد باقي التركة كاملاً على أحد الزوجين المنفرد.",
    };
  }

  return { isRadd: false };
}
