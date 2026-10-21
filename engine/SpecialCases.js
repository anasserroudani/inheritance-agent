/**
 * @file SpecialCases.js
 * @description
 * Detection and detailed fiqh classification of named classical inheritance cases
 * (المسائل الملقبة والخاصة في علم الفرائض ومدونة الأسرة المغربية).
 *
 * Moroccan Statutory Special Cases (مدونة الأسرة المغربية - الباب السابع: مسائل خاصة):
 * - المادة 361: المسألة الأكدرية
 * - المادة 362: المسألة المالكية
 * - المادة 363: شبه المالكية
 * - المادة 364: مسألة الخرقاء
 * - المادة 365: المسألة المشتركة (الحمارية / اليمية / الحجرية)
 * - المادة 366: مسألة الغراوين (المسألة الغراء مع الزوج أو مع الزوجة)
 * - المادة 367: مسألة المباهلة
 * - المادة 368: المسألة المنبرية
 *
 * Classical Named Cases:
 * - مسألة أم الفروخ (المسألة الشريحية)
 * - القريب المبارك (المادتان 341 و 342)
 * - المسألة الدينارية الصغرى (أم الأرامل / السبعة عشرية)
 * - المسألة الدينارية الكبرى (الداودية / الركابية)
 */

import { isAkdariyya as engineIsAkdariyya } from "./Grandfather.js";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const GRANDMOTHER_KEYS = ["MATERNAL_GRANDMOTHER", "PATERNAL_GRANDMOTHER"];

/**
 * Returns the count of active (unblocked) heirs of a specific relation.
 */
function count(heirs, key) {
  if (!heirs || !heirs[key]) return 0;
  if (heirs[key].is_blocked) return 0;
  return Number(heirs[key].count || 0);
}

/**
 * Checks if the heir exists and is not blocked.
 */
function active(heirs, key) {
  return Boolean(
    heirs?.[key] && !heirs[key].is_blocked && Number(heirs[key].count || 0) > 0,
  );
}

/**
 * Checks if the count of an heir relation is exactly N.
 */
function exactly(heirs, key, n) {
  return count(heirs, key) === n;
}

/**
 * Returns total count of active grandmothers (maternal + paternal).
 */
function totalGrandmothers(heirs) {
  return (
    count(heirs, "MATERNAL_GRANDMOTHER") + count(heirs, "PATERNAL_GRANDMOTHER")
  );
}

/**
 * Checks if any other heirs exist outside the allowed list.
 */
function hasOtherActiveHeirs(
  heirs,
  allowedKeys = [],
  allowGrandmothers = false,
) {
  if (!heirs) return false;
  const allowed = new Set(allowedKeys);

  return Object.entries(heirs).some(([key, value]) => {
    if (allowed.has(key)) return false;
    if (allowGrandmothers && GRANDMOTHER_KEYS.includes(key)) return false;

    return value && !value.is_blocked && Number(value.count || 0) > 0;
  });
}

/* -------------------------------------------------------------------------- */
/* 1. مسألة الغراوين (الغراوان / العمريتان) — المادة 366                      */
/* -------------------------------------------------------------------------- */

/**
 * Checks Al-Gharrawayn (مسألتا الغراوين - المادة 366 من مدونة الأسرة).
 *
 * Case 1: Husband + Mother + Father (no descendants, no siblings >= 2).
 * Case 2: Wife (1 or more) + Mother + Father (no descendants, no siblings >= 2).
 *
 * @param {Object} heirs
 * @returns {{ isUmariyyah: boolean, type: 'HUSBAND'|'WIFE'|null }}
 */
export function checkUmariyyah(heirs) {
  if (!heirs) return { isUmariyyah: false, type: null };

  const hasHusband = count(heirs, "HUSBAND") === 1;
  const hasWife = count(heirs, "WIFE") >= 1;

  if (!hasHusband && !hasWife) return { isUmariyyah: false, type: null };

  // Must have exactly Mother and Father
  if (!exactly(heirs, "MOTHER", 1) || !exactly(heirs, "FATHER", 1)) {
    return { isUmariyyah: false, type: null };
  }

  // Must NOT have any descendants (children or grandchildren)
  const descendants = [
    "SON",
    "DAUGHTER",
    "GRANDSON",
    "GRANDDAUGHTER",
    "GREAT_GRANDSON",
    "GREAT_GRANDDAUGHTER",
  ];
  if (descendants.some((d) => active(heirs, d))) {
    return { isUmariyyah: false, type: null };
  }

  // Must NOT have multiple siblings (2 or more)
  const siblingKeys = [
    "FULL_BROTHER",
    "FULL_SISTER",
    "PATERNAL_BROTHER",
    "PATERNAL_SISTER",
    "MATERNAL_BROTHER",
    "MATERNAL_SISTER",
    "MATERNAL_SIBLINGS",
  ];
  const siblingCount = siblingKeys.reduce((acc, k) => acc + count(heirs, k), 0);
  if (siblingCount >= 2) return { isUmariyyah: false, type: null };

  // No other heirs
  const allowed = hasHusband
    ? ["HUSBAND", "MOTHER", "FATHER"]
    : ["WIFE", "MOTHER", "FATHER"];

  // A single sibling does not block the mother from 1/3 of remainder
  siblingKeys.forEach((k) => allowed.push(k));

  if (hasOtherActiveHeirs(heirs, allowed)) {
    return { isUmariyyah: false, type: null };
  }

  return {
    isUmariyyah: true,
    type: hasHusband ? "HUSBAND" : "WIFE",
  };
}

export const isUmariyyah = checkUmariyyah;

/* -------------------------------------------------------------------------- */
/* 2. المسألة المنبرية — المادة 368                                            */
/* -------------------------------------------------------------------------- */

/**
 * Checks Al-Minbariyya (المسألة المنبرية - وصار ثمنها تُسعاً).
 * Moroccan Family Code Article 368.
 *
 * Condition: Exactly 1 Wife + Exactly 2 Daughters + Father + Mother.
 * Base 24 awls to 27.
 *
 * @param {Object} heirs
 * @param {number|null} [awlBase]
 * @returns {boolean}
 */
export function isMinbariyya(heirs, awlBase = null) {
  if (!heirs) return false;

  const hasWife = exactly(heirs, "WIFE", 1);
  const hasDaughters = exactly(heirs, "DAUGHTER", 2);
  const hasFather = exactly(heirs, "FATHER", 1);
  const hasMother = exactly(heirs, "MOTHER", 1);

  if (!hasWife || !hasDaughters || !hasFather || !hasMother) return false;

  if (hasOtherActiveHeirs(heirs, ["WIFE", "DAUGHTER", "FATHER", "MOTHER"])) {
    return false;
  }

  if (awlBase != null) {
    return Number(awlBase) === 27;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* 3. المسألة الأكدرية — المادة 361                                            */
/* -------------------------------------------------------------------------- */

/**
 * Checks Al-Akdariyya (المسألة الأكدرية).
 * Moroccan Family Code Article 361.
 *
 * Condition: Husband + Mother + Paternal Grandfather + 1 Sister (Full or Paternal).
 *
 * @param {Object} heirs
 * @returns {boolean}
 */
export function isAkdariyya(heirs) {
  if (!heirs) return false;

  if (!exactly(heirs, "HUSBAND", 1)) return false;
  if (!exactly(heirs, "MOTHER", 1)) return false;
  if (!exactly(heirs, "PATERNAL_GRANDFATHER", 1)) return false;

  const fullSisters = count(heirs, "FULL_SISTER");
  const patSisters = count(heirs, "PATERNAL_SISTER");
  const totalSisters = fullSisters + patSisters;

  if (totalSisters !== 1) return false;

  // No full brothers or paternal brothers
  if (
    count(heirs, "FULL_BROTHER") > 0 ||
    count(heirs, "PATERNAL_BROTHER") > 0
  ) {
    return false;
  }

  if (
    hasOtherActiveHeirs(heirs, [
      "HUSBAND",
      "MOTHER",
      "PATERNAL_GRANDFATHER",
      "FULL_SISTER",
      "PATERNAL_SISTER",
    ])
  ) {
    return false;
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* 4. المسألة المالكية — المادة 362                                            */
/* -------------------------------------------------------------------------- */

/**
 * Checks Al-Mas'ala Al-Malikiyyah (المسألة المالكية).
 * Moroccan Family Code Article 362.
 *
 * Condition: Husband + (Mother OR Grandmother) + Paternal Grandfather +
 *            >= 2 Maternal Siblings + >= 1 Paternal Brother(s) (no full brother).
 *
 * @param {Object} heirs
 * @returns {boolean}
 */
export function isMalikiyyah(heirs) {
  if (!heirs) return false;

  if (!exactly(heirs, "HUSBAND", 1)) return false;

  const hasMotherOrGrandmother =
    exactly(heirs, "MOTHER", 1) || totalGrandmothers(heirs) >= 1;

  if (!hasMotherOrGrandmother) return false;
  if (!exactly(heirs, "PATERNAL_GRANDFATHER", 1)) return false;

  const matSiblings =
    count(heirs, "MATERNAL_BROTHER") +
    count(heirs, "MATERNAL_SISTER") +
    count(heirs, "MATERNAL_SIBLINGS");
  if (matSiblings < 2) return false;

  const patBrothers = count(heirs, "PATERNAL_BROTHER");
  if (patBrothers < 1) return false;

  // Crucial: NO full brothers
  if (count(heirs, "FULL_BROTHER") > 0) return false;

  const allowed = [
    "HUSBAND",
    "MOTHER",
    "PATERNAL_GRANDFATHER",
    "MATERNAL_BROTHER",
    "MATERNAL_SISTER",
    "MATERNAL_SIBLINGS",
    "PATERNAL_BROTHER",
    "PATERNAL_SISTER",
  ];

  return !hasOtherActiveHeirs(heirs, allowed, true);
}

/* -------------------------------------------------------------------------- */
/* 5. مسألة شبه المالكية — المادة 363                                          */
/* -------------------------------------------------------------------------- */

/**
 * Checks Shibh Al-Malikiyyah (شبه المالكية).
 * Moroccan Family Code Article 363.
 *
 * Condition: Husband + (Mother OR Grandmother) + Paternal Grandfather +
 *            >= 2 Maternal Siblings + exactly 1 Full Brother (no paternal brothers).
 *
 * @param {Object} heirs
 * @returns {boolean}
 */
export function isShibhMalikiyyah(heirs) {
  if (!heirs) return false;

  if (!exactly(heirs, "HUSBAND", 1)) return false;

  const hasMotherOrGrandmother =
    exactly(heirs, "MOTHER", 1) || totalGrandmothers(heirs) >= 1;

  if (!hasMotherOrGrandmother) return false;
  if (!exactly(heirs, "PATERNAL_GRANDFATHER", 1)) return false;

  const matSiblings =
    count(heirs, "MATERNAL_BROTHER") +
    count(heirs, "MATERNAL_SISTER") +
    count(heirs, "MATERNAL_SIBLINGS");
  if (matSiblings < 2) return false;

  if (!exactly(heirs, "FULL_BROTHER", 1)) return false;

  const allowed = [
    "HUSBAND",
    "MOTHER",
    "PATERNAL_GRANDFATHER",
    "MATERNAL_BROTHER",
    "MATERNAL_SISTER",
    "MATERNAL_SIBLINGS",
    "FULL_BROTHER",
  ];

  return !hasOtherActiveHeirs(heirs, allowed, true);
}

/* -------------------------------------------------------------------------- */
/* 6. مسألة الخرقاء — المادة 364                                               */
/* -------------------------------------------------------------------------- */

/**
 * Checks Al-Kharqa (مسألة الخرقاء).
 * Moroccan Family Code Article 364.
 *
 * Condition: Mother + Paternal Grandfather + 1 Sister (Full or Paternal only).
 * Base 3, corrected to 9: Mother 3, Grandfather 4, Sister 2.
 *
 * @param {Object} heirs
 * @returns {boolean}
 */
export function isKharqa(heirs) {
  if (!heirs) return false;

  if (!exactly(heirs, "MOTHER", 1)) return false;
  if (!exactly(heirs, "PATERNAL_GRANDFATHER", 1)) return false;

  const fullSisters = count(heirs, "FULL_SISTER");
  const patSisters = count(heirs, "PATERNAL_SISTER");
  const totalSisters = fullSisters + patSisters;

  if (totalSisters !== 1) return false;

  if (
    hasOtherActiveHeirs(heirs, [
      "MOTHER",
      "PATERNAL_GRANDFATHER",
      "FULL_SISTER",
      "PATERNAL_SISTER",
    ])
  ) {
    return false;
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* مسألة المعادة — المادة 360                                                */
/* -------------------------------------------------------------------------- */

/**
 * Checks Al-Mu'adah (مسألة المعادة).
 * Moroccan Family Code Article 360.
 *
 * Condition: Grandfather + at least 1 Full Sibling + at least 1 Paternal Sibling.
 * Father and male descendants must NOT be present.
 *
 * @param {Object} heirs
 * @returns {boolean}
 */
export function isMuadah(heirs) {
  if (!heirs) return false;

  const hasGrandfather =
    count(heirs, "PATERNAL_GRANDFATHER") === 1 ||
    count(heirs, "PATERNAL_GREAT_GRANDFATHER") === 1;
  if (!hasGrandfather) return false;

  if (active(heirs, "FATHER")) return false;

  const maleDescendants = ["SON", "GRANDSON", "GREAT_GRANDSON"];
  if (maleDescendants.some((d) => active(heirs, d))) return false;

  const fullSiblings =
    count(heirs, "FULL_BROTHER") + count(heirs, "FULL_SISTER");
  const patSiblings =
    count(heirs, "PATERNAL_BROTHER") + count(heirs, "PATERNAL_SISTER");

  return fullSiblings >= 1 && patSiblings >= 1;
}

/* -------------------------------------------------------------------------- */
/* 7. المسألة المشتركة — المادة 365                                            */
/* -------------------------------------------------------------------------- */

/**
 * Checks Al-Mushtarakah (المسألة المشتركة / الحمارية / اليمية).
 * Moroccan Family Code Article 365.
 *
 * Condition: Husband + (Mother OR Grandmother) + >= 2 Maternal Siblings +
 *            >= 1 Full Sibling (at least 1 male full brother).
 *
 * @param {Object} heirs
 * @returns {boolean}
 */
export function isMushtarakah(heirs) {
  if (!heirs) return false;

  if (!exactly(heirs, "HUSBAND", 1)) return false;

  const hasMotherOrGrandmother =
    exactly(heirs, "MOTHER", 1) || totalGrandmothers(heirs) >= 1;

  if (!hasMotherOrGrandmother) return false;

  const matSiblings =
    count(heirs, "MATERNAL_BROTHER") +
    count(heirs, "MATERNAL_SISTER") +
    count(heirs, "MATERNAL_SIBLINGS");
  if (matSiblings < 2) return false;

  const fullBrothers = count(heirs, "FULL_BROTHER");
  if (fullBrothers < 1) return false;

  // Must not have father or grandfather
  if (active(heirs, "FATHER") || active(heirs, "PATERNAL_GRANDFATHER")) {
    return false;
  }

  // Must not have male/female descendants
  const descendants = [
    "SON",
    "DAUGHTER",
    "GRANDSON",
    "GRANDDAUGHTER",
    "GREAT_GRANDSON",
    "GREAT_GRANDDAUGHTER",
  ];
  if (descendants.some((d) => active(heirs, d))) {
    return false;
  }

  const allowed = [
    "HUSBAND",
    "MOTHER",
    "MATERNAL_BROTHER",
    "MATERNAL_SISTER",
    "MATERNAL_SIBLINGS",
    "FULL_BROTHER",
    "FULL_SISTER",
  ];

  return !hasOtherActiveHeirs(heirs, allowed, true);
}

/* -------------------------------------------------------------------------- */
/* 8. مسألة المباهلة — المادة 367                                              */
/* -------------------------------------------------------------------------- */

/**
 * Checks Al-Mubahala (مسألة المباهلة - أول عول في الإسلام).
 * Moroccan Family Code Article 367.
 *
 * Condition: Husband + Mother + 1 Sister (Full or Paternal).
 * Base 6 awls to 8.
 *
 * @param {Object} heirs
 * @param {number|null} [awlBase]
 * @returns {boolean}
 */
export function isMubahala(heirs, awlBase = null) {
  if (!heirs) return false;

  if (!exactly(heirs, "HUSBAND", 1)) return false;
  if (!exactly(heirs, "MOTHER", 1)) return false;

  const totalSisters =
    count(heirs, "FULL_SISTER") + count(heirs, "PATERNAL_SISTER");
  if (totalSisters !== 1) return false;

  if (
    hasOtherActiveHeirs(heirs, [
      "HUSBAND",
      "MOTHER",
      "FULL_SISTER",
      "PATERNAL_SISTER",
    ])
  ) {
    return false;
  }

  if (awlBase != null) {
    return Number(awlBase) === 8;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* 9. مسألة أم الفروخ (المسألة الشريحية)                                      */
/* -------------------------------------------------------------------------- */

/**
 * Checks Umm Al-Furukh (أم الفروخ - المسألة الشريحية).
 * Condition: Husband + Mother + 2 Full Sisters (or Paternal) + 2 Maternal Siblings.
 * Base 6 awls to 10 (the maximum awl for base 6).
 *
 * @param {Object} heirs
 * @param {number|null} [awlBase]
 * @returns {boolean}
 */
export function isUmmAlFurukh(heirs, awlBase = null) {
  if (!heirs) return false;

  if (!exactly(heirs, "HUSBAND", 1)) return false;
  if (!exactly(heirs, "MOTHER", 1)) return false;

  const sisters = count(heirs, "FULL_SISTER") + count(heirs, "PATERNAL_SISTER");
  if (sisters < 2) return false;

  const matSiblings =
    count(heirs, "MATERNAL_BROTHER") +
    count(heirs, "MATERNAL_SISTER") +
    count(heirs, "MATERNAL_SIBLINGS");
  if (matSiblings < 2) return false;

  const allowed = [
    "HUSBAND",
    "MOTHER",
    "FULL_SISTER",
    "PATERNAL_SISTER",
    "MATERNAL_BROTHER",
    "MATERNAL_SISTER",
    "MATERNAL_SIBLINGS",
  ];

  if (hasOtherActiveHeirs(heirs, allowed)) return false;

  if (awlBase != null) {
    return Number(awlBase) === 10;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* 10. مسألة القريب المبارك — المادتان 341 و 342                              */
/* -------------------------------------------------------------------------- */

/**
 * Checks Al-Qarib Al-Mubarak (القريب المبارك).
 * Moroccan Family Code Articles 341 & 342.
 *
 * Condition: >= 2 Daughters + >= 1 Granddaughter(s) + >= 1 Grandson (or lower).
 *
 * @param {Object} heirs
 * @param {Object|null} [results]
 * @returns {boolean}
 */
export function isQaribMubarak(heirs, results = null) {
  if (!heirs) return false;

  const daughters = count(heirs, "DAUGHTER");
  if (daughters < 2) return false;

  const granddaughters = count(heirs, "GRANDDAUGHTER");
  if (granddaughters < 1) return false;

  const grandsons = count(heirs, "GRANDSON") + count(heirs, "GREAT_GRANDSON");
  if (grandsons < 1) return false;

  if (results && results["GRANDDAUGHTER"]) {
    const gd = results["GRANDDAUGHTER"];
    const receives = Number(gd.shares || gd.share || 0) > 0;
    const isTasib = gd.type === "TAASIB" || gd.is_asabah || gd.asabah;
    return receives && isTasib;
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* 11. المسألة الدينارية الصغرى (أم الأرامل / السبعة عشرية)                   */
/* -------------------------------------------------------------------------- */

/**
 * Checks Al-Dinariyya Al-Sughra (أم الأرامل / السبعة عشرية).
 * Condition: 3 Wives + 2 Grandmothers + 4 Maternal Sisters + 8 Paternal Sisters.
 * Base 12 awls to 17 (17 heirs each receive exactly 1 share).
 *
 * @param {Object} heirs
 * @param {number|null} [awlBase]
 * @returns {boolean}
 */
export function isDinariyyaSughra(heirs, awlBase = null) {
  if (!heirs) return false;

  if (!exactly(heirs, "WIFE", 3)) return false;
  if (totalGrandmothers(heirs) !== 2) return false;

  const matSisters =
    count(heirs, "MATERNAL_SISTER") + count(heirs, "MATERNAL_SIBLINGS");
  if (matSisters !== 4) return false;

  if (!exactly(heirs, "PATERNAL_SISTER", 8)) return false;

  const allowed = [
    "WIFE",
    "MATERNAL_SISTER",
    "MATERNAL_SIBLINGS",
    "PATERNAL_SISTER",
  ];
  if (hasOtherActiveHeirs(heirs, allowed, true)) return false;

  if (awlBase != null) {
    return Number(awlBase) === 17;
  }
  return true;
}

/**
 * Checks Al-Dinariyya Al-Sughra variant with Full Sisters.
 * Condition: 3 Wives + 2 Grandmothers + 4 Maternal Sisters + 8 Full Sisters.
 *
 * @param {Object} heirs
 * @param {number|null} [awlBase]
 * @returns {boolean}
 */
export function isDinariyyaSughraFullSister(heirs, awlBase = null) {
  if (!heirs) return false;

  if (!exactly(heirs, "WIFE", 3)) return false;
  if (totalGrandmothers(heirs) !== 2) return false;

  const matSisters =
    count(heirs, "MATERNAL_SISTER") + count(heirs, "MATERNAL_SIBLINGS");
  if (matSisters !== 4) return false;

  if (!exactly(heirs, "FULL_SISTER", 8)) return false;

  const allowed = [
    "WIFE",
    "MATERNAL_SISTER",
    "MATERNAL_SIBLINGS",
    "FULL_SISTER",
  ];
  if (hasOtherActiveHeirs(heirs, allowed, true)) return false;

  if (awlBase != null) {
    return Number(awlBase) === 17;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* 12. المسألة الدينارية الكبرى (الداودية / الركابية)                          */
/* -------------------------------------------------------------------------- */

/**
 * Checks Al-Dinariyya Al-Kubra (المسألة الدينارية الكبرى / الداودية / الركابية).
 * Condition: Exactly 1 Wife + 1 Mother + 2 Daughters + 12 Full Brothers + 1 Full Sister.
 * Base 24 corrected to 600; Full Sister gets 1/600 (1 dinar out of 600).
 *
 * @param {Object} heirs
 * @returns {boolean}
 */
export function isDinariyyaKubra(heirs) {
  if (!heirs) return false;

  const hasWife = exactly(heirs, "WIFE", 1);
  const hasMother = exactly(heirs, "MOTHER", 1);
  const hasDaughters = exactly(heirs, "DAUGHTER", 2);
  const hasFullBrothers = exactly(heirs, "FULL_BROTHER", 12);
  const hasFullSister = exactly(heirs, "FULL_SISTER", 1);

  if (
    !hasWife ||
    !hasMother ||
    !hasDaughters ||
    !hasFullBrothers ||
    !hasFullSister
  ) {
    return false;
  }

  return !hasOtherActiveHeirs(heirs, [
    "WIFE",
    "MOTHER",
    "DAUGHTER",
    "FULL_BROTHER",
    "FULL_SISTER",
  ]);
}

/**
 * Backward-compatible alias for Al-Dinariyya Al-Kubra.
 */
export const isDinariyya = isDinariyyaKubra;

/* -------------------------------------------------------------------------- */
/* Main Detector & Formatter                                                  */
/* -------------------------------------------------------------------------- */

function formatCase(caseData) {
  return {
    ...caseData,
    arabicName: caseData.name,
    badgeName: caseData.badgeName || caseData.name,
  };
}

/**
 * Master detection function that evaluates heirs and calculation results
 * to return a comprehensive special case object or null.
 *
 * @param {Object} heirs
 * @param {Object} [calcResult]
 * @param {Object|null} [calcInstance]
 * @returns {Object|null}
 */
export function detectSpecialCase(heirs, calcResult = {}, calcInstance = null) {
  if (!heirs) return null;

  const awlBase =
    calcResult.aul_base ||
    calcResult.awl_base ||
    calcInstance?.aul_base ||
    calcInstance?.awl_base ||
    null;

  // 1. Al-Gharrawayn (مسألتا الغراوين / العمريتان — المادة 366 من مدونة الأسرة)
  const umariyyahCheck = checkUmariyyah(heirs);
  if (umariyyahCheck.isUmariyyah) {
    if (umariyyahCheck.type === "HUSBAND") {
      return formatCase({
        id: "umariyyah_husband",
        name: "مسألة الغراوين الأولى (مع الزوج)",
        badgeName: "مسألة الغراوين (مع الزوج)",
        title: "مسألة الغراوين الأولى (مع الزوج - المادة 366 من مدونة الأسرة)",
        category: "مسألة خاصة منصوص عليها في مدونة الأسرة (المادة 366)",
        summary:
          "اجتمع في هذه الفريضة: زوج وأم وأب، دون وجود فرع وارث ولا جمع من الإخوة.",
        ruling:
          "أصل المسألة 6: أخذ الزوج النصف فرضاً (3 سهام)، وأخذت الأم «ثلث الباقي» بعد نصيب الزوج (وهو سهم واحد من 6 = 1/6 جميع المال) بدلاً من ثلث جميع التركة، وأخذ الأب الباقي تعصيباً (سهمان من 6 = 1/3 جميع المال)، ليكون للأب ضعف نصيب الأم عملاً بالقاعدة الشرعية (للذكر مثل حظ الأنثيين).",
        fiqhNote:
          "تُعرف هذه المسألة بـ الغراوين، والمفرد الغرّاء، وقيل سُمّيت بذلك لوضوحها وشهرتها كالكوكب الأغر. وتُسمّى أيضاً العُمَرِيَّتين أو العُمَرِيَّتين؛ لأن أمير المؤمنين عمر بن الخطاب رضي الله عنه أول من قضى فيها بهذا القضاء، ووافقه عليه عثمان وعلي وزيد بن ثابت وعبد الله بن مسعود رضي الله عنهم وجمهور أهل العلم",
        legalReference:
          "المادة 366 من مدونة الأسرة المغربية وقضاء عمر بن الخطاب وإجماع الصحابة",
      });
    }
    if (umariyyahCheck.type === "WIFE") {
      return formatCase({
        id: "umariyyah_wife",
        name: "مسألة الغراوين الثانية (مع الزوجة)",
        badgeName: "مسألة الغراوين (مع الزوجة)",
        title:
          "مسألة الغراوين الثانية (مع الزوجة - المادة 366 من مدونة الأسرة)",
        category: "مسألة خاصة منصوص عليها في مدونة الأسرة (المادة 366)",
        summary:
          "اجتمع في هذه الفريضة: زوجة وأم وأب، دون وجود فرع وارث ولا جمع من الإخوة.",
        ruling:
          "أصل المسألة 4: أخذت الزوجة الربع فرضاً (سهم واحد)، وأخذت الأم «ثلث الباقي» بعد نصيب الزوجة (سهم واحد من 4 = 1/4 جميع المال)، وأخذ الأب الباقي تعصيباً (سهمان من 4 = 1/2 جميع المال)، ليكون للأب ضعف نصيب الأم عملاً بالقاعدة الشرعية (للذكر مثل حظ الأنثيين).",
        fiqhNote:
          "تُعرف هذه المسألة بـ الغراوين، والمفرد الغرّاء، وقيل سُمّيت بذلك لوضوحها وشهرتها كالكوكب الأغر. وتُسمّى أيضاً العُمَرِيَّتين أو العُمَرِيَّتين؛ لأن أمير المؤمنين عمر بن الخطاب رضي الله عنه أول من قضى فيها بهذا القضاء، ووافقه عليه عثمان وعلي وزيد بن ثابت وعبد الله بن مسعود رضي الله عنهم وجمهور أهل العلم",
        legalReference:
          "المادة 366 من مدونة الأسرة المغربية وقضاء عمر بن الخطاب وإجماع الصحابة",
      });
    }
  }

  // 2. Al-Akdariyya (المسألة الأكدرية — المادة 361 من مدونة الأسرة)
  if (
    calcResult.is_akdariyya ||
    (calcInstance && calcInstance.is_akdariyya) ||
    isAkdariyya(heirs) ||
    engineIsAkdariyya(heirs)
  ) {
    return formatCase({
      id: "akdariyya",
      name: "المسألة الأكدرية",
      badgeName: "المسألة الأكدرية",
      title: "المسألة الأكدرية (المادة 361 من مدونة الأسرة)",
      category: "مسألة خاصة منصوص عليها في مدونة الأسرة (المادة 361)",
      summary:
        "اجتمع في هذه الفريضة: زوج، وأم، وجد لأب، وأخت واحدة (شقيقة أو لأب).",
      ruling:
        "أصلها 6 وتعول إلى 9: للزوج النصف (3)، وللأم الثلث (2)، وللجد السدس (1)، وللأخت النصف (3). ثم يُضم نصيب الجد إلى نصيب الأخت (1 + 3 = 4 سهام) ويقتسمانه تعصيباً للذكر مثل حظ الأنثيين، وتصح الفريضة من 27: للزوج 9، وللأم 6، وللجد 8، وللأخت 4 سهام.",
      fiqhNote:
        "سُميت بالأكدرية لأنها كدّرت على زيد بن ثابت رضي الله عنه أصوله وقواعده في باب الجد؛ إذ لم يفرض لأخت مع جد إلا فيها، ولم يعل أصل مسألة فيها جد إلا إياها، ولم يجمع سهام صاحب فرض إلى سهام عاصب ليقسماها تعصيباً للذكر مثل حظ الأنثيين إلا فيها.",
      legalReference:
        "المادة 361 من مدونة الأسرة المغربية ومذهب الإمام مالك وجمهور الفقهاء",
    });
  }

  // 3. Al-Mas'ala Al-Malikiyyah (المسألة المالكية — المادة 362 من مدونة الأسرة)
  if (isMalikiyyah(heirs)) {
    return formatCase({
      id: "malikiyyah",
      name: "المسألة المالكية",
      badgeName: "المسألة المالكية",
      title: "المسألة المالكية (المادة 362 من مدونة الأسرة)",
      category: "مسألة خاصة منصوص عليها في مدونة الأسرة (المادة 362)",
      summary:
        "اجتمع في هذه الفريضة: زوج، وأم (أو جدة)، وجد لأب، وإخوة لأم متعددون، وأخ لأب فأكثر.",
      ruling:
        "أصل المسألة 6: للزوج النصف (3 سهام)، وللأم أو الجدة السدس (سهم واحد)، وأخذ الجد الباقي تعصيباً (سهمان = 1/3 التركة)، وحُجب الإخوة لأم بالجد، وسقط الأخ لأب فلم يرث شيئاً.",
      fiqhNote:
        "سُميت بالمالكية لقضاء الإمام مالك بن أنس رحمه الله فيها بإسقاط الأخ لأب ومنح جميع الباقي تعصيباً للجد؛ وذلك صيانةً لحق الجد من المقاسمة التي تنقصه عن الثلث.",
      legalReference:
        "المادة 362 من مدونة الأسرة المغربية ومذهب الإمام مالك رحمه الله",
    });
  }

  // 4. Shibh Al-Malikiyyah (شبه المالكية — المادة 363 من مدونة الأسرة)
  if (isShibhMalikiyyah(heirs)) {
    return formatCase({
      id: "shibh_malikiyyah",
      name: "مسألة شبه المالكية",
      badgeName: "شبه المالكية",
      title: "مسألة شبه المالكية (المادة 363 من مدونة الأسرة)",
      category: "مسألة خاصة منصوص عليها في مدونة الأسرة (المادة 363)",
      summary:
        "اجتمع في هذه الفريضة: زوج، وأم (أو جدة)، وجد لأب، وإخوة لأم متعددون، وأخ شقيق واحد.",
      ruling:
        "أصل المسألة 6: للزوج النصف (3 سهام)، وللأم أو الجدة السدس (سهم واحد)، ويأخذ الجد الباقي تعصيباً (سهمان = 1/3 التركة)، ويُحجب الإخوة لأم بالجد، ويسقط الأخ الشقيق دون أن يشارك الإخوة لأم؛ لكون الجد قد حجبهم فلم يعد ثَمَّ فرض ليشترك معهم فيه.",
      fiqhNote:
        "سُميت بشبه المالكية لأنها تشبه المسألة المالكية في صورتها وحكمها، والفارق بينهما أن العاصب هنا أخ شقيق بينما في المالكية هو أخ لأب.",
      legalReference:
        "المادة 363 من مدونة الأسرة المغربية ومذهب الإمام مالك رحمه الله",
    });
  }

  // 5. Al-Kharqa (مسألة الخرقاء — المادة 364 من مدونة الأسرة)
  if (calcResult.is_kharqa || calcInstance?.is_kharqa || isKharqa(heirs)) {
    return formatCase({
      id: "kharqa",
      name: "مسألة الخرقاء",
      badgeName: "مسألة الخرقاء",
      title: "مسألة الخرقاء (المادة 364 من مدونة الأسرة)",
      category: "مسألة خاصة منصوص عليها في مدونة الأسرة (المادة 364)",
      summary: "اجتمعت في هذه الفريضة: أم، وجد لأب، وأخت واحدة (شقيقة أو لأب).",
      ruling:
        "أصل المسألة من 3: للأم الثلث فرضاً (سهم واحد)، واقتسم الجد مع الأخت الباقي تعصيباً (سهمان) للذكر مثل حظ الأنثيين (على 3 رؤوس). ولانكسار السهام صُححت الفريضة من 9: للأم 3 سهام، وللجد 4 سهام، وللأخت سهمان.",
      fiqhNote:
        "سُميت بالخرقاء لتخرق أقوال الصحابة الكرام وتعددها فيها (قيل فيها تسعة أقوال مختلفة)، ومذهب المالكية ومدونة الأسرة جرى على توريث الأم الثلث واقتسام الجد والأخت للباقي تعصيباً للذكر مثل حظ الأنثيين.",
      legalReference:
        "المادة 364 من مدونة الأسرة المغربية ومذهب المالكية وجمهور العلماء",
    });
  }

  // Al-Mu'adah (مسألة المعادة — المادة 360 من مدونة الأسرة)
  if (calcResult.is_muadah || calcInstance?.is_muadah || isMuadah(heirs)) {
    return formatCase({
      id: "muadah",
      name: "مسألة المعادة",
      badgeName: "مسألة المعادة",
      title: "مسألة المعادة (المادة 360 من مدونة الأسرة)",
      category: "مسألة خاصة منصوص عليها في مدونة الأسرة (المادة 360)",
      summary:
        "اجتمع الجد مع إخوة أشقاء وإخوة لأب في فريضة واحدة.",
      ruling:
        "يَعُدّ الإخوة الأشقاء الإخوةَ لأب على الجد في المقاسمة لمنعه كثرة الميراث، ثم يأخذ الأشقاء ما حصل بعد نصيب الجد: فإن كان الشقيق ذكراً حجب الإخوة لأب جميعاً، وإن كانت شقيقة واحدة أخذت كمال نصفها وكان الباقي للإخوة لأب، وإن كنَّ شقيقات أخذن كمال الثلثين وكان الباقي للإخوة لأب ذكوراً أو إناثاً.",
      fiqhNote:
        "نصت المادة 360 من مدونة الأسرة على: «إذا كان مع الإخوة الأشقاء إخوة لأب عاد الإخوة الأشقاء الجد بالإخوة لأب فمنعوه بهم كثرة الميراث، ثم يأخذ الأشقاء ما حصل بعد نصيب الجد، فإن كانت شقيقة واحدة أخذت كمال نصفها وكان الباقي للإخوة لأب، إلا إذا كانوا أخوات فللشقيقات الثلثان والباقي للإخوة لأب ذكوراً أو إناثاً، وإن كان الشقيق ذكراً حجب الإخوة لأب جميعاً». وسُميت بالمعادة من العَدّ والمزاحمة، وهو قضاء زيد بن ثابت والصحابة الكرام ومذهب المالكية.",
      legalReference:
        "المادة 360 من مدونة الأسرة المغربية ومذهب الإمام مالك وجمهور الفقهاء",
    });
  }

  // 6. Al-Mushtarakah (المسألة المشتركة — المادة 365 من مدونة الأسرة)
  if (isMushtarakah(heirs)) {
    return formatCase({
      id: "mushtarakah",
      name: "المسألة المشتركة",
      badgeName: "المسألة المشتركة",
      title: "المسألة المشتركة (المادة 365 من مدونة الأسرة)",
      category: "مسألة خاصة منصوص عليها في مدونة الأسرة (المادة 365)",
      summary:
        "اجتمع في هذه الفريضة: زوج، وأم (أو جدة)، وإخوة لأم متعددون، وإخوة أشقاء (فيهم ذكر على الأقل).",
      ruling:
        "أصل المسألة 6: للزوج النصف (3 سهام)، وللأم أو الجدة السدس (سهم واحد)، ويشترك الإخوة الأشقاء مع الإخوة لأم في الثلث الفرضي (سهمان) ويقتسمونه بينهم بالتساوي (للذكر مثل الأنثى) لاشتراكهم جميعاً في قرابة الأم.",
      fiqhNote:
        "تسمى أيضاً بالمسألة الحمارية أو الحجرية أو اليمية؛ لأن الإخوة الأشقاء قالوا لعمر بن الخطاب رضي الله عنه: «يا أمير المؤمنين، هب أن أبانا كان حماراً أو حجراً مُلقى في اليم، ألسنا نشترك معهم في قرابة أم واحدة؟!» فاستحسن عمر مقالتهم وشرك بينهم في الثلث.",
      legalReference:
        "المادة 365 من مدونة الأسرة المغربية ومذهب الإمام مالك والإمام الشافعي",
    });
  }

  // 7. Al-Mubahala (مسألة المباهلة — المادة 367 من مدونة الأسرة)
  if (isMubahala(heirs, awlBase)) {
    return formatCase({
      id: "mubahala",
      name: "مسألة المباهلة",
      badgeName: "مسألة المباهلة",
      title: "مسألة المباهلة (أول عول في الإسلام - المادة 367 من مدونة الأسرة)",
      category: "مسألة خاصة منصوص عليها في مدونة الأسرة (المادة 367)",
      summary: "اجتمع في هذه الفريضة: زوج وأم وأخت واحدة شقيقة (أو لأب).",
      ruling:
        "أصل المسألة 6 وتعول إلى 8: للزوج النصف (3 سهام)، وللأخت النصف (3 سهام)، وللأم الثلث (سهمان). عالت المسألة من 6 إلى 8 ونقصت أنصبة جميع الورثة بمقدار العول.",
      fiqhNote:
        "سُميت بالمباهلة لأن الصحابي الجليل عبد الله بن عباس رضي الله عنهما كان ينكر العول ويقول فيها: «من شاء باهلته أن الله لم يجعل في مال واحد نصفين وثُلثاً!» ولكن استقر إجماع الصحابة وقضاء عمر على العول صيانة لحقوق جميع أصحاب الفروض.",
      legalReference:
        "المادة 367 من مدونة الأسرة المغربية وإجماع الصحابة في عهد عمر رضي الله عنه",
    });
  }

  // 8. Al-Minbariyya (المسألة المنبرية — المادة 368 من مدونة الأسرة)
  if (isMinbariyya(heirs, awlBase)) {
    return formatCase({
      id: "minbariyya",
      name: "المسألة المنبرية",
      badgeName: "المسألة المنبرية",
      title: "المسألة المنبرية (المادة 368 من مدونة الأسرة)",
      category: "مسألة خاصة منصوص عليها في مدونة الأسرة (المادة 368)",
      summary: "اجتمع في هذه الفريضة: زوجة وبنتان وأبوان (أب وأم).",
      ruling:
        "أصل المسألة 24: للزوجة الثمن (3 سهام)، وللبنات الثلثان (16 سهماً)، وللأب السدس (4 سهام)، وللأم السدس (4 سهام). مجموع السهام 27، فعالت الفريضة من 24 إلى 27، ونقص نصيب الزوجة من الثمن (3/24) إلى التسع (3/27 = 1/9).",
      fiqhNote:
        "سُميت بالمنبرية لأن أمير المؤمنين علي بن أبي طالب رضي الله عنه سُئل عنها وهو على منبر الكوفة يخطب، فقال على البديهة ودون انقطاع لخطبته: «الحمد لله الذي يحكم بالحق قطعا، ويجزي كل نفس بما تسعى... وصار ثمنها تُسعاً» ثم مضى في خطبته.",
      legalReference:
        "المادة 368 من مدونة الأسرة المغربية وقضاء الإمام علي بن أبي طالب رضي الله عنه",
    });
  }

  // 9. Umm Al-Furukh (مسألة أم الفروخ — المسألة الشريحية)
  if (isUmmAlFurukh(heirs, awlBase)) {
    return formatCase({
      id: "umm_al_furukh",
      name: "مسألة أم الفروخ (المسألة الشريحية)",
      badgeName: "مسألة أم الفروخ",
      title: "مسألة أم الفروخ",
      category: "من المسائل الملقبة المشهورة في أقصى درجات العول",
      summary:
        "اجتمع في هذه الفريضة: زوج وأم وأختان شقيقتان (أو لأب) وإخوة لأم متعددون.",
      ruling:
        "أصل المسألة 6 وتعول إلى 10 (أقصى عول للأصل 6): للزوج النصف (3)، وللأم السدس (1)، وللأختين الثلثان (4)، وللإخوة لأم الثلث (2). مجموع السهام 10، فتقسم التركة من 10 أجزاء.",
      fiqhNote:
        "سُميت بأم الفروخ لكثرة ما فرخت وزادت من السهام والعول، وتسمى أيضاً بالمسألة الشريحية لأن القاضي شريحاً قضى بها.",
      legalReference: "قضاء شريح القاضي وباب العول في الفقه الإسلامي",
    });
  }

  // 10. Al-Qarib Al-Mubarak (القريب المبارك — المادتان 341 و342 من مدونة الأسرة)
  if (isQaribMubarak(heirs, calcResult.distributions || calcResult.results)) {
    return formatCase({
      id: "qarib_mubarak",
      name: "مسألة القريب المبارك",
      badgeName: "مسألة القريب المبارك",
      title: "مسألة القريب المبارك (المادتان 341 و342 من مدونة الأسرة)",
      category: "مسألة فقهية خاصة في باب التعصيب بالغير",
      summary: "اجتمعت بنتان فأكثر مع بنت ابن وابن ابن في درجتها أو أنزل منها.",
      ruling:
        "استكملت البنات الثلثين (2/3) مما يسقط بنت الابن عادةً، ولكن وجود ابن الابن عصبها معه للذكر مثل حظ الأنثيين، فورثت نصيباً بفضله وكان مباركاً عليها فلولاه لسقطت.",
      fiqhNote:
        "يسمى 'القريب المبارك' لأنه أنقذها من الحرمان وجعلها ترث معه، ونص عليه المشرع في المادتين 341 و342 من مدونة الأسرة.",
      legalReference: "المادتان 341 و342 من مدونة الأسرة المغربية",
    });
  }

  // 11. Al-Dinariyya Al-Sughra (المسألة الدينارية الصغرى — أم الأرامل / السبعة عشرية)
  if (isDinariyyaSughra(heirs, awlBase)) {
    return formatCase({
      id: "dinariyya_sughra",
      name: "المسألة الدينارية الصغرى",
      badgeName: "المسألة الدينارية الصغرى",
      title: "المسألة الدينارية الصغرى (أم الأرامل / السبعة عشرية)",
      category: "مسألة كلاسيكية مشهورة في باب العول وتوزيع السهام",
      summary: "اجتمعت ثلاث زوجات وجدتان وأربع أخوات لأم وثماني أخوات لأب.",
      ruling:
        "أصلها من 12 وتعول إلى 17: للزوجات الربع (3 سهام)، وللجدتين السدس (سهمان)، وللأخوات لأم الثلث (4 سهام)، وللأخوات لأب الثلثان (8 سهام). تستغرق السهام 17 امرأة، فتنال كل واحدة سهماً واحداً (ديناراً واحداً من تركة 17 ديناراً).",
      fiqhNote:
        "تسمى أيضاً أم الأرامل وأم الفروج والسبعة عشرية، وهي الصيغة المالكية المعتمدة في كتب الفرائض.",
      legalReference: "الفقه المالكي الكلاسيكي وباب العول",
    });
  }

  // 12. Al-Dinariyya Al-Sughra (صيغة الأخوات الشقيقات)
  if (isDinariyyaSughraFullSister(heirs, awlBase)) {
    return formatCase({
      id: "dinariyya_sughra_full_sister_variant",
      name: "المسألة الدينارية الصغرى",
      badgeName: "المسألة الدينارية الصغرى",
      title: "الدينارية الصغرى (صيغة الأخوات الشقيقات)",
      category: "صيغة كلاسيكية بديلة في باب العول",
      summary: "اجتمعت ثلاث زوجات وجدتان وأربع أخوات لأم وثماني أخوات شقيقات.",
      ruling:
        "أصلها من 12 وتعول إلى 17، وتستوعب السهام سبع عشرة امرأة، لكل واحدة سهم واحد.",
      fiqhNote:
        "هذه الصيغة مذكورة في بعض المصادر الفرائضية القديمة بذكر الأخوات الشقيقات عوض الأخوات لأب.",
      legalReference: "كتب الفرائض الفقهية الكلاسيكية",
    });
  }

  // 13. Al-Dinariyya Al-Kubra (المسألة الدينارية الكبرى / الداودية / الركابية)
  if (isDinariyyaKubra(heirs)) {
    return formatCase({
      id: "dinariyya_kubra",
      name: "المسألة الدينارية (الركابية)",
      badgeName: "المسألة الدينارية",
      title: "المسألة الدينارية الكبرى (الداودية / الركابية)",
      category: "من نوادر المسائل الملقبة في تصحيح الفرائض",
      summary:
        "اجتمع في هذه الفريضة: زوجة وأم وبنتان و12 أخاً شقيقاً وأخت شقيقة واحدة.",
      ruling:
        "أصل المسألة 24: للزوجة الثمن (3)، وللأم السدس (4)، وللبنتين الثلثان (16). مجموع الفروض 23 سهماً، وبقي سهم واحد اقتسمه الـ 12 أخاً مع الأخت تعصيباً على 25 رأساً، فصحت الفريضة من 600 (24 × 25)، ونالت الأخت سهماً واحداً من 600 (ديناراً واحداً من تركة 600 دينار).",
      fiqhNote:
        "سُميت بالدينارية أو الركابية لأن امرأة سألت عنها أمير المؤمنين علي بن أبي طالب رضي الله عنه وهو يركب دابته قائلة: ترك أخي 600 دينار ولم أنل إلا ديناراً واحداً! فأخبرها بالورثة وقسمتها على البديهة وقال: هذا حقك.",
      legalReference:
        "قضاء الإمام علي بن أبي طالب رضي الله عنه وباب تصحيح الانكسار",
    });
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Supported Special Case IDs Registry                                        */
/* -------------------------------------------------------------------------- */

export const SPECIAL_CASE_IDS = Object.freeze([
  "umariyyah_husband",
  "umariyyah_wife",
  "akdariyya",
  "malikiyyah",
  "shibh_malikiyyah",
  "kharqa",
  "muadah",
  "mushtarakah",
  "mubahala",
  "minbariyya",
  "umm_al_furukh",
  "qarib_mubarak",
  "dinariyya_sughra",
  "dinariyya_sughra_full_sister_variant",
  "dinariyya_kubra",
]);
