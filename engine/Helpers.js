/**
 * @file Helpers.js
 * @description Helper functions for querying heir existence, gender categories,
 * relationships, and blocking status within active heir maps.
 */

/**
 * @typedef {Object} HeirInfo
 * @property {string} relationship - Standard relationship identifier (e.g. 'SON', 'WIFE').
 * @property {number} count - Number of individuals with this relationship.
 * @property {boolean} [is_blocked] - True if this heir is blocked (محجوب) from inheritance.
 * @property {string|null} [blocked_by] - Relationship of the heir causing the blockage.
 * @property {string} [displayName] - Localized Arabic display name.
 */

/**
 * @typedef {Object.<string, HeirInfo>} HeirMap
 */

/**
 * Checks if there is any active (unblocked) descendant (فرع وارث) in the estate.
 * Descendants include: Son, Daughter, Grandson, Granddaughter, Great-Grandson, Great-Granddaughter.
 * 
 * @param {HeirMap} heirs - Map of active heirs.
 * @returns {boolean} True if any descendant is present and unblocked.
 */
export function hasDescendants(heirs) {
    return ['SON', 'DAUGHTER', 'GRANDSON', 'GRANDDAUGHTER', 'GREAT_GRANDSON', 'GREAT_GRANDDAUGHTER'].some(
        r => heirs[r] && !heirs[r].is_blocked && heirs[r].count > 0
    );
}

/**
 * Checks if there is any active (unblocked) male descendant (فرع وارث مذكر).
 * Includes: Son, Grandson, Great-Grandson.
 * 
 * @param {HeirMap} heirs - Map of active heirs.
 * @returns {boolean} True if any male descendant is present and unblocked.
 */
export function hasMaleDescendants(heirs) {
    return ['SON', 'GRANDSON', 'GREAT_GRANDSON'].some(
        r => heirs[r] && !heirs[r].is_blocked && heirs[r].count > 0
    );
}

/**
 * Checks if there is any active (unblocked) female descendant (فرع وارث مؤنث).
 * Includes: Daughter, Granddaughter, Great-Granddaughter.
 * 
 * @param {HeirMap} heirs - Map of active heirs.
 * @returns {boolean} True if any female descendant is present and unblocked.
 */
export function hasFemaleDescendants(heirs) {
    return ['DAUGHTER', 'GRANDDAUGHTER', 'GREAT_GRANDDAUGHTER'].some(
        r => heirs[r] && !heirs[r].is_blocked && heirs[r].count > 0
    );
}

/**
 * Checks if at least one direct son (ابن صلب) is present and unblocked.
 * 
 * @param {HeirMap} heirs - Map of active heirs.
 * @returns {boolean} True if son is present and unblocked.
 */
export function hasSon(heirs) {
    return !!(heirs['SON'] && !heirs['SON'].is_blocked && heirs['SON'].count > 0);
}

/**
 * Checks if at least one grandson through son (ابن ابن) is present and unblocked.
 * 
 * @param {HeirMap} heirs - Map of active heirs.
 * @returns {boolean} True if grandson is present and unblocked.
 */
export function hasGrandson(heirs) {
    return !!(heirs['GRANDSON'] && !heirs['GRANDSON'].is_blocked && heirs['GRANDSON'].count > 0);
}

/**
 * Checks if the biological father (الأب) is present and unblocked.
 * 
 * @param {HeirMap} heirs - Map of active heirs.
 * @returns {boolean} True if father is present and unblocked.
 */
export function hasFather(heirs) {
    return !!(heirs['FATHER'] && !heirs['FATHER'].is_blocked && heirs['FATHER'].count > 0);
}

/**
 * Checks if any paternal grandfather (الجد الصحيح) is present and unblocked.
 * 
 * @param {HeirMap} heirs - Map of active heirs.
 * @returns {boolean} True if grandfather is present and unblocked.
 */
export function hasGrandfather(heirs) {
    return ['PATERNAL_GRANDFATHER', 'PATERNAL_GREAT_GRANDFATHER'].some(
        r => heirs[r] && !heirs[r].is_blocked && heirs[r].count > 0
    );
}

/**
 * Checks if a spouse (Husband or Wife) is present and unblocked.
 * 
 * @param {HeirMap} heirs - Map of active heirs.
 * @returns {boolean} True if husband or wife is present.
 */
export function hasSpouse(heirs) {
    return ['HUSBAND', 'WIFE'].some(
        r => heirs[r] && !heirs[r].is_blocked && heirs[r].count > 0
    );
}

/**
 * Computes the total count of active, unblocked siblings (إخوة وأخوات) across all branches:
 * Full, Paternal, and Maternal.
 * 
 * @param {HeirMap} heirs - Map of active heirs.
 * @returns {number} Total count of active siblings.
 */
export function getActiveSiblingsCount(heirs) {
    let count = 0;
    const siblingKeys = [
        'FULL_BROTHER', 'FULL_SISTER',
        'PATERNAL_BROTHER', 'PATERNAL_SISTER',
        'MATERNAL_BROTHER', 'MATERNAL_SISTER'
    ];
    for (const key of siblingKeys) {
        if (heirs[key] && !heirs[key].is_blocked) {
            count += heirs[key].count || 0;
        }
    }
    return count;
}

/**
 * Checks if there are two or more siblings (جمع من الإخوة) of any type.
 * Under Islamic law, 2 or more siblings reduce the mother's share from 1/3 to 1/6.
 * 
 * @param {HeirMap} heirs - Map of active heirs.
 * @returns {boolean} True if total active siblings count >= 2.
 */
export function hasMultipleSiblings(heirs) {
    return getActiveSiblingsCount(heirs) > 1;
}
