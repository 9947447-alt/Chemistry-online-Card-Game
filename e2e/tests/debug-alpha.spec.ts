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
    page.on("requestfailed", (request) => errors.push(
      `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`,
    ));
    await use(errors);
    expect(errors).toEqual([]);
  },
});

test.use({ locale: "zh-CN" });

async function startNoTeacherGame(page: Page) {
  await page.goto("/");
  await page.getByLabel("player_1 角色").selectOption("chemical_factory_ceo");
  await page.getByLabel("player_2 角色").selectOption("acid_king");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByRole("heading", { exact: true, name: "主行动" })).toBeVisible();
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

async function expectGuidanceCopy(
  page: Page,
  heading: string,
  actor: string,
  entry: string,
  concept: string,
) {
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  const expand = page.getByRole("button", { name: "展开新手引导" });
  if (await expand.isVisible().catch(() => false)) {
    await expand.click();
  }
  await expect(page.getByText(actor, { exact: true })).toBeVisible();
  await expect(page.getByText(entry, { exact: true })).toBeVisible();
  await expect(page.getByText(concept, { exact: true })).toBeVisible();
}

async function readGuidanceInvariants(page: Page) {
  return page.evaluate(() => {
    const summaryValues = Array.from(document.querySelectorAll(".debug-summary .summary-grid dd"));
    const detailRows = Array.from(document.querySelectorAll(".debug-detail-list > div"));
    const readDetail = (label: string) => detailRows.find(
      (row) => row.querySelector("dt")?.textContent === label,
    )?.querySelector("dd")?.textContent ?? null;
    const logEntries = Array.from(document.querySelectorAll(".game-log li"))
      .map((entry) => entry.textContent ?? "");
    const activePlayerSection = document.querySelector(".active-pill")?.closest("section");
    const preparationPanel = document.querySelector(".preparation-panel");
    const counterattackPanel = document.querySelector(
      '[aria-labelledby="experiment-counterattack-title"]',
    );

    return {
      currentPlayer: summaryValues[3]?.textContent ?? null,
      currentPlayerId: activePlayerSection?.getAttribute("aria-labelledby")?.replace(/-title$/u, "") ?? null,
      detailText: document.querySelector(".debug-detail-list")?.textContent ?? "",
      logCount: logEntries.length,
      logEntries,
      pendingLaboratoryPreparation: preparationPanel?.textContent ?? "无",
      pendingResponse: readDetail("PendingResponse") ?? "无",
      pendingStatusHandling: readDetail("pendingStatusHandling") ?? "无",
      pendingExperimentCounterattack: counterattackPanel?.textContent ?? "无",
      phase: readDetail("phase"),
    };
  });
}

async function openAndCloseAbout(page: Page) {
  const aboutTrigger = page.getByRole("button", { name: "关于与帮助" });
  await aboutTrigger.click();
  const dialog = page.getByRole("dialog", { name: "关于与帮助" });
  await expect(dialog).toBeVisible();
  await expect(page.locator(".application-shell")).toHaveAttribute("inert", "");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  const closeButton = page.getByRole("button", { name: "关闭帮助" });
  const repositoryLink = dialog.getByRole("link", {
    name: "在新标签页打开反应域 GitHub 仓库",
  });
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(repositoryLink).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();
  await closeButton.click();
  await expect(dialog).toBeHidden();
  await expect(aboutTrigger).toBeFocused();
}

test("Alpha 4 language layer changes only presentation and keeps feedback static", async ({ page, runtimeErrors }) => {
  void runtimeErrors;
  await startNoTeacherGame(page);
  expect(await page.evaluate(() => ({
    language: navigator.language,
    languages: navigator.languages,
  }))).toEqual({ language: "zh-CN", languages: ["zh-CN"] });

  const beforeLanguageSwitch = await page.evaluate(() => ({
    cards: document.querySelectorAll(".debug-card").length,
    detailText: document.querySelector(".debug-detail-list")?.textContent ?? "",
    logEntries: Array.from(document.querySelectorAll(".game-log li")).map((entry) => entry.textContent),
    phase: Array.from(document.querySelectorAll(".debug-detail-list > div")).find(
      (row) => row.querySelector("dt")?.textContent === "phase",
    )?.querySelector("dd")?.textContent ?? null,
  }));

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { exact: true, name: "Main action" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "New player guidance: Main action" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Full game log" })).toBeVisible();
  await expect(page.locator(".game-log")).toContainText("entering experiment cycle 1");

  const feedback = page.getByRole("link", { name: "Open Microsoft Forms feedback in a new tab" });
  await expect(feedback).toHaveAttribute("href", "https://forms.cloud.microsoft/r/QG8PACUnsa");
  await expect(feedback).toHaveAttribute("target", "_blank");
  await expect(feedback).toHaveAttribute("rel", "noopener noreferrer");

  expect(await page.evaluate(() => ({
    cookie: document.cookie,
    localStorage: window.localStorage.length,
    sessionStorage: window.sessionStorage.length,
    formsRequests: performance.getEntriesByType("resource").filter((entry) =>
      entry.name.includes("forms.cloud.microsoft"),
    ).length,
  }))).toEqual({ cookie: "", localStorage: 0, sessionStorage: 0, formsRequests: 0 });

  await page.getByRole("button", { name: "中文" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  expect(await page.evaluate(() => ({
    cards: document.querySelectorAll(".debug-card").length,
    detailText: document.querySelector(".debug-detail-list")?.textContent ?? "",
    logEntries: Array.from(document.querySelectorAll(".game-log li")).map((entry) => entry.textContent),
    phase: Array.from(document.querySelectorAll(".debug-detail-list > div")).find(
      (row) => row.querySelector("dt")?.textContent === "phase",
    )?.querySelector("dd")?.textContent ?? null,
  }))).toEqual(beforeLanguageSwitch);

  await page.getByRole("button", { name: "English" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("heading", { name: "反应域 · 本地双人角色选择" })).toBeVisible();
});

test.describe("English browser preference", () => {
  test.use({ locale: "en-US" });

  test("Alpha 4 suggests English from an English browser preference", async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await page.goto("/");

    expect(await page.evaluate(() => ({
      language: navigator.language,
      languages: navigator.languages,
    }))).toEqual({ language: "en-US", languages: ["en-US"] });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", {
      name: "REACTION FIELD · Local two-player character selection",
    })).toBeVisible();
    await expect(page.getByLabel("player_1 character")).toHaveValue("laboratory_teacher");
  });
});

test("Alpha 4 English display covers setup, all public phases, dialogs, and fatal fallback", async ({ page, runtimeErrors }) => {
  void runtimeErrors;
  const switchToEnglish = async (path: string) => {
    await page.goto(path);
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  };

  await switchToEnglish("/");
  await expect(page.getByRole("heading", { name: "REACTION FIELD · Local two-player character selection" })).toBeVisible();
  await expect(page.getByText(
    "Current goal: Confirm the local shared-screen two-player lineup before starting this public game.",
    { exact: true },
  )).toBeVisible();
  await expect(page.getByRole("button", { name: "Expand guidance" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.getByRole("button", { name: "Expand guidance" }).click();
  await page.getByRole("button", { name: "Hide new player guidance" }).click();
  const englishRestore = page.getByRole("button", { name: "Show new player guidance again" });
  await expect(page.getByText(
    "Current goal: Confirm the local shared-screen two-player lineup before starting this public game.",
    { exact: true },
  )).toBeVisible();
  await expect(page.getByText("Both players", { exact: true })).toBeHidden();
  await expect(page.getByText(
    "Use Player A and Player B character selection and Start game below.",
    { exact: true },
  )).toBeHidden();
  await expect(page.getByText(
    "Both hands are public; refreshing returns to the default character selections and does not save this game.",
    { exact: true },
  )).toBeHidden();
  await expect(englishRestore).toBeFocused();
  await englishRestore.click();
  await expect(page.getByRole("button", { name: "Collapse guidance" })).toBeFocused();
  await expect(page.getByText("Both players", { exact: true })).toBeVisible();
  await page.locator(".first-game-example summary").click();
  await expect(page.locator(".first-game-example")).toContainText(
    "Play a card: The active player chooses a card through the available action controls.",
  );
  await page.getByRole("button", { name: "About & help" }).click();
  const englishAbout = page.getByRole("dialog", { name: "About & help" });
  await expect(englishAbout).toBeVisible();
  await expect(englishAbout.getByRole("link", {
    name: "Open the Reaction Field GitHub repository in a new tab",
  })).toHaveAttribute("rel", "noopener noreferrer");
  await page.getByRole("button", { name: "Close help" }).click();

  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.getByRole("heading", { name: "Laboratory Teacher · Preparation" })).toBeVisible();

  await startNoTeacherGame(page);
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Main action", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "End this action" }).click();
  await page.getByRole("button", { name: "Restart with current lineup" }).click();
  await expect(page.getByRole("alertdialog", { name: "Restart with the current lineup?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await switchToEnglish("/?scenario=response-window");
  await expect(page.getByRole("heading", { name: "Response window" })).toBeVisible();
  await switchToEnglish("/?scenario=status-window");
  await expect(page.getByRole("heading", { name: "Status handling window" })).toBeVisible();
  await switchToEnglish("/?scenario=experiment-counterattack-window");
  await expect(page.getByRole("heading", { name: "Experiment Counterattack selection" })).toBeVisible();
  await switchToEnglish("/?scenario=reaction-h2o");
  await expect(page.locator(".successful-reaction-notice")).toHaveCount(0);
  await expect(page.locator(".game-log__reaction")).toContainText(
    "Successful reaction · Acid-base neutralization",
  );
  await switchToEnglish("/?scenario=game-over");
  await expect(page.getByRole("heading", { name: "Game over", exact: true })).toBeVisible();
  await switchToEnglish("/?scenario=fatal");
  await expect(page.getByRole("heading", { name: "The current game stopped safely" })).toBeVisible();
});

test("默认配置、正式元数据与 configuring 帮助界面", async ({ page, runtimeErrors }) => {
  void runtimeErrors;
  await page.goto("/");

  await expect(page.getByRole("heading", {
    name: "反应域 · 本地双人角色选择",
  })).toBeVisible();
  await expect(page.getByLabel("player_1 角色")).toHaveValue("laboratory_teacher");
  await expect(page.getByLabel("player_2 角色")).toHaveValue("chemical_factory_ceo");
  await expect(page.getByText("Web Playtest Alpha · v0.16.0-alpha.1 · MVP0-P10", {
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

test("新手引导覆盖真实流程和 fixture 窗口，并保持可键盘恢复", async ({ page, runtimeErrors }) => {
  void runtimeErrors;
  await page.goto("/");
  await expect(page.getByText(
    "当前目标：确认本地同屏双人阵容后，再开始本局公开对局。",
    { exact: true },
  )).toBeVisible();
  const initialExpand = page.getByRole("button", { name: "展开新手引导" });
  await expect(initialExpand).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("双方玩家", { exact: true })).toBeHidden();

  const playerASelect = page.getByLabel("player_1 角色");
  const playerBSelect = page.getByLabel("player_2 角色");
  const startButton = page.getByRole("button", { name: "开始游戏" });
  const firstGameExample = page.locator(".first-game-example");
  expect(await page.evaluate(() => {
    const playerA = document.querySelector('[aria-label="player_1 角色"]');
    const playerB = document.querySelector('[aria-label="player_2 角色"]');
    const start = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "开始游戏",
    );
    const guidance = document.querySelector(".new-player-guidance");
    const example = document.querySelector(".first-game-example");
    const catalog = document.querySelector(".character-catalog");
    if (!playerA || !playerB || !start || !guidance || !example || !catalog) return false;
    const follows = (left: Node, right: Node) => Boolean(
      left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    return follows(playerA, playerB) && follows(playerB, start) &&
      follows(start, guidance) && follows(guidance, example) && follows(example, catalog);
  })).toBe(true);

  await playerASelect.focus();
  await page.keyboard.press("Tab");
  await expect(playerBSelect).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(startButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(initialExpand).toBeFocused();

  const exampleDetails = firstGameExample.locator("details");
  await expect(exampleDetails).not.toHaveAttribute("open", "");
  await exampleDetails.locator("summary").click();
  await expect(firstGameExample).toContainText("出牌：当前玩家选择一张符合现有操作条件的牌。");
  await expect(firstGameExample).toContainText("响应：另一位玩家可使用现有响应入口。");
  await expect(firstGameExample).toContainText(
    "反应与记录：若形成已实现的成功反应，结果显示并写入公开日志。",
  );
  await expect(firstGameExample.locator("button")).toHaveCount(0);

  await expectGuidanceCopy(
    page,
    "新手引导：配置",
    "双方玩家",
    "使用下方“玩家 A”“玩家 B”角色选择与“开始游戏”。",
    "双方手牌公开；刷新页面会回到默认角色预选，不保存当前对局。",
  );
  const configuringGuidanceBaseline = await readGuidanceInvariants(page);
  const collapse = page.getByRole("button", { name: "折叠新手引导" });
  await collapse.focus();
  await page.keyboard.press("Enter");
  const expand = page.getByRole("button", { name: "展开新手引导" });
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expect(expand).toBeFocused();
  expect(await readGuidanceInvariants(page)).toEqual(configuringGuidanceBaseline);
  await page.keyboard.press("Space");
  await expect(collapse).toBeFocused();
  expect(await readGuidanceInvariants(page)).toEqual(configuringGuidanceBaseline);
  const skip = page.getByRole("button", { name: "跳过新手引导" });
  await skip.focus();
  await page.keyboard.press("Space");
  const show = page.getByRole("button", { name: "重新显示新手引导" });
  await expect(page.getByText(
    "当前目标：确认本地同屏双人阵容后，再开始本局公开对局。",
    { exact: true },
  )).toBeVisible();
  await expect(page.getByText("双方玩家", { exact: true })).toBeHidden();
  await expect(page.getByText(
    "使用下方“玩家 A”“玩家 B”角色选择与“开始游戏”。",
    { exact: true },
  )).toBeHidden();
  await expect(page.getByText(
    "双方手牌公开；刷新页面会回到默认角色预选，不保存当前对局。",
    { exact: true },
  )).toBeHidden();
  await expect(show).toBeFocused();
  expect(await readGuidanceInvariants(page)).toEqual(configuringGuidanceBaseline);
  await page.keyboard.press("Enter");
  await expect(collapse).toBeFocused();
  expect(await readGuidanceInvariants(page)).toEqual(configuringGuidanceBaseline);
  await expectGuidanceCopy(
    page,
    "新手引导：配置",
    "双方玩家",
    "使用下方“玩家 A”“玩家 B”角色选择与“开始游戏”。",
    "双方手牌公开；刷新页面会回到默认角色预选，不保存当前对局。",
  );
  const skipBeforeReload = page.getByRole("button", { name: "跳过新手引导" });
  await skipBeforeReload.focus();
  await page.keyboard.press("Enter");
  const showBeforeReload = page.getByRole("button", { name: "重新显示新手引导" });
  await expect(showBeforeReload).toBeVisible();
  await expect(showBeforeReload).toBeFocused();
  expect(await readGuidanceInvariants(page)).toEqual(configuringGuidanceBaseline);
  await page.reload();
  await expectGuidanceCopy(
    page,
    "新手引导：配置",
    "双方玩家",
    "使用下方“玩家 A”“玩家 B”角色选择与“开始游戏”。",
    "双方手牌公开；刷新页面会回到默认角色预选，不保存当前对局。",
  );
  expect(await readGuidanceInvariants(page)).toEqual(configuringGuidanceBaseline);

  await page.getByRole("button", { name: "开始游戏" }).click();
  await expectGuidanceCopy(
    page,
    "新手引导：备课",
    "当前选择者：玩家 A",
    "使用下方“实验室老师 · 备课”面板中的卡牌与“确认备课选择”。",
    "备课选择的数量和可选范围由现有面板显示；引导不重复判定。",
  );
  await page.getByRole("button", { name: "返回角色选择" }).click();
  await page.getByRole("button", { name: "确认返回" }).click();
  await page.getByLabel("player_1 角色").selectOption("chemical_factory_ceo");
  await page.getByLabel("player_2 角色").selectOption("acid_king");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expectGuidanceCopy(
    page,
    "新手引导：主行动",
    "当前行动者：玩家 A",
    "使用下方“主行动”“主动 DIY”与角色技能入口，或“结束本次行动”。",
    "场面基准只说明当前场面的参考；是否可关联以现有操作面板的提示为准。",
  );
  const beforeGuidanceInteractions = await readGuidanceInvariants(page);
  const factoryCountBeforeGuidanceInteractions = await page
    .getByTestId("fixture-factory-count")
    .textContent();
  expect(factoryCountBeforeGuidanceInteractions).not.toBeNull();
  const playingCollapse = page.getByRole("button", { name: "折叠新手引导" });
  await playingCollapse.focus();
  await page.keyboard.press("Space");
  const playingExpand = page.getByRole("button", { name: "展开新手引导" });
  await expect(playingExpand).toBeFocused();
  expect(await readGuidanceInvariants(page)).toEqual(beforeGuidanceInteractions);
  await playingExpand.press("Enter");
  await expect(playingCollapse).toBeFocused();
  expect(await readGuidanceInvariants(page)).toEqual(beforeGuidanceInteractions);
  const playingSkip = page.getByRole("button", { name: "跳过新手引导" });
  await playingSkip.press("Space");
  const playingShow = page.getByRole("button", { name: "重新显示新手引导" });
  await expect(playingShow).toBeFocused();
  expect(await readGuidanceInvariants(page)).toEqual(beforeGuidanceInteractions);
  await playingShow.press("Enter");
  await expect(playingCollapse).toBeFocused();
  expect(await readGuidanceInvariants(page)).toEqual(beforeGuidanceInteractions);
  await expectGuidanceCopy(
    page,
    "新手引导：主行动",
    "当前行动者：玩家 A",
    "使用下方“主行动”“主动 DIY”与角色技能入口，或“结束本次行动”。",
    "场面基准只说明当前场面的参考；是否可关联以现有操作面板的提示为准。",
  );
  const afterGuidanceInteractions = await readGuidanceInvariants(page);
  expect(afterGuidanceInteractions).toEqual(beforeGuidanceInteractions);
  await expectFactoryCount(
    page,
    Number(factoryCountBeforeGuidanceInteractions),
  );

  await page.goto("/?scenario=response-window");
  await expectGuidanceCopy(
    page,
    "新手引导：响应",
    "当前响应者：玩家 B",
    "使用下方“响应窗口”内显示的选项，或“放弃响应”。",
    "响应 DIY 在 MVP0-P10 中关闭；引导不判断任何具体卡牌是否合法。",
  );
  await page.goto("/?scenario=status-window");
  await expectGuidanceCopy(
    page,
    "新手引导：状态处理",
    "当前处理者：玩家 A",
    "使用下方“状态处理窗口”内显示的选项，或“放弃处理”。",
    "可用处理牌由现有状态面板决定；引导不创建或判断处理选项。",
  );
  await page.goto("/?scenario=experiment-counterattack-window");
  await expectGuidanceCopy(
    page,
    "新手引导：实验反击",
    "当前反击者：玩家 B",
    "使用下方“实验反击选择”面板中当前显示的选项。",
    "真实金属选项仍延期；此处不会补充不存在的卡牌或选项。",
  );
  await expect(page.locator('section[aria-labelledby="player_2-title"]').getByText("7 / 8", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "选择回复", exact: true })).toBeEnabled();
  await page.goto("/?scenario=game-over");
  await expectGuidanceCopy(
    page,
    "新手引导：对局结束",
    "本局结果：玩家 B 获胜",
    "查看公开日志，并使用页面顶部“按当前阵容重开”或“返回角色选择”。",
    "结果已由既有对局结算确定；引导不改变胜负或重开行为。",
  );
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
  await expect(page.getByRole("heading", { exact: true, name: "主行动" })).toBeVisible();

  await startNoTeacherGame(page);
  await expect(page.getByRole("heading", { exact: true, name: "主行动" })).toBeVisible();
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
  await expect(page.getByRole("heading", { exact: true, name: "主行动" })).toBeVisible();
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
  const gameOverRepository = page.getByRole("link", { name: "在新标签页打开反应域 GitHub 仓库" });
  await expect(gameOverRepository).toHaveAttribute(
    "href",
    "https://github.com/9947447-alt/reaction-field",
  );
  await expect(gameOverRepository).toHaveAttribute("target", "_blank");
  await expect(gameOverRepository).toHaveAttribute("rel", "noopener noreferrer");
  await page.getByRole("button", { name: "关于与帮助" }).click();
  const about = page.getByRole("dialog", { name: "关于与帮助" });
  await expect(about).toBeVisible();
  const aboutRepository = about.getByRole("link", { name: "在新标签页打开反应域 GitHub 仓库" });
  await expect(aboutRepository).toHaveAttribute(
    "href",
    "https://github.com/9947447-alt/reaction-field",
  );
  await expect(aboutRepository).toHaveAttribute("target", "_blank");
  await expect(aboutRepository).toHaveAttribute("rel", "noopener noreferrer");
  await page.getByRole("button", { name: "关闭帮助" }).click();

  await page.getByRole("button", { name: "按当前阵容重开" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { exact: true, name: "主行动" })).toBeVisible();
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
  await expect(page.locator(".successful-reaction-notice")).toHaveCount(0);
  await expect(page.locator(".game-log__reaction")).toContainText("成功反应 · 酸碱中和");
  await expect(page.locator(".game-log__reaction")).toContainText("伤害已完全抵消；生成虚拟结果 H2O");

  await page.goto("/?scenario=reaction-co2");
  await expect(page.locator(".successful-reaction-notice")).toHaveCount(0);
  await expect(page.locator(".game-log__reaction")).toContainText("成功反应 · 酸与碳酸盐");
  await expect(page.locator(".game-log__reaction")).toContainText("伤害已完全抵消；生成虚拟结果 CO2");

  await page.goto("/?scenario=reaction-so2-immediate");
  await expect(page.locator(".successful-reaction-notice")).toHaveCount(0);
  await expect(page.locator(".game-log__reaction")).toContainText("成功反应 · SO2 碱性吸收");
  await expect(page.getByText("入口：即时多目标响应")).toBeVisible();
  await expect(page.getByText("结果：伤害已完全抵消")).toBeVisible();

  await page.goto("/?scenario=reaction-so2-status");
  await expect(page.locator(".successful-reaction-notice")).toHaveCount(0);
  const reaction = page.locator(".game-log__reaction");
  await expect(reaction).toContainText("成功反应 · SO2 碱性吸收");
  await expect(reaction).toContainText("入口：状态处理响应");
  await expect(reaction).toContainText("结果：待处理状态已移除");
  await expect(reaction).not.toContainText("status_phase11_fixture_so2");
  await expect(reaction).not.toContainText("SO2_LEAK");
  const details = page.locator(".game-log__details").last();
  await expect(details).not.toHaveAttribute("open", "");
  await details.locator("summary").click();
  await expect(details).toContainText("status_phase11_fixture_so2");

  await page.goto("/?scenario=response-window");
  await expect(page.locator(".successful-reaction-notice")).toHaveCount(0);
  await page.locator(".response-panel").getByRole("button", {
    name: "稀 NaOH 可在当前对局中选择",
  }).click();
  await expect(page.locator(".successful-reaction-notice")).toContainText("成功反应 · 酸碱中和");
  await expect(page.locator(".game-log__reaction")).toContainText("成功反应 · 酸碱中和");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.locator(".successful-reaction-notice")).toContainText(
    "Successful reaction · Acid-base neutralization",
  );
  await expect(page.locator(".successful-reaction-notice")).toBeHidden({ timeout: 3000 });
  await page.getByRole("button", { name: "中文" }).click();
  await expect(page.locator(".successful-reaction-notice")).toBeHidden();
  await expect(page.locator(".game-log__reaction")).toContainText("成功反应 · 酸碱中和");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?scenario=response-window");
  await page.locator(".response-panel").getByRole("button", {
    name: "稀 NaOH 可在当前对局中选择",
  }).click();
  await expect(page.locator(".successful-reaction-notice")).toBeVisible();
  await expect(page.locator(".successful-reaction-notice")).toHaveCSS("animation-name", "none");
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
  await expect(page.getByRole("heading", { name: "新手引导：配置" })).toBeVisible();
  await expect(page.getByText("备课", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "关于与帮助" }).click();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "关闭帮助" }).click();

  await startNoTeacherGame(page);
  await expectNoHorizontalOverflow(page);
  await expect(page.getByRole("heading", { name: "新手引导：主行动" })).toBeVisible();
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
  await expectGuidanceCopy(
    page,
    "新手引导：对局结束",
    "本局结果：玩家 B 获胜",
    "查看公开日志，并使用页面顶部“按当前阵容重开”或“返回角色选择”。",
    "结果已由既有对局结算确定；引导不改变胜负或重开行为。",
  );
  const gameOverEntry = page.getByText(
    "查看公开日志，并使用页面顶部“按当前阵容重开”或“返回角色选择”。",
    { exact: true },
  );
  await expect(gameOverEntry).toHaveText(
    /^查看公开日志，并使用页面顶部“按当前阵容重开”或“返回角色选择”。$/u,
  );
  await expect(page.getByText("左侧日志", { exact: true })).toHaveCount(0);
  const gameOverGuidanceBaseline = await readGuidanceInvariants(page);
  const gameOverFactoryCount = await page.getByTestId("fixture-factory-count").textContent();
  expect(gameOverFactoryCount).not.toBeNull();

  const gameOverCollapse = page.getByRole("button", { name: "折叠新手引导" });
  await gameOverCollapse.focus();
  await page.keyboard.press("Space");
  const gameOverExpand = page.getByRole("button", { name: "展开新手引导" });
  await expect(gameOverExpand).toBeFocused();
  expect(await readGuidanceInvariants(page)).toEqual(gameOverGuidanceBaseline);
  await expectNoHorizontalOverflow(page);

  await gameOverExpand.press("Space");
  await expect(gameOverCollapse).toBeFocused();
  expect(await readGuidanceInvariants(page)).toEqual(gameOverGuidanceBaseline);
  await expectNoHorizontalOverflow(page);

  const gameOverSkip = page.getByRole("button", { name: "跳过新手引导" });
  await gameOverSkip.focus();
  await page.keyboard.press("Space");
  const gameOverShow = page.getByRole("button", { name: "重新显示新手引导" });
  await expect(page.getByText(
    "当前目标：查看公开日志与结果，再决定是否开始下一局。",
    { exact: true },
  )).toBeVisible();
  await expect(page.getByText("本局结果：玩家 B 获胜", { exact: true })).toBeHidden();
  await expect(page.getByText(
    "查看公开日志，并使用页面顶部“按当前阵容重开”或“返回角色选择”。",
    { exact: true },
  )).toBeHidden();
  await expect(page.getByText(
    "结果已由既有对局结算确定；引导不改变胜负或重开行为。",
    { exact: true },
  )).toBeHidden();
  await expect(gameOverShow).toBeFocused();
  expect(await readGuidanceInvariants(page)).toEqual(gameOverGuidanceBaseline);
  await expectNoHorizontalOverflow(page);

  await gameOverShow.press("Space");
  await expect(gameOverCollapse).toBeFocused();
  expect(await readGuidanceInvariants(page)).toEqual(gameOverGuidanceBaseline);
  await expectNoHorizontalOverflow(page);
  await expectFactoryCount(page, Number(gameOverFactoryCount));

  await openAndCloseAbout(page);
});
