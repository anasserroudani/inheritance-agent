// Reads the file ".env" (next to package.json) and puts its lines in process.env.
// Lines look like KEY=value. Variables that already exist are not replaced.
import fs from "node:fs";

export function loadEnv(file = new URL("../.env", import.meta.url)) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return; // no .env file, that is fine
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    let value = m[2];
    const quoted = /^"([^"]*)"/.exec(value) || /^'([^']*)'/.exec(value);
    if (quoted) value = quoted[1];
    else value = value.replace(/\s+#.*$/, ""); // comment after the value
    if (value && process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
