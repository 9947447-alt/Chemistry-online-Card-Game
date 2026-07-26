// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { installBrowserFatalHandlers } from "./browserFatalHandlers";

describe("Phase 11 browser fatal handlers", () => {
  it("replaces duplicate registrations, reports an error once, and cleans up", () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    installBrowserFatalHandlers(firstCallback);
    const cleanup = installBrowserFatalHandlers(secondCallback);

    window.dispatchEvent(new ErrorEvent("error", { error: new Error("first") }));
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("second") }));

    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledOnce();

    cleanup();
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("after cleanup") }));
    expect(secondCallback).toHaveBeenCalledOnce();
  });

  it("handles unhandledrejection once, prevents the browser default, and cleans up", () => {
    const callback = vi.fn();
    const cleanup = installBrowserFatalHandlers(callback);
    const rejectionEvent = new Event("unhandledrejection", {
      cancelable: true,
    }) as PromiseRejectionEvent;
    Object.defineProperties(rejectionEvent, {
      promise: { value: Promise.resolve() },
      reason: { value: new Error("PRIVATE_REJECTION_MESSAGE") },
    });

    window.dispatchEvent(rejectionEvent);
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("duplicate") }));

    expect(rejectionEvent.defaultPrevented).toBe(true);
    expect(callback).toHaveBeenCalledOnce();

    cleanup();
    const afterCleanup = new Event("unhandledrejection", {
      cancelable: true,
    }) as PromiseRejectionEvent;
    window.dispatchEvent(afterCleanup);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("cleans up all listeners on pagehide", () => {
    const callback = vi.fn();
    installBrowserFatalHandlers(callback);

    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("after pagehide") }));

    expect(callback).not.toHaveBeenCalled();
  });
});
