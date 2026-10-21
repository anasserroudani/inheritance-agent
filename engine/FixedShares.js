/**
 * @file FixedShares.js
 * @description Calculates Quranic prescribed fixed shares (أصحاب الفروض).
 * Implements the 6 primary fractions (1/2, 1/4, 1/8, 2/3, 1/3, 1/6) and the special Umariyyatayn cases.
 */

import Fraction from '../fraction.js';
import { hasDescendants, hasMaleDescendants, hasFemaleDescendants } from './Helpers.js';

/**
 * Calculates and assigns Quranic fixed shares (الفروض المقدرة) to eligible heirs.
 * Deducts each assigned share from the total remaining estate fraction.
 * 
 * Rules Implemented:
 * 1. Husband (الزوج): 1/2 without children, 1/4 with children (Surah An-Nisa: 12).
 * 2. Wife (الزوجة): 1/4 without children, 1/8 with children (Surah An-Nisa: 12).
 * 3. Mother (الأم): 1/3 without children & <2 siblings; 1/6 with children or >=2 siblings; 1/3 of remainder in Umariyyatayn (Surah An-Nisa: 11).
 * 4. Father (الأب): 1/6 fixed share when male/female descendants exist (Surah An-Nisa: 11).
 * 5. Grandfather (الجد لأب): 1/6 fixed share when descendants exist and not sharing with siblings.
 * 6. Daughters (البنات): 1/2 for single, 2/3 for multiple (without son).
 * 7. Granddaughters (بنات الابن): 1/2 for single, 2/3 for multiple (without higher females); 1/6 with single daughter (تكملة للثلثين).
 * 8. Great-Granddaughters (بنات ابن الابن): 1/2, 2/3, or 1/6 completion.
 * 9. Full Sisters (الأخوات الشقيقات): 1/2 for single, 2/3 for multiple (kalala, no full brother).
 * 10. Paternal Sisters (الأخوات لأب): 1/2, 2/3, or 1/6 completion with single full sister.
 * 11. Maternal Siblings (الإخوة لأم): 1/6 for single, 1/3 shared equally between males & females (Surah An-Nisa: 12).
 * 
 * @param {import('./Helpers.js').HeirMap} heirs - Active heirs map.
 * @param {Object.<string, {share: Fraction, count: number, asabah?: boolean}>} results - Distribution results dictionary.
 * @param {Object.<string, string>} explanations - Legal reasons dictionary.
 * @param {Fraction} remaining - Remaining fraction of the estate (starts at 1).
 * @returns {Fraction} Updated remaining fraction after deducting all assigned fixed shares.
 */
export function calculateFixedShares(heirs, results, explanations, remaining) {
    const hasChildren = hasDescendants(heirs);

    // =========================================================================
    // 1. Husband (الزوج)
    // =========================================================================
    if (heirs['HUSBAND']) {
        const share = hasChildren ? new Fraction(1, 4) : new Fraction(1, 2);
        results['HUSBAND'] = { share, count: 1 };
        explanations['HUSBAND'] = hasChildren
            ? `يرث الزوج الربع (1/4) فرضاً لوجود فرع وارث للمتوفاة، لقوله تعالى: [فَإِنْ كَانَ لَهُنَّ وَلَدٌ فَلَكُمُ الرُّبُعُ مِمَّا تَرَكْنَ].`
            : `يرث الزوج النصف (1/2) فرضاً لعدم وجود فرع وارث للمتوفاة، لقوله تعالى: [وَلَكُمْ نِصْفُ مَا تَرَكَ أَزْوَاجُكُمْ إِنْ لَمْ يَكُنْ لَهُنَّ وَلَدٌ].`;
        remaining = remaining.sub(share);
    }

    // =========================================================================
    // 2. Wife (الزوجة)
    // =========================================================================
    if (heirs['WIFE']) {
        const count = heirs['WIFE'].count || 1;
        const share = hasChildren ? new Fraction(1, 8) : new Fraction(1, 4);
        results['WIFE'] = { share, count };
        explanations['WIFE'] = hasChildren
            ? `ترث الزوجة (أو تشترك الزوجات بالتساوي في) الثمن (1/8) فرضاً لوجود فرع وارث للمتوفى، لقوله تعالى: [فَإِنْ كَانَ لَكُمْ وَلَدٌ فَلَهُنَّ الثُّمُنُ مِمَّا تَرَكْتُمْ].`
            : `ترث الزوجة من زوجها الربع (1/4) فرضاً (أو تشترك فيه الزوجات بالتساوي) لعدم وجود فرع وارث للمتوفى، لقوله تعالى: [وَلَهُنَّ الرُّبُعُ مِمَّا تَرَكْتُمْ إِنْ لَمْ يَكُنْ لَكُمْ وَلَدٌ].`;
        remaining = remaining.sub(share);
    }

    // Count all siblings (active and blocked) to evaluate mother's reduction
    let siblingCount = 0;
    const siblingKeys = ['FULL_BROTHER', 'FULL_SISTER', 'PATERNAL_BROTHER', 'PATERNAL_SISTER', 'MATERNAL_BROTHER', 'MATERNAL_SISTER'];
    for (const key of siblingKeys) {
        if (heirs[key]) {
            siblingCount += heirs[key].count || 0;
        }
    }
    const has2OrMoreSiblings = siblingCount >= 2;

    // =========================================================================
    // 3. Mother (الأم)
    // =========================================================================
    if (heirs['MOTHER'] && !heirs['MOTHER'].is_blocked) {
        // Al-Umariyyatayn (المسألتان العمريتان / الغراوان): Spouse + Mother + Father, no children, <2 siblings
        const isUmariyyah = !hasChildren && siblingCount < 2 && heirs['FATHER'] && !heirs['FATHER'].is_blocked && (heirs['HUSBAND'] || heirs['WIFE']);

        if (isUmariyyah) {
            const spouseKey = heirs['HUSBAND'] ? 'HUSBAND' : 'WIFE';
            const spouseName = heirs[spouseKey].displayName;
            const share = remaining.mul(new Fraction(1, 3));
            results['MOTHER'] = { share, count: 1 };
            explanations['MOTHER'] = `ترث الأم ثلث الباقي بعد نصيب ${spouseName} (المسألة العمرية / الغراوية) لعدم وجود فرع وارث ولانفراد الأب معها ومع أحد الزوجين، تطبيقاً لقضاء عمر بن الخطاب والصحابة رضي الله عنهم.`;
            remaining = remaining.sub(share);
        } else {
            const useOneSixth = hasChildren || has2OrMoreSiblings;
            const share = useOneSixth ? new Fraction(1, 6) : new Fraction(1, 3);
            results['MOTHER'] = { share, count: 1 };
            explanations['MOTHER'] = useOneSixth
                ? `ترث الأم السدس (1/6) فرضاً ${hasChildren ? 'لوجود فرع وارث للمتوفى (لقوله تعالى: [وَلِأَبَوَيْهِ لِكُلِّ وَاحِدٍ مِنْهُمَا السُّدُسُ مِمَّا تَرَكَ إِنْ كَانَ لَهُ وَلَدٌ])' : 'لوجود جمع من الإخوة للمتوفى (اثنان فأكثر، لقوله تعالى: [فَإِنْ كَانَ لَهُ إِخْوَةٌ فَلِأُمِّهِ السُّدُسُ])'}.`
                : `ترث الأم الثلث (1/3) فرضاً لعدم وجود فرع وارث للمتوفى وعدم وجود جمع من الإخوة، لقوله تعالى: [فَإِنْ لَمْ يَكُنْ لَهُ وَلَدٌ وَوَرِثَهُ أَبَوَاهُ فَلِأُمِّهِ الثُّلُثُ].`;
            remaining = remaining.sub(share);
        }
    }

    // =========================================================================
    // 4. Father (الأب) - Fixed Share Portion
    // =========================================================================
    if (heirs['FATHER'] && !heirs['FATHER'].is_blocked) {
        if (hasChildren) {
            const share = new Fraction(1, 6);
            results['FATHER'] = { share, count: 1, asabah: hasFemaleDescendants(heirs) && !hasMaleDescendants(heirs) };
            explanations['FATHER'] = hasMaleDescendants(heirs)
                ? `يرث الأب السدس (1/6) فرضاً لوجود فرع وارث ذكر للمتوفى، لقوله تعالى: [وَلِأَبَوَيْهِ لِكُلِّ وَاحِدٍ مِنْهُمَا السُّدُسُ مِمَّا تَرَكَ إِنْ كَانَ لَهُ وَلَدٌ].`
                : `يرث الأب سُدس التركة إضافة إلى الباقي من التركة (إن تبقى شىء) فى حالة وجود الفرع الوارث المؤنث (مثل البنت و بنت الابن و بنت ابن الإبن) لقوله تعالى (وَلأَبَوَيْهِ لِكُلِّ وَاحِدٍ مِنْهُمَا السُّدُسُ مِمَّا تَرَكَ إِنْ كَانَ لَهُ وَلَدٌ). ويرث الباقي تعصيباً لأنه أولى رجل ذكر لقولة ﷺ (ألحقوا الفرائض بأهلها فما بقى فهو لأولى رجل ذكر)`;
            remaining = remaining.sub(share);
        }
    }

    // =========================================================================
    // 5. Grandfather (الجد لأب) - Fixed Share Portion
    // =========================================================================
    const activeGFKey = ['PATERNAL_GRANDFATHER', 'PATERNAL_GREAT_GRANDFATHER'].find(r => heirs[r] && !heirs[r].is_blocked);
    const activeSiblingsExist = ['FULL_BROTHER', 'FULL_SISTER', 'PATERNAL_BROTHER', 'PATERNAL_SISTER']
        .some(rel => heirs[rel] && !heirs[rel].is_blocked);

    if (activeGFKey && !activeSiblingsExist) {
        if (hasChildren) {
            const share = new Fraction(1, 6);
            results[activeGFKey] = { share, count: 1, asabah: hasFemaleDescendants(heirs) && !hasMaleDescendants(heirs) };
            explanations[activeGFKey] = hasMaleDescendants(heirs)
                ? `يرث الجد لأب السدس (1/6) فرضاً لوجود فرع وارث ذكر للمتوفى وعدم وجود الأب.`
                : `يرث الجد لأب السدس (1/6) فرضاً لوجود فرع وارث أنثى للمتوفى وعدم وجود الأب، مع حقه في أخذ الباقي تعصيباً.`;
            remaining = remaining.sub(share);
        }
    }

    // =========================================================================
    // 6. Daughters (البنات الصلبيات)
    // =========================================================================
    if (heirs['DAUGHTER'] && !heirs['DAUGHTER'].is_blocked && !(heirs['SON'] && !heirs['SON'].is_blocked)) {
        const count = heirs['DAUGHTER'].count;
        const share = count === 1 ? new Fraction(1, 2) : new Fraction(2, 3);
        results['DAUGHTER'] = { share, count };
        explanations['DAUGHTER'] = count === 1
            ? `ترث البنت الصلبية النصف (1/2) فرضاً لانفرادها ولعدم وجود ابن صلب يعصبها، لقوله تعالى: [وَإِنْ كَانَتْ وَاحِدَةً فَلَهَا النِّصْفُ].`
            : `يرث البنات الصلبيات الثلثين (2/3) فرضاً لتعددهن (اثنتين فأكثر) ولعدم وجود ابن صلب يعصبهن (توزع بالتساوي)، لقوله تعالى: [فَإِنْ كُنَّ نِسَاءً فَوْقَ اثْنَتَيْنِ فَلَهُنَّ ثُلُثَا مَا تَرَكَ].`;
        remaining = remaining.sub(share);
    }

    // =========================================================================
    // 7. Granddaughters (بنات الابن)
    // =========================================================================
    if (heirs['GRANDDAUGHTER'] && !heirs['GRANDDAUGHTER'].is_blocked && !(heirs['GRANDSON'] && !heirs['GRANDSON'].is_blocked)) {
        const count = heirs['GRANDDAUGHTER'].count;
        const daughterCount = heirs['DAUGHTER'] && !heirs['DAUGHTER'].is_blocked ? heirs['DAUGHTER'].count : 0;

        if (daughterCount === 0) {
            const share = count === 1 ? new Fraction(1, 2) : new Fraction(2, 3);
            results['GRANDDAUGHTER'] = { share, count };
            explanations['GRANDDAUGHTER'] = count === 1
                ? `ترث بنت الابن النصف (1/2) فرضاً عند عدم وجود فرع وارث أعلى منها وعدم وجود ابن ابن يعصبها.`
                : `يرث بنات الابن الثلثين (2/3) فرضاً لتعددهن ولعدم وجود فرع وارث أعلى منهن ولا عاصب يعصبهن.`;
            remaining = remaining.sub(share);
        } else if (daughterCount === 1) {
            const share = new Fraction(1, 6);
            results['GRANDDAUGHTER'] = { share, count };
            explanations['GRANDDAUGHTER'] = `ترث بنت الابن السدس (1/6) فرضاً تكملة للثلثين لوجود بنت صلبية واحدة مستحقة للنصف.`;
            remaining = remaining.sub(share);
        }
    }

    // =========================================================================
    // 8. Great-Granddaughters (بنات ابن الابن)
    // =========================================================================
    if (heirs['GREAT_GRANDDAUGHTER'] && !heirs['GREAT_GRANDDAUGHTER'].is_blocked && !(heirs['GREAT_GRANDSON'] && !heirs['GREAT_GRANDSON'].is_blocked)) {
        const count = heirs['GREAT_GRANDDAUGHTER'].count;
        const daughterCount = heirs['DAUGHTER'] && !heirs['DAUGHTER'].is_blocked ? heirs['DAUGHTER'].count : 0;
        const granddaughterCount = heirs['GRANDDAUGHTER'] && !heirs['GRANDDAUGHTER'].is_blocked ? heirs['GRANDDAUGHTER'].count : 0;

        if (daughterCount === 0 && granddaughterCount === 0) {
            const share = count === 1 ? new Fraction(1, 2) : new Fraction(2, 3);
            results['GREAT_GRANDDAUGHTER'] = { share, count };
            explanations['GREAT_GRANDDAUGHTER'] = count === 1
                ? `ترث بنت ابن الابن النصف (1/2) فرضاً لانفرادها وعدم وجود فرع وارث أعلى منها ولا عاصب يعصبها.`
                : `يرث بنات ابن الابن الثلثين (2/3) فرضاً لتعددهن ولعدم وجود فرع وارث أعلى منهن ولا عاصب.`;
            remaining = remaining.sub(share);
        } else if (daughterCount + granddaughterCount === 1) {
            const share = new Fraction(1, 6);
            results['GREAT_GRANDDAUGHTER'] = { share, count };
            explanations['GREAT_GRANDDAUGHTER'] = `ترث بنت ابن الابن السدس (1/6) فرضاً تكملة للثلثين لوجود فرع وارث أنثى أعلى منها مستحق للنصف.`;
            remaining = remaining.sub(share);
        }
    }

    // =========================================================================
    // 9. Full Sister (الأخت الشقيقة)
    // =========================================================================
    const gfSiblings = activeGFKey && activeSiblingsExist;
    if (heirs['FULL_SISTER'] && !heirs['FULL_SISTER'].is_blocked && !hasChildren && !heirs['FATHER'] && !gfSiblings && !(heirs['FULL_BROTHER'] && !heirs['FULL_BROTHER'].is_blocked)) {
        const count = heirs['FULL_SISTER'].count;
        const share = count === 1 ? new Fraction(1, 2) : new Fraction(2, 3);
        results['FULL_SISTER'] = { share, count };
        explanations['FULL_SISTER'] = count === 1
            ? `ترث الأخت الشقيقة النصف (1/2) فرضاً لانفرادها وعدم وجود فرع وارث أو أصل ذكر أو أخ شقيق يعصبها، لقوله تعالى: [إِنِ امْرُؤٌ هَلَكَ لَيْسَ لَهُ وَلَدٌ وَلَهُ أُخْتٌ فَلَهَا نِصْفُ مَا تَرَكَ].`
            : `يرث الأخوات الشقيقات الثلثين (2/3) فرضاً لتعددهن وعدم وجود فرع وارث أو أصل ذكر أو عاصب يعصبهن، لقوله تعالى: [فَإِنْ كَانَتَا اثْنَتَيْنِ فَلَهُمَا الثُّلُثَانِ مِمَّا تَرَكَ].`;
        remaining = remaining.sub(share);
    }

    // =========================================================================
    // 10. Paternal Sister (الأخت لأب)
    // =========================================================================
    const hasFullBrother = heirs['FULL_BROTHER'] && !heirs['FULL_BROTHER'].is_blocked;
    const hasPaternalBrother = heirs['PATERNAL_BROTHER'] && !heirs['PATERNAL_BROTHER'].is_blocked;
    const fullSisterCount = heirs['FULL_SISTER'] && !heirs['FULL_SISTER'].is_blocked ? heirs['FULL_SISTER'].count : 0;

    if (heirs['PATERNAL_SISTER'] && !heirs['PATERNAL_SISTER'].is_blocked && !hasChildren && !heirs['FATHER'] && !gfSiblings && !hasFullBrother && !hasPaternalBrother) {
        const count = heirs['PATERNAL_SISTER'].count;
        if (fullSisterCount === 0) {
            const share = count === 1 ? new Fraction(1, 2) : new Fraction(2, 3);
            results['PATERNAL_SISTER'] = { share, count };
            explanations['PATERNAL_SISTER'] = count === 1
                ? `ترث الأخت لأب النصف (1/2) فرضاً لانفرادها وعدم وجود فرع وارث أو أصل ذكر أو أخ لأب أو أخت شقيقة.`
                : `يرث الأخوات لأب الثلثين (2/3) فرضاً لتعددهن وعدم وجود فرع وارث أو أصل ذكر أو عاصب.`
            remaining = remaining.sub(share);
        } else if (fullSisterCount === 1) {
            const share = new Fraction(1, 6);
            results['PATERNAL_SISTER'] = { share, count };
            explanations['PATERNAL_SISTER'] = `ترث الأخت لأب السدس (1/6) فرضاً تكملة للثلثين لوجود أخت شقيقة واحدة مستحقة للنصف.`;
            remaining = remaining.sub(share);
        }
    }

    // =========================================================================
    // 11. Maternal Siblings (الإخوة والأخوات لأم)
    // =========================================================================
    const hasMaleAscendant = heirs['FATHER'] || activeGFKey;
    if (!hasChildren && !hasMaleAscendant) {
        const mBrothers = heirs['MATERNAL_BROTHER'] && !heirs['MATERNAL_BROTHER'].is_blocked ? heirs['MATERNAL_BROTHER'].count : 0;
        const mSisters = heirs['MATERNAL_SISTER'] && !heirs['MATERNAL_SISTER'].is_blocked ? heirs['MATERNAL_SISTER'].count : 0;
        const totalMaternal = mBrothers + mSisters;

        if (totalMaternal > 0) {
            const oneThird = new Fraction(1, 3);
            const oneSixth = new Fraction(1, 6);

            for (const rel of ['MATERNAL_BROTHER', 'MATERNAL_SISTER']) {
                if (heirs[rel] && !heirs[rel].is_blocked) {
                    const count = heirs[rel].count;
                    let share;
                    if (totalMaternal === 1) {
                        share = oneSixth;
                        explanations[rel] = `يرث الأخ/الأخت لأم السدس (1/6) فرضاً لانفراده وعدم وجود فرع وارث ولا أصل ذكر وارث (كلالة)، لقوله تعالى: [وَلهُ أَخٌ أَوْ أُخْتٌ فَلِكُلِّ وَاحِدٍ مِنْهُمَا السُّدُسُ].`;
                    } else {
                        share = oneThird.mul(new Fraction(count, totalMaternal));
                        explanations[rel] = `يرث الإخوة لأم الثلث (1/3) فرضاً يشتركون فيه بالتساوي (للذكر مثل الأنثى) لتعددهم وعدم وجود فرع وارث ولا أصل ذكر وارث، لقوله تعالى: [فَهُمْ شُرَكَاءُ فِي الثُّلُثِ].`;
                    }
                    results[rel] = { share, count };
                    remaining = remaining.sub(share);
                }
            }
        }
    }

    return remaining;
}
