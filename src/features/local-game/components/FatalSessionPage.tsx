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
          {isEnglish ? "Old game was isolated; recovery creates a new game." : "旧对局已隔离，恢复将创建全新对局。"}
        </p>
        <dl className="failure-diagnostics">
          {([
            [isEnglish ? "Name" : "名称", session.error.diagnostics.displayName],
            [isEnglish ? "Error code" : "错误码", session.error.code],
            [isEnglish ? "App version" : "应用版本", session.error.diagnostics.version],
            [isEnglish ? "Rules version" : "规则版本", session.error.diagnostics.rulesVersion],
            ["Commit", session.error.diagnostics.commit],
            [isEnglish ? "Environment" : "运行环境", session.error.diagnostics.environment],
          ] as const).map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
        <div className="fatal-actions">
          <button
            className="primary-button"
            onClick={() => dispatch({ type: "RECOVER_FATAL_WITH_CURRENT_LINEUP" })}
            type="button"
          >
            {isEnglish ? "Restart new game" : "按原阵容创建新对局"}
          </button>
          <button
            className="secondary-button"
            onClick={() => dispatch({ type: "RETURN_TO_CHARACTER_SELECTION" })}
            type="button"
          >
            {isEnglish ? "Return to character selection" : "返回角色选择"}
          </button>
          <button className="secondary-button" onClick={copyDiagnostics} type="button">
            {isEnglish ? "Copy diagnostics" : "复制安全诊断"}
          </button>
        </div>
        <p aria-live="polite" className="panel-note">
          {copyStatus === "copied"
            ? (isEnglish ? "Safe diagnostics copied." : "安全诊断已复制。")
            : copyStatus === "failed"
              ? (isEnglish ? "Clipboard error." : "剪贴板错误。")
              : (isEnglish ? "Diagnostics exclude private game details." : "诊断不含对局细节。")}
        </p>
      </section>
    </main>
  );
}
