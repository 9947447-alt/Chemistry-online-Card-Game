import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function verifyWebPlaytestTag(tag, version) {
  if (!tag) throw new Error("Expected the bare release tag in GITHUB_REF_NAME.");

  const expectedTag = `web-playtest-v${version}`;
  if (tag !== expectedTag) {
    throw new Error(`Tag ${tag} does not match package version ${version}; expected ${expectedTag}.`);
  }
}

export async function checkWebPlaytestTag(environment = process.env) {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const tag = environment.GITHUB_REF_NAME;
  verifyWebPlaytestTag(tag, packageJson.version);
  return tag;
}

async function main() {
  const tag = await checkWebPlaytestTag();
  console.log(`Web Playtest tag verified: ${tag}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
