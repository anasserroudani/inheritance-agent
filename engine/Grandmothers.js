/**
 * @file Grandmothers.js
 * @description Calculates the 1/6 shared fixed share (فرض السدس للجدات) among valid maternal and paternal grandmothers.
 */

import Fraction from '../fraction.js';

/**
 * Calculates and distributes the 1/6 fixed share among all eligible, unblocked grandmothers.
 * Under Islamic law (Maliki, Shafi'i, Hanafi, Hanbali), all valid grandmothers of equal or valid degree
 * share the 1/6 equally when the mother is deceased.
 * 
 * Valid Grandmothers in the Maliki school:
 * 1. Paternal Grandmother (أم الأب): `PATERNAL_GRANDMOTHER`
 * 2. Maternal Grandmother (أم الأم): `MATERNAL_GRANDMOTHER`
 * 3. Maternal Great-Grandmother (أم أم الأم): `MATERNAL_GREAT_GRANDMOTHER`
 * 4. Maternal-Paternal Great-Grandmother (أم أم الأب): `MATERNAL_PATERNAL_GREAT_GRANDMOTHER`
 * Note: Paternal Great-Grandmother (أم أب الأب) does NOT inherit in the Maliki school.
 * 
 * @param {import('./Helpers.js').HeirMap} heirs - Active heirs map.
 * @param {Object.<string, {share: Fraction, count: number}>} results - Distribution results dictionary.
 * @param {Object.<string, string>} explanations - Legal reasons dictionary.
 * @param {Fraction} remaining - Remaining fraction of the estate.
 * @returns {Fraction} Updated remaining fraction after deducting grandmothers' share.
 */
export function calculateGrandmothersShare(heirs, results, explanations, remaining) {
    const grandmotherKeys = [
        'PATERNAL_GRANDMOTHER',
        'MATERNAL_GRANDMOTHER',
        'MATERNAL_GREAT_GRANDMOTHER',
        'MATERNAL_PATERNAL_GREAT_GRANDMOTHER'
    ];

    const activeGrandmothers = grandmotherKeys.filter(g => heirs[g] && !heirs[g].is_blocked && heirs[g].count > 0);

    if (activeGrandmothers.length > 0) {
        if (heirs['MOTHER'] && !heirs['MOTHER'].is_blocked) {
            // Mother is present, so grandmothers are blocked
            return remaining;
        }

        const oneSixth = new Fraction(1, 6);
        const shareEach = oneSixth.div(new Fraction(activeGrandmothers.length));

        for (const gm of activeGrandmothers) {
            results[gm] = { share: shareEach, count: heirs[gm].count || 1 };
            explanations[gm] = activeGrandmothers.length === 1
                ? `ترث الجدة السدس (1/6) فرضاً لانفرادها وعدم وجود الأم الحاجبة لها، لحديث إطعام النبي ﷺ الجدة السدس.`
                : `ترث الجدة السدس (1/6) فرضاً بالاشتراك مع الجدات الوارثات بالتساوي لعدم وجود الأم.`;

            remaining = remaining.sub(shareEach);
        }
    }

    return remaining;
}
