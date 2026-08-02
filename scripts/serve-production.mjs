import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { extname, isAbsolute, relative, resolve } from "node:path";

const contentTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function isWithin(root, candidate) {
  const pathRelative = relative(root, candidate);
  return pathRelative === "" || (!pathRelative.startsWith("..") && !isAbsolute(pathRelative));
}

function requestPathname(requestUrl) {
  const encodedPathname = (requestUrl ?? "/").split("?", 1)[0] ?? "/";
  if (!encodedPathname.startsWith("/") || encodedPathname.includes("\\") || encodedPathname.includes("\0")) {
    return undefined;
  }

  if (/%(?:2f|5c|00)/iu.test(encodedPathname)) return undefined;

  let pathname;
  try {
    pathname = decodeURIComponent(encodedPathname);
  } catch {
    return undefined;
  }

  if (
    pathname.includes("\\") ||
    pathname.includes("\0") ||
    pathname.includes("%") ||
    pathname.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    return undefined;
  }

  return pathname.replace(/^\/playtest(?=\/|$)/u, "") || "/";
}

function wantsHtmlNavigation(request, pathname) {
  return extname(pathname) === "" && (request.headers.accept ?? "").includes("text/html");
}

function send(response, status, headers = {}) {
  response.writeHead(status, headers);
  response.end();
}

async function safeExistingFile(root, rootRealpath, pathname) {
  const candidate = resolve(root, `.${pathname}`);
  if (!isWithin(root, candidate)) return undefined;

  try {
    const candidateRealpath = await realpath(candidate);
    if (!isWithin(rootRealpath, candidateRealpath) || !(await stat(candidateRealpath)).isFile()) {
      return undefined;
    }
    return candidateRealpath;
  } catch {
    return undefined;
  }
}

export async function createProductionServer({ root = "dist" } = {}) {
  const configuredRoot = resolve(root);
  const rootRealpath = await realpath(configuredRoot);
  const indexPath = await safeExistingFile(configuredRoot, rootRealpath, "/index.html");
  if (!indexPath) throw new Error(`Expected an index.html inside production root: ${configuredRoot}`);

  return createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      send(response, 405, { allow: "GET, HEAD", "content-length": "0" });
      return;
    }

    const pathname = requestPathname(request.url);
    if (!pathname) {
      send(response, 404, { "content-length": "0" });
      return;
    }

    const filePath = await safeExistingFile(configuredRoot, rootRealpath, pathname)
      ?? (wantsHtmlNavigation(request, pathname) ? indexPath : undefined);
    if (!filePath) {
      send(response, 404, { "content-length": "0" });
      return;
    }

    const fileStat = await stat(filePath);
    const headers = {
      "content-length": String(fileStat.size),
      "content-type": contentTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream",
    };
    response.writeHead(200, headers);
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).on("error", () => response.destroy()).pipe(response);
  });
}

function parseCliArguments(argv) {
  const result = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index]?.startsWith("--")) result.set(argv[index].slice(2), argv[index + 1]);
  }
  return result;
}

async function main() {
  const argumentsByName = parseCliArguments(process.argv.slice(2));
  const root = argumentsByName.get("root") ?? "dist";
  const port = Number(argumentsByName.get("port") ?? "4175");
  const server = await createProductionServer({ root });
  server.listen(port, "127.0.0.1", () => console.log(`Serving ${resolve(root)} at http://127.0.0.1:${port}`));
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => server.close(() => process.exit(0)));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
