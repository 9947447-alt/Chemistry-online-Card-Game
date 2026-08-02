import {
  expect,
  test as base,
  type Page,
} from "@playwright/test";

const test = base.extend<{ runtimeErrors: string[] }>({
  runtimeErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        errors.push(`console.${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    await use(errors);
    expect(errors).toEqual([]);
  },
});

async function startNoTeacherGame(page: Page) {
  await page.goto("/");
  await page.getByLabel("player_1 角色").selectOption("chemical_factory_ceo");
  await page.getByLabel("player_2 角色").selectOption("acid_king");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByRole("heading", { name: "主行动" })).toBeVisible();
}

async function selectPreparationCards(page: Page) {
  const cards = page.locator(".preparation-candidate-grid button");
  await expect(cards).toHaveCount(20);
  for (let index = 0; index < 10; index += 1) {
    await cards.nth(index).click();
  }
  await page.getByRole("button", { name: "确认备课选择" }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  expect(widths.documentScrollWidth).toBeLessThanOrEqual(widths.documentClientWidth);
  expect(widths.bodyScrollWidth).toBeLessThanOrEqual(widths.bodyClientWidth);
  expect(widths.documentClientWidth).toBeLessThanOrEqual(widths.viewportWidth);
  expect(widths.bodyClientWidth).toBeLessThanOrEqual(widths.viewportWidth);
}

async function expectFactoryCount(page: Page, expectedCount: number) {
  await expect(page.getByTestId("fixture-factory-count")).toHaveText(String(expectedCount));
}

async function openAndCloseAbout(page: Page) {
  const aboutTrigger = page.getByRole("button", { name: "关于与帮助" });
  await aboutTrigger.click();
  const dialog = page.getByRole("dialog", { name: "关于与帮助" });
  await expect(dialog).toBeVisible();
  await expect(page.locator(".application-shell")).toHaveAttribute("inert", "");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  const closeButton = page.getByRole("button", { name: "关闭帮助" });
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();
  await closeButton.click();
  await expect(dialog).toBeHidden();
  await expect(aboutTrigger).toBeFocused();
}

test("默认配置、正式元数据与 configuring 帮助界面", async ({ page, runtimeErrors }) => {
  void runtimeErrors;
  await page.goto("/");

  await expect(page.getByRole("heading", {
    name: "反应域 · 本地双人角色选择",
  })).toBeVisible();
  await expect(page.getByLabel("player_1 角色")).toHaveValue("laboratory_teacher");
  await expect(page.getByLabel("player_2 角色")).toHaveValue("chemical_factory_ceo");
  await expect(page.getByText("Web Playtest Alpha · v0.12.0-alpha.1 · MVP0-P10", {
    exact: false,
  })).toBeVisible();

  const aboutTrigger = page.getByRole("button", { name: "关于与帮助" });
  await aboutTrigger.click();
  const dialog = page.getByRole("dialog", { name: "关于与帮助" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("七个角色与试玩能力")).toBeVisible();
  await expect(dialog.getByText("零网络遥测，无账号、无联网、无存档", {
    exact: false,
  })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(aboutTrigger).toBeFocused();
});

test("默认老师/CEO、双老师备课与无老师 mainAction", async ({ page, runtimeErrors }) => {
  void runtimeErrors;
  await page.goto("/");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByRole("heading", { name: "实验室老师 · 备课" })).toBeVisible();

  await page.getByRole("button", { name: "返回角色选择" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "确认返回" }).click();
  await page.getByLabel("player_2 角色").selectOption("laboratory_teacher");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByText("当前选择玩家：玩家 A")).toBeVisible();
  await selectPreparationCards(page);
  await expect(page.getByText("当前选择玩家：玩家 B")).toBeVisible();
  await selectPreparationCards(page);
  await expect(page.getByRole("heading", { name: "主行动" })).toBeVisible();

  await startNoTeacherGame(page);
  await expect(page.getByRole("heading", { name: "主行动" })).toBeVisible();
});

test("playing 重开和返回配置的确认、焦点、Escape 与原子取消", async ({ page, runtimeErrors }) => {
  void runtimeErrors;
  await startNoTeacherGame(page);
  await expectFactoryCount(page, 1);
  await openAndCloseAbout(page);
  const initialLogCount = await page.locator(".game-log li").count();
  const restart = page.getByRole("button", { name: "按当前阵容重开" });

  await restart.click();
  const restartDialog = page.getByRole("alertdialog", { name: "确认按当前阵容重开？" });
  await expect(restartDialog).toBeVisible();
  await expect(page.locator(".application-shell")).toHaveAttribute("inert", "");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const cancel = page.getByRole("button", { name: "取消" });
  const confirmRestart = page.getByRole("button", { name: "确认重开" });
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirmRestart).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(confirmRestart).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(restartDialog).toBeHidden();
  await expect(restart).toBeFocused();
  await expect(page.locator(".game-log li")).toHaveCount(initialLogCount);
  await expectFactoryCount(page, 1);

  await restart.click();
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirmRestart).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(restartDialog).toBeHidden();
  await expectFactoryCount(page, 2);
  await expect(page.locator(".game-log li")).toHaveCount(initialLogCount);

  await page.getByRole("button", { name: "结束本次行动" }).click();
  await expect(page.locator(".game-log li")).toHaveCount(initialLogCount + 1);
  await restart.click();
  await page.getByRole("button", { name: "取消" }).click();
  await expect(restart).toBeFocused();
  await expect(page.locator(".game-log li")).toHaveCount(initialLogCount + 1);
  await restart.click();
  await page.getByRole("button", { name: "确认重开" }).dblclick();
  await expectFactoryCount(page, 3);
  await expect(page.locator(".game-log li")).toHaveCount(initialLogCount);

  const returnButton = page.getByRole("button", { name: "返回角色选择" });
  await returnButton.click();
  await page.getByRole("button", { name: "取消" }).click();
  await expect(page.getByRole("heading", { name: "主行动" })).toBeVisible();
  await returnButton.click();
  await page.getByRole("button", { name: "确认返回" }).dblclick();
  await expect(page.getByRole("heading", {
    name: "反应域 · 本地双人角色选择",
  })).toBeVisible();
  await expect(page.getByLabel("player_1 角色")).toHaveValue("chemical_factory_ceo");
  await expect(page.getByLabel("player_2 角色")).toHaveValue("acid_king");
  await expectFactoryCount(page, 3);
});

test("gameOver 后重开和返回角色选择均无需确认，帮助仍可访问", async ({ page, runtimeErrors }) => {
  void runtimeErrors;
  await page.goto("/?scenario=game-over");
  await expectFactoryCount(page, 1);
  await expect(page.getByRole("heading", { name: "本地双人公开对局" })).toBeVisible();
  await page.getByRole("button", { name: "关于与帮助" }).click();
  await expect(page.getByRole("dialog", { name: "关于与帮助" })).toBeVisible();
  await page.getByRole("button", { name: "关闭帮助" }).click();

  await page.getByRole("button", { name: "按当前阵容重开" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "主行动" })).toBeVisible();
  await expectFactoryCount(page, 2);

  await page.goto("/?scenario=game-over");
  await page.getByRole("button", { name: "返回角色选择" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("heading", {
    name: "反应域 · 本地双人角色选择",
  })).toBeVisible();
});

test("fatal 会话只允许全新恢复或返回配置", async ({ page, runtimeErrors }) => {
  void runtimeErrors;
  await page.goto("/?scenario=fatal");
  await expect(page.getByRole("heading", { name: "当前对局已安全停止" })).toBeVisible();
  await expect(page.getByText("GAME_ACTION_FAILED", { exact: true })).toBeVisible();
  await expect(page.getByText("旧对局状态已从本地会话中移除", {
    exact: false,
  })).toBeVisible();
  await expect(page.getByText("laboratory_teacher")).toHaveCount(0);
  await expect(page.getByText("chemical_factory_ceo")).toHaveCount(0);
  await page.getByRole("button", { name: "按原阵容创建全新对局" }).click();
  await expect(page.getByRole("heading", { name: "实验室老师 · 备课" })).toBeVisible();

  await page.goto("/?scenario=fatal");
  await page.getByRole("button", { name: "返回角色选择" }).click();
  await expect(page.getByRole("heading", {
    name: "反应域 · 本地双人角色选择",
  })).toBeVisible();
});

test("React ErrorBoundary 显示脱敏兜底且提供重新加载", async ({ page, runtimeErrors }) => {
  void runtimeErrors;
  await page.goto("/?scenario=render-error");
  await expect(page.getByRole("heading", {
    name: "页面遇到无法继续处理的错误",
  })).toBeVisible();
  await expect(page.getByText("UI_RENDER_FAILED", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "重新加载页面" })).toBeVisible();
  await expect(page.getByText("E2E_PRIVATE_RENDER_ERROR")).toHaveCount(0);
});

test("成功反应公开摘要不泄漏内部状态标识，调试详情保留结构化诊断", async ({ page, runtimeErrors }) => {
  void runtimeErrors;
  await page.goto("/?scenario=reaction-h2o");
  await expect(page.getByText("伤害已完全抵消；生成虚拟结果 H2O")).toBeVisible();

  await page.goto("/?scenario=reaction-co2");
  await expect(page.getByText("伤害已完全抵消；生成虚拟结果 CO2")).toBeVisible();

  await page.goto("/?scenario=reaction-so2-immediate");
  await expect(page.getByText("入口：即时多目标响应")).toBeVisible();
  await expect(page.getByText("结果：伤害已完全抵消")).toBeVisible();

  await page.goto("/?scenario=reaction-so2-status");
  const reaction = page.locator(".game-log__reaction");
  await expect(reaction).toContainText("入口：状态处理响应");
  await expect(reaction).toContainText("结果：待处理状态已移除");
  await expect(reaction).not.toContainText("status_phase11_fixture_so2");
  await expect(reaction).not.toContainText("SO2_LEAK");
  const details = page.locator(".game-log__details").last();
  await expect(details).not.toHaveAttribute("open", "");
  await details.locator("summary").click();
  await expect(details).toContainText("status_phase11_fixture_so2");
});

test("真实 reducer 长日志可滚动且页面无水平溢出", async ({ page, runtimeErrors }) => {
  void runtimeErrors;
  await page.goto("/?scenario=long-log");
  await expectFactoryCount(page, 1);
  const logEntries = page.locator(".game-log li");
  expect(await logEntries.count()).toBeGreaterThanOrEqual(100);
  const logList = page.locator(".game-log ol");
  const logDimensions = await logList.evaluate((element) => ({
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
  }));
  expect(logDimensions.scrollHeight).toBeGreaterThan(logDimensions.clientHeight);
  expect(logDimensions.overflowY).toMatch(/auto|scroll/u);
  await expectNoHorizontalOverflow(page);
});

test("390×844 覆盖 configuring、playing、reaction、About、fatal 与 gameOver", async ({ page, runtimeErrors }) => {
  void runtimeErrors;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expectNoHorizontalOverflow(page);
  await expect(page.getByText("备课", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "关于与帮助" }).click();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "关闭帮助" }).click();

  await startNoTeacherGame(page);
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "关于与帮助" }).click();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "关闭帮助" }).click();

  await page.goto("/?scenario=reaction-so2-status");
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "关于与帮助" }).click();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "关闭帮助" }).click();

  await page.goto("/?scenario=fatal");
  await expectNoHorizontalOverflow(page);

  await page.goto("/?scenario=game-over");
  await expectNoHorizontalOverflow(page);
  await openAndCloseAbout(page);
});
