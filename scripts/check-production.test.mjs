import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkProductionArtifact,
  forbiddenProductionMarkers,
} from "./check-production.mjs";

const expectedTitle = "反应域 · REACTION FIELD · Web Playtest Alpha · 0.16.0-alpha.1 · MVP0-P10";
const cleanIndex = `<!doctype html><html><head><title>${expectedTitle}</title><script src="./assets/app.js"></script><link href="./assets/app.css" rel="stylesheet"></head><body></body></html>`;
const temporaryRoots = [];

async function createTemporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "phase12-production-check-"));
  temporaryRoots.push(root);
  return root;
}

async function writeArtifact(distDirectory, relativePath, content) {
  const path = join(distDirectory, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function createCleanDist() {
  const root = await createTemporaryRoot();
  const distDirectory = join(root, "dist");
  await writeArtifact(distDirectory, "index.html", cleanIndex);
  await writeArtifact(distDirectory, "assets/app.js", "export const clean = true;");
  await writeArtifact(distDirectory, "assets/app.css", "body{margin:0}");
  return distDirectory;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => (
    rm(root, { recursive: true, force: true })
  )));
});

describe("Phase 12 production artifact scanner", () => {
  it("fails when dist is missing", async () => {
    const root = await createTemporaryRoot();
    await expect(checkProductionArtifact({
      distDirectory: join(root, "missing-dist"),
      expectedTitle,
    })).rejects.toThrow(/Cannot read production directory/u);
  });

  it("fails when index.html is missing", async () => {
    const root = await createTemporaryRoot();
    const distDirectory = join(root, "dist");
    await writeArtifact(distDirectory, "assets/app.js", "export {};");
    await expect(checkProductionArtifact({ distDirectory, expectedTitle })).rejects.toThrow(
      /index\.html is missing/u,
    );
  });

  it("finds a fixture marker in HTML", async () => {
    const distDirectory = await createCleanDist();
    await writeArtifact(
      distDirectory,
      "index.html",
      `${cleanIndex}<!-- ${forbiddenProductionMarkers[0]} -->`,
    );
    await expect(checkProductionArtifact({ distDirectory, expectedTitle })).rejects.toThrow(
      /index\.html contains forbidden marker/u,
    );
  });

  it("finds a fixture marker in JSON", async () => {
    const distDirectory = await createCleanDist();
    await writeArtifact(
      distDirectory,
      "assets/metadata.json",
      JSON.stringify({ fixture: forbiddenProductionMarkers[3] }),
    );
    await expect(checkProductionArtifact({ distDirectory, expectedTitle })).rejects.toThrow(
      /metadata\.json contains forbidden marker/u,
    );
  });

  it("finds a fixture marker in binary bytes", async () => {
    const distDirectory = await createCleanDist();
    await writeArtifact(
      distDirectory,
      "assets/module.wasm",
      Buffer.concat([
        Buffer.from([0x00, 0x61, 0x73, 0x6d]),
        Buffer.from(forbiddenProductionMarkers[5], "utf8"),
        Buffer.from([0x00, 0xff]),
      ]),
    );
    await expect(checkProductionArtifact({ distDirectory, expectedTitle })).rejects.toThrow(
      /module\.wasm contains forbidden marker/u,
    );
  });

  it("rejects source maps", async () => {
    const distDirectory = await createCleanDist();
    await writeArtifact(distDirectory, "assets/app.js.map", "{}");
    await expect(checkProductionArtifact({ distDirectory, expectedTitle })).rejects.toThrow(
      /contains source maps/u,
    );
  });

  it("rejects root-absolute asset paths", async () => {
    const distDirectory = await createCleanDist();
    await writeArtifact(
      distDirectory,
      "index.html",
      cleanIndex.replace("./assets/app.js", "/assets/app.js"),
    );
    await expect(checkProductionArtifact({ distDirectory, expectedTitle })).rejects.toThrow(
      /index\.html contains a root-absolute \/assets\/ path/u,
    );
  });

  it("rejects root-absolute asset paths in non-HTML artifacts", async () => {
    const distDirectory = await createCleanDist();
    await writeArtifact(
      distDirectory,
      "assets/theme.css",
      "body{background-image:url('/assets/private-background.svg')}",
    );
    await expect(checkProductionArtifact({ distDirectory, expectedTitle })).rejects.toThrow(
      /theme\.css contains a root-absolute \/assets\/ path/u,
    );
  });

  it("accepts a clean artifact with relative assets", async () => {
    const distDirectory = await createCleanDist();
    await expect(checkProductionArtifact({ distDirectory, expectedTitle })).resolves.toBeUndefined();
  });
});
