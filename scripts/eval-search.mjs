// How good is the Moudawana search?  npm run eval:search
import { SEARCH_SET } from "../eval/search-set.mjs";
import { searchMoudawana } from "../agent/search.js";

let top1 = 0, top3 = 0, top5 = 0, rr = 0;
const misses = [];

for (const [question, good] of SEARCH_SET) {
  const found = searchMoudawana(question, 5).map((r) => r.article);
  const rank = found.findIndex((n) => good.includes(n)) + 1; // 0 = not found
  if (rank === 1) top1++;
  if (rank >= 1 && rank <= 3) top3++;
  if (rank >= 1) top5++;
  if (rank) rr += 1 / rank;
  if (rank !== 1) misses.push({ question, wanted: good, got: found, rank });
}

const n = SEARCH_SET.length;
const pct = (x) => ((100 * x) / n).toFixed(0) + "%";
console.log(`questions: ${n}`);
console.log(`right article first: ${pct(top1)} | in top 3: ${pct(top3)} | in top 5: ${pct(top5)} | MRR: ${(rr / n).toFixed(2)}`);
if (misses.length) {
  console.log("\nnot first:");
  for (const m of misses) console.log(`  [rank ${m.rank || "-"}] ${m.question}  wanted ${m.wanted.join("/")}  got ${m.got.join(",")}`);
}
process.exitCode = 0;
