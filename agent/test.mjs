// Regression tests: classic cases with known answers. Run: node --test agent/test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { runCalculate, validateInput } from "./tool.js";

const H = (...a) => a.map(([relationship, count = 1]) => ({ relationship, count }));
const shares = (r) => Object.fromEntries(r.heirs.map((h) => [h.relationship, h.total_share]));

const CASES = [
  ["Umariyya (husband)", "female", H(["HUSBAND"], ["MOTHER"], ["FATHER"]), { HUSBAND: "1/2", MOTHER: "1/6", FATHER: "1/3" }, "umariyya"],
  ["Umariyya (wife)", "male", H(["WIFE"], ["MOTHER"], ["FATHER"]), { WIFE: "1/4", MOTHER: "1/4", FATHER: "1/2" }, "umariyya"],
  ["Akdariyya", "female", H(["HUSBAND"], ["MOTHER"], ["PATERNAL_GRANDFATHER"], ["FULL_SISTER"]), { HUSBAND: "1/3", MOTHER: "2/9", PATERNAL_GRANDFATHER: "8/27", FULL_SISTER: "4/27" }, "akdariyya"],
  ["Mushtarakah", "female", H(["HUSBAND"], ["MOTHER"], ["MATERNAL_BROTHER", 2], ["FULL_BROTHER"]), { HUSBAND: "1/2", MOTHER: "1/6", MATERNAL_BROTHER: "2/9", FULL_BROTHER: "1/9" }, "mushtarakah"],
  ["Minbariyya", "male", H(["WIFE"], ["DAUGHTER", 2], ["FATHER"], ["MOTHER"]), { WIFE: "1/9", DAUGHTER: "16/27", FATHER: "4/27", MOTHER: "4/27" }, "minbariyya"],
  ["Mubahala (awl 8)", "female", H(["HUSBAND"], ["MOTHER"], ["FULL_SISTER"]), { HUSBAND: "3/8", MOTHER: "1/4", FULL_SISTER: "3/8" }, "awl"],
  ["Umm al-Faroukh (awl 10)", "female", H(["HUSBAND"], ["MOTHER"], ["FULL_SISTER", 2], ["MATERNAL_BROTHER", 2]), { HUSBAND: "3/10", MOTHER: "1/10", FULL_SISTER: "2/5", MATERNAL_BROTHER: "1/5" }, "awl"],
  ["Dinariyya sughra", "male", H(["WIFE", 3], ["PATERNAL_GRANDMOTHER"], ["MATERNAL_GRANDMOTHER"], ["MATERNAL_SISTER", 4], ["FULL_SISTER", 8]), { WIFE: "3/17", PATERNAL_GRANDMOTHER: "1/17", MATERNAL_GRANDMOTHER: "1/17", MATERNAL_SISTER: "4/17", FULL_SISTER: "8/17" }, "awl"],
  ["Maliki grandfather", "female", H(["HUSBAND"], ["MOTHER"], ["PATERNAL_GRANDFATHER"], ["MATERNAL_BROTHER", 2], ["PATERNAL_BROTHER"]), { HUSBAND: "1/2", MOTHER: "1/6", PATERNAL_GRANDFATHER: "1/3", MATERNAL_BROTHER: "0", PATERNAL_BROTHER: "0" }, "malikiyya"],
  ["Radd", "male", H(["DAUGHTER"], ["MOTHER"]), { DAUGHTER: "3/4", MOTHER: "1/4" }, "radd"],
  ["Son blocks grandson", "male", H(["SON"], ["GRANDSON"], ["FATHER"]), { SON: "5/6", FATHER: "1/6", GRANDSON: "0" }],
  ["Father blocks grandfather", "male", H(["FATHER"], ["PATERNAL_GRANDFATHER"], ["MOTHER"]), { FATHER: "2/3", MOTHER: "1/3", PATERNAL_GRANDFATHER: "0" }],
  ["Son blocks brother", "male", H(["SON"], ["FULL_BROTHER"]), { SON: "1", FULL_BROTHER: "0" }],
  ["Wife, 2 sons, daughter, mother", "male", H(["WIFE"], ["SON", 2], ["DAUGHTER"], ["MOTHER"]), { WIFE: "1/8", MOTHER: "1/6", SON: "17/30", DAUGHTER: "17/120" }],
];

for (const [name, gender, heirs, expected, flag] of CASES) {
  test(name, () => {
    const r = runCalculate({ deceased_gender: gender, heirs, total_estate_value: 1_000_000 });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(shares(r), expected);
    assert.equal(r.shares_sum, "1");
    if (flag) assert.equal(r.flags[flag], true, `flag ${flag} should be true`);
  });
}

test("net estate = estate - debts - funeral", () => {
  const r = runCalculate({ heirs: H(["SON"]), total_estate_value: 240000, debts: 10000, funeral_expenses: 5000 });
  assert.equal(r.net_estate, 225000);
});

test("no heirs is rejected", () => assert.equal(runCalculate({ heirs: [] }).ok, false));

const BAD = [
  ["husband + wife", { heirs: H(["HUSBAND"], ["WIFE"]) }],
  ["5 wives", { heirs: H(["WIFE", 5]) }],
  ["unknown code", { heirs: H(["COUSIN_OF_UNCLE"]) }],
  ["count 0", { heirs: H(["SON", 0]) }],
  ["2 fathers", { heirs: H(["FATHER", 2]) }],
  ["duplicate line", { heirs: H(["SON"], ["SON"]) }],
  ["wife but deceased female", { deceased_gender: "female", heirs: H(["WIFE"]) }],
  ["negative debts", { heirs: H(["SON"]), debts: -5 }],
];
for (const [name, input] of BAD) test(`rejects: ${name}`, () => assert.ok(validateInput(input).errors.length > 0));
