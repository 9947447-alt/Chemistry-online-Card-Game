import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { checkWebPlaytestTag, verifyWebPlaytestTag } from "./check-web-playtest-tag.mjs";

const script = new URL("./check-web-playtest-tag.mjs", import.meta.url);
const version = "0.13.0-alpha.3";

function run(environment = {}, argumentsList = []) {
  return spawnSync(process.execPath, [script.pathname, ...argumentsList], {
    encoding: "utf8",
    env: { ...process.env, GITHUB_REF: "refs/tags/web-playtest-v0.13.0-alpha.3", ...environment },
  });
}

describe("check-web-playtest-tag", () => {
  it("accepts only the exact bare tag supplied through GITHUB_REF_NAME", async () => {
    await expect(checkWebPlaytestTag({ GITHUB_REF_NAME: "web-playtest-v0.13.0-alpha.3" })).resolves.toBe("web-playtest-v0.13.0-alpha.3");
    expect(run({ GITHUB_REF_NAME: "web-playtest-v0.13.0-alpha.3" }).status).toBe(0);
  });

  it.each([
    "web-playtest-v0.13.0-alpha.1",
    "web-playtest-v0.13.0-alpha.2",
    "web-playtest-v0.13.0-alpha.4",
    "web-playtest-v0.13.0-alpha.3-extra",
    "v0.13.0-alpha.3",
    "refs/tags/web-playtest-v0.13.0-alpha.3",
    "",
    undefined,
  ])("rejects invalid environment tag %s", async (tag) => {
    await expect(checkWebPlaytestTag(tag === undefined ? {} : { GITHUB_REF_NAME: tag })).rejects.toThrow();
    const environment = tag === undefined ? { GITHUB_REF_NAME: undefined } : { GITHUB_REF_NAME: tag };
    expect(run(environment).status).toBe(1);
  });

  it("does not accept a CLI tag or GITHUB_REF fallback", () => {
    expect(run({ GITHUB_REF_NAME: undefined }, ["web-playtest-v0.13.0-alpha.3"]).status).toBe(1);
    expect(() => verifyWebPlaytestTag("refs/tags/web-playtest-v0.13.0-alpha.3", version)).toThrow();
  });
});
