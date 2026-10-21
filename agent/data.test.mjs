// Checks the knowledge files: the Moudawana articles and the fiqh book passages.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadEnv } from "./env.js";
import { searchMoudawana, searchFiqh, getArticle, hasFiqh } from "./search.js";

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));

test("Moudawana: 400 articles, numbers 1..400 in order, none empty", () => {
  const a = read("moudawana.json");
  assert.equal(a.length, 400);
  a.forEach((x, i) => {
    assert.equal(x.number, i + 1);
    assert.ok(x.text.length > 10, `article ${x.number} is empty`);
  });
});

test("Moudawana: the inheritance book is complete (articles 321 to 395)", () => {
  for (let n = 321; n <= 395; n++) assert.equal(getArticle(n)?.book, "الكتاب السادس: الميراث", `article ${n}`);
});

test("Moudawana: no letter swap in the text (الأب, not األب)", () => {
  const all = read("moudawana.json").map((x) => x.text).join(" ");
  assert.equal(/األ|اإل|اآل/.test(all), false);
  assert.ok(getArticle(367).text.includes("المباهلة"));
});

test("Moudawana: article 82 keeps its first sentence", () => {
  assert.ok(getArticle(82).text.startsWith("عند حضور الطرفين"));
});

test("Moudawana search: finds the article for a plain question", () => {
  const r = searchMoudawana("ما هي الحقوق المتعلقة بالتركة", 5);
  assert.ok(r.some((x) => x.article === 322));
  assert.equal(searchMoudawana("المادة 351", 3)[0].article, 351);
});

test("fiqh book: loaded, Arabic, no leftover LaTeX", () => {
  assert.ok(hasFiqh);
  const p = read("fiqh.json");
  assert.ok(p.length >= 90);
  for (const x of p) {
    assert.ok(/[؀-ۿ]/.test(x.text));
    assert.equal(/\\(?:frac|text|mathbf|rightarrow)/.test(x.text), false);
    assert.equal(/\[\d+\s*[،,]\s*\d+\]/.test(x.text), false, "citation mark left");
  }
});

test("fiqh book search: finds the right lesson with a page number", () => {
  const awl = searchFiqh("ما هو العول", 3);
  assert.ok(awl.some((x) => x.page === "87-89" && x.text.includes("العول")));
  assert.ok(awl.every((x) => x.source.includes("دروس في الفرائض")));
  const akdariyya = searchFiqh("المسألة الأكدرية", 2);
  assert.equal(akdariyya[0].page, "98");
});

test(".env file: plain, quoted, comment, empty value, and existing variables are kept", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "env-")), ".env");
  fs.writeFileSync(file, 'T_KEY1=abc\nT_KEY2="quoted value"  # comment\n# T_KEY3=no\nT_KEY4=\nT_KEY5=plain # note\nT_KEY6=new\n');
  process.env.T_KEY6 = "already";
  loadEnv(file);
  assert.equal(process.env.T_KEY1, "abc");
  assert.equal(process.env.T_KEY2, "quoted value");
  assert.equal(process.env.T_KEY3, undefined);
  assert.equal(process.env.T_KEY4, undefined);
  assert.equal(process.env.T_KEY5, "plain");
  assert.equal(process.env.T_KEY6, "already");
});
