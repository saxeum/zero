import { readFileSync } from "node:fs";
import Babel from "@babel/standalone";

const files = ["src/App.jsx", "src/main.jsx"];

let failed = false;

for (const file of files) {
  const src = readFileSync(new URL(file, import.meta.url), "utf8");
  try {
    const out = Babel.transform(src, { presets: ["react"] });
    console.log(`${file}: ok (${src.length} bytes -> ${out.code.length} bytes)`);
  } catch (err) {
    failed = true;
    console.error(`${file}: JSX does not compile`);
    console.error(err.message);
  }
}

process.exit(failed ? 1 : 0);
