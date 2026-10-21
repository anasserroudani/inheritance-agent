/**
 * @file BlockingRules.js
 * @description Implements Islamic jurisprudence total exclusion rules (حجب الحرمان).
 * Evaluates priority hierarchy between heirs: descendants, ascendants, collaterals, and agnatic relatives.
 */

import { hasMaleDescendants, hasFemaleDescendants, hasFather, hasGrandfather } from './Helpers.js';

/**
 * Applies Islamic blocking rules (حجب الحرمان) to the active heirs map in place.
 * Sets `is_blocked = true`, records `blocked_by`, and generates authentic legal explanations.
 * 
 * Hierarchy and Exclusion Principles:
 * 1. Mother blocks all grandmothers (maternal & paternal).
 * 2. Father blocks grandfathers, paternal grandmothers, and all collateral relatives (siblings, nephews, uncles).
 * 3. Sons block all grandchildren, siblings, nephews, uncles, and cousins.
 * 4. Grandsons block lower grandchildren and collaterals.
 * 5. Female descendants block maternal siblings.
 * 6. Daughters (>=2) block granddaughters unless accompanied by a male agnate (Asabah / معصب).
 * 7. Full brothers and Asabah sisters block paternal siblings and lower agnates.
 * 8. Priority among male agnates follows class (جهة), degree (درجة), and strength of relation (قوة القرابة).
 * 
 * @param {import('./Helpers.js').HeirMap} heirs - Active heirs map modified in place.
 * @param {Object.<string, string>} explanations - Explanations dictionary for recording blocking reasons.
 * @returns {void}
 */
export function applyBlockingRules(heirs, explanations) {
    /**
     * Helper to set blocking status and record the legal justification.
     * @param {string} blockedKey - Relationship code of the excluded heir.
     * @param {string} blockerKey - Relationship code of the excluding heir.
     * @param {string} reason - Detailed Arabic legal explanation.
     */
    const block = (blockedKey, blockerKey, reason) => {
        if (heirs[blockedKey]) {
            heirs[blockedKey].is_blocked = true;
            heirs[blockedKey].blocked_by = blockerKey;
            explanations[blockedKey] = reason;
        }
    };

    /**
     * Helper to block a list of heirs with a shared reason.
     * @param {string[]} blockedKeys - Array of relationship codes to block.
     * @param {string} blockerKey - Relationship code of the excluding heir.
     * @param {string} reason - Detailed Arabic legal explanation.
     */
    const blockMany = (blockedKeys, blockerKey, reason) => {
        for (const k of blockedKeys) {
            block(k, blockerKey, reason);
        }
    };

    // =========================================================================
    // 1. Mother (الأم) Blocking Rules
    // =========================================================================
    if (heirs['MOTHER'] && !heirs['MOTHER'].is_blocked) {
        const gmReason = `الجدة محجوبة حجب حرمان لوجود الأم، لأن الأم أصل الجدات ولا ترث الجدة مع وجود أمها.`;
        blockMany([
            'PATERNAL_GRANDMOTHER',
            'MATERNAL_GRANDMOTHER',
            'MATERNAL_GREAT_GRANDMOTHER',
            'PATERNAL_GREAT_GRANDMOTHER',
            'MATERNAL_PATERNAL_GREAT_GRANDMOTHER'
        ], 'MOTHER', gmReason);
    }

    // =========================================================================
    // 2. Father (الأب) Blocking Rules
    // =========================================================================
    if (heirs['FATHER'] && !heirs['FATHER'].is_blocked) {
        // Father blocks all grandfathers
        block('PATERNAL_GRANDFATHER', 'FATHER', `الجد محجوب لوجود الأب، فالأب أصل الجد وأقرب منه.`);
        block('PATERNAL_GREAT_GRANDFATHER', 'FATHER', `الجد محجوب لوجود الأب.`);

        // Father blocks paternal grandmothers (who connect through him)
        const patGmReason = `الجدة لأب محجوبة لوجود الأب لأنها تدلي به للمتوفى.`;
        blockMany([
            'PATERNAL_GRANDMOTHER',
            'PATERNAL_GREAT_GRANDMOTHER',
            'MATERNAL_PATERNAL_GREAT_GRANDMOTHER'
        ], 'FATHER', patGmReason);

        // Father blocks all siblings, nephews, uncles, and cousins
        const collateralReason = `محجوب(ة) حجب حرمان لوجود الأب (الأصل الذكر الأقرب).`;
        blockMany([
            'FULL_BROTHER', 'FULL_SISTER',
            'PATERNAL_BROTHER', 'PATERNAL_SISTER',
            'MATERNAL_BROTHER', 'MATERNAL_SISTER',
            'NEPHEW_FULL', 'NEPHEW_PATERNAL',
            'GREAT_NEPHEW_FULL', 'GREAT_NEPHEW_PATERNAL',
            'UNCLE_FULL', 'UNCLE_PATERNAL',
            'COUSIN_FULL', 'COUSIN_PATERNAL',
            'GREAT_COUSIN_FULL', 'GREAT_COUSIN_PATERNAL',
            'FATHER_UNCLE_FULL', 'FATHER_UNCLE_PATERNAL',
            'FATHER_COUSIN_FULL', 'FATHER_COUSIN_PATERNAL'
        ], 'FATHER', collateralReason);
    }

    // =========================================================================
    // 3. Grandfather (الجد لأب) Blocking Rules
    // =========================================================================
    if (heirs['PATERNAL_GRANDFATHER'] && !heirs['PATERNAL_GRANDFATHER'].is_blocked) {
        block('PATERNAL_GREAT_GRANDFATHER', 'PATERNAL_GRANDFATHER', `الجد الأبعد محجوب بالجد الأقرب.`);
        block('PATERNAL_GREAT_GRANDMOTHER', 'PATERNAL_GRANDFATHER', `الجدة لأب محجوبة بالجد الأقرب.`);
        block('MATERNAL_PATERNAL_GREAT_GRANDMOTHER', 'PATERNAL_GRANDFATHER', `الجدة لأب محجوبة بالجد الأقرب.`);

        // Grandfather blocks maternal siblings (الإخوة لأم)
        const matSibReason = `الإخوة لأم محجوبون بالجد لأب (الأصل الذكر الوارث) إجماعاً.`;
        block('MATERNAL_BROTHER', 'PATERNAL_GRANDFATHER', matSibReason);
        block('MATERNAL_SISTER', 'PATERNAL_GRANDFATHER', matSibReason);

        // Grandfather blocks nephews, uncles, and cousins
        const belowReason = `محجوب لوجود الجد لأب (الأصل الوارث مقدم على الحواشي الأبعد).`;
        blockMany([
            'NEPHEW_FULL', 'NEPHEW_PATERNAL',
            'GREAT_NEPHEW_FULL', 'GREAT_NEPHEW_PATERNAL',
            'UNCLE_FULL', 'UNCLE_PATERNAL',
            'COUSIN_FULL', 'COUSIN_PATERNAL',
            'GREAT_COUSIN_FULL', 'GREAT_COUSIN_PATERNAL',
            'FATHER_UNCLE_FULL', 'FATHER_UNCLE_PATERNAL',
            'FATHER_COUSIN_FULL', 'FATHER_COUSIN_PATERNAL'
        ], 'PATERNAL_GRANDFATHER', belowReason);
    }

    // Great-Grandfather
    if (heirs['PATERNAL_GREAT_GRANDFATHER'] && !heirs['PATERNAL_GREAT_GRANDFATHER'].is_blocked) {
        const gpReason = `محجوب لوجود الجد لأب الأعلى.`;
        block('MATERNAL_BROTHER', 'PATERNAL_GREAT_GRANDFATHER', gpReason);
        block('MATERNAL_SISTER', 'PATERNAL_GREAT_GRANDFATHER', gpReason);
        blockMany([
            'NEPHEW_FULL', 'NEPHEW_PATERNAL',
            'GREAT_NEPHEW_FULL', 'GREAT_NEPHEW_PATERNAL',
            'UNCLE_FULL', 'UNCLE_PATERNAL',
            'COUSIN_FULL', 'COUSIN_PATERNAL',
            'GREAT_COUSIN_FULL', 'GREAT_COUSIN_PATERNAL'
        ], 'PATERNAL_GREAT_GRANDFATHER', gpReason);
    }

    // =========================================================================
    // 4. Male Descendants (الفروع الذكور) Blocking Rules
    // =========================================================================
    // Son (الابن)
    if (heirs['SON'] && !heirs['SON'].is_blocked) {
        const sonReason = `محجوب(ة) حجب حرمان لوجود الابن (الفرع الوارث المذكر الأقرب).`;
        blockMany([
            'GRANDSON', 'GRANDDAUGHTER',
            'GREAT_GRANDSON', 'GREAT_GRANDDAUGHTER',
            'FULL_BROTHER', 'FULL_SISTER',
            'PATERNAL_BROTHER', 'PATERNAL_SISTER',
            'MATERNAL_BROTHER', 'MATERNAL_SISTER',
            'NEPHEW_FULL', 'NEPHEW_PATERNAL',
            'GREAT_NEPHEW_FULL', 'GREAT_NEPHEW_PATERNAL',
            'UNCLE_FULL', 'UNCLE_PATERNAL',
            'COUSIN_FULL', 'COUSIN_PATERNAL',
            'GREAT_COUSIN_FULL', 'GREAT_COUSIN_PATERNAL',
            'FATHER_UNCLE_FULL', 'FATHER_UNCLE_PATERNAL',
            'FATHER_COUSIN_FULL', 'FATHER_COUSIN_PATERNAL'
        ], 'SON', sonReason);
    }

    // Grandson (ابن الابن)
    if (heirs['GRANDSON'] && !heirs['GRANDSON'].is_blocked) {
        const gsReason = `محجوب(ة) حجب حرمان لوجود ابن الابن.`;
        blockMany([
            'GREAT_GRANDSON', 'GREAT_GRANDDAUGHTER',
            'FULL_BROTHER', 'FULL_SISTER',
            'PATERNAL_BROTHER', 'PATERNAL_SISTER',
            'MATERNAL_BROTHER', 'MATERNAL_SISTER',
            'NEPHEW_FULL', 'NEPHEW_PATERNAL',
            'GREAT_NEPHEW_FULL', 'GREAT_NEPHEW_PATERNAL',
            'UNCLE_FULL', 'UNCLE_PATERNAL',
            'COUSIN_FULL', 'COUSIN_PATERNAL',
            'GREAT_COUSIN_FULL', 'GREAT_COUSIN_PATERNAL'
        ], 'GRANDSON', gsReason);
    }

    // Great Grandson (ابن ابن الابن)
    if (heirs['GREAT_GRANDSON'] && !heirs['GREAT_GRANDSON'].is_blocked) {
        const ggsReason = `محجوب(ة) لوجود ابن ابن الابن.`;
        blockMany([
            'FULL_BROTHER', 'FULL_SISTER',
            'PATERNAL_BROTHER', 'PATERNAL_SISTER',
            'MATERNAL_BROTHER', 'MATERNAL_SISTER',
            'NEPHEW_FULL', 'NEPHEW_PATERNAL',
            'GREAT_NEPHEW_FULL', 'GREAT_NEPHEW_PATERNAL',
            'UNCLE_FULL', 'UNCLE_PATERNAL',
            'COUSIN_FULL', 'COUSIN_PATERNAL'
        ], 'GREAT_GRANDSON', ggsReason);
    }

    // =========================================================================
    // 5. Female Descendants (الفروع الإناث) Blocking Rules
    // =========================================================================
    // Female descendants block maternal siblings
    if (hasFemaleDescendants(heirs)) {
        const matReason = `الإخوة لأم محجوبون لوجود فرع وارث للمتوفى.`;
        block('MATERNAL_BROTHER', 'FEMALE_DESCENDANTS', matReason);
        block('MATERNAL_SISTER', 'FEMALE_DESCENDANTS', matReason);
    }

    // Two or more daughters block granddaughters unless accompanied by a grandson or great-grandson (Asabah)
    if (heirs['DAUGHTER'] && heirs['DAUGHTER'].count >= 2) {
        const hasActiveMaleDescendantForGranddaughter =
            (heirs['GRANDSON'] && !heirs['GRANDSON'].is_blocked) ||
            (heirs['GREAT_GRANDSON'] && !heirs['GREAT_GRANDSON'].is_blocked);
        if (!hasActiveMaleDescendantForGranddaughter) {
            block('GRANDDAUGHTER', 'DAUGHTER', `بنت الابن محجوبة لاستغراق البنات الصلبيات فرض الثلثين ولعدم وجود عاصب يعصبها.`);
        }

        const hasActiveGreatGrandson = heirs['GREAT_GRANDSON'] && !heirs['GREAT_GRANDSON'].is_blocked;
        if (!hasActiveGreatGrandson) {
            block('GREAT_GRANDDAUGHTER', 'DAUGHTER', `بنت ابن الابن محجوبة لاستغراق البنات الصلبيات فرض الثلثين ولعدم وجود عاصب.`);
        }
    }

    // Granddaughters (>=2) block great-granddaughters unless accompanied by great-grandson
    if (heirs['GRANDDAUGHTER'] && !heirs['GRANDDAUGHTER'].is_blocked && heirs['GRANDDAUGHTER'].count >= 2) {
        const hasActiveGreatGrandson = heirs['GREAT_GRANDSON'] && !heirs['GREAT_GRANDSON'].is_blocked;
        if (!hasActiveGreatGrandson) {
            block('GREAT_GRANDDAUGHTER', 'GRANDDAUGHTER', `بنت ابن الابن محجوبة لاستغراق بنات الابن فرض الثلثين ولعدم وجود عاصب.`);
        }
    }

    // =========================================================================
    // 6. Grandmother Hierarchy Blocking
    // =========================================================================
    if (heirs['MATERNAL_GRANDMOTHER'] && !heirs['MATERNAL_GRANDMOTHER'].is_blocked) {
        block('MATERNAL_GREAT_GRANDMOTHER', 'MATERNAL_GRANDMOTHER', `محجوبة بالجدة لأم الأقرب منها.`);
        block('MATERNAL_PATERNAL_GREAT_GRANDMOTHER', 'MATERNAL_GRANDMOTHER', `محجوبة بالجدة لأم الأقرب منها.`);
    }

    if (heirs['PATERNAL_GRANDMOTHER'] && !heirs['PATERNAL_GRANDMOTHER'].is_blocked) {
        block('PATERNAL_GREAT_GRANDMOTHER', 'PATERNAL_GRANDMOTHER', `محجوبة بالجدة لأب الأقرب منها.`);
        block('MATERNAL_PATERNAL_GREAT_GRANDMOTHER', 'PATERNAL_GRANDMOTHER', `محجوبة بالجدة لأب الأقرب منها.`);
    }

    // =========================================================================
    // Maliki School Rule: Paternal Great-Grandmother (أم أب الأب) is non-inheriting
    // =========================================================================
    if (heirs['PATERNAL_GREAT_GRANDMOTHER'] && !heirs['PATERNAL_GREAT_GRANDMOTHER'].is_blocked) {
        heirs['PATERNAL_GREAT_GRANDMOTHER'].is_blocked = true;
        heirs['PATERNAL_GREAT_GRANDMOTHER'].blocked_by = 'المذهب المالكي';
        explanations['PATERNAL_GREAT_GRANDMOTHER'] = `الجدة (أم أب الأب) ساقطة لا ترث عند المالكية؛ إذ لا يرث من الجدات في المذهب المالكي إلا طائفتان: أمهات الأم بمحض الإناث، وأمهات الأب بمحض الإناث، ولا ترث أم أبي الأب لعدم وجود نص أو أثر بتوريثها، ولا يصح قياسها على أم الأب لأن أمهات الأب طائفة غير طائفة أمهات الجد.`;
    }

    // =========================================================================
    // 7. Full Siblings (الإخوة والأخوات الأشقاء) Blocking Rules
    // =========================================================================
    // Full Brother (الأخ الشقيق)
    if (heirs['FULL_BROTHER'] && !heirs['FULL_BROTHER'].is_blocked) {
        const fbReason = `محجوب(ة) لوجود الأخ الشقيق (العاصب الأقرب في جهة الأخوة).`;
        const blockedRels = [
            'NEPHEW_FULL', 'NEPHEW_PATERNAL',
            'GREAT_NEPHEW_FULL', 'GREAT_NEPHEW_PATERNAL',
            'UNCLE_FULL', 'UNCLE_PATERNAL',
            'COUSIN_FULL', 'COUSIN_PATERNAL',
            'GREAT_COUSIN_FULL', 'GREAT_COUSIN_PATERNAL',
            'FATHER_UNCLE_FULL', 'FATHER_UNCLE_PATERNAL'
        ];
        // If grandfather is present, paternal siblings are NOT blocked here because they are counted in Al-Mu'adah (المعادة)
        if (!hasGrandfather(heirs)) {
            blockedRels.unshift('PATERNAL_BROTHER', 'PATERNAL_SISTER');
        }
        blockMany(blockedRels, 'FULL_BROTHER', fbReason);
    }

    // Full Sister Asabah with Others (الأخت الشقيقة عصبة مع الغير)
    const hasDaughtersOrGranddaughters = hasFemaleDescendants(heirs);
    const hasFullSister = heirs['FULL_SISTER'] && !heirs['FULL_SISTER'].is_blocked;
    const noMaleDescendantOrFatherOrGF = !hasMaleDescendants(heirs) && !hasFather(heirs) && !hasGrandfather(heirs);
    const fullSisterIsAsabahWithOthers = hasDaughtersOrGranddaughters && hasFullSister && noMaleDescendantOrFatherOrGF;

    if (fullSisterIsAsabahWithOthers) {
        const fsReason = `محجوب(ة) لوجود الأخت الشقيقة التي صارت عصبة مع البنات (الأخوات مع البنات عصبة كالأخ الشقيق).`;
        blockMany([
            'PATERNAL_BROTHER', 'PATERNAL_SISTER',
            'NEPHEW_FULL', 'NEPHEW_PATERNAL',
            'GREAT_NEPHEW_FULL', 'GREAT_NEPHEW_PATERNAL',
            'UNCLE_FULL', 'UNCLE_PATERNAL',
            'COUSIN_FULL', 'COUSIN_PATERNAL'
        ], 'FULL_SISTER', fsReason);
    }

    // Two or more full sisters block paternal sisters (unless accompanied by paternal brother)
    if (heirs['FULL_SISTER'] && !heirs['FULL_SISTER'].is_blocked && heirs['FULL_SISTER'].count >= 2) {
        const hasPaternalBrother = heirs['PATERNAL_BROTHER'] && !heirs['PATERNAL_BROTHER'].is_blocked;
        if (!hasPaternalBrother) {
            block('PATERNAL_SISTER', 'FULL_SISTER', `الأخت لأب محجوبة لاستغراق الأخوات الشقيقات فرض الثلثين ولعدم وجود عاصب (أخ لأب) يعصبها.`);
        }
    }

    // =========================================================================
    // 8. Paternal Siblings (الإخوة لأب) Blocking Rules
    // =========================================================================
    if (heirs['PATERNAL_BROTHER'] && !heirs['PATERNAL_BROTHER'].is_blocked) {
        const pbReason = `محجوب لوجود الأخ لأب.`;
        blockMany([
            'NEPHEW_FULL', 'NEPHEW_PATERNAL',
            'GREAT_NEPHEW_FULL', 'GREAT_NEPHEW_PATERNAL',
            'UNCLE_FULL', 'UNCLE_PATERNAL',
            'COUSIN_FULL', 'COUSIN_PATERNAL'
        ], 'PATERNAL_BROTHER', pbReason);
    }

    // Paternal Sister Asabah with Others
    const hasPaternalSister = heirs['PATERNAL_SISTER'] && !heirs['PATERNAL_SISTER'].is_blocked;
    const noFullBrother = !(heirs['FULL_BROTHER'] && !heirs['FULL_BROTHER'].is_blocked);
    const paternalSisterIsAsabahWithOthers = hasDaughtersOrGranddaughters && hasPaternalSister && noMaleDescendantOrFatherOrGF && noFullBrother && !fullSisterIsAsabahWithOthers;

    if (paternalSisterIsAsabahWithOthers) {
        const psReason = `محجوب لوجود الأخت لأب التي صارت عصبة مع البنات.`;
        blockMany([
            'NEPHEW_FULL', 'NEPHEW_PATERNAL',
            'GREAT_NEPHEW_FULL', 'GREAT_NEPHEW_PATERNAL',
            'UNCLE_FULL', 'UNCLE_PATERNAL',
            'COUSIN_FULL', 'COUSIN_PATERNAL'
        ], 'PATERNAL_SISTER', psReason);
    }

    // =========================================================================
    // 9. Collateral Relatives (أبناء الإخوة والأعمام وبنوهم)
    // =========================================================================
    if (heirs['NEPHEW_FULL'] && !heirs['NEPHEW_FULL'].is_blocked) {
        blockMany(['NEPHEW_PATERNAL', 'GREAT_NEPHEW_FULL', 'GREAT_NEPHEW_PATERNAL', 'UNCLE_FULL', 'UNCLE_PATERNAL', 'COUSIN_FULL', 'COUSIN_PATERNAL'],
            'NEPHEW_FULL', `محجوب لوجود ابن الأخ الشقيق.`);
    }

    if (heirs['NEPHEW_PATERNAL'] && !heirs['NEPHEW_PATERNAL'].is_blocked) {
        blockMany(['GREAT_NEPHEW_FULL', 'GREAT_NEPHEW_PATERNAL', 'UNCLE_FULL', 'UNCLE_PATERNAL', 'COUSIN_FULL', 'COUSIN_PATERNAL'],
            'NEPHEW_PATERNAL', `محجوب لوجود ابن الأخ لأب.`);
    }

    if (heirs['GREAT_NEPHEW_FULL'] && !heirs['GREAT_NEPHEW_FULL'].is_blocked) {
        blockMany(['GREAT_NEPHEW_PATERNAL', 'UNCLE_FULL', 'UNCLE_PATERNAL', 'COUSIN_FULL', 'COUSIN_PATERNAL', 'GREAT_COUSIN_FULL', 'GREAT_COUSIN_PATERNAL', 'FATHER_COUSIN_FULL', 'FATHER_COUSIN_PATERNAL'],
            'GREAT_NEPHEW_FULL', `محجوب لوجود ابن ابن الأخ الشقيق.`);
    }

    if (heirs['GREAT_NEPHEW_PATERNAL'] && !heirs['GREAT_NEPHEW_PATERNAL'].is_blocked) {
        blockMany(['UNCLE_FULL', 'UNCLE_PATERNAL', 'COUSIN_FULL', 'COUSIN_PATERNAL', 'GREAT_COUSIN_FULL', 'GREAT_COUSIN_PATERNAL', 'FATHER_COUSIN_FULL', 'FATHER_COUSIN_PATERNAL'],
            'GREAT_NEPHEW_PATERNAL', `محجوب لوجود ابن ابن الأخ لأب.`);
    }

    if (heirs['UNCLE_FULL'] && !heirs['UNCLE_FULL'].is_blocked) {
        blockMany(['UNCLE_PATERNAL', 'COUSIN_FULL', 'COUSIN_PATERNAL', 'GREAT_COUSIN_FULL', 'GREAT_COUSIN_PATERNAL', 'FATHER_COUSIN_FULL', 'FATHER_COUSIN_PATERNAL'],
            'UNCLE_FULL', `محجوب لوجود العم الشقيق.`);
    }

    if (heirs['UNCLE_PATERNAL'] && !heirs['UNCLE_PATERNAL'].is_blocked) {
        blockMany(['COUSIN_FULL', 'COUSIN_PATERNAL', 'GREAT_COUSIN_FULL', 'GREAT_COUSIN_PATERNAL', 'FATHER_COUSIN_FULL', 'FATHER_COUSIN_PATERNAL'],
            'UNCLE_PATERNAL', `محجوب لوجود العم لأب.`);
    }

    if (heirs['COUSIN_FULL'] && !heirs['COUSIN_FULL'].is_blocked) {
        blockMany(['COUSIN_PATERNAL', 'GREAT_COUSIN_FULL', 'GREAT_COUSIN_PATERNAL', 'FATHER_COUSIN_FULL', 'FATHER_COUSIN_PATERNAL'], 'COUSIN_FULL', `محجوب لوجود ابن العم الشقيق.`);
    }

    if (heirs['COUSIN_PATERNAL'] && !heirs['COUSIN_PATERNAL'].is_blocked) {
        blockMany(['GREAT_COUSIN_FULL', 'GREAT_COUSIN_PATERNAL', 'FATHER_COUSIN_FULL', 'FATHER_COUSIN_PATERNAL'], 'COUSIN_PATERNAL', `محجوب لوجود ابن العم لأب.`);
    }

    if (heirs['GREAT_COUSIN_FULL'] && !heirs['GREAT_COUSIN_FULL'].is_blocked) {
        blockMany(['GREAT_COUSIN_PATERNAL', 'FATHER_COUSIN_FULL', 'FATHER_COUSIN_PATERNAL'], 'GREAT_COUSIN_FULL', `محجوب لوجود ابن ابن العم الشقيق.`);
    }

    if (heirs['GREAT_COUSIN_PATERNAL'] && !heirs['GREAT_COUSIN_PATERNAL'].is_blocked) {
        blockMany(['FATHER_COUSIN_FULL', 'FATHER_COUSIN_PATERNAL'], 'GREAT_COUSIN_PATERNAL', `محجوب لوجود ابن ابن العم لأب.`);
    }

    if (heirs['FATHER_COUSIN_FULL'] && !heirs['FATHER_COUSIN_FULL'].is_blocked) {
        block('FATHER_COUSIN_PATERNAL', 'FATHER_COUSIN_FULL', `محجوب لوجود ابن عم الأب الشقيق.`);
    }
}

/**
 * Checks whether an unborn child (fetus / الحمل) is totally excluded/blocked by living heirs.
 * 
 * @param {string} pregnancyRelationKey - Key matching PREGNANCY_OPTIONS (e.g. 'SON_OR_DAUGHTER').
 * @param {import('./Helpers.js').HeirMap} heirs - Active heirs map.
 * @returns {boolean} True if the fetus is blocked in both male and female forms.
 */
export function checkIsPregnancyBlocked(pregnancyRelationKey, heirs) {
    const PREGNANCY_MAP = {
        'SON_OR_DAUGHTER': { maleRel: 'SON', femaleRel: 'DAUGHTER' },
        'GRANDSON_OR_GRANDDAUGHTER': { maleRel: 'GRANDSON', femaleRel: 'GRANDDAUGHTER' },
        'GREAT_GRANDSON_OR_GREAT_GRANDDAUGHTER': { maleRel: 'GREAT_GRANDSON', femaleRel: 'GREAT_GRANDDAUGHTER' },
        'FULL_SIBLING': { maleRel: 'FULL_BROTHER', femaleRel: 'FULL_SISTER' },
        'PATERNAL_SIBLING': { maleRel: 'PATERNAL_BROTHER', femaleRel: 'PATERNAL_SISTER' },
        'MATERNAL_SIBLING': { maleRel: 'MATERNAL_BROTHER', femaleRel: 'MATERNAL_SISTER' },
        'FULL_NEPHEW': { maleRel: 'NEPHEW_FULL' },
        'PATERNAL_NEPHEW': { maleRel: 'NEPHEW_PATERNAL' },
        'FULL_NEPHEW_SON': { maleRel: 'GREAT_NEPHEW_FULL' },
        'PATERNAL_NEPHEW_SON': { maleRel: 'GREAT_NEPHEW_PATERNAL' },
        'FULL_UNCLE': { maleRel: 'UNCLE_FULL' },
        'PATERNAL_UNCLE': { maleRel: 'UNCLE_PATERNAL' },
        'FULL_COUSIN': { maleRel: 'COUSIN_FULL' },
        'PATERNAL_COUSIN': { maleRel: 'COUSIN_PATERNAL' },
        'FULL_COUSIN_SON': { maleRel: 'GREAT_COUSIN_FULL' },
        'PATERNAL_COUSIN_SON': { maleRel: 'GREAT_COUSIN_PATERNAL' },
        'FATHER_FULL_UNCLE': { maleRel: 'FATHER_UNCLE_FULL' },
        'FATHER_PATERNAL_UNCLE': { maleRel: 'FATHER_UNCLE_PATERNAL' },
        'FATHER_FULL_COUSIN': { maleRel: 'FATHER_COUSIN_FULL' },
        'FATHER_PATERNAL_COUSIN': { maleRel: 'FATHER_COUSIN_PATERNAL' }
    };

    const config = PREGNANCY_MAP[pregnancyRelationKey];
    if (!config) return false;

    // Create test heirs map including existing heirs
    const testHeirs = {};
    for (const [k, v] of Object.entries(heirs)) {
        testHeirs[k] = { ...v, is_blocked: false, blocked_by: null };
    }

    const addedKeys = [];
    if (config.maleRel) {
        addedKeys.push(config.maleRel);
        if (!testHeirs[config.maleRel]) {
            testHeirs[config.maleRel] = {
                relationship: config.maleRel,
                count: 1,
                is_blocked: false,
                blocked_by: null
            };
        }
    }
    if (config.femaleRel) {
        addedKeys.push(config.femaleRel);
        if (!testHeirs[config.femaleRel]) {
            testHeirs[config.femaleRel] = {
                relationship: config.femaleRel,
                count: 1,
                is_blocked: false,
                blocked_by: null
            };
        }
    }

    applyBlockingRules(testHeirs, {});

    // Fetus is blocked from direct inheritance if ALL potential forms (male and female) are blocked
    const isFetusSelfBlocked = addedKeys.every(k => testHeirs[k] && testHeirs[k].is_blocked);
    if (!isFetusSelfBlocked) {
        return false;
    }

    // Even if the fetus itself is blocked from inheriting (حجب حرمان),
    // check if the fetus affects another heir's share (حجب نقصان كحجب الأم بالإخوة المحجوبين):
    // 1. Mother (الأم): Blocked siblings still reduce Mother from 1/3 to 1/6 (المحجوب يحجب غيره حجب نقصان)
    if (heirs['MOTHER'] && !heirs['MOTHER'].is_blocked) {
        const isSiblingPregnancy = ['FULL_SIBLING', 'PATERNAL_SIBLING', 'MATERNAL_SIBLING'].includes(pregnancyRelationKey);
        if (isSiblingPregnancy) {
            // Check if mother is already reduced to 1/6 by active descendants
            const hasDescendants = Boolean(
                (heirs['SON'] && !heirs['SON'].is_blocked) ||
                (heirs['DAUGHTER'] && !heirs['DAUGHTER'].is_blocked) ||
                (heirs['GRANDSON'] && !heirs['GRANDSON'].is_blocked) ||
                (heirs['GRANDDAUGHTER'] && !heirs['GRANDDAUGHTER'].is_blocked) ||
                (heirs['GREAT_GRANDSON'] && !heirs['GREAT_GRANDSON'].is_blocked) ||
                (heirs['GREAT_GRANDDAUGHTER'] && !heirs['GREAT_GRANDDAUGHTER'].is_blocked)
            );
            if (!hasDescendants) {
                // Count all existing siblings (full, paternal, maternal) regardless of whether they are blocked
                const siblingKeys = [
                    'FULL_BROTHER', 'FULL_SISTER',
                    'PATERNAL_BROTHER', 'PATERNAL_SISTER',
                    'MATERNAL_BROTHER', 'MATERNAL_SISTER'
                ];
                let existingSiblingsCount = 0;
                for (const sk of siblingKeys) {
                    if (heirs[sk] && heirs[sk].count > 0) {
                        existingSiblingsCount += heirs[sk].count;
                    }
                }
                // If there were < 2 siblings, the birth of this fetus (or twins) would reduce the Mother from 1/3 to 1/6!
                if (existingSiblingsCount < 2) {
                    return false; // Pregnancy affects the Mother's share! Not blocked from affecting the estate.
                }
            }
        }
    }

    // 2. Grandfather (الجد) with siblings in Mu'adah / Muqasamah (المعادة)
    const hasGrandfather = (heirs['PATERNAL_GRANDFATHER'] && !heirs['PATERNAL_GRANDFATHER'].is_blocked) ||
                           (heirs['PATERNAL_GREAT_GRANDFATHER'] && !heirs['PATERNAL_GREAT_GRANDFATHER'].is_blocked);
    if (hasGrandfather) {
        const isSiblingPregnancy = ['FULL_SIBLING', 'PATERNAL_SIBLING'].includes(pregnancyRelationKey);
        if (isSiblingPregnancy) {
            return false;
        }
    }

    return true;
}
