import packageMetadata from "../../package.json";

declare const __APP_COMMIT__: string;

export type ReleaseMetadata = Readonly<{
  displayName: "化学卡牌在线游戏";
  channel: "Debug Alpha";
  version: string;
  rulesVersion: "MVP0-P10";
  commit: string;
}>;

function readCommit(): string {
  if (typeof __APP_COMMIT__ !== "string" || __APP_COMMIT__.length === 0) {
    return "dev/unknown";
  }

  return __APP_COMMIT__;
}

export const releaseMetadata: ReleaseMetadata = Object.freeze({
  displayName: "化学卡牌在线游戏",
  channel: "Debug Alpha",
  version: packageMetadata.version,
  rulesVersion: "MVP0-P10",
  commit: readCommit(),
});

export type SafeRuntimeDiagnostics = Readonly<{
  displayName: ReleaseMetadata["displayName"];
  version: string;
  rulesVersion: ReleaseMetadata["rulesVersion"];
  commit: string;
  environment: "浏览器 Web 运行环境" | "非浏览器测试环境";
}>;

export function createSafeRuntimeDiagnostics(): SafeRuntimeDiagnostics {
  return Object.freeze({
    displayName: releaseMetadata.displayName,
    version: releaseMetadata.version,
    rulesVersion: releaseMetadata.rulesVersion,
    commit: releaseMetadata.commit,
    environment: typeof window === "undefined"
      ? "非浏览器测试环境"
      : "浏览器 Web 运行环境",
  });
}
