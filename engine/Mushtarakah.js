import Fraction from "fraction.js";
import { hasDescendants } from "./Helpers.js";
import { calculateGrandmothersShare } from "./Grandmothers.js";

/**
 * Checks if the heirs configuration forms Al-Mas'ala Al-Mushtarakah
 * (المسألة المشتركة / الحمارية / الحجرية / اليمية - المادة 365 من مدونة الأسرة).
 *
 * Conditions (Article 365 of the Moroccan Family Code):
 * 1. Husband (الزوج) - gets 1/2
 * 2. Mother (الأم) or valid Grandmother(s) (الجدة) - gets 1/6
 * 3. Maternal siblings (الإخوة والأخوات لأم) >= 2 - collective share is 1/3
 * 4. Full brother(s) >= 1 (أخ شقيق واحد فأكثر), with or without full sisters
 * 5. No descendants (لا ولد ولا ولد ابن)
 * 6. No father, no grandfather (لا أب ولا جد لأب)
 *
 * Under Article 365:
 * The 1/3 is shared equally between maternal siblings and full siblings
 * on a strict per-head basis: للذكر مثل حظ الأنثى، ويقسم بينهم على عدد رؤوسهم.
 *
 * @param {import('./Helpers.js').HeirMap} heirs
 * @returns {boolean}
 */
export function isMushtarakah(heirs) {
  // 1. Husband
  const hasHusband =
    heirs["HUSBAND"] &&
    !heirs["HUSBAND"].is_blocked &&
    heirs["HUSBAND"].count > 0;
  if (!hasHusband) return false;

  // 2. Mother or valid Grandmother
  const hasMother =
    heirs["MOTHER"] && !heirs["MOTHER"].is_blocked && heirs["MOTHER"].count > 0;
  const grandmotherKeys = [
    "PATERNAL_GRANDMOTHER",
    "MATERNAL_GRANDMOTHER",
    "MATERNAL_GREAT_GRANDMOTHER",
    "PATERNAL_GREAT_GRANDMOTHER",
    "MATERNAL_PATERNAL_GREAT_GRANDMOTHER",
  ];
  const hasGrandmother = grandmotherKeys.some(
    (g) => heirs[g] && !heirs[g].is_blocked && heirs[g].count > 0,
  );
  if (!hasMother && !hasGrandmother) return false;

  // 3. No descendants
  if (hasDescendants(heirs)) return false;

  // 4. No male ascendant (Father or Grandfather)
  if (
    heirs["FATHER"] &&
    !heirs["FATHER"].is_blocked &&
    heirs["FATHER"].count > 0
  )
    return false;
  const hasGF = ["PATERNAL_GRANDFATHER", "PATERNAL_GREAT_GRANDFATHER"].some(
    (g) => heirs[g] && !heirs[g].is_blocked && heirs[g].count > 0,
  );
  if (hasGF) return false;

  // 5. Maternal siblings >= 2
  const mBrothers =
    heirs["MATERNAL_BROTHER"] && !heirs["MATERNAL_BROTHER"].is_blocked
      ? heirs["MATERNAL_BROTHER"].count || 0
      : 0;
  const mSisters =
    heirs["MATERNAL_SISTER"] && !heirs["MATERNAL_SISTER"].is_blocked
      ? heirs["MATERNAL_SISTER"].count || 0
      : 0;
  const totalMaternal = mBrothers + mSisters;
  if (totalMaternal < 2) return false;

  // 6. Full brother(s) >= 1
  const fbCount =
    heirs["FULL_BROTHER"] && !heirs["FULL_BROTHER"].is_blocked
      ? heirs["FULL_BROTHER"].count || 0
      : 0;
  if (fbCount < 1) return false;

  return true;
}

/**
 * Executes distribution for Al-Mas'ala Al-Mushtarakah (Article 365).
 *
 * @param {import('./Helpers.js').HeirMap} heirs
 * @param {Object.<string, {share: Fraction, count: number, asabah?: boolean, mushtarakah?: boolean}>} results
 * @param {Object.<string, string>} explanations
 * @returns {Fraction} Remaining residue (should be 0)
 */
export function calculateMushtarakah(heirs, results, explanations) {
  // 1. Husband gets 1/2
  results["HUSBAND"] = {
    share: new Fraction(1, 2),
    count: heirs["HUSBAND"].count || 1,
    asabah: false,
  };
  explanations["HUSBAND"] =
    "يرث الزوج النصف (1/2) فرضاً لعدم وجود فرع وارث للزوجة المتوفاة، لقوله تعالى: [وَلَكُمْ نِصْفُ مَا تَرَكَ أَزْوَاجُكُمْ إِنْ لَمْ يَكُنْ لَهُنَّ وَلَدٌ].";

  // 2. Mother or Grandmother gets 1/6
  if (heirs["MOTHER"] && !heirs["MOTHER"].is_blocked) {
    results["MOTHER"] = {
      share: new Fraction(1, 6),
      count: heirs["MOTHER"].count || 1,
      asabah: false,
    };
    explanations["MOTHER"] =
      "ترث الأم السدس (1/6) فرضاً لوجود جمع من الإخوة، لقوله تعالى: [فَإِنْ كَانَ لَهُ إِخْوَةٌ فَلِأُمِّهِ السُّدُسُ].";
  } else {
    calculateGrandmothersShare(
      heirs,
      results,
      explanations,
      new Fraction(1, 6),
    );
  }

  // 3. Maternal siblings and Full siblings share the 1/3 equally per head (للذكر مثل الأنثى)
  const mBrothers =
    heirs["MATERNAL_BROTHER"] && !heirs["MATERNAL_BROTHER"].is_blocked
      ? heirs["MATERNAL_BROTHER"].count || 0
      : 0;
  const mSisters =
    heirs["MATERNAL_SISTER"] && !heirs["MATERNAL_SISTER"].is_blocked
      ? heirs["MATERNAL_SISTER"].count || 0
      : 0;
  const fbCount =
    heirs["FULL_BROTHER"] && !heirs["FULL_BROTHER"].is_blocked
      ? heirs["FULL_BROTHER"].count || 0
      : 0;
  const fsCount =
    heirs["FULL_SISTER"] && !heirs["FULL_SISTER"].is_blocked
      ? heirs["FULL_SISTER"].count || 0
      : 0;

  const totalSharingHeads = mBrothers + mSisters + fbCount + fsCount;
  // Per-person share in the whole estate = (1/3) / totalSharingHeads = 1 / (3 * totalSharingHeads)
  const perPersonFraction = new Fraction(1, 3 * totalSharingHeads);

  if (mBrothers > 0) {
    results["MATERNAL_BROTHER"] = {
      share: perPersonFraction.mul(new Fraction(mBrothers)),
      count: mBrothers,
      asabah: false,
      mushtarakah: true,
    };
    explanations["MATERNAL_BROTHER"] =
      "يرث الإخوة لأم بالتشريك مع الإخوة الأشقاء في الثلث بالتساوي على عدد رؤوسهم في المسألة المشتركة (المادة 365 من مدونة الأسرة).";
  }

  if (mSisters > 0) {
    results["MATERNAL_SISTER"] = {
      share: perPersonFraction.mul(new Fraction(mSisters)),
      count: mSisters,
      asabah: false,
      mushtarakah: true,
    };
    explanations["MATERNAL_SISTER"] =
      "ترث الأخوات لأم بالتشريك مع الإخوة الأشقاء في الثلث بالتساوي على عدد رؤوسهم في المسألة المشتركة (المادة 365 من مدونة الأسرة).";
  }

  if (fbCount > 0) {
    results["FULL_BROTHER"] = {
      share: perPersonFraction.mul(new Fraction(fbCount)),
      count: fbCount,
      asabah: false,
      mushtarakah: true,
    };
    explanations["FULL_BROTHER"] =
      "يرث الأخ الشقيق (أو الأشقاء) بالتشريك مع الإخوة لأم في الثلث بالتساوي على عدد رؤوسهم (للذكر مثل الأنثى) عملاً بالمادة 365 من مدونة الأسرة ومذهب المالكية (المسألة المشتركة / الحمارية).";
  }

  if (fsCount > 0) {
    results["FULL_SISTER"] = {
      share: perPersonFraction.mul(new Fraction(fsCount)),
      count: fsCount,
      asabah: false,
      mushtarakah: true,
    };
    explanations["FULL_SISTER"] =
      "ترث الأخت الشقيقة بالتشريك مع الإخوة لأم في الثلث بالتساوي على عدد رؤوسهم مع أخيها الشقيق في المسألة المشتركة (المادة 365 من مدونة الأسرة).";
  }

  return new Fraction(0);
}
