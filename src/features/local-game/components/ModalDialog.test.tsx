// @vitest-environment happy-dom

import { act, createElement, createRef, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalDialog } from "./ModalDialog";

type AnimationFrameCallback = (time: number) => void;

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function renderDialog(onRequestClose = vi.fn()) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const initialFocusRef = createRef<HTMLButtonElement>();

  const dialog = createElement(
    ModalDialog,
    {
      ariaDescribedBy: "description",
      ariaLabelledBy: "title",
      children: [
        createElement("h2", { id: "title", key: "title" }, "Test dialog"),
        createElement("p", { id: "description", key: "description" }, "Dialog description"),
        createElement("button", { ref: initialFocusRef, type: "button", key: "first" }, "First"),
        createElement("button", { type: "button", key: "last" }, "Last"),
      ],
      className: "test-dialog",
      initialFocusRef,
      onRequestClose,
      role: "dialog",
    },
  );

  return { container, dialog, root };
}

describe("ModalDialog", () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    document.body.replaceChildren();
  });

  it("defers initial focus until its animation frame", async () => {
    const callbacks = new Map<number, AnimationFrameCallback>();
    const requestAnimationFrame = vi.fn((callback: AnimationFrameCallback) => {
      callbacks.set(1, callback);
      return 1;
    });
    globalThis.requestAnimationFrame = requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn();
    const { container, dialog, root } = renderDialog();

    try {
      await act(async () => root.render(dialog));
      const first = container.querySelector<HTMLButtonElement>("button");
      expect(first).not.toBeNull();
      expect(document.activeElement).not.toBe(first);
      expect(requestAnimationFrame).toHaveBeenCalledOnce();

      await act(async () => callbacks.get(1)?.(0));
      expect(document.activeElement).toBe(first);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("cancels deferred focus when unmounted before the animation frame", async () => {
    let callback: AnimationFrameCallback | undefined;
    const cancelAnimationFrame = vi.fn();
    globalThis.requestAnimationFrame = vi.fn((nextCallback: AnimationFrameCallback) => {
      callback = nextCallback;
      return 7;
    });
    globalThis.cancelAnimationFrame = cancelAnimationFrame;
    const { container, dialog, root } = renderDialog();

    await act(async () => root.render(dialog));
    const first = container.querySelector<HTMLButtonElement>("button");
    expect(first).not.toBeNull();
    const focus = vi.spyOn(first!, "focus");

    await act(async () => root.unmount());
    await act(async () => callback?.(0));

    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
    expect(focus).not.toHaveBeenCalled();
    container.remove();
  });

  it("does not retain a stale focus frame across a StrictMode remount", async () => {
    const callbacks = new Map<number, AnimationFrameCallback>();
    const cancelled = new Set<number>();
    let frame = 0;
    globalThis.requestAnimationFrame = vi.fn((callback: AnimationFrameCallback) => {
      frame += 1;
      callbacks.set(frame, callback);
      return frame;
    });
    globalThis.cancelAnimationFrame = vi.fn((id: number) => cancelled.add(id));
    const { container, dialog, root } = renderDialog();

    try {
      await act(async () => root.render(createElement(StrictMode, null, dialog)));
      const first = container.querySelector<HTMLButtonElement>("button");
      const focus = vi.spyOn(first!, "focus");

      await act(async () => {
        for (const [id, callback] of callbacks) {
          if (!cancelled.has(id)) {
            callback(0);
          }
        }
      });

      expect(cancelled).toContain(1);
      expect(focus).toHaveBeenCalledOnce();
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("preserves Escape and Tab focus trapping", async () => {
    const callbacks = new Map<number, AnimationFrameCallback>();
    let frame = 0;
    globalThis.requestAnimationFrame = vi.fn((callback: AnimationFrameCallback) => {
      frame += 1;
      callbacks.set(frame, callback);
      return frame;
    });
    globalThis.cancelAnimationFrame = vi.fn();
    const onRequestClose = vi.fn();
    const { container, dialog, root } = renderDialog(onRequestClose);

    try {
      await act(async () => root.render(dialog));
      await act(async () => callbacks.get(1)?.(0));
      const [first, last] = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
      last.focus();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
      expect(document.activeElement).toBe(first);

      document.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        key: "Tab",
        shiftKey: true,
      }));
      expect(document.activeElement).toBe(last);

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(onRequestClose).toHaveBeenCalledOnce();
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
