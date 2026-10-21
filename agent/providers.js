// Each provider turns our simple message format into what that API expects.
//
// Our messages look like this:
//   { role: "user", content: "text" }
//   { role: "assistant", content: "text", toolCalls: [{ id, name, input }] }
//   { role: "tool", results: [{ id, name, content, isError }] }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- OpenAI-style APIs (Gemini, DeepSeek, OpenAI, ...) ----------

export function toOpenAITools(tools) {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

export function toOpenAIMessages(system, messages) {
  const out = [{ role: "system", content: system }];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const msg = { role: "assistant", content: m.content || null };
      if (m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map((c) => ({
          id: c.id,
          type: "function",
          function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) },
          // Gemini 3 gives a hidden "thought signature" with each tool call and refuses the next request without it
          ...(c.extra ? { extra_content: c.extra } : {}),
        }));
      }
      out.push(msg);
    } else if (m.role === "tool") {
      for (const r of m.results) out.push({ role: "tool", tool_call_id: r.id, content: r.content });
    }
  }
  return out;
}

async function postJson(url, headers, body) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
    if (res.ok) return res.json();
    const text = await res.text();
    lastError = new Error(`${res.status} from ${new URL(url).host}: ${text.slice(0, 300)}`);
    // free tiers hit rate limits a lot, so wait and try again
    if (res.status !== 429 && res.status < 500) break;
    await sleep(1500 * (attempt + 1));
  }
  throw lastError;
}

export function openaiProvider({ name, baseUrl, apiKey, model }) {
  // Define fallback model hierarchy for Gemini to ensure 99.9% uptime
  const modelsToTry = name === "gemini" 
    ? Array.from(new Set([model, "gemini-1.5-pro", "gemini-1.5-flash"])) 
    : [model];

  return {
    name: `${name}:${model}`,
    async chat({ system, messages, tools }) {
      let data;
      let lastError;

      // Iterate through the model cascade hierarchy
      for (const currentModel of modelsToTry) {
        try {
          data = await postJson(`${baseUrl}/chat/completions`, { authorization: `Bearer ${apiKey}` }, {
            model: currentModel,
            messages: toOpenAIMessages(system, messages),
            tools: toOpenAITools(tools),
          });
          
          // If successful, log the active model and break out of the fallback loop
          if (currentModel !== model) {
            console.log(`[Resilience] Fallback triggered successfully. Switched to model: ${currentModel}`);
          }
          break;
        } catch (err) {
          lastError = err;
          console.warn(`[Warning] Model ${currentModel} failed or busy. Attempting next fallback model...`);
        }
      }

      // If all models in the cascade failed, throw the last captured error
      if (!data) throw lastError;

      const msg = data.choices?.[0]?.message ?? {};
      const toolCalls = (msg.tool_calls ?? []).map((c, i) => {
        let input = {};
        try { input = JSON.parse(c.function.arguments || "{}"); } catch { /* bad json, tool will report empty input */ }
        return { id: c.id || `call_${Date.now()}_${i}`, name: c.function.name, input, ...(c.extra_content ? { extra: c.extra_content } : {}) };
      });
      return {
        text: msg.content ?? "",
        toolCalls,
        usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 },
      };
    },
  };
}

// ---------- Anthropic ----------

export function toAnthropicMessages(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const blocks = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const c of m.toolCalls ?? []) blocks.push({ type: "tool_use", id: c.id, name: c.name, input: c.input });
      out.push({ role: "assistant", content: blocks });
    } else if (m.role === "tool") {
      out.push({
        role: "user",
        content: m.results.map((r) => ({ type: "tool_result", tool_use_id: r.id, content: r.content, ...(r.isError ? { is_error: true } : {}) })),
      });
    }
  }
  return out;
}

export function anthropicProvider({ apiKey, model }) {
  return {
    name: `anthropic:${model}`,
    async chat({ system, messages, tools }) {
      const data = await postJson("https://api.anthropic.com/v1/messages",
        { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        { model, max_tokens: 1200, system, tools, messages: toAnthropicMessages(messages) });
      return {
        text: data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n"),
        toolCalls: data.content.filter((b) => b.type === "tool_use").map((b) => ({ id: b.id, name: b.name, input: b.input })),
        usage: { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 },
      };
    },
  };
}

// ---------- pick one from environment variables ----------
// PROVIDER=gemini (default) | deepseek | openai | anthropic
// MODEL=...   overrides the default model name
// the key comes from GEMINI_API_KEY, DEEPSEEK_API_KEY, OPENAI_API_KEY or ANTHROPIC_API_KEY

export const PRESETS = {
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.1-flash-lite", keyVar: "GEMINI_API_KEY" },
  deepseek: { baseUrl: "https://api.deepseek.com", model: "deepseek-flash", keyVar: "DEEPSEEK_API_KEY" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini", keyVar: "OPENAI_API_KEY" },
  anthropic: { model: "claude-haiku-4-5-20251001", keyVar: "ANTHROPIC_API_KEY" },
};

export function createProvider(env = process.env) {
  const name = (env.PROVIDER || "gemini").toLowerCase();
  const p = PRESETS[name];
  if (!p) throw new Error(`Unknown PROVIDER "${name}". Use: ${Object.keys(PRESETS).join(", ")}`);
  const apiKey = env[p.keyVar];
  if (!apiKey) throw new Error(`Missing ${p.keyVar}. Set it first (PROVIDER is "${name}").`);
  const model = env.MODEL || p.model;
  if (name === "anthropic") return anthropicProvider({ apiKey, model });
  return openaiProvider({ name, baseUrl: env.BASE_URL || p.baseUrl, apiKey, model });
}
