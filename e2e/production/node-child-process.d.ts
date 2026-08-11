declare module "node:child_process" {
  interface ExecFileSyncOptions {
    encoding: "utf8";
    stdio: readonly ("ignore" | "pipe")[];
  }

  export function execFileSync(
    file: string,
    argumentsList: readonly string[],
    options: ExecFileSyncOptions,
  ): string;
}
