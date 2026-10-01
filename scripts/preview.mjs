import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { root } from "./content.mjs";

const directory = resolve(root, "dist");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".xml": "application/xml",
  ".txt": "text/plain",
};
const server = createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405).end();
    return;
  }
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes("\\") || pathname.includes("\0")) {
      response.writeHead(400).end();
      return;
    }
    let path = resolve(directory, `.${pathname}`);
    if (path !== directory && !path.startsWith(`${directory}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    if ((await stat(path)).isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        response
          .writeHead(301, { Location: `${url.pathname}/${url.search}` })
          .end();
        return;
      }
      path = resolve(path, "index.html");
    }
    const body = await readFile(path);
    response.writeHead(200, {
      "Content-Type": types[extname(path)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    const body = await readFile(resolve(directory, "404.html")).catch(() =>
      Buffer.from("404"),
    );
    response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    response.end(request.method === "HEAD" ? undefined : body);
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`CV preview: http://127.0.0.1:${port}`),
);
