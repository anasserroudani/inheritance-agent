# Inheritance agent

# Inheritance agent

An AI agent that answers inheritance questions (Maliki school, Moroccan Moudawana) on top of the
existing calculation engine, and explains every result.

The model does no maths. It does five things:

1. understands the question and turns it into a list of heirs,
2. calls the engine (`calculate_inheritance`) to get exact shares, the base, awl/radd and the reason for each heir,
3. looks for the evidence: the Moudawana articles (`search_moudawana`), the primary book (`search_fiqh_book`), and the advanced jurisprudence index (`search_alubab_book`),
4. writes the answer as a short proof the user can check.



```
user -> model -> calculate_inheritance (engine, exact fractions)
              -> search_moudawana   (400 articles, Book 6 = inheritance)
              -> search_fiqh_book   (book "دروس في الفرائض", 100 
              passages, page numbers when known)
              -> search_alubab_book (book "اللباب في شرح تحفة الطلاب", structural index with chapter pages)
     <- answer: heirs understood, blocked heirs, share + reason, base/awl/radd, article + book page
```

## Run it in VS Code (first time)

You need Node.js 20 or newer (check with `node -v` in the VS Code terminal; if it fails, install it from nodejs.org).

1. Open the project folder in VS Code (the folder that contains `package.json`).
2. Open the terminal: menu **Terminal > New Terminal**.
3. Install the one dependency:
   ```
   npm install
   ```
4. Put your Google AI Studio key in a file called `.env`:
   - copy `.env.example` and rename the copy to `.env` (same folder as `package.json`),
   - open `.env` and paste the key after `GEMINI_API_KEY=` (no quotes, no spaces).
   - The key comes from https://aistudio.google.com/apikey . Never share `.env` (it is in `.gitignore`).
5. Check that everything works (free, no key used):
   ```
   npm test
   ```
   You should see `# fail 0`.
6. Start the agent:
   ```
   npm run chat        # chat in the terminal
   npm start           # chat page: open http://localhost:3000 in the browser
   ```
7. Ask something, for example:
   - `مات عن زوجة وابن وبنتين، التركة 900000 درهم` (calculation + proof)
   - `لماذا تأخذ الأم ثلث الباقي في العمريتين؟` (explanation from the book)
   - `ما هي حقوق التركة حسب المدونة؟` (law question)

No key yet? `npm run demo` opens the same page with fake answers, only to see the design.

If something fails:
- `Missing GEMINI_API_KEY`: the `.env` file is not in the project folder, or it is named `.env.txt`. Turn on "File name extensions" in Windows.
- Error 429: you hit the free limit of the key. Wait one minute and try again.
- Error 400/404 about the model: set `MODEL=` in `.env` to a model name from https://ai.google.dev/gemini-api/docs/models .

## What it knows

The agent may use ONLY these sources (nothing else is in the index, this is checked: every word of both indexes comes from these files):

| source | file | how it is used |
|---|---|---|
| Moudawana (400 articles) | `data/moudawana-clean.txt` -> `data/moudawana.json` | `search_moudawana` |
| Book "دروس في الفرائض" (RTF: lessons with page numbers + 10 summary nodes) | `data/faraid.rtf` -> `data/fiqh-book.txt` -> `data/fiqh.json` | `search_fiqh_book` |
| The calculation | `engine.js` and `engine/` (unchanged, as received) | `calculate_inheritance` |
| Book "اللباب في شرح تحفة الطلاب" | `data/al_lubab_cleaned_2.txt` -> `data/alubab.json` | `search_alubab_book` |

To change the knowledge: replace the file in `data/`, then run `npm run build:data` and `npm test`.
The book RTF (made by macOS TextEdit) stores the Arabic in the Windows-1256 code page, so it is converted in two steps
(needs pandoc and Python): `pandoc -f rtf -t plain --wrap=none data/faraid.rtf -o /tmp/p.txt` then
`python3 scripts/rtf-to-text.py /tmp/p.txt data/fiqh-book.txt`. The converted file is already in the project.
`KNOWLEDGE.md` has the measured quality and the gaps.

```
npm run eval:search     # does the Moudawana search find the right article? (47 questions)
npm run eval:engine     # 20,000 random families through the engine, with legal rule checks
```

## How the answer is justified

The prompt (`prompt.js`) makes the model answer in this order: heirs understood, blocked heirs and why,
share of each heir with the reason (the engine's own text, with article numbers), the numbers
(base, awl base, radd, special case), the evidence (article, Faraid book page, and Al Lubab chapter details),


## Files

| file | what it does |
|---|---|
| `tool.js` | tool definition, input checks, short result for the model (base, awl, radd included) |
| `search.js` | search in the Moudawana and in the book (free, no embeddings) |
| `agent.js` | the loop: model -> tools -> model |
| `providers.js` | Gemini / DeepSeek / OpenAI / Anthropic, chosen with environment variables |
| `env.js` | reads the `.env` file |
| `prompt.js` | system prompt, including the proof format |
| `arabic.js` | Arabic normalising, stemming, synonyms for the search |
| `chat-handler.js` | what the web page calls: input checks, rate limit, keeps the last calculation for the table |
| `cli.js`, `../server.js`, `../api/chat.js` | terminal chat / local web server / same endpoint for Vercel |
| `../public/` | the chat page (`index.html`, `style.css`, `app.js`) |
| `../scripts/` | `build-moudawana-index.mjs`, `build-fiqh-knowledge.mjs`, `rtf-to-text.py` |

## The chat page

Right-to-left Arabic page: chat bubbles, example questions, and a result table (heir, count, share,
amount) filled **directly from the engine**, not from the text of the model. It shows the badge of
special cases (awl, radd, Akdariyya, ...) and checks that all shares add up to 1.

- The browser sends only the visible chat text. It can not send fake tool results.
- Max 20 questions per minute per IP, so a public page can not burn the API key.
- Colors are at the top of `public/style.css`. Send a screenshot of the app and I match its design.
- For Vercel: `api/chat.js` is the endpoint and `public/` is served as static files. Set
  `GEMINI_API_KEY` (and `PROVIDER`) in the project settings. Not tested on Vercel.
- To put the chat inside the existing app, call `POST /api/chat` with
  `{ message, history: [{role, content}] }`. It returns `{ answer, calc }`.

## Choosing the model

Set `PROVIDER` (default `gemini`) and the matching key. Set `MODEL` to change the model name.
Default names are in `providers.js`.

Gemini prices checked on Google's pricing page (October 2026, per 1M tokens, paid tier):
`gemini-3.1-flash-lite` $0.25 input / $1.50 output (default), `gemini-3.5-flash-lite` $0.30 / $2.50.
Both have a free tier. DeepSeek flash is about $0.15 / $0.60 (not rechecked). One question is about
5,000 input tokens and 400 output tokens, so a fraction of a cent.

Careful with the free tier: Google may use the content to improve its products, and the paid tier does not.
Do not send real client data on a free key. Check with your supervisor before using real cases.

## What is not finished

- Never tested with a live model (no key in my environment). Test with 10 to 20 real questions in
  Arabic, French and English and check the proofs.
- The book file is a structured explanation of the book (lessons, page numbers, 10 summary nodes). The agent quotes it
  with the page number from that file.
- Wills, mandatory bequest, munasakhat, missing person, pregnancy and iqrar work in the engine but
  the agent can not use them yet.
- `constants/pregnancyConstants.js` was missing from engine.zip. I made an empty file (it only
  changes one label). Put the real one back.
- The engine accepts bad input without any error (husband and wife together, 6 wives, ...).
  `tool.js` blocks these before calling it.
