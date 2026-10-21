/**
 * @file Grandfather.js
 * @description Implements the Maliki school rules for Grandfather inheriting alongside Siblings (باب الجد والإخوة).
 * Covers Al-Muqasamah (المقاسمة), One-Third of Estate, One-Third of Remainder, One-Sixth of Estate, and Al-Mu'adah (المعادة).
 */

import Fraction from '../fraction.js';
import { hasDescendants } from './Helpers.js';

/**
 * Checks if the current heirs configuration forms Al-Akdariyya (المسألة الأكدرية).
 * Conditions:
 * 1. Husband (الزوج)
 * 2. Mother (الأم)
 * 3. Grandfather (الجد لأب)
 * 4. Exactly one sister (أخت شقيقة أو أخت لأب منفردة)
 * 5. No descendants, no father, no brothers, no other active heirs.
 * 
 * Under Article 367 of the Moroccan Family Code and classical jurisprudence:
 * Prescribed shares: Husband 1/2, Mother 1/3, Grandfather 1/6, Sister 1/2.
 * Origin = 6, sums to 9 (Awl to 9).
 * Grandfather and Sister combine shares (1 + 3 = 4), divide 2:1 (3 heads).
 * Inkesar correction: 9 * 3 = 27.
 * Husband = 9/27, Mother = 6/27, Grandfather = 8/27, Sister = 4/27.
 * 
 * @param {import('./Helpers.js').HeirMap} heirs
 * @returns {boolean}
 */
export function isAkdariyya(heirs) {
    const hasHusband = heirs['HUSBAND'] && !heirs['HUSBAND'].is_blocked && heirs['HUSBAND'].count > 0;
    if (!hasHusband) return false;

    const hasMother = heirs['MOTHER'] && !heirs['MOTHER'].is_blocked && heirs['MOTHER'].count > 0;
    if (!hasMother) return false;

    const gfKey = ['PATERNAL_GRANDFATHER', 'PATERNAL_GREAT_GRANDFATHER'].find(
        r => heirs[r] && !heirs[r].is_blocked && heirs[r].count > 0
    );
    if (!gfKey) return false;

    if (hasDescendants(heirs)) return false;
    if (heirs['FATHER'] && !heirs['FATHER'].is_blocked && heirs['FATHER'].count > 0) return false;

    const fbCount = heirs['FULL_BROTHER'] && !heirs['FULL_BROTHER'].is_blocked ? heirs['FULL_BROTHER'].count : 0;
    const pbCount = heirs['PATERNAL_BROTHER'] && !heirs['PATERNAL_BROTHER'].is_blocked ? heirs['PATERNAL_BROTHER'].count : 0;
    if (fbCount > 0 || pbCount > 0) return false;

    const fsCount = heirs['FULL_SISTER'] && !heirs['FULL_SISTER'].is_blocked ? heirs['FULL_SISTER'].count : 0;
    const psCount = heirs['PATERNAL_SISTER'] && !heirs['PATERNAL_SISTER'].is_blocked ? heirs['PATERNAL_SISTER'].count : 0;

    const exactlyOneSister = (fsCount === 1 && psCount === 0) || (fsCount === 0 && psCount === 1);
    if (!exactlyOneSister) return false;

    const sisterKey = fsCount === 1 ? 'FULL_SISTER' : 'PATERNAL_SISTER';
    const allowedKeys = ['HUSBAND', 'MOTHER', gfKey, sisterKey];

    for (const [key, heir] of Object.entries(heirs)) {
        if (!allowedKeys.includes(key) && heir && !heir.is_blocked && heir.count > 0) {
            return false;
        }
    }

    return true;
}

/**
 * Checks if the heirs configuration forms Al-Mas'ala Al-Malikiyyah (المسألة المالكية - المادة 362 من مدونة الأسرة).
 * Conditions:
 * 1. Husband (الزوج)
 * 2. Mother (الأم) or valid Grandmother(s) (الجدة)
 * 3. Paternal Grandfather (الجد لأب)
 * 4. Multiple maternal siblings (الإخوة لأم اثنان فأكثر)
 * 5. One or more paternal brothers (أخ للأب أو أكثر) - without full brothers
 * 6. No descendants, no father.
 * 
 * Result under Article 362:
 * - Husband: 1/2 = 3/6
 * - Mother/Grandmother: 1/6 = 1/6
 * - Grandfather: Takes all remainder by Ta'seeb = 1/3 = 2/6
 * - Paternal brother(s): Drop out (سقط لاستئثار الجد بالباقي)
 * - Maternal siblings: Blocked by Grandfather (محجوبون بالجد)
 * 
 * @param {import('./Helpers.js').HeirMap} heirs
 * @returns {boolean}
 */
export function isMalikiyyah(heirs) {
    const hasHusband = heirs['HUSBAND'] && !heirs['HUSBAND'].is_blocked && heirs['HUSBAND'].count > 0;
    if (!hasHusband) return false;

    const hasMother = heirs['MOTHER'] && !heirs['MOTHER'].is_blocked && heirs['MOTHER'].count > 0;
    const grandmotherKeys = [
        'PATERNAL_GRANDMOTHER',
        'MATERNAL_GRANDMOTHER',
        'MATERNAL_GREAT_GRANDMOTHER',
        'PATERNAL_GREAT_GRANDMOTHER',
        'MATERNAL_PATERNAL_GREAT_GRANDMOTHER'
    ];
    const hasGrandmother = grandmotherKeys.some(g => heirs[g] && !heirs[g].is_blocked && heirs[g].count > 0);
    if (!hasMother && !hasGrandmother) return false;

    const gfKey = ['PATERNAL_GRANDFATHER', 'PATERNAL_GREAT_GRANDFATHER'].find(
        r => heirs[r] && !heirs[r].is_blocked && heirs[r].count > 0
    );
    if (!gfKey) return false;

    if (hasDescendants(heirs)) return false;
    if (heirs['FATHER'] && !heirs['FATHER'].is_blocked && heirs['FATHER'].count > 0) return false;

    // Maternal siblings present (brother or sister)
    const mBrothers = heirs['MATERNAL_BROTHER'] ? heirs['MATERNAL_BROTHER'].count || 0 : 0;
    const mSisters = heirs['MATERNAL_SISTER'] ? heirs['MATERNAL_SISTER'].count || 0 : 0;
    if (mBrothers + mSisters < 1) return false;

    // No full siblings
    const fbCount = heirs['FULL_BROTHER'] && !heirs['FULL_BROTHER'].is_blocked ? heirs['FULL_BROTHER'].count : 0;
    const fsCount = heirs['FULL_SISTER'] && !heirs['FULL_SISTER'].is_blocked ? heirs['FULL_SISTER'].count : 0;
    if (fbCount > 0 || fsCount > 0) return false;

    // Paternal siblings present (at least 1 brother or sister)
    const pbCount = heirs['PATERNAL_BROTHER'] && !heirs['PATERNAL_BROTHER'].is_blocked ? heirs['PATERNAL_BROTHER'].count : 0;
    const psCount = heirs['PATERNAL_SISTER'] && !heirs['PATERNAL_SISTER'].is_blocked ? heirs['PATERNAL_SISTER'].count : 0;
    if (pbCount === 0 && psCount === 0) return false;

    return true;
}

/**
 * Checks if the heirs configuration forms Shibh Al-Malikiyyah (مسألة شبه المالكية - المادة 363 من مدونة الأسرة).
 * Conditions:
 * 1. Husband (الزوج)
 * 2. Mother (الأم) or valid Grandmother(s) (الجدة)
 * 3. Paternal Grandfather (الجد لأب)
 * 4. Maternal sibling(s) (الإخوة لأم)
 * 5. Full brother(s) (أخ شقيق أو أكثر)
 * 6. No descendants, no father.
 * 
 * Result under Article 363:
 * - Husband: 1/2 = 3/6
 * - Mother/Grandmother: 1/6 = 1/6
 * - Grandfather: Takes all remainder by Ta'seeb = 1/3 = 2/6
 * - Full brother(s): Drop out (سقط لاستئثار الجد بالباقي)
 * - Maternal siblings: Blocked by Grandfather (محجوبون بالجد)
 * 
 * @param {import('./Helpers.js').HeirMap} heirs
 * @returns {boolean}
 */
export function isShibhMalikiyyah(heirs) {
    const hasHusband = heirs['HUSBAND'] && !heirs['HUSBAND'].is_blocked && heirs['HUSBAND'].count > 0;
    if (!hasHusband) return false;

    const hasMother = heirs['MOTHER'] && !heirs['MOTHER'].is_blocked && heirs['MOTHER'].count > 0;
    const grandmotherKeys = [
        'PATERNAL_GRANDMOTHER',
        'MATERNAL_GRANDMOTHER',
        'MATERNAL_GREAT_GRANDMOTHER',
        'PATERNAL_GREAT_GRANDMOTHER',
        'MATERNAL_PATERNAL_GREAT_GRANDMOTHER'
    ];
    const hasGrandmother = grandmotherKeys.some(g => heirs[g] && !heirs[g].is_blocked && heirs[g].count > 0);
    if (!hasMother && !hasGrandmother) return false;

    const gfKey = ['PATERNAL_GRANDFATHER', 'PATERNAL_GREAT_GRANDFATHER'].find(
        r => heirs[r] && !heirs[r].is_blocked && heirs[r].count > 0
    );
    if (!gfKey) return false;

    if (hasDescendants(heirs)) return false;
    if (heirs['FATHER'] && !heirs['FATHER'].is_blocked && heirs['FATHER'].count > 0) return false;

    // Maternal siblings present (brother or sister)
    const mBrothers = heirs['MATERNAL_BROTHER'] ? heirs['MATERNAL_BROTHER'].count || 0 : 0;
    const mSisters = heirs['MATERNAL_SISTER'] ? heirs['MATERNAL_SISTER'].count || 0 : 0;
    if (mBrothers + mSisters < 1) return false;

    // Full brother present (at least 1 full brother)
    const fbCount = heirs['FULL_BROTHER'] && !heirs['FULL_BROTHER'].is_blocked ? heirs['FULL_BROTHER'].count : 0;
    if (fbCount === 0) return false;

    return true;
}

/**
 * Checks if an active paternal grandfather is present alongside active full or paternal siblings.
 * 
 * @param {import('./Helpers.js').HeirMap} heirs - Active heirs map.
 * @returns {boolean} True if grandfather and siblings inherit together.
 */
export function hasGrandfatherWithSiblings(heirs) {
    const activeGF = ['PATERNAL_GRANDFATHER', 'PATERNAL_GREAT_GRANDFATHER'].find(r => heirs[r] && !heirs[r].is_blocked && heirs[r].count > 0);
    if (!activeGF) return false;

    const activeSiblings = ['FULL_BROTHER', 'FULL_SISTER', 'PATERNAL_BROTHER', 'PATERNAL_SISTER']
        .some(rel => heirs[rel] && !heirs[rel].is_blocked && heirs[rel].count > 0);

    return activeSiblings;
}

/**
 * Calculates shares when a paternal grandfather inherits with full and/or paternal siblings under the Maliki school (المذهب المالكي).
 * 
 * Legal Rules:
 * 1. Without other fixed heirs (ليس معهم صاحب فرض):
 *    - Grandfather gets the best of:
 *      a) Al-Muqasamah (المقاسمة): Grandfather counts as one brother.
 *      b) 1/3 of the total estate (ثلث جميع المال).
 * 2. With other fixed heirs (معهم صاحب فرض):
 *    - Grandfather gets the best of:
 *      a) Al-Muqasamah (المقاسمة) of the remainder.
 *      b) 1/3 of the remainder (ثلث الباقي).
 *      c) 1/6 of the total estate (سدس جميع المال).
 * 3. Al-Mu'adah (المعادة):
 *    - Full siblings count paternal siblings with them in Muqasamah against the grandfather to minimize his share,
 *      then full siblings take the remaining portion according to their Quranic max (1/2 for single, 2/3 for multiple)
 *      or as Asabah with brothers, and give paternal siblings only whatever remains.
 * 4. Al-Akdariyya (المسألة الأكدرية):
 *    - Husband + Mother + Grandfather + Single Sister. Corrected from 27.
 * 
 * @param {import('./Helpers.js').HeirMap} heirs - Active heirs map.
 * @param {Object.<string, {share: Fraction, count: number}>} results - Distribution results dictionary.
 * @param {Object.<string, string>} explanations - Legal reasons dictionary.
 * @param {Fraction} remaining - Remainder fraction after preceding fixed shares.
 * @param {boolean} otherFixedHeirsExist - True if other fixed heirs (spouses, mother, daughters, etc.) exist.
 * @returns {Fraction} Updated remaining fraction (always 0 as all remainder is distributed to GF & siblings).
 */
export function calculateGrandfatherWithSiblings(heirs, results, explanations, remaining, otherFixedHeirsExist) {
    const gfKey = ['PATERNAL_GRANDFATHER', 'PATERNAL_GREAT_GRANDFATHER'].find(r => heirs[r] && !heirs[r].is_blocked);
    if (!gfKey) return remaining;

    const gfName = heirs[gfKey].displayName;

    // Special Case: المسألة الأكدرية (Al-Akdariyya)
    if (isAkdariyya(heirs)) {
        const sisterKey = heirs['FULL_SISTER'] && !heirs['FULL_SISTER'].is_blocked && heirs['FULL_SISTER'].count > 0
            ? 'FULL_SISTER'
            : 'PATERNAL_SISTER';
        const sisterName = heirs[sisterKey].displayName;

        // Akdariyya final shares:
        // Husband: 9/27 (33.33%)
        // Mother: 6/27 (22.22%)
        // Grandfather: 8/27 (29.63%)
        // Sister: 4/27 (14.81%)
        results['HUSBAND'] = { share: new Fraction(9, 27), count: 1 };
        results['MOTHER'] = { share: new Fraction(6, 27), count: 1 };
        results[gfKey] = { share: new Fraction(8, 27), count: 1 };
        results[sisterKey] = { share: new Fraction(4, 27), count: 1 };

        explanations['HUSBAND'] = `يرث الزوج 9 أسهم من 27 (المسألة الأكدرية)؛ فرضه الأصلي النصف (1/2 = 3/6)، وعالت المسألة إلى 9، ثم بعد تصحيح انكسار الجد والأخت بالضرب في 3 صار له 9 أسهم من 27.`;
        explanations['MOTHER'] = `ترث الأم 6 أسهم من 27 (المسألة الأكدرية)؛ فرضها الأصلي الثلث (1/3 = 2/6) لعدم وجود فرع وارث ولا جمع من الإخوة، وعالت المسألة إلى 9، ثم بعد تصحيح الانكسار بالضرب في 3 صار لها 6 أسهم من 27.`;
        explanations[gfKey] = `يرث ${gfName} 8 أسهم من 27 (المسألة الأكدرية)؛ فُرض له السدس (1/6 = سهم واحد) أولاً، ثم ضُمّ فرضه إلى فرض ${sisterName} (3 سهام) فصارا 4 سهام، وقاسَمها إياها للذكر مثل حظ الأنثيين (على 3 رؤوس)، وصُححت المسألة من 27 فصار له ثلثا الـ 12 سهماً (8 أسهم من 27) عملاً بالمادة 367 من مدونة الأسرة.`;
        explanations[sisterKey] = `ترث ${sisterName} 4 أسهم من 27 (المسألة الأكدرية)؛ فُرض لها النصف (1/2 = 3 سهام) أولاً لانفرادها، فعالت المسألة إلى 9، ثم ضُمّ فرضها إلى فرض الجد (4 سهام) واقتسماه للذكر مثل حظ الأنثيين (على 3 رؤوس)، وصُححت المسألة من 27 فصار لها ثلث الـ 12 سهماً (4 أسهم من 27) عملاً بالمادة 367 من مدونة الأسرة.`;

        return new Fraction(0);
    }

    // Special Case: المسألة المالكية (Al-Mas'ala Al-Malikiyyah - Art. 362)
    if (isMalikiyyah(heirs)) {
        results[gfKey] = { share: remaining, count: 1, asabah: true };
        explanations[gfKey] = `يرث ${gfName} جميع الباقي تعصيباً (${remaining.toString()} = 2/6) في المسألة المالكية (المادة 362 من مدونة الأسرة) ولا يقاسمه الأخ للأب.`;

        ['PATERNAL_BROTHER', 'PATERNAL_SISTER'].forEach(p => {
            if (heirs[p]) {
                heirs[p].is_blocked = true;
                heirs[p].blocked_by = gfKey;
                explanations[p] = `سقط في المسألة المالكية (المادة 362 من مدونة الأسرة) لاستئثار الجد بجميع الباقي تعصيباً وعدم مقاسمته معه.`;
            }
        });

        return new Fraction(0);
    }

    // Special Case: شبه المالكية (Shibh Al-Malikiyyah - Art. 363)
    if (isShibhMalikiyyah(heirs)) {
        results[gfKey] = { share: remaining, count: 1, asabah: true };
        explanations[gfKey] = `يرث ${gfName} جميع الباقي تعصيباً (${remaining.toString()} = 2/6) في مسألة شبه المالكية (المادة 363 من مدونة الأسرة) ولا يقاسمه الأخ الشقيق.`;

        ['FULL_BROTHER', 'FULL_SISTER', 'PATERNAL_BROTHER', 'PATERNAL_SISTER'].forEach(p => {
            if (heirs[p]) {
                heirs[p].is_blocked = true;
                heirs[p].blocked_by = gfKey;
                explanations[p] = `سقط في مسألة شبه المالكية (المادة 363 من مدونة الأسرة) لاستئثار الجد بجميع الباقي تعصيباً وعدم مقاسمته معه.`;
            }
        });

        return new Fraction(0);
    }

    const FB = heirs['FULL_BROTHER'] && !heirs['FULL_BROTHER'].is_blocked ? heirs['FULL_BROTHER'].count : 0;
    const FS = heirs['FULL_SISTER'] && !heirs['FULL_SISTER'].is_blocked ? heirs['FULL_SISTER'].count : 0;
    const PB = heirs['PATERNAL_BROTHER'] && !heirs['PATERNAL_BROTHER'].is_blocked ? heirs['PATERNAL_BROTHER'].count : 0;
    const PS = heirs['PATERNAL_SISTER'] && !heirs['PATERNAL_SISTER'].is_blocked ? heirs['PATERNAL_SISTER'].count : 0;

    // --- Option 1: المقاسمة (Sharing) ---
    // Grandfather counts as a brother (2 shares). Brothers count as 2 shares, sisters as 1 share.
    const totalParts = 2 + 2 * (FB + PB) + (FS + PS);
    const shareSharing = remaining.mul(new Fraction(2, totalParts));

    let grandfatherShare;
    let explanationOption = '';
    let isFardThird = false;
    let isFardSixth = false;
    let isThirdRemainder = false;

    if (!otherFixedHeirsExist) {
        // Case A: No other fixed-share heirs (بغير صاحب فرض)
        // Grandfather gets the best of: 1) المقاسمة, 2) ثلث التركة (1/3 of total estate)
        const shareOneThird = new Fraction(1, 3);
        if (shareOneThird.greaterThan(shareSharing)) {
            grandfatherShare = shareOneThird;
            isFardThird = true;
            explanationOption = `بفرض ثلث التركة (1/3) كونه الأحظ له مع الإخوة لعدم وجود أصحاب فروض آخرين.`;
        } else if (shareSharing.equals(shareOneThird)) {
            grandfatherShare = shareSharing;
            isFardThird = true;
            explanationOption = `بالمقاسمة مع الإخوة (لاستواء المقاسمة وثلث جميع المال) كونه الأحظ له لعدم وجود أصحاب فروض آخرين.`;
        } else {
            grandfatherShare = shareSharing;
            explanationOption = `بالمقاسمة مع الإخوة (كأخ) كونه الأحظ له لعدم وجود أصحاب فروض آخرين.`;
        }
    } else {
        // Case B: With other fixed-share heirs (مع صاحب فرض)
        // Under Article 361 of the Moroccan Family Code and classical Maliki/Zaydi jurisprudence,
        // Grandfather receives the best (الأحظ) of three options:
        // 1. Al-Muqasamah of the remainder (المقاسمة كأخ من الباقي)
        // 2. 1/3 of the remainder (ثلث الباقي)
        // 3. 1/6 of the total estate (سدس جميع المال)
        // And the grandfather can NEVER receive less than 1/6 of the total estate.
        const shareOneSixthOfTotal = new Fraction(1, 6);
        const shareOneThirdOfRemainder = remaining.mul(new Fraction(1, 3));

        let bestOption = 'sharing';
        let bestShare = shareSharing;

        if (shareOneThirdOfRemainder.greaterThan(bestShare)) {
            bestShare = shareOneThirdOfRemainder;
            bestOption = 'third_remainder';
        }

        if (shareOneSixthOfTotal.greaterThan(bestShare)) {
            bestShare = shareOneSixthOfTotal;
            bestOption = 'fard_sixth';
        } else if (shareOneSixthOfTotal.equals(bestShare)) {
            if (bestOption === 'third_remainder') {
                bestOption = 'fard_sixth';
            }
        }

        grandfatherShare = bestShare;

        if (bestOption === 'fard_sixth') {
            isFardSixth = true;
            if (shareOneSixthOfTotal.equals(shareSharing) && shareOneSixthOfTotal.equals(shareOneThirdOfRemainder)) {
                explanationOption = `بفرض السدس (1/6) فرضاً لاستواء الأحوال الثلاثة (المقاسمة وثلث الباقي وسدس جميع المال).`;
            } else if (shareOneSixthOfTotal.equals(shareOneThirdOfRemainder)) {
                explanationOption = `بفرض السدس (1/6) فرضاً لاستواء ثلث الباقي وسدس جميع المال وهما أحظ له من المقاسمة.`;
            } else if (shareOneSixthOfTotal.equals(shareSharing)) {
                explanationOption = `بفرض السدس (1/6) فرضاً لاستواء المقاسمة وسدس جميع المال وهما أحظ له من ثلث الباقي.`;
            } else {
                explanationOption = `بفرض السدس (1/6) فرضاً كونه الأحظ له لأن المقاسمة وثلث الباقي ينقصانه عن السدس.`;
            }
        } else if (bestOption === 'third_remainder') {
            isThirdRemainder = true;
            explanationOption = `بفرض ثلث الباقي بعد ذوي الفروض كونه الأحظ له من المقاسمة وسدس جميع المال.`;
        } else {
            if (shareSharing.equals(shareOneThirdOfRemainder)) {
                explanationOption = `بالمقاسمة مع الإخوة كأحدهم لاستواء المقاسمة وثلث الباقي وهما أحظ له من سدس جميع المال.`;
            } else {
                explanationOption = `بالمقاسمة مع الإخوة كأحدهم كونه الأحظ له من ثلث الباقي وسدس جميع المال.`;
            }
        }
    }

    results[gfKey] = {
        share: grandfatherShare,
        count: 1,
        asabah: !isFardThird && !isFardSixth && !isThirdRemainder,
        is_third_of_remainder: isThirdRemainder,
        is_fard_third: isFardThird,
        is_fard_sixth: isFardSixth
    };
    explanations[gfKey] = `يرث ${gfName} ${explanationOption}`;

    // Sibling share of remainder
    let siblingShare = remaining.sub(grandfatherShare);
    if (siblingShare.lessThan(0)) {
        siblingShare = new Fraction(0);
    }

    // Distribute to siblings using Maliki rule (المعادة)
    if (siblingShare.greaterThan(0)) {
        if (FB > 0 || FS > 0) {
            // Full siblings present (they count paternal siblings in Muqasamah but take priority over them)
            if (FB > 0) {
                // Full brother is present: takes all remaining sibling shares with full sisters (2:1)
                // and completely blocks paternal siblings.
                const totalFullParts = 2 * FB + FS;
                const fbShare = siblingShare.mul(new Fraction(2 * FB, totalFullParts));
                results['FULL_BROTHER'] = { share: fbShare, count: FB, asabah: true };
                explanations['FULL_BROTHER'] = `يرث الأخ الشقيق (أو الأشقاء بالتساوي) بالتعصيب مع الجد والأخوات الشقيقات للذكر مثل حظ الأنثيين بعد أن حجبوا الإخوة لأب.`;

                if (FS > 0) {
                    const fsShare = siblingShare.mul(new Fraction(FS, totalFullParts));
                    results['FULL_SISTER'] = { share: fsShare, count: FS, asabah: true };
                    explanations['FULL_SISTER'] = `ترث الأخت الشقيقة (أو الأخوات بالتساوي) بالتعصيب مع الإخوة الأشقاء.`;
                }

                // Paternal siblings are blocked
                ['PATERNAL_BROTHER', 'PATERNAL_SISTER'].forEach(p => {
                    if (heirs[p]) {
                        heirs[p].is_blocked = true;
                        heirs[p].blocked_by = 'FULL_BROTHER';
                        explanations[p] = `محجوب(ة) لاستغراق الإخوة الأشقاء للتركة المتبقية بعد نصيب الجد.`;
                    }
                });
            } else {
                // Only full sisters present (no full brothers).
                // Full sister(s) take their fixed share (1/2 if single, 2/3 if multiple) as maximum from the TOTAL estate.
                const sisterMaxFraction = new Fraction(FS === 1 ? 1 : 2, FS === 1 ? 2 : 3);
                const actualSisterShare = siblingShare.greaterThan(sisterMaxFraction) ? sisterMaxFraction : siblingShare;

                const hasPaternal = (PB > 0 || PS > 0);
                results['FULL_SISTER'] = {
                    share: actualSisterShare,
                    count: FS,
                    asabah: !hasPaternal,
                    is_fard: hasPaternal
                };
                explanations['FULL_SISTER'] = `ترث الأخت الشقيقة (أو الأخوات بالتساوي) فرضاً ${FS === 1 ? 'النصف (1/2)' : 'الثلثين (2/3)'} كحد أقصى بعد نصيب الجد.`;

                const paternalRemainder = siblingShare.sub(actualSisterShare);
                if (paternalRemainder.greaterThan(0) && hasPaternal) {
                    const totalPaternalParts = 2 * PB + PS;
                    if (PB > 0) {
                        const pbShare = paternalRemainder.mul(new Fraction(2 * PB, totalPaternalParts));
                        results['PATERNAL_BROTHER'] = { share: pbShare, count: PB, asabah: true };
                        explanations['PATERNAL_BROTHER'] = `يرث الأخ لأب الباقي بعد أن أخذت الأخت الشقيقة فرضها الأقصى.`;
                    }
                    if (PS > 0) {
                        const psShare = paternalRemainder.mul(new Fraction(PS, totalPaternalParts));
                        results['PATERNAL_SISTER'] = { share: psShare, count: PS, asabah: true };
                        explanations['PATERNAL_SISTER'] = `ترث الأخت لأب الباقي بالتعصيب مع الأخ لأب بعد فرض الأخت الشقيقة.`;
                    }
                } else {
                    ['PATERNAL_BROTHER', 'PATERNAL_SISTER'].forEach(p => {
                        if (heirs[p]) {
                            heirs[p].is_blocked = true;
                            heirs[p].blocked_by = 'FULL_SISTER';
                            explanations[p] = `محجوب(ة) لاستغراق الأخت الشقيقة للسهام المتبقية.`;
                        }
                    });
                }
            }
        } else {
            // No full siblings, only paternal siblings
            const totalPaternalParts = 2 * PB + PS;
            if (PB > 0) {
                const pbShare = siblingShare.mul(new Fraction(2 * PB, totalPaternalParts));
                results['PATERNAL_BROTHER'] = { share: pbShare, count: PB, asabah: true };
                explanations['PATERNAL_BROTHER'] = `يرث الأخ لأب الباقي تعصيباً للذكر مثل حظ الأنثيين بالاشتراك مع الأخوات لأب.`;
            }
            if (PS > 0) {
                const psShare = siblingShare.mul(new Fraction(PS, totalPaternalParts));
                results['PATERNAL_SISTER'] = { share: psShare, count: PS, asabah: true };
                explanations['PATERNAL_SISTER'] = `ترث الأخت لأب بالتعصيب مع الأخ لأب.`;
            }
        }
    }

    return new Fraction(0);
}
