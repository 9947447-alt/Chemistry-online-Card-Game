import { readFile, readdir } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const defaultDistDirectory = fileURLToPath(new URL("../dist/", import.meta.url));

export const forbiddenProductionMarkers = Object.freeze([
  "__PHASE11_E2E_FIXTURE__",
  "phase11-e2e-fixture",
  "fixtureApp.tsx",
  "fixtureScenarios.ts",
  "vite.e2e.config",
  "E2E_PRIVATE_RENDER_ERROR",
  "test-private-state",
  "private-test-state",
  "testPrivateState",
  "privateTestState",
  "OPENAI_API_KEY",
  "VITE_PRIVATE",
  "BEGIN PRIVATE KEY",
]);

async function readDirectory(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Cannot read production directory: ${directory}`, { cause: error });
  }
}

async function listRegularFiles(directory) {
  const entries = await readDirectory(directory);
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listRegularFiles(path));
    } else if (entry.isFile()) {
      files.push(path);
    } else {
      throw new Error(`Production artifact contains a non-regular file: ${path}`);
    }
  }
  return files;
}

async function readArtifact(file) {
  try {
    return await readFile(file);
  } catch (error) {
    throw new Error(`Cannot read production artifact: ${file}`, { cause: error });
  }
}

function containsRootAbsoluteAssetPath(content) {
  const marker = Buffer.from("/assets/", "utf8");
  const delimiters = new Set([
    0x09,
    0x0a,
    0x0d,
    0x20,
    0x22,
    0x27,
    0x28,
    0x3a,
    0x3d,
  ]);
  let offset = 0;
  while (offset < content.length) {
    const index = content.indexOf(marker, offset);
    if (index === -1) {
      return false;
    }
    if (index === 0 || delimiters.has(content[index - 1])) {
      return true;
    }
    offset = index + marker.length;
  }
  return false;
}

export async function checkProductionArtifact({ distDirectory, expectedTitle }) {
  if (!isAbsolute(distDirectory)) {
    throw new Error("Production distDirectory must be absolute.");
  }

  const files = await listRegularFiles(distDirectory);
  const relativeFiles = files.map((file) => relative(distDirectory, file));
  const sourceMaps = relativeFiles.filter((file) => extname(file) === ".map");
  if (sourceMaps.length > 0) {
    throw new Error(`Production build contains source maps: ${sourceMaps.join(", ")}`);
  }

  const markerBuffers = forbiddenProductionMarkers.map((marker) => ({
    marker,
    bytes: Buffer.from(marker, "utf8"),
  }));
  for (const file of files) {
    const content = await readArtifact(file);
    const relativeFile = relative(distDirectory, file);
    for (const { marker, bytes } of markerBuffers) {
      if (content.indexOf(bytes) !== -1) {
        throw new Error(
          `Production artifact ${relativeFile} contains forbidden marker ${marker}.`,
        );
      }
    }
    if (containsRootAbsoluteAssetPath(content)) {
      throw new Error(`Production artifact ${relativeFile} contains a root-absolute /assets/ path.`);
    }
  }

  const indexPath = join(distDirectory, "index.html");
  if (!relativeFiles.includes("index.html")) {
    throw new Error(`Production index.html is missing: ${indexPath}`);
  }
  const indexHtml = (await readArtifact(indexPath)).toString("utf8");
  if (!indexHtml.includes(`<title>${expectedTitle}</title>`)) {
    throw new Error("Production HTML title is not aligned with Phase 11 release metadata.");
  }
  if (!indexHtml.includes("./assets/")) {
    throw new Error("Production index does not contain relative asset paths.");
  }
}

async function runDefaultCheck() {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const expectedTitle = `化学卡牌在线游戏 · Debug Alpha · ${packageJson.version} · MVP0-P10`;
  await checkProductionArtifact({
    distDirectory: defaultDistDirectory,
    expectedTitle,
  });
  console.log(
    "Production isolation check passed: relative assets, no source maps, no fixture or private markers.",
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runDefaultCheck();
}
