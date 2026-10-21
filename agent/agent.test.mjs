// These tests use fake providers and a fake fetch, so they cost nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { runTurn, executeTool, citedArticles, unsupportedArticles } from "./agent.js";
import { searchMoudawana, getArticle } from "./search.js";
import { createProvider, toOpenAIMessages, toAnthropicMessages, openaiProvider } from "./providers.js";

// a fake model: first it asks for the tool, then it answers using the tool result
function fakeModel(toolInput, answerFrom) {
  return {
    async chat({ messages }) {
      const last = messages.at(-1);
      if (last.role === "user") {
        return { text: "", toolCalls: [{ id: "t1", name: "calculate_inheritance", input: toolInput }] };
      }
      return { text: answerFrom(last.results[0]), toolCalls: [] };
    },
  };
}

test("loop: tool call, result goes back, final answer", async () => {
  const model = fakeModel(
    { heirs: [{ relationship: "WIFE" }, { relationship: "SON", count: 2 }], total_estate_value: 80000 },
    (result) => {
      const data = JSON.parse(result.content);
      assert.equal(data.ok, true);
      assert.equal(data.shares_sum, "1");
      const wife = data.heirs.find((h) => h.code === "WIFE");
      return `wife gets ${wife.share} = ${wife.amount}`;
    },
  );
  const r = await runTurn(model, [], "wife and 2 sons, estate 80000");
  assert.equal(r.answer, "wife gets 1/8 = 10000");
  assert.equal(r.usage.calls, 2);
});

test("loop: tool errors are sent back marked as errors", async () => {
  let got;
  const model = fakeModel({ heirs: [{ relationship: "HUSBAND" }, { relationship: "WIFE" }] }, (result) => {
    got = result;
    return "ok";
  });
  await runTurn(model, [], "x");
  assert.equal(got.isError, true);
  assert.match(got.content, /cannot both/);
});

test("loop stops after 6 steps", async () => {
  const model = { async chat() { return { text: "", toolCalls: [{ id: "t", name: "search_moudawana", input: { query: "الارث" } }] }; } };
  const r = await runTurn(model, [], "loop");
  assert.match(r.answer, /Sorry/);
  assert.equal(r.usage.calls, 6);
});

test("unknown tool gives an error, no crash", () => {
  assert.equal(executeTool("nope", {}).isError, true);
});

// ---- providers ----

const history = [
  { role: "user", content: "hello" },
  { role: "assistant", content: "", toolCalls: [{ id: "a1", name: "search_moudawana", input: { query: "x" } }] },
  { role: "tool", results: [{ id: "a1", name: "search_moudawana", content: "[]", isError: false }] },
];

test("openai format: tool calls and results", () => {
  const out = toOpenAIMessages("SYS", history);
  assert.deepEqual(out.map((m) => m.role), ["system", "user", "assistant", "tool"]);
  assert.equal(out[2].tool_calls[0].function.arguments, '{"query":"x"}');
  assert.equal(out[3].tool_call_id, "a1");
});

test("anthropic format: tool_use and tool_result blocks", () => {
  const out = toAnthropicMessages(history);
  assert.equal(out[1].content[0].type, "tool_use");
  assert.equal(out[2].content[0].type, "tool_result");
});

test("gemini-style provider works end to end with a fake network", async () => {
  const sent = [];
  const replies = [
    { choices: [{ message: { content: null, tool_calls: [{ id: "", type: "function", function: { name: "calculate_inheritance", arguments: JSON.stringify({ heirs: [{ relationship: "DAUGHTER" }, { relationship: "MOTHER" }] }) } }] } }], usage: { prompt_tokens: 100, completion_tokens: 10 } },
    { choices: [{ message: { content: "Done" } }], usage: { prompt_tokens: 200, completion_tokens: 5 } },
  ];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    sent.push({ url, body: JSON.parse(opts.body), auth: opts.headers.authorization });
    return { ok: true, json: async () => replies.shift() };
  };
  try {
    const provider = openaiProvider({ name: "gemini", baseUrl: "https://example.test/v1", apiKey: "KEY", model: "m1" });
    const r = await runTurn(provider, [], "daughter and mother");
    assert.equal(r.answer, "Done");
    assert.equal(r.usage.input, 300);
    assert.equal(sent[0].url, "https://example.test/v1/chat/completions");
    assert.equal(sent[0].auth, "Bearer KEY");
    assert.equal(sent[0].body.tools[0].type, "function");
    // the second request carries the tool result, with an id even though the provider sent an empty one
    const toolMsg = sent[1].body.messages.at(-1);
    assert.equal(toolMsg.role, "tool");
    assert.ok(toolMsg.tool_call_id);
    assert.equal(JSON.parse(toolMsg.content).heirs.find((h) => h.code === "DAUGHTER").share, "3/4");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("citedArticles reads Arabic, Latin and Eastern digits, lists and 'art.'", () => {
  assert.deepEqual([...citedArticles("المادة 329 و337، والمادة ٣٤٨، article 12, art. 5")].sort((a, b) => a - b), [5, 12, 329, 337, 348]);
});

test("unsupportedArticles: an article is fine only if a tool result has it", () => {
  const results = ['{"why":"(المادة 348 من مدونة الأسرة)"}', '[{"article":343,"text":"..."}]'];
  assert.deepEqual(unsupportedArticles("حسب المادة 348 والمادة 343", results), []);
  assert.deepEqual(unsupportedArticles("المادة 348 والمادة 329", results), [329]);
});

test("loop: an article from memory is sent back for a check, then the fixed answer is returned", async () => {
  let calls = 0;
  const model = {
    async chat({ messages }) {
      calls++;
      const last = messages.at(-1);
      if (last.role === "user" && last.content.startsWith("Check failed")) {
        assert.match(last.content, /article 999/);
        return { text: "answer without a bad article", toolCalls: [] };
      }
      if (last.role === "user") return { text: "", toolCalls: [{ id: "t1", name: "search_moudawana", input: { query: "المادة 351" } }] };
      return { text: "see المادة 351 and المادة 999", toolCalls: [] }; // 351 comes from the search result, 999 does not
    },
  };
  const r = await runTurn(model, [], "question");
  assert.equal(r.answer, "answer without a bad article");
  assert.equal(calls, 3);
});

test("the model gets the engine's own steps (base, correction), not an internal base number", () => {
  const out = executeTool("calculate_inheritance", {
    deceased_gender: "male", total_estate_value: 900000,
    heirs: [{ relationship: "WIFE" }, { relationship: "SON" }, { relationship: "DAUGHTER", count: 2 }],
  }).content;
  assert.equal("base_asl" in out, false);
  const text = out.steps.map((x) => x.title + " " + x.text).join(" ");
  assert.match(text, /\(8\)/);   // base 8
  assert.match(text, /32/);       // corrected to 32
});

test("gemini 3: the thought signature of a tool call is sent back in the next request", async () => {
  const sig = { google: { thought_signature: "CvcQAdHN2OekY10ClPFkYA==" } };
  const call = (name, args, extra) => ({ id: "", type: "function", function: { name, arguments: JSON.stringify(args) }, ...(extra ? { extra_content: extra } : {}) });
  const replies = [
    // two calls at once: only the first one carries a signature (that is how Gemini does it)
    { choices: [{ message: { content: null, tool_calls: [
      call("calculate_inheritance", { heirs: [{ relationship: "DAUGHTER" }, { relationship: "MOTHER" }] }, sig),
      call("search_moudawana", { query: "السدس" }),
    ] } }], usage: {} },
    { choices: [{ message: { content: "Done" } }], usage: {} },
  ];
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    sent.push(JSON.parse(opts.body));
    return { ok: true, json: async () => replies.shift() };
  };
  try {
    const provider = openaiProvider({ name: "gemini", baseUrl: "https://example.test/v1", apiKey: "KEY", model: "m1" });
    await runTurn(provider, [], "test");
    const assistant = sent[1].messages.find((m) => m.role === "assistant");
    assert.deepEqual(assistant.tool_calls[0].extra_content, sig);
    assert.equal("extra_content" in assistant.tool_calls[1], false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("createProvider: default is gemini, needs a key, unknown name fails", () => {
  assert.throws(() => createProvider({}), /GEMINI_API_KEY/);
  assert.match(createProvider({ GEMINI_API_KEY: "k" }).name, /^gemini:/);
  assert.match(createProvider({ PROVIDER: "deepseek", DEEPSEEK_API_KEY: "k", MODEL: "x" }).name, /^deepseek:x$/);
  assert.throws(() => createProvider({ PROVIDER: "nope" }), /Unknown PROVIDER/);
});

// ---- Moudawana search ----

test("all articles are there", () => {
  for (const n of [1, 82, 321, 342, 366, 400]) assert.ok(getArticle(n), `article ${n} missing`);
  assert.equal(getArticle(401), null);
});

test("search finds the right article", () => {
  assert.equal(searchMoudawana("المادة 351")[0].article, 351);
  assert.ok(searchMoudawana("أصحاب الربع الزوج والزوجة").some((r) => r.article === 343));
  assert.ok(searchMoudawana("مسألة الغراوين").some((r) => r.article === 366));
  assert.ok(searchMoudawana("المسألة المشتركة الإخوة لأم والأشقاء").some((r) => r.article === 365));
  assert.ok(searchMoudawana("المسألة الأكدرية").some((r) => r.article === 361));
});
