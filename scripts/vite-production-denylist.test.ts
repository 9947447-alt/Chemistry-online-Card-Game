import { resolve } from "node:path";
import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";
import { productionModuleDenylistPlugin } from "../vite.config";

const projectRoot = resolve(import.meta.dirname, "..");

function getProductionLoadHandler(): OmitThisParameter<
  NonNullable<Plugin["load"]> extends infer Hook
    ? Hook extends { handler: infer Handler }
      ? Handler
      : Hook
    : never
> {
  const loadHook = productionModuleDenylistPlugin().load;
  expect(loadHook).toBeDefined();
  if (!loadHook) {
    throw new Error("Expected the production denylist plugin to expose a load hook.");
  }

  return typeof loadHook === "function" ? loadHook : loadHook.handler;
}

describe("Phase 11 production module denylist", () => {
  it.each([
    "e2e/support.ts",
    "src/testing/fixtureScenarios.ts",
    "e2e/fixtureApp.tsx",
    "vite.e2e.config.ts",
    "src/__fixtures__/privateState.ts",
    "src/testing/testPrivateState.ts",
  ])("rejects %s through the production plugin load hook", async (relativeId) => {
    const load = getProductionLoadHandler();
    const moduleId = resolve(projectRoot, relativeId);

    await expect(Promise.resolve().then(() => load(moduleId))).rejects.toThrow(
      /forbidden E2E\/test module/u,
    );
  });

  it("allows formal source through the production plugin load hook", async () => {
    const load = getProductionLoadHandler();

    await expect(
      Promise.resolve().then(() => load(resolve(projectRoot, "src/main.tsx"))),
    ).resolves.toBeNull();
  });
});
