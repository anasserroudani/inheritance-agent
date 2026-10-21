/**
 * @file MandatoryBequest.js
 * @description Implements statutory Mandatory Bequests (الوصية الواجبة) under Moroccan Law (Articles 369-372 of the Family Code).
 * Evaluates hypothetical shares for predeceased descendants, applies sub-problem deductions,
 * distributes branch shares to grandchildren and great-grandchildren, and enforces the 1/3 estate cap.
 */

import Fraction from '../fraction.js';

/**
 * Calculates statutory Mandatory Bequests (الوصية الواجبة) for qualifying descendants.
 * 
 * Statutory Principles (Moroccan Mudawwana Arts. 369–372):
 * 1. Preliminary Problem (العمل التمهيدي):
 *    Predeceased children enter the problem as if living. If living grandchildren inherit by ta'seeb in the main estate,
 *    predeceased children enter at the grandson level.
 * 2. Deductions in Sub-Problems:
 *    - Spouse of deceased child: 1/8 (for wife) or 1/4 (for husband) if surviving.
 *    - Mother of deceased child: 1/6 if surviving; if deceased, the paternal grandmother (أم الأب = mother of main deceased) inherits 1/6.
 *    - Father of main deceased: inherits 1/6 as paternal grandfather (أب الأب) of the deceased child.
 * 3. Great-Grandchildren Sub-Problem:
 *    - Paternal great-grandfather (أب أب الأب) inherits 1/6.
 *    - Spouse of deceased grandson inherits 1/8.
 *    - Paternal great-grandmother (أم أب الأب) receives 0 under Maliki jurisprudence.
 * 4. Maximum Limit:
 *    The sum of all mandatory bequests cannot exceed 1/3 of the net estate (ثلث التركة).
 *    If exceeded, bequests are reduced pro-rata (بالمحاصة).
 * 
 * @param {Object} params
 * @param {import('./Helpers.js').HeirMap} params.heirs - Processed active heirs map.
 * @param {import('./Calculator.js').CaseData} params.caseData - Case configuration data.
 * @param {Array<Object>} params.wills_input - Array of voluntary wills.
 * @param {boolean} params.heirs_approved_excess - Whether heirs approved wills exceeding 1/3.
 * @param {number} params.net_estate - Net estate value after debts/funeral.
 * @param {Function} params.CalculatorClass - Calculator constructor reference for preliminary evaluation.
 * @returns {{
 *   cost: number,
 *   fraction: Fraction,
 *   isScaled: boolean,
 *   list: Array<{
 *     id: string,
 *     type: 'son'|'daughter',
 *     executed_parent_share: Fraction,
 *     executed_entry_fraction: Fraction,
 *     entry_value: number,
 *     kids: Array<{type: string, count: number, share: Fraction, value: number}>
 *   }>
 * }}
 */
export function calculateMandatoryBequests({
    heirs,
    caseData,
    wills_input = [],
    heirs_approved_excess = false,
    net_estate = 0,
    CalculatorClass
}) {
    if (!caseData.mandatoryBequests || caseData.mandatoryBequests.length === 0) {
        return { cost: 0, fraction: new Fraction(0), isScaled: false, list: [] };
    }

    /**
     * Helper to check if a grandchild type is already an unblocked heir in the main estate.
     * @param {'grandson'|'granddaughter'|'great_grandson'|'great_granddaughter'} type
     * @returns {boolean}
     */
    const isUnblockedHeir = (type) => {
        const map = {
            'grandson': 'GRANDSON',
            'granddaughter': 'GRANDDAUGHTER',
            'great_grandson': 'GREAT_GRANDSON',
            'great_granddaughter': 'GREAT_GRANDDAUGHTER'
        };
        const heirKey = map[type];
        return heirKey && heirs[heirKey] && !heirs[heirKey].is_blocked;
    };

    // =========================================================================
    // 1. Build temporary heirs list for Preliminary Problem (العمل التمهيدي)
    // =========================================================================
    const tempHeirsMap = {};
    for (const h of Object.values(heirs)) {
        if (!h.is_blocked && h.count > 0) {
            tempHeirsMap[h.relationship] = h.count;
        }
    }

    let deceasedSonsCount = 0;
    let deceasedDaughtersCount = 0;
    let virtualGrandsonCount = 0;

    const hasLivingGrandchildrenAsHeirs = (heirs['GRANDSON'] && !heirs['GRANDSON'].is_blocked) ||
        (heirs['GRANDDAUGHTER'] && !heirs['GRANDDAUGHTER'].is_blocked);

    for (const mb of caseData.mandatoryBequests) {
        if (mb.type === 'son') {
            if (hasLivingGrandchildrenAsHeirs) {
                virtualGrandsonCount++;
            } else {
                deceasedSonsCount++;
            }
        } else if (mb.type === 'daughter') {
            deceasedDaughtersCount++;
        }
    }

    if (deceasedSonsCount > 0) {
        tempHeirsMap['SON'] = (tempHeirsMap['SON'] || 0) + deceasedSonsCount;
    }
    if (virtualGrandsonCount > 0) {
        tempHeirsMap['GRANDSON'] = (tempHeirsMap['GRANDSON'] || 0) + virtualGrandsonCount;
    }
    if (deceasedDaughtersCount > 0) {
        tempHeirsMap['DAUGHTER'] = (tempHeirsMap['DAUGHTER'] || 0) + deceasedDaughtersCount;
    }

    const tempHeirsList = Object.entries(tempHeirsMap).map(([relationship, count]) => ({
        relationship,
        count
    }));

    // =========================================================================
    // 2. Run preliminary calculation to find hypothetical share of deceased children
    // =========================================================================
    const tempCaseData = {
        id: 'temp-mb-calc',
        name: caseData.name,
        gender: caseData.gender,
        total_estate_value: 1,
        funeral_expenses: 0,
        debts: 0,
        heirs: tempHeirsList,
        wills: [],
        mandatoryBequests: []
    };

    const tempCalc = new CalculatorClass(tempCaseData);
    tempCalc.calculate();

    let voluntaryWillsFraction = new Fraction(0);
    if (!heirs_approved_excess) {
        for (const will of wills_input) {
            if (will.valueType === 'fraction') {
                const parts = (will.value || '1/3').split('/');
                const num = parseInt(parts[0], 10) || 0;
                const den = parseInt(parts[1], 10) || 1;
                voluntaryWillsFraction = voluntaryWillsFraction.add(new Fraction(num, den));
            } else if (will.valueType === 'percentage') {
                const val = parseInt(will.value, 10) || 0;
                voluntaryWillsFraction = voluntaryWillsFraction.add(new Fraction(val, 100));
            }
        }
        if (voluntaryWillsFraction.greaterThan(new Fraction(1, 3))) {
            voluntaryWillsFraction = new Fraction(1, 3);
        }
    }
    const scaleFactorForWills = new Fraction(1).sub(voluntaryWillsFraction);

    let singleSonShare = new Fraction(0);
    if (tempCalc.results['SON']) {
        singleSonShare = tempCalc.results['SON'].share.div(new Fraction(tempCalc.results['SON'].count)).mul(scaleFactorForWills);
    } else if (tempCalc.results['GRANDSON']) {
        singleSonShare = tempCalc.results['GRANDSON'].share.div(new Fraction(tempCalc.results['GRANDSON'].count)).mul(scaleFactorForWills);
    }

    let singleDaughterShare = new Fraction(0);
    if (tempCalc.results['DAUGHTER']) {
        singleDaughterShare = tempCalc.results['DAUGHTER'].share.div(new Fraction(tempCalc.results['DAUGHTER'].count)).mul(scaleFactorForWills);
    }

    // =========================================================================
    // 3. Process each mandatory bequest branch
    // =========================================================================
    const list = [];
    let totalFraction = new Fraction(0);

    for (const mb of caseData.mandatoryBequests) {
        const parentShare = mb.type === 'son' ? singleSonShare : singleDaughterShare;
        if (parentShare.equals(new Fraction(0))) {
            continue;
        }

        // Deduct spouse, mother/paternal grandmother, and grandfather shares from parent's share
        let spouseDen = 1;
        let spouseNum = 0;
        let motherDen = 1;
        let motherNum = 0;
        let gfDen = 1;
        let gfNum = 0;

        const totalSons = parseInt(mb.sonsCount, 10) || 0;
        const totalDaughters = parseInt(mb.daughtersCount, 10) || 0;
        const totalGreatSons = parseInt(mb.greatSonsCount, 10) || 0;
        const totalGreatDaughters = parseInt(mb.greatDaughtersCount, 10) || 0;

        const hasKids = totalSons > 0 || totalDaughters > 0 || totalGreatSons > 0 || totalGreatDaughters > 0;

        if (mb.spouseAlive) {
            if (mb.type === 'son') {
                spouseNum = 1;
                spouseDen = hasKids ? 8 : 4;
            } else {
                spouseNum = 1;
                spouseDen = hasKids ? 4 : 2;
            }
        }

        const isFemaleDeceased = caseData.deceased_gender === 'female' ||
            caseData.gender === 'female' ||
            (heirs['HUSBAND'] && !heirs['HUSBAND'].is_blocked);

        if (isFemaleDeceased) {
            // Main deceased was female (the mother of the deceased child)
            // 1. Father of the child is the HUSBAND of the main deceased
            if (heirs['HUSBAND'] && !heirs['HUSBAND'].is_blocked) {
                gfNum = 1;
                gfDen = 6;
            }
            // 2. Maternal grandmother of the child is the MOTHER of the main deceased
            // Under Moroccan / Islamic law, father does NOT block maternal grandmother
            const hasMaternalGM = (heirs['MOTHER'] && !heirs['MOTHER'].is_blocked) ||
                (heirs['MATERNAL_GRANDMOTHER'] && !heirs['MATERNAL_GRANDMOTHER'].is_blocked);
            if (hasMaternalGM) {
                motherNum = 1;
                motherDen = 6;
            }
        } else {
            // Main deceased was male (the father of the deceased child)
            const hasGM = (heirs['MOTHER'] && !heirs['MOTHER'].is_blocked) ||
                (heirs['PATERNAL_GRANDMOTHER'] && !heirs['PATERNAL_GRANDMOTHER'].is_blocked) ||
                (heirs['MATERNAL_GRANDMOTHER'] && !heirs['MATERNAL_GRANDMOTHER'].is_blocked);

            if (mb.motherAlive) {
                motherNum = 1;
                motherDen = hasKids ? 6 : 3;
            } else if (hasGM) {
                // When the mother is deceased, paternal grandmother (main deceased's mother) gets 1/6
                motherNum = 1;
                motherDen = 6;
            }

            const hasGF = (heirs['PATERNAL_GRANDFATHER'] && !heirs['PATERNAL_GRANDFATHER'].is_blocked) ||
                (heirs['FATHER'] && !heirs['FATHER'].is_blocked);
            if (hasGF) {
                gfNum = 1;
                gfDen = 6;
            }
        }

        const spouseFraction = new Fraction(spouseNum, spouseDen);
        const motherFraction = new Fraction(motherNum, motherDen);
        const gfFraction = new Fraction(gfNum, gfDen);
        const combinedDeductions = spouseFraction.add(motherFraction).add(gfFraction);

        const kidsFractionOfParent = combinedDeductions.greaterThan(new Fraction(1))
            ? new Fraction(0)
            : new Fraction(1).sub(combinedDeductions);

        const childrenShare = (mb.type === 'son' && hasLivingGrandchildrenAsHeirs)
            ? parentShare
            : parentShare.mul(kidsFractionOfParent);

        // Distribute childrenShare among grandchildren / great-grandchildren
        const kids = [];
        let entryFraction = new Fraction(0);

        if (mb.type === 'son') {
            const hasDirect = totalSons > 0 || totalDaughters > 0;
            const hasGreat = totalGreatSons > 0 || totalGreatDaughters > 0;

            if (hasDirect) {
                const directSonsCount = totalSons;
                const directDaughtersCount = totalDaughters;
                const deceasedGrandsonsCount = hasGreat ? 1 : 0;

                const totalShares = (directSonsCount + deceasedGrandsonsCount) * 2 + directDaughtersCount * 1;

                if (totalShares > 0) {
                    let grandsonBaseShare = childrenShare.mul(new Fraction(2, totalShares));
                    let granddaughterBaseShare = childrenShare.mul(new Fraction(1, totalShares));
                    let deceasedGrandsonShare = (mb.type === 'son' && hasLivingGrandchildrenAsHeirs)
                        ? childrenShare
                        : childrenShare.mul(new Fraction(2, totalShares));

                    let gSpouseDen = 1;
                    let gSpouseNum = 0;
                    let gMotherDen = 1;
                    let gMotherNum = 0;

                    if (mb.greatSpouseAlive) {
                        gSpouseNum = 1;
                        gSpouseDen = 8;
                    }
                    if (mb.spouseAlive) {
                        gMotherNum = 1;
                        gMotherDen = 6;
                    }
                    let gGrandfatherDen = 1;
                    let gGrandfatherNum = 0;
                    const hasGF2 = (heirs['PATERNAL_GRANDFATHER'] && !heirs['PATERNAL_GRANDFATHER'].is_blocked) ||
                        (heirs['FATHER'] && !heirs['FATHER'].is_blocked);
                    if (hasGF2) {
                        gGrandfatherNum = 1;
                        gGrandfatherDen = 6;
                    }

                    const gSpouseFraction = new Fraction(gSpouseNum, gSpouseDen);
                    const gMotherFraction = new Fraction(gMotherNum, gMotherDen);
                    const gGrandfatherFraction = new Fraction(gGrandfatherNum, gGrandfatherDen);
                    const gCombinedDeductions = gSpouseFraction.add(gMotherFraction).add(gGrandfatherFraction);

                    const deductedShare = deceasedGrandsonShare.mul(
                        gCombinedDeductions.greaterThan(new Fraction(1)) ? new Fraction(1) : gCombinedDeductions
                    );

                    const greatChildrenShare = deceasedGrandsonShare.sub(deductedShare);

                    const finalGrandsonShare = grandsonBaseShare;
                    const finalGranddaughterShare = granddaughterBaseShare;

                    if (directSonsCount > 0 && !isUnblockedHeir('grandson')) {
                        kids.push({
                            type: 'grandson',
                            count: directSonsCount,
                            share: finalGrandsonShare
                        });
                        entryFraction = entryFraction.add(finalGrandsonShare.mul(new Fraction(directSonsCount)));
                    }
                    if (directDaughtersCount > 0 && !isUnblockedHeir('granddaughter')) {
                        kids.push({
                            type: 'granddaughter',
                            count: directDaughtersCount,
                            share: finalGranddaughterShare
                        });
                        entryFraction = entryFraction.add(finalGranddaughterShare.mul(new Fraction(directDaughtersCount)));
                    }

                    const totalGreatShares = totalGreatSons * 2 + totalGreatDaughters * 1;
                    if (totalGreatShares > 0) {
                        if (totalGreatSons > 0 && !isUnblockedHeir('great_grandson')) {
                            const gSonShare = greatChildrenShare.mul(new Fraction(2, totalGreatShares));
                            kids.push({
                                type: 'great_grandson',
                                count: totalGreatSons,
                                share: gSonShare
                            });
                            entryFraction = entryFraction.add(gSonShare.mul(new Fraction(totalGreatSons)));
                        }
                        if (totalGreatDaughters > 0 && !isUnblockedHeir('great_granddaughter')) {
                            const gDaughterShare = greatChildrenShare.mul(new Fraction(1, totalGreatShares));
                            kids.push({
                                type: 'great_granddaughter',
                                count: totalGreatDaughters,
                                share: gDaughterShare
                            });
                            entryFraction = entryFraction.add(gDaughterShare.mul(new Fraction(totalGreatDaughters)));
                        }
                    }
                }
            } else if (hasGreat) {
                let gSpouseDen = 1;
                let gSpouseNum = 0;
                let gMotherDen = 1;
                let gMotherNum = 0;

                if (mb.greatSpouseAlive) {
                    gSpouseNum = 1;
                    gSpouseDen = 8;
                }
                if (mb.spouseAlive) {
                    gMotherNum = 1;
                    gMotherDen = 6;
                }
                let gGrandfatherDen = 1;
                let gGrandfatherNum = 0;
                const hasGF2 = (heirs['PATERNAL_GRANDFATHER'] && !heirs['PATERNAL_GRANDFATHER'].is_blocked) ||
                    (heirs['FATHER'] && !heirs['FATHER'].is_blocked);
                if (hasGF2) {
                    gGrandfatherNum = 1;
                    gGrandfatherDen = 6;
                }

                const gSpouseFraction = new Fraction(gSpouseNum, gSpouseDen);
                const gMotherFraction = new Fraction(gMotherNum, gMotherDen);
                const gGrandfatherFraction = new Fraction(gGrandfatherNum, gGrandfatherDen);
                const gCombinedDeductions = gSpouseFraction.add(gMotherFraction).add(gGrandfatherFraction);
                const gKidsFractionOfParent = gCombinedDeductions.greaterThan(new Fraction(1))
                    ? new Fraction(0)
                    : new Fraction(1).sub(gCombinedDeductions);

                const greatChildrenShare = childrenShare.mul(gKidsFractionOfParent);

                const totalGreatShares = totalGreatSons * 2 + totalGreatDaughters * 1;
                if (totalGreatShares > 0) {
                    if (totalGreatSons > 0 && !isUnblockedHeir('great_grandson')) {
                        const gSonShare = greatChildrenShare.mul(new Fraction(2, totalGreatShares));
                        kids.push({
                            type: 'great_grandson',
                            count: totalGreatSons,
                            share: gSonShare
                        });
                        entryFraction = entryFraction.add(gSonShare.mul(new Fraction(totalGreatSons)));
                    }
                    if (totalGreatDaughters > 0 && !isUnblockedHeir('great_granddaughter')) {
                        const gDaughterShare = greatChildrenShare.mul(new Fraction(1, totalGreatShares));
                        kids.push({
                            type: 'great_granddaughter',
                            count: totalGreatDaughters,
                            share: gDaughterShare
                        });
                        entryFraction = entryFraction.add(gDaughterShare.mul(new Fraction(totalGreatDaughters)));
                    }
                }
            }
        } else {
            // Daughter branch
            if (totalSons > 0 || totalDaughters > 0) {
                const totalShares = totalSons * 2 + totalDaughters * 1;
                if (totalSons > 0) {
                    const sonShare = childrenShare.mul(new Fraction(2, totalShares));
                    kids.push({
                        type: 'grandson_of_daughter',
                        count: totalSons,
                        share: sonShare
                    });
                    entryFraction = entryFraction.add(sonShare.mul(new Fraction(totalSons)));
                }
                if (totalDaughters > 0) {
                    const daughterShare = childrenShare.mul(new Fraction(1, totalShares));
                    kids.push({
                        type: 'granddaughter_of_daughter',
                        count: totalDaughters,
                        share: daughterShare
                    });
                    entryFraction = entryFraction.add(daughterShare.mul(new Fraction(totalDaughters)));
                }
            }
        }

        list.push({
            id: mb.id,
            name: mb.name || '',
            type: mb.type,
            parent_share: parentShare,
            entry_fraction: entryFraction,
            kids
        });

        totalFraction = totalFraction.add(entryFraction);
    }

    // =========================================================================
    // 4. Cap at 1/3 of the net estate (ثلث التركة)
    // =========================================================================
    const oneThird = new Fraction(1, 3);
    let isScaled = false;
    let scaleFactor = new Fraction(1);

    if (totalFraction.greaterThan(oneThird)) {
        isScaled = true;
        scaleFactor = oneThird.div(totalFraction);
        totalFraction = oneThird;
    }

    // =========================================================================
    // 5. Build final list of nested bequest distributions
    // =========================================================================
    const processedBequests = [];
    const netEstateVal = net_estate;

    for (const mb of list) {
        const executedEntryFraction = mb.entry_fraction.mul(scaleFactor);
        const entryValue = executedEntryFraction.valueOf() * netEstateVal;

        const kids = [];
        for (const kid of mb.kids) {
            const scaledKidShare = kid.share.mul(scaleFactor);
            kids.push({
                type: kid.type,
                count: kid.count,
                share: scaledKidShare,
                value: scaledKidShare.valueOf() * netEstateVal
            });
        }

        processedBequests.push({
            id: mb.id,
            name: mb.name || '',
            type: mb.type,
            executed_parent_share: mb.parent_share,
            executed_entry_fraction: executedEntryFraction,
            entry_value: entryValue,
            kids
        });
    }

    return {
        cost: totalFraction.valueOf() * netEstateVal,
        fraction: totalFraction,
        isScaled,
        list: processedBequests
    };
}
