import { StrictMode, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../src/app/App";
import { installBrowserFatalHandlers } from "../src/app/browserFatalHandlers";
import { LocaleProvider } from "../src/app/locale";
import { RootErrorBoundary } from "../src/app/RootErrorBoundary";
import { RootFailurePage } from "../src/app/RootFailurePage";
import "../src/styles.css";
import {
  deterministicFixtureFactory,
  getFixtureInitializer,
  getFixtureFactoryInvocationCount,
  readFixtureScenario,
  subscribeToFixtureFactoryCount,
} from "./fixtureScenarios";

declare const __PHASE11_E2E_FIXTURE__: boolean;

function ThrowingFixture(): never {
  throw new Error("E2E_PRIVATE_RENDER_ERROR");
}

function FixtureDiagnostics() {
  const factoryCount = useSyncExternalStore(
    subscribeToFixtureFactoryCount,
    getFixtureFactoryInvocationCount,
    getFixtureFactoryInvocationCount,
  );

  return (
    <output data-testid="fixture-factory-count" hidden>
      {factoryCount}
    </output>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  document.body.textContent = "E2E fixture root is missing.";
} else if (!__PHASE11_E2E_FIXTURE__) {
  document.body.textContent = "E2E fixture marker is disabled.";
} else {
  const scenario = new URLSearchParams(window.location.search).get("scenario");
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
  installBrowserFatalHandlers(renderRootFailure);

  root.render(
    <StrictMode>
      <LocaleProvider>
        <RootErrorBoundary>
          {scenario === "render-error" ? (
            <ThrowingFixture />
          ) : (
            <>
              <FixtureDiagnostics />
              <App
                createGame={deterministicFixtureFactory}
                createSession={getFixtureInitializer(readFixtureScenario())}
              />
            </>
          )}
        </RootErrorBoundary>
      </LocaleProvider>
    </StrictMode>,
  );
}
