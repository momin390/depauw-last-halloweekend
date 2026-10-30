import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { createServer as viteServer } from "vite";
import { localPool } from "./local-store";
import { RoomStore } from "../server/store";
import { api } from "../server/api";
const { pool } = await localPool(".local-db");
const handle = api(new RoomStore(pool));
const vite = process.argv.includes("--built")
  ? null
  : await viteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
const server = createServer(async (req, res) => {
  if (req.url === "/__qa-mobile") {
    res
      .writeHead(200, { "Content-Type": "text/html" })
      .end(
        '<!doctype html><title>Mobile QA</title><style>body{margin:0;background:#29232f}iframe{width:390px;height:844px;border:0}</style><iframe title="Mobile game" src="/?seat=default"></iframe>',
      );
    return;
  }
  if (req.url?.split("?")[0] === "/.netlify/functions/game") {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
        if (chunks.reduce((n, c) => n + c.length, 0) > 8192) {
          res.writeHead(413).end();
          return;
        }
      }
      const request = new Request("http://" + req.headers.host + req.url, {
        method: req.method,
        headers: req.headers as HeadersInit,
        ...(req.method === "POST"
          ? { body: Buffer.concat(chunks).toString() }
          : {}),
      });
      const response = await handle(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } catch {
      res.writeHead(500).end();
    }
  } else if (vite) vite.middlewares(req, res);
  else {
    try {
      const base = resolve("dist");
      const pathname = decodeURIComponent(
        new URL(req.url || "/", "http://local").pathname,
      );
      let file = resolve(base, "." + pathname);
      if (!file.startsWith(base + sep) && file !== base) {
        res.writeHead(403).end();
        return;
      }
      if (!extname(file)) file = resolve(base, "index.html");
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type":
          (
            {
              ".html": "text/html",
              ".css": "text/css",
              ".js": "application/javascript",
              ".svg": "image/svg+xml",
            } as Record<string, string>
          )[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  }
});
server.listen(
  Number(
    process.env.PORT ||
      (process.argv.includes("--port")
        ? process.argv[process.argv.indexOf("--port") + 1]
        : 5173),
  ),
  "0.0.0.0",
  () => console.log("Local multiplayer development server ready."),
);
