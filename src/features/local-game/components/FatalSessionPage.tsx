import { useState } from "react";
import { useLocale } from "../../../app/locale";
import {
  formatFatalDiagnostics,
  type FatalLocalGameSession,
  type LocalGameSessionCommand,
} from "../localGameSession";
import { getFatalMessageDisplayName } from "../presentationLocale";

type FatalSessionPageProps = Readonly<{
  session: FatalLocalGameSession;
  dispatch: (command: LocalGameSessionCommand) => void;
}>;

export function FatalSessionPage({ session, dispatch }: FatalSessionPageProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const { locale } = useLocale();
  const isEnglish = locale === "en";

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
          <p className="debug-kicker">{isEnglish ? "REACTION FIELD · Session safety boundary" : "反应域 · 会话安全边界"}</p>
          <h1 id="fatal-session-title">{isEnglish ? "The current game stopped safely" : "当前对局已安全停止"}</h1>
        </div>
        <p>{getFatalMessageDisplayName(session.error.code, session.error.userMessage, locale)}</p>
        <p className="panel-note">
          {isEnglish ? "The old game state was removed from the local session and every old game action is rejected. Recovery creates a complete new game." : "旧对局状态已从本地会话中移除，任何旧对局操作都会被拒绝。恢复会重新创建完整的新对局。"}
        </p>
        <dl className="failure-diagnostics">
          <div><dt>{isEnglish ? "Name" : "名称"}</dt><dd>{session.error.diagnostics.displayName}</dd></div>
          <div><dt>{isEnglish ? "Error code" : "错误码"}</dt><dd>{session.error.code}</dd></div>
          <div><dt>{isEnglish ? "App version" : "应用版本"}</dt><dd>{session.error.diagnostics.version}</dd></div>
          <div><dt>{isEnglish ? "Rules version" : "规则版本"}</dt><dd>{session.error.diagnostics.rulesVersion}</dd></div>
          <div><dt>Commit</dt><dd>{session.error.diagnostics.commit}</dd></div>
          <div><dt>{isEnglish ? "Environment" : "运行环境"}</dt><dd>{session.error.diagnostics.environment}</dd></div>
        </dl>
        <div className="fatal-actions">
          <button
            className="primary-button"
            onClick={() => dispatch({ type: "RECOVER_FATAL_WITH_CURRENT_LINEUP" })}
            type="button"
          >
            {isEnglish ? "Create a new game with the same lineup" : "按原阵容创建全新对局"}
          </button>
          <button
            className="secondary-button"
            onClick={() => dispatch({ type: "RETURN_TO_CHARACTER_SELECTION" })}
            type="button"
          >
            {isEnglish ? "Return to character selection" : "返回角色选择"}
          </button>
          <button className="secondary-button" onClick={copyDiagnostics} type="button">
            {isEnglish ? "Copy safe diagnostics" : "复制安全诊断"}
          </button>
        </div>
        <p aria-live="polite" className="panel-note">
          {copyStatus === "copied"
            ? (isEnglish ? "Safe diagnostics copied." : "安全诊断已复制。")
            : copyStatus === "failed"
              ? (isEnglish ? "The browser did not allow copying; the page uploaded no information." : "浏览器未允许复制；页面未上传任何信息。")
              : (isEnglish ? "Diagnostics contain no original error text, stack, or game content." : "诊断不包含异常原文、堆栈或任何对局内容。")}
        </p>
      </section>
    </main>
  );
}
