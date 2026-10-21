# What the agent knows (measured, October 2026)

Run the checks yourself: `npm test`, `npm run eval:search`, `npm run eval:engine`.

## 1. Calculating shares (the engine) - strong

- 37 types of heirs, blocking, fixed shares, residuary heirs, awl, radd, the grandfather with siblings,
  and the named cases (Umariyya, Akdariyya, Mushtarakah, Minbariyya, Mubahala, Maliki, Kharqa, Muadah, ...).
- 15 classic cases checked by hand against the textbook answer: all correct.
- Stress test, 4 random seeds, about 110,000 random families: no crash, shares always add up to exactly 1,
  money always adds up to the estate, and 8 legal rules always hold (a son blocks the siblings, the father
  blocks the grandfather and siblings, maternal siblings are blocked by a child or the father,
  a son gets twice a daughter, a husband never gets more than 1/2, ...).
- Every heir gets a written reason in Arabic with the Quran verse or the Moudawana article.

**Open question for a scholar:** when a spouse is the ONLY heir, the engine gives the spouse the whole
estate (radd). Classical Maliki rule is that the rest goes to the treasury, and the usual rule is that
spouses do not get radd. The engine says it clearly in its explanation, so it looks like a choice of the
app's authors. Ask your supervisor if this is the wanted rule. It happens in about 12% of random families,
but much less in real life (a spouse with no other relative is rare).

## 2. Law text (the Moudawana, 400 articles) - medium

The text comes from a clean file (`data/moudawana-clean.txt`, no letter-swap bug). It was checked against an
independent OCR of the same PDF: 97% of the words agree, and the difference is mostly OCR errors in the OCR file. (That check was done on an earlier copy; the file is identical to the one used now.)
Article numbers run 1 to 400 without gaps (checked by `npm test`).

On 47 realistic questions (`eval/search-set.mjs`):

| the right article is... | share of questions |
|---|---|
| first | 55% |
| in the first 3 | 74% |
| in the first 5 | 81% |

The agent receives 5 articles, so it sees the right one in about 4 questions out of 5.
The misses are mostly short definition questions ("what is the Radd?") and questions where several
neighbouring articles talk about the same thing.
The model writes the search query itself, in legal Arabic, which should do better than these raw
questions. Check this with a real key.

How to improve it (in this order):
1. Test with a real model and 20 real questions from your team.
2. Add semantic search (embeddings). 400 short articles cost almost nothing to embed.

## 3. Explaining WHY (reasoning behind the rules) - good, to be tested with a live model

The engine explains each result (base, awl, radd, article numbers). For the reasoning behind the rules the agent
uses `search_fiqh_book`: 100 passages from the book file `data/faraid.rtf` (90 lesson passages with page numbers and
10 summary nodes). Test searches for awl, Akdariyya, Umariyyatan, munasakhat, the grandfather with brothers,
mother's share, estate division and the Moroccan mithqal all find the right lesson.
Limits: the file is a structured explanation of the book, so quotes are "according to the book file, page N".
Page ranges are sometimes wide (for example 133-163 for estate division).

## 4. Not available to the agent yet

- Wills, mandatory bequest (الوصية الواجبة), munasakhat, missing person, pregnancy, iqrar:
  the engine can do them, the agent tool can not. Add one at a time with tests.
- Procedure outside the Moudawana (notary, land registry, taxes, inheritance certificates in practice).
- Other schools or other countries' laws. The engine and the search are Maliki + Moroccan law only.
