import { expect, test as base, type Page } from "@playwright/test";

const test = base.extend<{ networkFailures: string[]; runtimeErrors: string[] }>({
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

for (const [path, assetPrefix] of [["/", "/assets/"], ["/playtest/", "/playtest/assets/"]] as const) {
  test(`正式构建在 ${path} 保持可操作且无横向溢出`, async ({ page, networkFailures, runtimeErrors }) => {
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
    await expect(page).toHaveTitle(/反应域 · REACTION FIELD · Web Playtest Alpha · 0\.12\.0-alpha\.1/u);
    await expect(page.getByRole("heading", { name: "反应域 · 本地双人角色选择" })).toBeVisible();
    await expect(page.locator(".release-bar .secondary-brand")).toHaveText("REACTION FIELD");
    await expect(page.getByLabel("player_1 角色")).toHaveValue("laboratory_teacher");
    await expect(page.getByLabel("player_2 角色")).toHaveValue("chemical_factory_ceo");
    await page.getByRole("button", { name: "关于与帮助" }).click();
    await expect(page.getByRole("dialog", { name: "关于与帮助" })).toContainText("REACTION FIELD");
    await page.keyboard.press("Escape");
    await page.getByLabel("player_1 角色").selectOption("chemical_factory_ceo");
    await page.getByLabel("player_2 角色").selectOption("acid_king");
    await page.getByRole("button", { name: "开始游戏" }).click();
    await expect(page.getByRole("heading", { name: "主行动" })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "主行动" })).toBeVisible();
    await page.getByRole("button", { name: "返回角色选择" }).click();
    await page.getByRole("button", { name: "确认返回" }).click();
    await expect(page.getByRole("heading", { name: "反应域 · 本地双人角色选择" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
  });
}
