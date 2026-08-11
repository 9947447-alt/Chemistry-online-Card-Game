import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { installBrowserFatalHandlers } from "./app/browserFatalHandlers";
import { LocaleProvider } from "./app/locale";
import { RootErrorBoundary } from "./app/RootErrorBoundary";
import { RootFailurePage } from "./app/RootFailurePage";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  document.body.textContent = "页面容器缺失，无法启动应用。";
} else {
  let rootFailed = false;
  let renderRootFailure = () => undefined;
  const root = createRoot(rootElement, {
    onCaughtError: () => undefined,
    onRecoverableError: () => undefined,
    onUncaughtError: () => renderRootFailure(),
  });

  renderRootFailure = () => {
    if (rootFailed) {
      return;
    }

    rootFailed = true;
    root.render(
      <LocaleProvider>
        <RootFailurePage code="ROOT_RUNTIME_FAILED" />
      </LocaleProvider>,
    );
  };

  const cleanupBrowserHandlers = installBrowserFatalHandlers(renderRootFailure);
  if (import.meta.hot) {
    import.meta.hot.dispose(cleanupBrowserHandlers);
  }

  root.render(
    <StrictMode>
      <LocaleProvider>
        <RootErrorBoundary>
          <App />
        </RootErrorBoundary>
      </LocaleProvider>
    </StrictMode>,
  );
}
