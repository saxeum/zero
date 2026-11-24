// Fails the build if the client grows past a budget someone chose on purpose.
//
// The number is not a target, it is a tripwire: a dependency swap that adds 20 kB
// gzipped has to show up as a diff here, not as a surprise six months later.
import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const DIR = "dist/assets";
const BUDGET_KB = 95;

const assets = readdirSync(DIR).filter((file) => /\.(js|css)$/.test(file));

if (assets.length === 0) {
  console.error(`bundle: nothing in ${DIR} — did the build run?`);
  process.exit(1);
}

let total = 0;
for (const file of assets.sort()) {
  const gzip = gzipSync(readFileSync(join(DIR, file))).length;
  total += gzip;
  console.log(`  ${file.padEnd(34)} ${(gzip / 1024).toFixed(1)} kB gzip`);
}

const kb = total / 1024;
const line = `bundle: ${kb.toFixed(1)} kB gzip of ${BUDGET_KB} kB budget`;

if (kb > BUDGET_KB) {
  console.error(`${line} — over by ${(kb - BUDGET_KB).toFixed(1)} kB`);
  console.error("Raise BUDGET_KB only if you can say what the extra bytes buy.");
  process.exit(1);
}

console.log(line);
