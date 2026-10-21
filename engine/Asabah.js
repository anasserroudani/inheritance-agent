/**
 * @file Asabah.js
 * @description Distributes the estate residue (الباقي تعصيباً) to agnatic heirs (العصبات).
 * Covers Asabah bi-nafs (عصبة بالنفس), Asabah bi-ghayr (عصبة بالغير), and Asabah ma'a ghayr (عصبة مع الغير).
 */

import Fraction from '../fraction.js';
import { hasFemaleDescendants, hasMaleDescendants, hasFather, hasGrandfather } from './Helpers.js';

/**
 * Distributes the remainder of the estate to the closest eligible residuary heir(s) in priority order.
 * 
 * Order of Agnatic Classes (جهات العصبة):
 * 1. Descendants (جهة البنوة): Son + Daughter (2:1), Grandson + Granddaughter (2:1), Great-Grandson + Great-Granddaughter (2:1).
 * 2. Ascendants (جهة الأبوة): Father, Grandfathers.
 * 3. Siblings and their descendants (جهة الأخوة وبنوهم):
 *    - Sisters with female descendants (الأخوات مع البنات عصبة مع الغير).
 *    - Full Brother + Full Sister (2:1).
 *    - Paternal Brother + Paternal Sister (2:1).
 *    - Full Nephew, Paternal Nephew, Great Nephews.
 * 4. Paternal Uncles and their descendants (جهة العمومة وبنوهم):
 *    - Full Uncle, Paternal Uncle, Full Cousin, Paternal Cousin, Great Cousins, Father's Uncles, Father's Cousins.
 * 
 * @param {import('./Helpers.js').HeirMap} heirs - Active heirs map.
 * @param {Object.<string, {share: Fraction, count: number}>} results - Distribution results dictionary.
 * @param {Object.<string, string>} explanations - Legal reasons dictionary.
 * @param {Fraction} remaining - Remaining fraction after fixed shares.
 * @returns {void}
 */
export function distributeResidue(heirs, results, explanations, remaining) {
    if (remaining.lessThan(0) || remaining.equals(0)) {
        return;
    }

    /**
     * Helper to allocate residue to an heir relationship and record the reason.
     * @param {string} key - Relationship code.
     * @param {Fraction} value - Fraction of residue assigned.
     * @param {string} desc - Legal explanation text.
     */
    const addResidue = (key, value, desc) => {
        if (!results[key]) {
            results[key] = { share: value, count: heirs[key].count || 1, asabah: true };
        } else {
            results[key].share = results[key].share.add(value);
            results[key].asabah = true;
        }
        explanations[key] = desc;
    };

    // =========================================================================
    // 1. Children (الابن والبنت الصلبية)
    // =========================================================================
    if (heirs['SON'] && !heirs['SON'].is_blocked) {
        const sonCount = heirs['SON'].count;
        const daughterCount = heirs['DAUGHTER'] && !heirs['DAUGHTER'].is_blocked ? heirs['DAUGHTER'].count : 0;
        const totalParts = (sonCount * 2) + daughterCount;

        const sonResidue = remaining.mul(new Fraction(sonCount * 2, totalParts));
        addResidue('SON', sonResidue, `يرث الابن (أو الأبناء بالتساوي) الباقي تعصيباً (عصبة بالنفس) كونه أقرب عاصب ذكر للمتوفى.`);

        if (daughterCount > 0) {
            const daughterResidue = remaining.mul(new Fraction(daughterCount, totalParts));
            addResidue('DAUGHTER', daughterResidue, `ترث البنت (أو البنات بالتساوي) بالتعصيب بالغير مع الابن للذكر مثل حظ الأنثيين، لقوله تعالى: [يُوصِيكُمُ اللَّهُ فِي أَوْلَادِكُمْ لِلذَّكَرِ مِثْلُ حَظِّ الْأُنْثَيَيْنِ].`);
        }
        return;
    }

    // =========================================================================
    // 2. Grandsons (ابن الابن وبنت الابن)
    // =========================================================================
    if (heirs['GRANDSON'] && !heirs['GRANDSON'].is_blocked) {
        const grandsonCount = heirs['GRANDSON'].count;
        const granddaughterCount = heirs['GRANDDAUGHTER'] && !heirs['GRANDDAUGHTER'].is_blocked ? heirs['GRANDDAUGHTER'].count : 0;
        const totalParts = (grandsonCount * 2) + granddaughterCount;

        const grandsonResidue = remaining.mul(new Fraction(grandsonCount * 2, totalParts));
        addResidue('GRANDSON', grandsonResidue, `يرث ابن الابن الباقي تعصيباً كونه يقوم مقام الابن عند عدمه.`);

        if (granddaughterCount > 0) {
            const granddaughterResidue = remaining.mul(new Fraction(granddaughterCount, totalParts));
            addResidue('GRANDDAUGHTER', granddaughterResidue, `ترث بنت الابن بالتعصيب بالغير مع ابن الابن للذكر مثل حظ الأنثيين.`);
        }
        return;
    }

    // =========================================================================
    // 3. Great Grandsons (ابن ابن الابن وبنت ابن الابن)
    // =========================================================================
    if (heirs['GREAT_GRANDSON'] && !heirs['GREAT_GRANDSON'].is_blocked) {
        const count = heirs['GREAT_GRANDSON'].count;
        const femaleCount = heirs['GREAT_GRANDDAUGHTER'] && !heirs['GREAT_GRANDDAUGHTER'].is_blocked ? heirs['GREAT_GRANDDAUGHTER'].count : 0;
        
        // Higher granddaughter (بنت الابن) is ta'seebed by great-grandson (القريب المبارك) if she has no fixed share (e.g. daughters took 2/3)
        const granddaughterNeedsAsabah = heirs['GRANDDAUGHTER'] && !heirs['GRANDDAUGHTER'].is_blocked && !results['GRANDDAUGHTER'];
        const gdCount = granddaughterNeedsAsabah ? heirs['GRANDDAUGHTER'].count : 0;

        const totalParts = (count * 2) + femaleCount + gdCount;

        const maleResidue = remaining.mul(new Fraction(count * 2, totalParts));
        addResidue('GREAT_GRANDSON', maleResidue, `يرث ابن ابن الابن الباقي تعصيباً لعدم وجود عاصب أقرب.`);

        if (gdCount > 0) {
            const gdResidue = remaining.mul(new Fraction(gdCount, totalParts));
            addResidue('GRANDDAUGHTER', gdResidue, `ترث بنت الابن (أو بنات الابن بالتساوي) بالتعصيب بالغير مع القريب المبارك (ابن ابن الابن) للذكر مثل حظ الأنثيين بعد استغراق البنات الصلبيات فرض الثلثين.`);
        }

        if (femaleCount > 0) {
            const femaleResidue = remaining.mul(new Fraction(femaleCount, totalParts));
            addResidue('GREAT_GRANDDAUGHTER', femaleResidue, `ترث بنت ابن الابن بالتعصيب بالغير مع ابن ابن الابن للذكر مثل حظ الأنثيين.`);
        }
        return;
    }

    // =========================================================================
    // 4. Father (الأب)
    // =========================================================================
    if (heirs['FATHER'] && !heirs['FATHER'].is_blocked) {
        const hasFemaleDesc = hasFemaleDescendants(heirs) && !hasMaleDescendants(heirs);
        if (hasFemaleDesc) {
            addResidue('FATHER', remaining, `يرث الأب سُدس التركة إضافة إلى الباقي من التركة (إن تبقى شىء) فى حالة وجود الفرع الوارث المؤنث (مثل البنت و بنت الابن و بنت ابن الإبن) لقوله تعالى (وَلأَبَوَيْهِ لِكُلِّ وَاحِدٍ مِنْهُمَا السُّدُسُ مِمَّا تَرَكَ إِنْ كَانَ لَهُ وَلَدٌ). ويرث الباقي تعصيباً لأنه أولى رجل ذكر لقولة ﷺ (ألحقوا الفرائض بأهلها فما بقى فهو لأولى رجل ذكر)`);
        } else {
            addResidue('FATHER', remaining, `يرث الأب الباقي تعصيباً (عصبة بالنفس) لعدم وجود فرع وارث مطلقاً.`);
        }
        return;
    }

    // =========================================================================
    // 5. Grandfathers (الجد لأب عند عدم مقاسمة الإخوة)
    // =========================================================================
    const activeGFKey = ['PATERNAL_GRANDFATHER', 'PATERNAL_GREAT_GRANDFATHER'].find(r => heirs[r] && !heirs[r].is_blocked);
    const activeSiblingsExist = ['FULL_BROTHER', 'FULL_SISTER', 'PATERNAL_BROTHER', 'PATERNAL_SISTER']
        .some(rel => heirs[rel] && !heirs[rel].is_blocked);

    if (activeGFKey && !activeSiblingsExist) {
        const gfName = heirs[activeGFKey].displayName;
        const hasFemaleDesc = hasFemaleDescendants(heirs) && !hasMaleDescendants(heirs);
        if (hasFemaleDesc) {
            addResidue(activeGFKey, remaining, `يرث ${gfName} السدس فرضاً لوجود فرع وارث أنثى بالإضافة إلى الباقي تعصيباً لعدم وجود الأب وفرع ذكر.`);
        } else {
            addResidue(activeGFKey, remaining, `يرث ${gfName} الباقي تعصيباً لعدم وجود الأب أو فرع وارث.`);
        }
        return;
    }

    // =========================================================================
    // 6. Sisters as Asabah with Others (العصبة مع الغير)
    // =========================================================================
    const noMaleDescendantOrFatherOrGF = !hasMaleDescendants(heirs) && !hasFather(heirs) && !hasGrandfather(heirs);
    const hasDaughtersOrGranddaughters = hasFemaleDescendants(heirs);

    const noFullBrother = !(heirs['FULL_BROTHER'] && !heirs['FULL_BROTHER'].is_blocked);
    const noPaternalBrother = !(heirs['PATERNAL_BROTHER'] && !heirs['PATERNAL_BROTHER'].is_blocked);
    const noFullSisterAsabah = !(heirs['FULL_SISTER'] && !heirs['FULL_SISTER'].is_blocked);

    // Full Sister with female descendants (requires no Full Brother)
    if (heirs['FULL_SISTER'] && !heirs['FULL_SISTER'].is_blocked && hasDaughtersOrGranddaughters && noMaleDescendantOrFatherOrGF && noFullBrother) {
        addResidue('FULL_SISTER', remaining, `ترث الأخت الشقيقة الباقي تعصيباً مع الغير لوجود البنات أو بنات الابن وعدم وجود الأخ الشقيق أو الأب.`);
        return;
    }

    // Paternal Sister with female descendants (requires no Full Brother, no Paternal Brother, and no Full Sister asabah)
    if (heirs['PATERNAL_SISTER'] && !heirs['PATERNAL_SISTER'].is_blocked && hasDaughtersOrGranddaughters && noMaleDescendantOrFatherOrGF && noFullBrother && noPaternalBrother && noFullSisterAsabah) {
        addResidue('PATERNAL_SISTER', remaining, `ترث الأخت لأب الباقي تعصيباً مع الغير لوجود البنات وعدم وجود عاصب أقرب.`);
        return;
    }

    // =========================================================================
    // 7. Full Siblings (الأخ الشقيق والأخت الشقيقة)
    // =========================================================================
    if (heirs['FULL_BROTHER'] && !heirs['FULL_BROTHER'].is_blocked) {
        const brotherCount = heirs['FULL_BROTHER'].count;
        const sisterCount = heirs['FULL_SISTER'] && !heirs['FULL_SISTER'].is_blocked ? heirs['FULL_SISTER'].count : 0;
        const totalParts = (brotherCount * 2) + sisterCount;

        const brotherShare = remaining.mul(new Fraction(brotherCount * 2, totalParts));
        addResidue('FULL_BROTHER', brotherShare, `يرث الأخ الشقيق (أو الأشقاء بالتساوي) الباقي تعصيباً كونه أقرب عاصب ذكر متبقي (عصبة بالنفس).`);

        if (sisterCount > 0) {
            const sisterShare = remaining.mul(new Fraction(sisterCount, totalParts));
            addResidue('FULL_SISTER', sisterShare, `ترث الأخت الشقيقة بالتعصيب بالغير مع الأخ الشقيق (للذكر مثل حظ الأنثيين)، لقوله تعالى: [وَإِنْ كَانُوا إِخْوَةً رِجَالًا وَنِسَاءً فَلِلذَّكَرِ مِثْلُ حَظِّ الْأُنْثَيَيْنِ].`);
        }
        return;
    }

    // =========================================================================
    // 8. Paternal Siblings (الأخ لأب والأخت لأب)
    // =========================================================================
    if (heirs['PATERNAL_BROTHER'] && !heirs['PATERNAL_BROTHER'].is_blocked) {
        const brotherCount = heirs['PATERNAL_BROTHER'].count;
        const sisterCount = heirs['PATERNAL_SISTER'] && !heirs['PATERNAL_SISTER'].is_blocked ? heirs['PATERNAL_SISTER'].count : 0;
        const totalParts = (brotherCount * 2) + sisterCount;

        const brotherShare = remaining.mul(new Fraction(brotherCount * 2, totalParts));
        addResidue('PATERNAL_BROTHER', brotherShare, `يرث الأخ لأب الباقي تعصيباً (عصبة بالنفس) لعدم وجود عاصب أقرب.`);

        if (sisterCount > 0) {
            const sisterShare = remaining.mul(new Fraction(sisterCount, totalParts));
            addResidue('PATERNAL_SISTER', sisterShare, `ترث الأخت لأب بالتعصيب بالغير مع الأخ لأب (للذكر مثل حظ الأنثيين).`);
        }
        return;
    }

    // =========================================================================
    // 9. Other Agnatic Fallbacks in strict priority order (باقي العصبات بالنفس)
    // =========================================================================
    const fallbackRels = [
        'NEPHEW_FULL', 'NEPHEW_PATERNAL',
        'GREAT_NEPHEW_FULL', 'GREAT_NEPHEW_PATERNAL',
        'UNCLE_FULL', 'UNCLE_PATERNAL',
        'COUSIN_FULL', 'COUSIN_PATERNAL',
        'GREAT_COUSIN_FULL', 'GREAT_COUSIN_PATERNAL',
        'FATHER_UNCLE_FULL', 'FATHER_UNCLE_PATERNAL',
        'FATHER_COUSIN_FULL', 'FATHER_COUSIN_PATERNAL'
    ];

    for (const rel of fallbackRels) {
        if (heirs[rel] && !heirs[rel].is_blocked) {
            addResidue(rel, remaining, `يرث ${heirs[rel].displayName} الباقي تعصيباً كونه أقرب عاصب ذكر متبقي للمتوفى.`);
            return;
        }
    }
}
