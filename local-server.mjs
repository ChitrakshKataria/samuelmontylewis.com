import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 8000);

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const target = pathname === "/" ? "/index.html" : pathname;
  const candidatePath = normalize(join(root, target));
  const resolvedRoot = resolve(root);
  let filePath = candidatePath;

  if (candidatePath.startsWith(resolvedRoot) && existsSync(candidatePath) && statSync(candidatePath).isDirectory()) {
    filePath = join(candidatePath, "index.html");
  }

  if (!filePath.startsWith(resolvedRoot) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    const fallbackPath = join(root, "index.html");
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    createReadStream(fallbackPath).pipe(response);
    return;
  }

  response.writeHead(200, {
    "content-type": types[extname(filePath)] || "application/octet-stream"
  });
  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  console.log(`Serving http://localhost:${port}`);
});
