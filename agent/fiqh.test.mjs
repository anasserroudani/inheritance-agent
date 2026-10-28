// Tests for the book tool: it is on when there are passages and off when the index is empty.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

// a small made-up index, only for these tests
const FIXTURE = [
  { source: "كتاب الاختبار", page: "3", title: "العول", text: "العول هو زيادة في عدد السهام ونقص في مقدار الأنصبة، وسببه ازدحام الفروض في المسألة." },
  { source: "كتاب الاختبار", page: "5", title: "الرد", text: "الرد هو عكس العول وهو أن تزيد الأنصبة على أصل المسألة فيرد الباقي على أصحاب الفروض بقدر فروضهم." },
];

// the search module reads its data when it is loaded, so we use a child process
function run(code, env = {}) {
  return execFileSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: path.join(import.meta.dirname, ".."),
    env: { ...process.env, ...env },
    encoding: "utf8",
  }).trim();
}

const tmpFile = (content) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fiqh-")), "index.json");
  fs.writeFileSync(file, content);
  return file;
};

test("with an empty fiqh index the fiqh tool is off", () => {
  const out = run(`import { TOOLS, executeTool } from "./agent/agent.js";
    console.log(JSON.stringify({ tools: TOOLS.map(t => t.name), call: executeTool("search_fiqh_book", {query:"x"}).isError }));`,
    { FIQH_INDEX: tmpFile("[]") });
  const r = JSON.parse(out);
  assert.ok(r.tools.includes("calculate_inheritance") && r.tools.includes("search_moudawana"));
  assert.equal(r.tools.includes("search_fiqh_book"), false);
  assert.equal(r.call, true);
});

test("with a fiqh index the tool is on and finds the right passage", () => {
  const out = run(`import { TOOLS, executeTool } from "./agent/agent.js";
    const r = executeTool("search_fiqh_book", { query: "ما هو العول؟" });
    console.log(JSON.stringify({ tools: TOOLS.map(t => t.name), first: r.content[0] }));`,
    { FIQH_INDEX: tmpFile(JSON.stringify(FIXTURE)) });
  const r = JSON.parse(out);
  assert.ok(r.tools.includes("search_fiqh_book"));
  assert.equal(r.first.page, "3");
  assert.equal(r.first.source, "كتاب الاختبار");
  assert.ok(r.first.text.includes("العول"));
});