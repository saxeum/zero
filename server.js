import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function sendFile(res, filePath, contentType) {
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch (err) {
    console.error(err);
    if (err.code === "ENOENT") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("File not found\n");
    } else {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server error\n");
    }
  }
}

const items = [
  { id: "seed-1", text: "learn useEffect" },
  { id: "seed-2", text: "fetch from the server" },
];

const routes = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
};

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host}`);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Server error\n");
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/items") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(items));
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/items") {
    let raw = "";
    for await (const chunk of req) raw += chunk;

    const body = JSON.parse(raw || "{}");
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("text required\n");
      return;
    }

    const item = { id: crypto.randomUUID(), text };
    items.push(item);
    res.writeHead(201, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(item));
    return;
  }
  const route = req.method === "GET" && routes[url.pathname];
  if (route) {
    await sendFile(res, path.join(__dirname, route[0]), route[1]);
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found\n");
  }
});

server.on("error", (err) => {
  console.error(err);
  process.exit(1);
});

server.listen(3000, () => {
  console.log("listening on http://localhost:3000");
});
