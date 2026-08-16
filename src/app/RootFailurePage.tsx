import { FeedbackLink } from "./feedback";
import { LocaleSwitch, useLocale } from "./locale";
import { releaseMetadata } from "./releaseMetadata";

export type RootFailureCode = "UI_RENDER_FAILED" | "ROOT_RUNTIME_FAILED";

type RootFailurePageProps = Readonly<{
  code: RootFailureCode;
}>;

export function RootFailurePage({ code }: RootFailurePageProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";

  return (
    <main className="root-failure-page">
      <header className="release-bar">
        <div>
          <strong>{releaseMetadata.displayName} · {releaseMetadata.secondaryName}</strong>
          <span>{releaseMetadata.channel} · v{releaseMetadata.version} · {releaseMetadata.rulesVersion}</span>
        </div>
        <div className="release-bar__actions">
          <LocaleSwitch />
          <FeedbackLink />
        </div>
      </header>
      <section className="root-failure-card" role="alert" aria-labelledby="root-failure-title">
        <p className="debug-kicker">{releaseMetadata.channel} · {isEnglish ? "Safe fallback" : "安全兜底"}</p>
        <h1 id="root-failure-title">
          {isEnglish ? "The page encountered an unrecoverable error" : "页面遇到无法继续处理的错误"}
        </h1>
        <p>
          {isEnglish
            ? "The interface stopped to avoid continuing with uncertain state. No game, hand, log, or error detail is uploaded."
            : "为避免继续运行不确定状态，当前界面已经停止。不会上传对局、手牌、日志或异常详情。"}
        </p>
        <dl className="failure-diagnostics">
          {([
            [isEnglish ? "Name" : "名称", releaseMetadata.displayName],
            [isEnglish ? "App version" : "应用版本", releaseMetadata.version],
            [isEnglish ? "Rules version" : "规则版本", releaseMetadata.rulesVersion],
            ["Commit", releaseMetadata.commit],
            [isEnglish ? "Error code" : "错误码", code],
          ] as const).map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
        <button
          className="primary-button"
          onClick={() => window.location.reload()}
          type="button"
        >
          {isEnglish ? "Reload page" : "重新加载页面"}
        </button>
      </section>
    </main>
  );
}
