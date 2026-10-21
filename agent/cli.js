// try the agent in the terminal: npm run chat
import readline from "node:readline/promises";
import { loadEnv } from "./env.js";
import { createProvider } from "./providers.js";
import { runTurn } from "./agent.js";

loadEnv(); // reads .env if it exists

let provider;
try {
  provider = createProvider();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

console.log(`Using ${provider.name}. Ctrl+C to quit.`);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let history = [];
const total = { input: 0, output: 0 };

while (true) {
  const question = await rl.question("\n> ");
  try {
    const r = await runTurn(provider, history, question, {
      onTool: (call) => console.log(`  [tool] ${call.name} ${JSON.stringify(call.input).slice(0, 120)}`),
    });
    history = r.history;
    total.input += r.usage.input;
    total.output += r.usage.output;
    console.log(`\n${r.answer}`);
    console.log(`  tokens: in ${r.usage.input} / out ${r.usage.output} (session: in ${total.input} / out ${total.output})`);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
