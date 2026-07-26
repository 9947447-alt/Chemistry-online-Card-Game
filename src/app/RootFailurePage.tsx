import { releaseMetadata } from "./releaseMetadata";

export type RootFailureCode = "UI_RENDER_FAILED" | "ROOT_RUNTIME_FAILED";

type RootFailurePageProps = Readonly<{
  code: RootFailureCode;
}>;

export function RootFailurePage({ code }: RootFailurePageProps) {
  return (
    <main className="root-failure-page">
      <section className="root-failure-card" role="alert" aria-labelledby="root-failure-title">
        <p className="debug-kicker">{releaseMetadata.channel} · 安全兜底</p>
        <h1 id="root-failure-title">页面遇到无法继续处理的错误</h1>
        <p>
          为避免继续运行不确定状态，当前界面已经停止。不会上传对局、手牌、日志或异常详情。
        </p>
        <dl className="failure-diagnostics">
          <div><dt>应用版本</dt><dd>{releaseMetadata.version}</dd></div>
          <div><dt>规则版本</dt><dd>{releaseMetadata.rulesVersion}</dd></div>
          <div><dt>Commit</dt><dd>{releaseMetadata.commit}</dd></div>
          <div><dt>错误码</dt><dd>{code}</dd></div>
        </dl>
        <button
          className="primary-button"
          onClick={() => window.location.reload()}
          type="button"
        >
          重新加载页面
        </button>
      </section>
    </main>
  );
}
