import { execFileSync } from "node:child_process";

const status = execFileSync(
  "git",
  ["status", "--porcelain", "--untracked-files=no"],
  { encoding: "utf8" },
).trim();

if (status.length > 0) {
  throw new Error(`Tracked worktree is not clean:\n${status}`);
}

console.log("Tracked worktree is clean.");
