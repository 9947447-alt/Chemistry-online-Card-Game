import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProductionServer } from "./serve-production.mjs";

let fixtureRoot;
let outsideRoot;
let server;
let baseUrl;

async function request(path, options) {
  return fetch(`${baseUrl}${path}`, options);
}

function rawRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const request = httpRequest({ host: url.hostname, path, port: url.port }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ body, status: response.statusCode }));
    });
    request.on("error", reject);
    request.end();
  });
}

beforeEach(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "reaction-field-dist-"));
  outsideRoot = await mkdtemp(join(tmpdir(), "reaction-field-outside-"));
  await mkdir(join(fixtureRoot, "assets"));
  await mkdir(join(fixtureRoot, "playtesting", "assets"), { recursive: true });
  await writeFile(join(fixtureRoot, "index.html"), "<main>app shell</main>");
  await writeFile(join(fixtureRoot, "assets", "app.js"), "export {};");
  await writeFile(join(fixtureRoot, "assets", "app.css"), "body{}");
  await writeFile(join(fixtureRoot, "assets", "font.woff2"), "font");
  await writeFile(join(fixtureRoot, "playtesting", "assets", "app.js"), "similar prefix asset");
  await writeFile(join(outsideRoot, "sentinel.txt"), "outside sentinel");
  await symlink(join(outsideRoot, "sentinel.txt"), join(fixtureRoot, "assets", "escape.txt"));
  server = await createProductionServer({ root: fixtureRoot });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(fixtureRoot, { force: true, recursive: true });
  await rm(outsideRoot, { force: true, recursive: true });
});

describe("serve-production", () => {
  it("serves root and exact /playtest navigations without stripping similar prefixes", async () => {
    for (const path of ["/", "/nested/route", "/playtest", "/playtest/nested/route"]) {
      const response = await request(path, { headers: { accept: "text/html" } });
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("app shell");
    }
    const similarPrefixAsset = await request("/playtesting/assets/app.js");
    expect(similarPrefixAsset.status).toBe(200);
    expect(await similarPrefixAsset.text()).toContain("similar prefix asset");
  });

  it("serves real assets with accurate MIME and HEAD metadata", async () => {
    const get = await request("/playtest/assets/app.js");
    const head = await request("/playtest/assets/app.js", { method: "HEAD" });
    expect(get.status).toBe(200);
    expect(get.headers.get("content-type")).toContain("text/javascript");
    expect(head.status).toBe(get.status);
    expect(head.headers.get("content-type")).toBe(get.headers.get("content-type"));
    expect(head.headers.get("content-length")).toBe(get.headers.get("content-length"));
    expect(await head.text()).toBe("");
    expect((await request("/assets/app.css")).headers.get("content-type")).toContain("text/css");
    expect((await request("/assets/font.woff2")).headers.get("content-type")).toContain("font/woff2");
  });

  it("does not turn missing resources into the app shell", async () => {
    for (const path of ["/missing.js", "/assets/missing.css", "/assets/missing.json", "/assets/missing.wasm", "/assets/missing.png"]) {
      const response = await request(path, { headers: { accept: "text/html" } });
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
    }
    expect((await request("/missing-route")).status).toBe(404);
  });

  it("rejects traversal, malformed encoding, encoded separators, and symlink escapes", async () => {
    for (const path of [
      "/../sentinel.txt",
      "/%2e%2e/sentinel.txt",
      "/%252e%252e/sentinel.txt",
      "/assets%2fapp.js",
      "/assets%5capp.js",
      "/assets%00app.js",
      "/assets/%ZZ",
      "/assets\\app.js",
      "/assets/escape.txt",
    ]) {
      const response = await rawRequest(path);
      expect(response.status).toBe(404);
      expect(response.body).not.toContain("outside sentinel");
    }
  });

  it("rejects unsafe methods with a stable Allow header", async () => {
    const response = await request("/", { method: "POST" });
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
    expect(await response.text()).toBe("");
  });
});
