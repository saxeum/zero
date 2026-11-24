import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("./index.ts", import.meta.url));

test("the entry point starts a server and reports its port", async () => {
  const child = spawn(process.execPath, [entry], {
    env: { ...process.env, PORT: "0", ZERO_DB: ":memory:" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("server did not report a port within 5s")),
        5000,
      );
      let out = "";
      child.stdout.on("data", (chunk) => {
        out += chunk;
        const match = out.match(/listening on (http:\/\/localhost:\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]);
        }
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`server exited early with code ${code}`));
      });
    });

    assert.equal((await fetch(`${base}/api/items`)).status, 200);
  } finally {
    child.kill();
  }
});
