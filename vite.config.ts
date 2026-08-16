import { execFileSync } from "node:child_process";
import { isAbsolute, relative, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import packageMetadata from "./package.json";

export function readBuildCommit(): string {
  try {
    const commit = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return commit.length > 0 ? commit : "dev/unknown";
  } catch {
    return "dev/unknown";
  }
}

export function releaseHtmlPlugin(): Plugin {
  const releaseTitle = [
    "反应域",
    "REACTION FIELD",
    "Web Playtest Alpha",
    packageMetadata.version,
    "MVP0-P10",
  ].join(" · ");

  return {
    name: "phase11-release-html",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => html.replace("__APP_RELEASE_TITLE__", releaseTitle),
    },
  };
}

function normalizeModulePath(path: string): string {
  return path.replaceAll("\\", "/");
}

export function isDeniedProductionModule(
  moduleId: string,
  rootDirectory: string = import.meta.dirname,
): boolean {
  if (moduleId.startsWith("\0")) {
    return false;
  }

  const cleanId = moduleId.split(/[?#]/u, 1)[0];
  const absoluteId = isAbsolute(cleanId) ? cleanId : resolve(rootDirectory, cleanId);
  const relativeId = normalizeModulePath(relative(resolve(rootDirectory), absoluteId));
  if (relativeId.startsWith("../") || relativeId === "..") {
    return false;
  }

  return (
    relativeId === "vite.e2e.config.ts" ||
    relativeId.startsWith("e2e/") ||
    /(?:^|\/)(?:fixtureApp|fixtureScenarios)\.[cm]?[jt]sx?$/u.test(relativeId) ||
    /(?:^|\/)__fixtures__\//u.test(relativeId) ||
    /(?:^|\/)[^/]*(?:test[-_.]?private[-_.]?state|private[-_.]?test[-_.]?state)[^/]*\.[cm]?[jt]sx?$/iu.test(relativeId)
  );
}

export function assertProductionModuleAllowed(
  moduleId: string,
  rootDirectory: string = import.meta.dirname,
): void {
  if (isDeniedProductionModule(moduleId, rootDirectory)) {
    throw new Error(`Production build imported forbidden E2E/test module: ${moduleId}`);
  }
}

export function productionModuleDenylistPlugin(): Plugin {
  return {
    name: "phase11-production-module-denylist",
    apply: "build",
    enforce: "pre",
    load(id) {
      assertProductionModuleAllowed(id);
      return null;
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [productionModuleDenylistPlugin(), releaseHtmlPlugin(), react()],
  define: {
    __APP_COMMIT__: JSON.stringify(readBuildCommit()),
  },
  build: {
    sourcemap: false,
  },
  test: {
    environment: "node",
    include: [
      "src/chemistry/**/*.test.ts",
      "src/game/tests/**/*.test.ts",
      "src/app/**/*.test.tsx",
      "src/features/**/*.test.tsx",
      "scripts/**/*.test.mjs",
      "scripts/**/*.test.ts",
    ],
  },
});
