/**
 * @file Explanations.js
 * @description Standard Arabic relationship names and explanation text formatting utilities.
 */

/**
 * Map of standard heir relationship codes to their authentic Arabic legal names.
 * @type {Object.<string, string>}
 */
export const HEIR_NAMES_AR = {
    'HUSBAND': 'الزوج',
    'WIFE': 'الزوجة',
    'FATHER': 'الأب',
    'MOTHER': 'الأم',
    'SON': 'الابن',
    'DAUGHTER': 'البنت',
    'GRANDSON': 'ابن الابن',
    'GRANDDAUGHTER': 'بنت الابن',
    'GREAT_GRANDSON': 'ابن ابن الابن',
    'GREAT_GRANDDAUGHTER': 'بنت ابن الابن',
    'FULL_BROTHER': 'الأخ الشقيق',
    'FULL_SISTER': 'الأخت الشقيقة',
    'PATERNAL_BROTHER': 'الأخ لأب',
    'PATERNAL_SISTER': 'الأخت لأب',
    'MATERNAL_BROTHER': 'الأخ لأم',
    'MATERNAL_SISTER': 'الأخت لأم',
    'PATERNAL_GRANDFATHER': 'الجد (أبو الأب)',
    'PATERNAL_GREAT_GRANDFATHER': 'أبو الجد (أب أب الأب)',
    'PATERNAL_GRANDMOTHER': 'الجدة (أم الأب)',
    'MATERNAL_GRANDMOTHER': 'الجدة (أم الأم)',
    'MATERNAL_GREAT_GRANDMOTHER': 'الجدة (أم أم الأم)',
    'PATERNAL_GREAT_GRANDMOTHER': 'الجدة (أم أب الأب)',
    'MATERNAL_PATERNAL_GREAT_GRANDMOTHER': 'الجدة (أم أم الأب)',
    'NEPHEW_FULL': 'ابن الأخ الشقيق',
    'NEPHEW_PATERNAL': 'ابن الأخ لأب',
    'GREAT_NEPHEW_FULL': 'ابن ابن الأخ الشقيق',
    'GREAT_NEPHEW_PATERNAL': 'ابن ابن الأخ لأب',
    'UNCLE_FULL': 'العم الشقيق',
    'UNCLE_PATERNAL': 'العم لأب',
    'COUSIN_FULL': 'ابن العم الشقيق',
    'COUSIN_PATERNAL': 'ابن العم لأب',
    'GREAT_COUSIN_FULL': 'ابن ابن العم الشقيق',
    'GREAT_COUSIN_PATERNAL': 'ابن ابن العم لأب',
    'FATHER_UNCLE_FULL': 'عم الأب الشقيق',
    'FATHER_UNCLE_PATERNAL': 'عم الأب لأب',
    'FATHER_COUSIN_FULL': 'ابن عم الأب الشقيق',
    'FATHER_COUSIN_PATERNAL': 'ابن عم الأب لأب',
    'PATERNAL_UNCLE': 'العم الشقيق',
    'FULL_UNCLE': 'العم الشقيق',
    'PATERNAL_UNCLE_PATERNAL': 'العم لأب',
    'FULL_NEPHEW': 'ابن الأخ الشقيق',
    'PATERNAL_NEPHEW': 'ابن الأخ لأب',
    'FULL_COUSIN': 'ابن العم الشقيق',
    'PATERNAL_COUSIN': 'ابن العم لأب'
};

/**
 * Formats Sharia legal explanation text to accurately match the deceased's gender (المتوفى / المتوفاة).
 * 
 * @param {string} whyText - The original explanation template text.
 * @param {'male'|'female'} gender - The gender of the deceased person.
 * @returns {string} The localized explanation text with appropriate gender pronouns.
 */
export function formatExplanation(whyText, gender) {
    if (!whyText) return '';
    if (gender === 'female') {
        return whyText.replace(/المتوفى/g, 'المتوفاة');
    }
    return whyText;
}

/**
 * Returns parent branch designation string, using custom name if provided.
 * @param {Object} mb - Mandatory bequest input item.
 * @param {number} index - Default 1-based index.
 * @returns {string} e.g. "(من الابن المتوفى أحمد)" or "(من الابن المتوفى #1)"
 */
export function getParentDesignation(mb, index) {
    if (!mb) return '';
    if (mb.name && mb.name.trim()) {
        const name = mb.name.trim();
        if (name.startsWith('من ') || name.startsWith('الابن') || name.startsWith('البنت')) {
            return `(${name.startsWith('من ') ? name : 'من ' + name})`;
        }
        return mb.type === 'son' ? `(من الابن المتوفى ${name})` : `(من البنت المتوفية ${name})`;
    }
    return mb.type === 'son' ? `(من الابن المتوفى #${index})` : `(من البنت المتوفية #${index})`;
}

/**
 * Returns parent branch label without parentheses, using custom name if provided.
 * @param {Object} mb - Mandatory bequest input item.
 * @param {number} index - Default 1-based index.
 * @returns {string} e.g. "الابن المتوفى أحمد" or "الابن المتوفى #1"
 */
export function getParentLabel(mb, index) {
    if (!mb) return '';
    if (mb.name && mb.name.trim()) {
        const name = mb.name.trim();
        if (name.startsWith('الابن') || name.startsWith('البنت')) {
            return name;
        }
        return mb.type === 'son' ? `الابن المتوفى ${name}` : `البنت المتوفية ${name}`;
    }
    return mb.type === 'son' ? `الابن المتوفى #${index}` : `البنت المتوفية #${index}`;
}

