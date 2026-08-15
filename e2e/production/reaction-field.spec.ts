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

    let seed = 42;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
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
    await expect(page).toHaveTitle(/反应域 · REACTION FIELD · Web Playtest Alpha · 0\.16\.0-alpha\.1/u);
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
    await expect(page.getByText(
      "当前目标：确认本地同屏双人阵容后，再开始本局公开对局。",
      { exact: true },
    )).toBeVisible();
    await expect(page.getByRole("button", { name: "展开新手引导" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.locator(".first-game-example details")).not.toHaveAttribute("open", "");
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
    const about = page.getByRole("dialog", { name: "关于与帮助" });
    await expect(about).toContainText("REACTION FIELD");
    await expect(about).toContainText("0.16.0-alpha.1");
    await expect(about).toContainText("MVP0-P10");
    await expect(about).toContainText(expectedBuildCommit);
    const repository = about.getByRole("link", { name: "在新标签页打开反应域 GitHub 仓库" });
    await expect(repository).toHaveAttribute(
      "href",
      "https://github.com/9947447-alt/Chemistry-online-Card-Game",
    );
    await expect(repository).toHaveAttribute("target", "_blank");
    await expect(repository).toHaveAttribute("rel", "noopener noreferrer");
    await page.keyboard.press("Escape");
    await page.getByLabel("player_1 角色").selectOption("chemical_factory_ceo");
    await page.getByLabel("player_2 角色").selectOption("acid_king");
    await page.getByRole("button", { name: "开始游戏" }).click();
    await expect(page.getByRole("heading", { exact: true, name: "主行动" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "新手引导：主行动" })).toBeVisible();
    await expect(page.locator(".release-bar .secondary-brand")).toHaveCount(0);

    // Phase 16 GameLog contract verification
    const gameLog = page.locator(".game-log");
    await expect(gameLog).toBeVisible();
    await expect(gameLog.locator("h2")).toHaveText("完整游戏日志");
    await expect(gameLog.locator("ol li").first()).toContainText("游戏开始，进入第 1 实验周期。");
    const initialLogCount = await gameLog.locator("ol li").count();
    expect(initialLogCount).toBeGreaterThanOrEqual(1);

    // In-place locale switch to English
    await page.getByRole("button", { name: "English" }).click();
    await expect(gameLog.locator("h2")).toHaveText("Full game log");
    await expect(gameLog.locator("ol li").first()).toContainText("Game started; entering experiment cycle 1.");
    expect(await gameLog.locator("ol li").count()).toBe(initialLogCount);

    // In-place locale switch back to Chinese
    await page.getByRole("button", { name: "中文" }).click();
    await expect(gameLog.locator("h2")).toHaveText("完整游戏日志");
    await expect(gameLog.locator("ol li").first()).toContainText("游戏开始，进入第 1 实验周期。");
    expect(await gameLog.locator("ol li").count()).toBe(initialLogCount);

    const debugCard = page.locator(".debug-card").first();
    const cardDetails = debugCard.locator("details");
    const selectedBefore = await debugCard.getAttribute("class");
    await expect(debugCard.locator("button details")).toHaveCount(0);
    await cardDetails.locator("summary").click();
    await expect(cardDetails).toHaveAttribute("open", "");
    expect(await debugCard.getAttribute("class")).toBe(selectedBefore);

    // Action progression log test
    await page.getByRole("button", { name: "结束本次行动" }).click();
    const postActionCount = await gameLog.locator("ol li").count();
    expect(postActionCount).toBeGreaterThan(initialLogCount);
    await expect(gameLog.locator("ol li").last()).toContainText("轮到 玩家 B 行动。");

    // In-place translation after action
    await page.getByRole("button", { name: "English" }).click();
    await expect(gameLog.locator("ol li").last()).toContainText("It is Player B's turn.");
    expect(await gameLog.locator("ol li").count()).toBe(postActionCount);
    await page.getByRole("button", { name: "中文" }).click();

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

test("正式构建在 / 验证 Phase 16 双语游戏日志、反应日志与 DIY 虚拟攻击展示", async ({ page, externalRequests, networkFailures, runtimeErrors }) => {
  void externalRequests;
  void runtimeErrors;
  void networkFailures;

  await page.goto("/");
  await page.getByLabel("player_1 角色").selectOption("laboratory_teacher");
  await page.getByLabel("player_2 角色").selectOption("laboratory_teacher");
  await page.getByRole("button", { name: "开始游戏" }).click();

  // Helper to select the first 10 cards in preparation panel
  async function selectFirstTenPreparationCards() {
    const candidateGrid = page.locator(".preparation-candidate-grid");
    const cards = candidateGrid.locator(".debug-card button.debug-card__select");
    await expect(cards).toHaveCount(20);

    for (let index = 0; index < 10; index += 1) {
      await cards.nth(index).click();
    }

    await page.getByRole("button", { name: "确认备课选择" }).click();
  }

  // Player A preparation: keep 10 cards
  await expect(page.getByText("当前选择玩家：玩家 A")).toBeVisible();
  await selectFirstTenPreparationCards();

  // Player B preparation: keep 10 cards
  await expect(page.getByText("当前选择玩家：玩家 B")).toBeVisible();
  await selectFirstTenPreparationCards();

  await expect(page.getByRole("heading", { exact: true, name: "主行动" })).toBeVisible();
  const gameLog = page.locator(".game-log");
  await expect(gameLog).toBeVisible();

  // Debug details in log entry
  const logDetails = gameLog.locator("details.game-log__details").first();
  await logDetails.locator("summary").click();
  await expect(logDetails.locator(".game-log__entry-id")).toContainText("日志编号：log_001");
  await page.getByRole("button", { name: "English" }).click();
  await expect(logDetails.locator("summary")).toHaveText("Debug details");
  await expect(logDetails.locator(".game-log__entry-id")).toContainText("Log ID：log_001");
  await page.getByRole("button", { name: "中文" }).click();
  await expect(logDetails.locator("summary")).toHaveText("调试详情");

  // 1. Formal DIY Virtual Attack execution
  const diyPanel = page.locator(".diy-panel");
  await expect(diyPanel).toBeVisible();

  const virtualAttackRecipes = [
    {
      id: "diy_hcl_from_h_cl",
      recipeZh: "H+ + Cl- -> 稀 HCl",
      recipeEn: "H+ + Cl- -> dilute HCl",
      productZh: "稀 HCl",
      productEn: "dilute HCl",
      kindZh: "酸性",
      kindEn: "acid",
      amount: 1,
    },
    {
      id: "diy_naoh_from_na_oh",
      recipeZh: "Na+ + OH- -> 稀 NaOH",
      recipeEn: "Na+ + OH- -> dilute NaOH",
      productZh: "稀 NaOH",
      productEn: "dilute NaOH",
      kindZh: "碱性",
      kindEn: "alkaline",
      amount: 1,
    },
    {
      id: "diy_koh_from_k_oh",
      recipeZh: "K+ + OH- -> 稀 KOH",
      recipeEn: "K+ + OH- -> dilute KOH",
      productZh: "稀 KOH",
      productEn: "dilute KOH",
      kindZh: "碱性",
      kindEn: "alkaline",
      amount: 1,
    },
    {
      id: "diy_h2so4_from_2h_so4",
      recipeZh: "2H+ + SO4^2- -> 稀 H2SO4",
      recipeEn: "2H+ + SO4^2- -> dilute H2SO4",
      productZh: "稀 H2SO4",
      productEn: "dilute H2SO4",
      kindZh: "酸性",
      kindEn: "acid",
      amount: 1,
    },
    {
      id: "diy_limewater_from_ca_2oh",
      recipeZh: "Ca2+ + 2OH- -> 石灰水 Ca(OH)2",
      recipeEn: "Ca2+ + 2OH- -> limewater Ca(OH)2",
      productZh: "石灰水 Ca(OH)2",
      productEn: "limewater Ca(OH)2",
      kindZh: "碱性",
      kindEn: "alkaline",
      amount: 1,
    },
  ];

  let selectedRecipeInfo = virtualAttackRecipes[0];
  const recipeSelect = diyPanel.locator("select").first();
  const componentSelects = diyPanel.locator(".component-slots select");

  for (const recipeInfo of virtualAttackRecipes) {
    await recipeSelect.selectOption(recipeInfo.id);
    const slotCount = await componentSelects.count();
    let allAvailable = true;
    for (let i = 0; i < slotCount; i += 1) {
      const optCount = await componentSelects.nth(i).locator("option").count();
      if (optCount <= 1) {
        allAvailable = false;
        break;
      }
    }
    if (allAvailable) {
      selectedRecipeInfo = recipeInfo;
      for (let i = 0; i < slotCount; i += 1) {
        await componentSelects.nth(i).selectOption({ index: 1 });
      }
      break;
    }
  }

  await page.getByRole("button", { name: "执行主动 DIY" }).click();

  const logItems = gameLog.locator("ol li");
  const diyLog = logItems.last();
  const logCountAfterDiy = await logItems.count();

  // Assert DIY Virtual Attack in Chinese: recipe, virtual product, waiting for response base damage
  const expectedDiyZh = `玩家 A 主动 DIY 使用 ${selectedRecipeInfo.recipeZh}，生成虚拟产品 ${selectedRecipeInfo.productZh}；对 玩家 B 的${selectedRecipeInfo.kindZh}伤害基础值为 ${selectedRecipeInfo.amount} 点，等待响应；不创建实体卡牌。`;
  await expect(diyLog).toContainText(expectedDiyZh);

  // In-place locale switch to English for DIY log
  await page.getByRole("button", { name: "English" }).click();
  const expectedDiyEn = `Player A used active DIY recipe ${selectedRecipeInfo.recipeEn} to produce the virtual product ${selectedRecipeInfo.productEn}; the base ${selectedRecipeInfo.kindEn} damage value to Player B is ${selectedRecipeInfo.amount}, awaiting response; no entity card is created.`;
  await expect(diyLog).toContainText(expectedDiyEn);
  expect(await logItems.count()).toBe(logCountAfterDiy);

  await page.getByRole("button", { name: "中文" }).click();

  // 2. Formal Response execution triggering Reaction
  const responsePanel = page.locator(".response-panel");
  await expect(responsePanel).toBeVisible();
  const responseCards = responsePanel.locator(".debug-card button.debug-card__select");
  await expect(responseCards.first()).toBeVisible();
  await responseCards.first().click();

  const reactionItem = gameLog.locator("li:has(.game-log__reaction)").last();
  await expect(reactionItem).toBeVisible();
  const reactionLog = reactionItem.locator(".game-log__reaction");
  const logCountAfterReaction = await logItems.count();

  // Assert Reaction in Chinese: neutralization, trigger, outcome
  await expect(reactionLog).toContainText("成功反应 · 酸碱中和");
  await expect(reactionLog).toContainText("入口：单目标伤害响应");
  await expect(reactionLog).toContainText("伤害已完全抵消；生成虚拟结果 H2O");
  await expect(reactionItem.locator(".game-log__message")).toContainText("已记录一项成功反应。");

  // In-place locale switch to English for Reaction log
  await page.getByRole("button", { name: "English" }).click();
  await expect(reactionLog).toContainText("Successful reaction · Acid-base neutralization");
  await expect(reactionLog).toContainText("Entry：Single-target damage response");
  await expect(reactionLog).toContainText("Damage was fully cancelled; virtual result H2O was produced");
  await expect(reactionItem.locator(".game-log__message")).toContainText("A successful reaction was recorded.");
  expect(await logItems.count()).toBe(logCountAfterReaction);

  await page.getByRole("button", { name: "中文" }).click();
});
