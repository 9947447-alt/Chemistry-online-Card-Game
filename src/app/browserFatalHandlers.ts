type BrowserFatalCallback = () => void;

let activeCleanup: (() => void) | undefined;

export function installBrowserFatalHandlers(
  onFatal: BrowserFatalCallback,
): () => void {
  activeCleanup?.();

  let reported = false;
  const reportOnce = () => {
    if (reported) {
      return;
    }

    reported = true;
    onFatal();
  };
  const handleError = (event: ErrorEvent) => {
    event.preventDefault();
    reportOnce();
  };
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    event.preventDefault();
    reportOnce();
  };
  const handlePageHide = () => cleanup();

  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);
  window.addEventListener("pagehide", handlePageHide, { once: true });

  function cleanup() {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    window.removeEventListener("pagehide", handlePageHide);
    if (activeCleanup === cleanup) {
      activeCleanup = undefined;
    }
  }
  activeCleanup = cleanup;
  return cleanup;
}
