// small helpers for cleaning and searching the Moudawana text

// invisible direction marks that come out of the PDF
const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿؜]/g;
const DIACRITICS = /[ً-ٰٟـ]/g;

// words that really start with "أل", leave these alone
const REAL_AL = new Set(["ألف", "ألفاظ", "ألفاظه", "ألزم", "ألزمت", "ألحق", "ألحقت", "ألغي", "ألغيت", "ألغى", "ألقى", "ألقي", "ألفى", "ألا", "ألفا"]);

// The PDF has a bug: the lam-alef ligature comes out with the two letters swapped
// (الأب -> األب, الابن -> االبن, لا -> ال). These rules only touch patterns that
// never happen in normal Arabic. A few words may stay wrong.
export function repairLigatures(s) {
  return s
    .replace(/ا([أإآ])ل/g, "ال$1")
    .replace(/ااl?ل/g, "الا")
    .replace(/لأل/g, "للأ")
    .replace(/([إأ])ال(?=\s|$|[.,،:;)])/g, "$1لا")
    .replace(/أوال/g, "أولا")
    .replace(/(^|\s)ال(?=\s)/g, "$1لا")
    .replace(/(^|[\s(،:؛.-])(أل[ء-ي]*)/g, (m, before, word) => (REAL_AL.has(word) ? m : before + "لأ" + word.slice(2)));
}

export function stripInvisible(s) {
  return s.replace(INVISIBLE, "").replace(/[ \t]+/g, " ").trim();
}

export function clean(s) {
  return repairLigatures(s.replace(INVISIBLE, "").replace(/[ \t]+/g, " ")).trim();
}

// ---------- search ----------
// The PDF swaps every lam-alef: لا -> ال, لأ -> أل, لإ -> إل, لآ -> آل (always, because the font joins these letters).
// So we do not try to repair the articles for searching. We apply the same swap to the
// user's question and compare both in the "swapped" form.
export function corrupt(s) {
  return s.replace(/ل([اأإآ])/g, "$1ل");
}

export function normalizeForSearch(s) {
  return s
    .replace(INVISIBLE, "")
    .replace(DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

// question words and small function words, they say nothing about the topic
const STOP = new Set(
  ("ما ماذا هي هو هم هل من متى كيف لماذا اذا إذا في على عن الى إلى التي الذي الذين ان أن إن لا كان كانت يكون تكون " +
    "كل مع بين او أو ثم هذا هذه ذلك له لها لهم قبل بعد عند حتى ايضا أي اي قد لم لن به بها منه منها فيه فيها هناك " +
    "يعني معنى")
    .split(/\s+/)
    .map((w) => normalizeForSearch(corrupt(w))),
);

// Light stemming so "ترث", "يرث", "الإرث", "ورثة" end up on the same token.
const SUFFIXES = ["ات", "ون", "ين", "ان", "ها", "هم", "ه"];
export function stem(t) {
  if (t.length > 4 && t.startsWith("ال")) t = t.slice(2);
  else if (t.length > 5 && /^[وفبك]ال/.test(t)) t = t.slice(3);

  for (const suf of SUFFIXES) {
    if (t.length > suf.length + 2 && t.endsWith(suf)) { t = t.slice(0, -suf.length); break; }
  }
  if (t.length >= 4 && /^[وي]/.test(t)) t = t.slice(1); // وارث -> ارث, يترك -> ترك
  return t;
}

// text of an article (already in the swapped form)
export function tokenize(s) {
  const out = [];
  for (const raw of normalizeForSearch(s).match(/[\u0621-\u064A0-9a-z]+/g) || []) {
    if (STOP.has(raw)) continue;
    const t = stem(raw);
    if (t.length > 1) out.push(t);
  }
  return out;
}

// A few legal words with the same meaning, so a question does not need the exact word of the article.
const SYNONYMS = [
  ["ارث", "ميراث", "ورثة", "وارث", "توارث", "يرث", "ترث"],
  ["وصية", "موصي", "اوصى", "يوصي"],
  ["تصفية", "مصفي", "تصفي"],
  ["مات", "توفي", "هلك", "موت", "ميت", "موروث"],
  ["دين", "ديون"],
  ["عول", "تعول", "عالت"],
  ["رد", "يرد", "ترد", "ردت"],
];

// The user's question: swap like the PDF (only for the Moudawana), tokenize, then add synonyms.
// Returns [token, weight] pairs: the user's own words count 1, synonyms count less.
export function expandQuery(question, { swapped = true } = {}) {
  const prep = (s) => (swapped ? corrupt(s) : s);
  const weights = new Map();
  for (const t of tokenize(prep(question))) weights.set(t, 1);
  for (const group of SYNONYMS) {
    const stems = group.flatMap((w) => tokenize(prep(w)));
    if (stems.some((t) => weights.get(t) === 1)) {
      for (const t of stems) if (!weights.has(t)) weights.set(t, 0.4);
    }
  }
  return [...weights];
}
