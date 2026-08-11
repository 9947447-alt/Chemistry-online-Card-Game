// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  getSuggestedDisplayLocale,
  LocaleProvider,
  LocaleSwitch,
  useLocale,
} from "./locale";

function LocaleProbe() {
  const { locale } = useLocale();
  return <output>{locale}</output>;
}

describe("Alpha 4 display locale", () => {
  it("suggests English when any browser language preference begins with en", () => {
    expect(getSuggestedDisplayLocale(["zh-CN", "en-GB"], "zh-CN")).toBe("en");
    expect(getSuggestedDisplayLocale(undefined, "en-US")).toBe("en");
  });

  it("otherwise suggests Simplified Chinese", () => {
    expect(getSuggestedDisplayLocale(["zh-CN", "ja-JP"], "en-US")).toBe("zh-CN");
    expect(getSuggestedDisplayLocale(undefined, undefined)).toBe("zh-CN");
  });

  it("switches display language in React state and updates html lang", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <LocaleProvider>
            <LocaleProbe />
            <LocaleSwitch />
          </LocaleProvider>,
        );
      });

      await act(async () => {
        (Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent === "English",
        ) as HTMLButtonElement).click();
      });

      expect(container.querySelector("output")?.textContent).toBe("en");
      expect(document.documentElement.lang).toBe("en");
      expect(container.querySelector('button[aria-pressed="true"]')?.textContent).toBe("English");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
