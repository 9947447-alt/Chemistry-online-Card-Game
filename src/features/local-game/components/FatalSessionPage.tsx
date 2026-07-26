import { useState } from "react";
import {
  formatFatalDiagnostics,
  type FatalLocalGameSession,
  type LocalGameSessionCommand,
} from "../localGameSession";

type FatalSessionPageProps = Readonly<{
  session: FatalLocalGameSession;
  dispatch: (command: LocalGameSessionCommand) => void;
}>;

export function FatalSessionPage({ session, dispatch }: FatalSessionPageProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(formatFatalDiagnostics(session.error));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <main className="local-game-page fatal-session-page">
      <section className="debug-section fatal-session-card" role="alert" aria-labelledby="fatal-session-title">
        <div>
          <p className="debug-kicker">会话安全边界</p>
          <h1 id="fatal-session-title">当前对局已安全停止</h1>
        </div>
        <p>{session.error.userMessage}</p>
        <p className="panel-note">
          旧对局状态已从本地会话中移除，任何旧对局操作都会被拒绝。恢复会重新创建完整的新对局。
        </p>
        <dl className="failure-diagnostics">
          <div><dt>错误码</dt><dd>{session.error.code}</dd></div>
          <div><dt>应用版本</dt><dd>{session.error.diagnostics.version}</dd></div>
          <div><dt>规则版本</dt><dd>{session.error.diagnostics.rulesVersion}</dd></div>
          <div><dt>Commit</dt><dd>{session.error.diagnostics.commit}</dd></div>
          <div><dt>运行环境</dt><dd>{session.error.diagnostics.environment}</dd></div>
        </dl>
        <div className="fatal-actions">
          <button
            className="primary-button"
            onClick={() => dispatch({ type: "RECOVER_FATAL_WITH_CURRENT_LINEUP" })}
            type="button"
          >
            按原阵容创建全新对局
          </button>
          <button
            className="secondary-button"
            onClick={() => dispatch({ type: "RETURN_TO_CHARACTER_SELECTION" })}
            type="button"
          >
            返回角色选择
          </button>
          <button className="secondary-button" onClick={copyDiagnostics} type="button">
            复制安全诊断
          </button>
        </div>
        <p aria-live="polite" className="panel-note">
          {copyStatus === "copied"
            ? "安全诊断已复制。"
            : copyStatus === "failed"
              ? "浏览器未允许复制；页面未上传任何信息。"
              : "诊断不包含异常原文、堆栈或任何对局内容。"}
        </p>
      </section>
    </main>
  );
}
