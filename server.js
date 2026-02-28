import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, join, relative, resolve } from "node:path";

const port = Number(process.env.PORT || 3000);
const publicDir = join(process.cwd(), "public");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendFile(res, filePath) {
  const ext = extname(filePath).toLowerCase();
  const type = mimeTypes[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("Internal server error");
  });
  stream.pipe(res);
}

function sendNotFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

const server = createServer((req, res) => {
  const rawPath = req.url?.split("?")[0] || "/";
  const requestedPath = rawPath === "/" ? "/index.html" : rawPath;
  const filePath = resolve(publicDir, `.${requestedPath}`);
  const relativePath = relative(publicDir, filePath);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    sendNotFound(res);
    return;
  }

  try {
    if (statSync(filePath).isDirectory()) {
      sendNotFound(res);
      return;
    }
  } catch {
    sendNotFound(res);
    return;
  }

  sendFile(res, filePath);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Party app running at http://0.0.0.0:${port}`);
});
