import { readFileSync } from "node:fs";
import Babel from "@babel/standalone";

const src = readFileSync(new URL("./app.js", import.meta.url), "utf8");

let out;
try {
  out = Babel.transform(src, { presets: ["react"] });
} catch (err) {
  console.error("app.js: JSX does not compile");
  console.error(err.message);
  process.exit(1);
}

console.log(`app.js: ok (${src.length} bytes -> ${out.code.length} bytes)`);
