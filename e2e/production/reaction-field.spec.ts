import { execFileSync } from "node:child_process";
import { expect, test as base, type Page } from "@playwright/test";

function readExpectedBuildCommit(): string {
  const commit = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (!/^[0-9a-f]{12}$/u.test(commit)) {
    throw new Error(`Expected a 12-character lowercase Git SHA, received: ${commit}`);
  }
  return commit;
}

const expectedBuildCommit = readExpectedBuildCommit();

const test = base.extend<{
  externalRequests: string[];
  networkFailures: string[];
  runtimeErrors: string[];
}>({
  externalRequests: async ({ page }, use) => {
    const failures: string[] = [];
    const baseOrigin = new URL("http://127.0.0.1:4175").origin;
    page.on("request", (request) => {
      const url = request.url();
      if (/^https?:/u.test(url) && new URL(url).origin !== baseOrigin) {
        failures.push(`${request.method()} ${url}`);
      }
    });
    await use(failures);
    expect(failures).toEqual([]);
  },
  networkFailures: async ({ page }, use) => {
    const failures: string[] = [];
    const baseOrigin = new URL("http://127.0.0.1:4175").origin;
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).origin === baseOrigin) {
        failures.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? "unknown"}`);
      }
    });
    page.on("response", (response) => {
      if (new URL(response.url()).origin === baseOrigin && (response.status() < 200 || response.status() >= 400)) {
        failures.push(`response: ${response.status()} ${response.url()}`);
      }
    });
    await use(failures);
    expect(failures).toEqual([]);
  },
  runtimeErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") errors.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    await use(errors);
    expect(errors).toEqual([]);
  },
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "language", {
      configurable: true,
      get: () => "zh-CN",
    });
    Object.defineProperty(Navigator.prototype, "languages", {
      configurable: true,
      get: () => ["zh-CN"],
    });
  });
});

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    bodyClient: document.body.clientWidth,
    bodyScroll: document.body.scrollWidth,
    documentClient: document.documentElement.clientWidth,
    documentScroll: document.documentElement.scrollWidth,
  }));
  expect(widths.bodyScroll).toBeLessThanOrEqual(widths.bodyClient);
  expect(widths.documentScroll).toBeLessThanOrEqual(widths.documentClient);
}

for (const [path, assetPrefix, brandPrefix] of [["/", "/assets/", "/"], ["/playtest/", "/playtest/assets/", "/playtest/"]] as const) {
  test(`正式构建在 ${path} 保持可操作且无横向溢出`, async ({ page, externalRequests, networkFailures, runtimeErrors }) => {
    void externalRequests;
    void runtimeErrors;
    void networkFailures;
    const successfulAssets: { contentType: string | null; path: string; resourceType: string }[] = [];
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin === "http://127.0.0.1:4175" && response.status() >= 200 && response.status() < 400) {
        successfulAssets.push({
          contentType: response.headers()["content-type"] ?? null,
          path: url.pathname,
          resourceType: response.request().resourceType(),
        });
      }
    });
    await page.goto(path);
    const script = successfulAssets.find((asset) => asset.resourceType === "script");
    const stylesheet = successfulAssets.find((asset) => asset.resourceType === "stylesheet");
    expect(script?.path.startsWith(assetPrefix)).toBe(true);
    expect(script?.contentType).toMatch(/^text\/javascript/u);
    expect(stylesheet?.path.startsWith(assetPrefix)).toBe(true);
    expect(stylesheet?.contentType).toMatch(/^text\/css/u);
    await expect(page).toHaveTitle(/反应域 · REACTION FIELD · Web Playtest Alpha · 0\.13\.0-alpha\.3/u);
    const iconLinks = await page.locator('link[rel~="icon"]').evaluateAll((links) => links.map((link) => ({
      href: link.getAttribute("href"),
      sizes: link.getAttribute("sizes"),
      type: link.getAttribute("type"),
    })));
    expect(iconLinks).toEqual([
      { href: "./brand/reaction-field-game-icon.svg", sizes: null, type: "image/svg+xml" },
      { href: "./brand/favicon.ico", sizes: null, type: "image/x-icon" },
      { href: "./brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { href: "./brand/favicon-16.png", sizes: "16x16", type: "image/png" },
    ]);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "./brand/apple-touch-icon-180.png");
    const brandAssets = [
      ["brand/reaction-field-game-icon.svg", "image/svg+xml"],
      ["brand/favicon.ico", "image/x-icon"],
      ["brand/favicon-32.png", "image/png"],
      ["brand/favicon-16.png", "image/png"],
      ["brand/apple-touch-icon-180.png", "image/png"],
    ] as const;
    for (const [relativeAssetPath, contentType] of brandAssets) {
      const asset = await page.evaluate(async (assetPath) => {
        const response = await fetch(assetPath, { cache: "no-store" });
        return { contentType: response.headers.get("content-type"), status: response.status };
      }, `${brandPrefix}${relativeAssetPath}`);
      expect(asset.status, relativeAssetPath).toBe(200);
      expect(asset.contentType, relativeAssetPath).toBe(contentType);
    }
    await expect(page.getByRole("heading", { name: "反应域 · 本地双人角色选择" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "新手引导：配置" })).toBeVisible();
    await expect(page.locator(".release-bar .secondary-brand")).toHaveText("REACTION FIELD");
    const feedback = page.getByRole("link", { name: "在新标签页打开 Microsoft Forms 反馈表" });
    await expect(feedback).toHaveAttribute("href", "https://forms.cloud.microsoft/r/QG8PACUnsa");
    await expect(feedback).toHaveAttribute("target", "_blank");
    await expect(feedback).toHaveAttribute("rel", "noopener noreferrer");
    await expect(page.locator(".character-selection-hero__icon")).toBeVisible();
    await expect(page.locator(".character-selection-hero__icon")).toHaveAttribute("alt", "");
    await expect(page.locator(".character-selection-hero__icon")).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByLabel("player_1 角色")).toHaveValue("laboratory_teacher");
    await expect(page.getByLabel("player_2 角色")).toHaveValue("chemical_factory_ceo");
    await page.getByRole("button", { name: "关于与帮助" }).click();
    await expect(page.getByRole("dialog", { name: "关于与帮助" })).toContainText("REACTION FIELD");
    await expect(page.getByRole("dialog", { name: "关于与帮助" })).toContainText("0.13.0-alpha.3");
    await expect(page.getByRole("dialog", { name: "关于与帮助" })).toContainText("MVP0-P10");
    await expect(page.getByRole("dialog", { name: "关于与帮助" })).toContainText(expectedBuildCommit);
    await page.keyboard.press("Escape");
    await page.getByLabel("player_1 角色").selectOption("chemical_factory_ceo");
    await page.getByLabel("player_2 角色").selectOption("acid_king");
    await page.getByRole("button", { name: "开始游戏" }).click();
    await expect(page.getByRole("heading", { exact: true, name: "主行动" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "新手引导：主行动" })).toBeVisible();
    await expect(page.locator(".release-bar .secondary-brand")).toHaveCount(0);
    const debugCard = page.locator(".debug-card").first();
    const cardDetails = debugCard.locator("details");
    const selectedBefore = await debugCard.getAttribute("class");
    await expect(debugCard.locator("button details")).toHaveCount(0);
    await cardDetails.locator("summary").click();
    await expect(cardDetails).toHaveAttribute("open", "");
    expect(await debugCard.getAttribute("class")).toBe(selectedBefore);
    await page.getByRole("button", { name: "结束本次行动" }).click();
    await page.getByRole("button", { name: "按当前阵容重开" }).click();
    await page.getByRole("button", { name: "确认重开" }).click();
    await expect(page.getByRole("heading", { exact: true, name: "主行动" })).toBeVisible();
    await page.getByRole("button", { name: "返回角色选择" }).click();
    await page.getByRole("button", { name: "确认返回" }).click();
    await expect(page.getByRole("heading", { name: "反应域 · 本地双人角色选择" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
  });
}
