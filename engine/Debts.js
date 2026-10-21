/**
 * @file Debts.js
 * @description Manages estate rights, funeral expenses, and debts under Moroccan inheritance law
 * (Mudawwanah Art. 322: حقوق التركة الخمسة مرتبة).
 *
 * Art. 322: "تتعلق بالتركة حقوق خمسة تخرج على الترتيب الآتي:
 * 1 - الحقوق المتعلقة بعين التركة؛
 * 2 - نفقات تجهيز الميت بالمعروف؛
 * 3 - ديون الميت؛
 * 4 - الوصية الصحيحة النافذة؛
 * 5 - المواريث بحسب ترتيبها في هذه المدونة."
 */

export const DEBT_TYPES = {
  IN_REM: {
    id: "in_rem",
    orderNum: 1,
    priorityOrder: 1,
    label: "الحقوق المتعلقة بعين التركة",
    shortLabel: "حق عيني",
    description: "كالرهن، والزكاة المتعلقة بالعين، والمبيع المحبوس بثمنه (تخرج أولاً قبل كل شيء)",
    badgeColor: "amber",
  },
  FUNERAL: {
    id: "funeral",
    orderNum: 2,
    priorityOrder: 2,
    label: "نفقات تجهيز الميت بالمعروف",
    shortLabel: "مؤن التجهيز",
    description: "نفقات الغسل والكفن والدفن والقبر بالمعروف دون إسراف ولا تقتير (تخرج ثانياً)",
    badgeColor: "emerald",
  },
  DEBT: {
    id: "debt",
    orderNum: 3,
    priorityOrder: 3,
    label: "ديون الميت",
    shortLabel: "ديون الميت",
    description: "الديون الثابتة في ذمة الميت سواء كانت لله تعالى أو للعباد (تخرج ثالثاً)",
    badgeColor: "sky",
  },
};

// Aliases for backward compatibility
DEBT_TYPES.PRIVILEGED = DEBT_TYPES.IN_REM;
DEBT_TYPES.ORDINARY = DEBT_TYPES.DEBT;

/**
 * Normalizes any debt type string into one of the 3 canonical Article 322 types.
 */
export function normalizeDebtType(rawType) {
  const t = String(rawType || "").toLowerCase().trim();
  if (t === "in_rem" || t === "ain" || t === "privileged" || t === "r" || t === "p") {
    return "in_rem";
  }
  if (t === "funeral" || t === "tajheez" || t === "f") {
    return "funeral";
  }
  return "debt";
}

/**
 * Normalizes and calculates detailed debts breakdown and priority of settlement according to Art. 322.
 *
 * Priority of settlement:
 * 1. الحقوق المتعلقة بعين التركة (In-Rem Rights) satisfied 1st from the gross estate.
 * 2. نفقات تجهيز الميت بالمعروف (Funeral Expenses) satisfied 2nd from remaining estate.
 * 3. ديون الميت (Deceased Debts) satisfied 3rd from remaining estate.
 * 4. Net Estate (صافي التركة بعد الديون والالتزامات) = max(0, totalEstate - totalDebts).
 * 5. If totalDebts > totalEstate, the estate is marked as insufficient (مستغرقة بالديون).
 *
 * @param {number} totalEstateValue - Gross estate value.
 * @param {Array<Object>|number} debtsInput - Array of debt items or flat numeric debts.
 * @returns {Object} Full breakdown of debts, payments, balances, and insolvency state.
 */
export function calculateDebtsBreakdown(totalEstateValue, debtsInput) {
  const estate = Math.max(0, parseFloat(totalEstateValue) || 0);

  let rawList = [];
  if (Array.isArray(debtsInput)) {
    rawList = debtsInput;
  } else if (typeof debtsInput === "number" || (typeof debtsInput === "string" && debtsInput.trim() !== "")) {
    const num = Math.max(0, parseFloat(debtsInput) || 0);
    if (num > 0) {
      rawList = [
        {
          id: "debt_legacy_1",
          type: "debt",
          amount: num,
          description: "دين مستحق على التركة",
        },
      ];
    }
  }

  // Normalize each item
  const items = rawList
    .filter((d) => d && (d.amount !== undefined || d.description))
    .map((d, idx) => {
      const canonicalType = normalizeDebtType(d.type);
      const amount = Math.max(0, parseFloat(d.amount) || 0);
      const typeInfo =
        canonicalType === "in_rem"
          ? DEBT_TYPES.IN_REM
          : canonicalType === "funeral"
            ? DEBT_TYPES.FUNERAL
            : DEBT_TYPES.DEBT;

      const fallbackDesc =
        canonicalType === "in_rem"
          ? "حق متعلق بعين التركة"
          : canonicalType === "funeral"
            ? "نفقات تجهيز الميت"
            : "دين على الميت";

      return {
        id: d.id || `debt_${Date.now()}_${idx}`,
        type: canonicalType,
        orderNum: typeInfo.orderNum,
        priorityOrder: typeInfo.priorityOrder,
        typeLabel: typeInfo.label,
        typeShortLabel: typeInfo.shortLabel,
        typeDescription: typeInfo.description,
        badgeColor: typeInfo.badgeColor,
        amount,
        description: d.description ? d.description.trim() : fallbackDesc,
      };
    });

  let inRemTotal = 0;
  let funeralTotal = 0;
  let debtsTotal = 0;

  for (const item of items) {
    if (item.type === "in_rem") {
      inRemTotal += item.amount;
    } else if (item.type === "funeral") {
      funeralTotal += item.amount;
    } else {
      debtsTotal += item.amount;
    }
  }

  const totalDebts = inRemTotal + funeralTotal + debtsTotal;
  const hasEstateValue = estate > 0;

  // Priority settlement calculation (Art. 322: عين -> تجهيز -> ديون)
  let inRemPaid = 0;
  let funeralPaid = 0;
  let debtsPaid = 0;
  let netEstate = estate;
  let isInsufficient = false;
  let isExhausted = false;

  if (hasEstateValue) {
    // 1. الحقوق المتعلقة بعين التركة
    inRemPaid = Math.min(estate, inRemTotal);
    const estateAfterInRem = Math.max(0, estate - inRemPaid);

    // 2. نفقات تجهيز الميت بالمعروف
    funeralPaid = Math.min(estateAfterInRem, funeralTotal);
    const estateAfterFuneral = Math.max(0, estateAfterInRem - funeralPaid);

    // 3. ديون الميت
    debtsPaid = Math.min(estateAfterFuneral, debtsTotal);

    netEstate = Math.max(0, estate - totalDebts);
    isInsufficient = totalDebts > estate;
    isExhausted = totalDebts >= estate && totalDebts > 0;
  } else {
    // Estate value not entered (pure fraction calculation)
    inRemPaid = 0;
    funeralPaid = 0;
    debtsPaid = 0;
    netEstate = 0;
    isInsufficient = false;
    isExhausted = false;
  }

  const inRemRemaining = Math.max(0, inRemTotal - inRemPaid);
  const funeralRemaining = Math.max(0, funeralTotal - funeralPaid);
  const debtsRemaining = Math.max(0, debtsTotal - debtsPaid);

  const totalPaid = inRemPaid + funeralPaid + debtsPaid;
  const totalUnpaid = Math.max(0, totalDebts - (hasEstateValue ? estate : 0));

  // Determine individual item settlement status
  const itemizedDebts = items.map((item) => {
    let paidAmount = 0;
    if (!hasEstateValue) {
      paidAmount = 0;
    } else if (item.type === "in_rem") {
      if (inRemTotal <= estate) {
        paidAmount = item.amount;
      } else if (inRemTotal > 0) {
        paidAmount = (item.amount / inRemTotal) * inRemPaid;
      }
    } else if (item.type === "funeral") {
      const estateAfterInRem = Math.max(0, estate - inRemTotal);
      if (estateAfterInRem >= funeralTotal) {
        paidAmount = item.amount;
      } else if (funeralTotal > 0) {
        paidAmount = (item.amount / funeralTotal) * funeralPaid;
      }
    } else {
      // Deceased debts (ديون الميت)
      const estateAfterFuneral = Math.max(0, estate - (inRemTotal + funeralTotal));
      if (estateAfterFuneral >= debtsTotal) {
        paidAmount = item.amount;
      } else if (debtsTotal > 0) {
        paidAmount = (item.amount / debtsTotal) * debtsPaid;
      }
    }

    const unpaidAmount = Math.max(0, item.amount - paidAmount);
    const isFullyPaid = hasEstateValue && unpaidAmount === 0 && item.amount > 0;
    const isPartiallyPaid = hasEstateValue && paidAmount > 0 && unpaidAmount > 0;

    return {
      ...item,
      paidAmount,
      unpaidAmount,
      isFullyPaid,
      isPartiallyPaid,
    };
  });

  // Sort items according to Art. 322 priority: 1. In Rem, 2. Funeral, 3. Debts
  const sortedItemizedDebts = [...itemizedDebts].sort((a, b) => {
    const orderA = a.priorityOrder || 3;
    const orderB = b.priorityOrder || 3;
    return orderA - orderB;
  });

  return {
    totalEstate: estate,
    hasEstateValue,
    items: sortedItemizedDebts,

    // 1 - الحقوق المتعلقة بعين التركة
    inRemTotal,
    inRemPaid,
    inRemRemaining,

    // 2 - نفقات تجهيز الميت بالمعروف
    funeralTotal,
    funeralPaid,
    funeralRemaining,

    // 3 - ديون الميت
    debtsTotal,
    debtsPaid,
    debtsRemaining,

    // Aggregate totals
    totalDebts,
    totalPaid,
    totalUnpaid,
    netEstate,
    isInsufficient,
    isExhausted,

    // Backward compatibility aliases
    privilegedTotal: inRemTotal,
    privilegedPaid: inRemPaid,
    privilegedRemaining: inRemRemaining,
    ordinaryTotal: debtsTotal + funeralTotal,
    ordinaryPaid: debtsPaid + funeralPaid,
    ordinaryRemaining: debtsRemaining + funeralRemaining,
  };
}
