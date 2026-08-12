// @vitest-environment happy-dom

import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { LocaleProvider, LocaleSwitch } from "../../../app/locale";
import { createInitialGame } from "../../../game/engine/createInitialGame";
import { engineReducer } from "../../../game/engine/reducer";
import type {
  CardInstanceId,
  CharacterId,
  GamePhase,
  GameState,
  PlayerId,
  PlayerStatus,
} from "../../../game/engine/types";
import { identityShuffle } from "../../../shared/random";
import { getConfiguringGuidance, getPlayingGuidance } from "../newPlayerGuidance";
import { NewPlayerGuidance } from "./NewPlayerGuidance";

type CharacterPair = [CharacterId, CharacterId];

function createGame(characterIds: CharacterPair): GameState {
  return createInitialGame({ characterIds, shuffle: identityShuffle });
}

function putCardInHand(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): GameState {
  const card = state.cardInstances[cardInstanceId];
  if (!card) {
    throw new Error(`Missing fixture card ${cardInstanceId}.`);
  }

  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      hand: player.id === playerId
        ? [...player.hand.filter((heldId) => heldId !== cardInstanceId), cardInstanceId]
        : player.hand.filter((heldId) => heldId !== cardInstanceId),
    })),
    deck: state.deck.filter((cardId) => cardId !== cardInstanceId),
    discardPile: state.discardPile.filter((cardId) => cardId !== cardInstanceId),
    cardInstances: {
      ...state.cardInstances,
      [cardInstanceId]: {
        ...card,
        ownerId: playerId,
        zone: { type: "hand", playerId },
      },
    },
  };
}

function createPreparationGame(): GameState {
  return createGame(["laboratory_teacher", "chemical_factory_ceo"]);
}

function createMainActionGame(): GameState {
  return createGame(["chemical_factory_ceo", "acid_king"]);
}

function createResponseGame(characterIds: CharacterPair = [
  "clumsy_party_secretary",
  "caustic_soda_captain",
]): GameState {
  let state = createGame(characterIds);
  state = putCardInHand(state, "player_1", "substance_hcl_dilute_01");
  state = putCardInHand(state, "player_2", "substance_naoh_dilute_01");
  state = engineReducer(state, {
    type: "PLAY_CARD",
    playerId: "player_1",
    cardInstanceId: "substance_hcl_dilute_01",
    targetPlayerId: "player_2",
  });
  return state;
}

function createStatusGame(): GameState {
  const state = createPreparationGame();
  const status: PlayerStatus = {
    id: "status_phase13_fixture_so2",
    statusId: "SO2_LEAK",
    createdAt: state.log.length + 1,
  };

  return {
    ...state,
    activePlayerId: "player_1",
    phase: "statusWindow",
    pendingLaboratoryPreparation: undefined,
    pendingStatusHandling: {
      playerId: "player_1",
      statusInstanceId: status.id,
    },
    players: state.players.map((player) => player.id === "player_1"
      ? { ...player, statuses: [...player.statuses, status] }
      : player),
  };
}

function createCounterattackGame(): GameState {
  let state = createGame([
    "clumsy_party_secretary",
    "chemistry_enthusiast",
  ]);
  state = putCardInHand(state, "player_1", "substance_hcl_dilute_01");
  state = putCardInHand(state, "player_2", "substance_naoh_dilute_01");
  const initialResponder = state.players.find((player) => player.id === "player_2");
  expect(initialResponder?.hp).toBe(8);
  state = engineReducer(state, {
    type: "PLAY_CARD",
    playerId: "player_1",
    cardInstanceId: "substance_hcl_dilute_01",
    targetPlayerId: "player_2",
  });
  state = engineReducer(state, {
    type: "PASS_RESPONSE",
    playerId: "player_2",
  });
  const damagedResponder = state.players.find((player) => player.id === "player_2");
  expect(damagedResponder?.hp).toBe(7);
  state = engineReducer(state, {
    type: "PASS_ACTION",
    playerId: state.activePlayerId,
  });
  state = putCardInHand(state, "player_1", "substance_hcl_dilute_02");
  state = putCardInHand(state, "player_2", "substance_naoh_dilute_02");
  state = engineReducer(state, {
    type: "PLAY_CARD",
    playerId: "player_1",
    cardInstanceId: "substance_hcl_dilute_02",
    targetPlayerId: "player_2",
  });
  const counterattack = engineReducer(state, {
    type: "RESPOND_WITH_CARD",
    playerId: "player_2",
    cardInstanceId: "substance_naoh_dilute_02",
  });
  expect(counterattack.pendingExperimentCounterattack?.legalOptions).toContain("recover");
  return counterattack;
}

function createGameOverGame(): GameState {
  const state = createMainActionGame();
  return {
    ...state,
    isDraw: false,
    phase: "gameOver",
    winnerPlayerId: "player_1",
  };
}

function withPhase(state: GameState, phase: GamePhase): GameState {
  return { ...state, phase };
}

function GuidanceHarness({ game }: { game: GameState }) {
  const [visible, setVisible] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  return createElement(NewPlayerGuidance, {
    collapsed,
    game,
    mode: "playing",
    onCollapsedChange: setCollapsed,
    onVisibleChange: setVisible,
    visible,
  });
}

describe("Phase 13 new-player guidance", () => {
  it("locks all seven public phases, actors, entries, concepts, and hidden internal phases", () => {
    const preparation = createPreparationGame();
    const mainAction = createMainActionGame();
    const response = createResponseGame();
    const status = createStatusGame();
    const counterattack = createCounterattackGame();
    const gameOver = createGameOverGame();

    expect(preparation.pendingLaboratoryPreparation).toMatchObject({
      playerId: "player_1",
    });
    expect(response.pendingResponse).toMatchObject({
      responderId: "player_2",
    });
    expect(status.pendingStatusHandling).toEqual({
      playerId: "player_1",
      statusInstanceId: "status_phase13_fixture_so2",
    });
    expect(status.players.find((player) => player.id === "player_1")?.statuses).toEqual([
      {
        id: "status_phase13_fixture_so2",
        statusId: "SO2_LEAK",
        createdAt: status.log.length + 1,
      },
    ]);
    expect(counterattack.pendingExperimentCounterattack).toMatchObject({
      responderPlayerId: "player_2",
      legalOptions: expect.arrayContaining(["recover"]),
    });
    const counterattackResponder = counterattack.players.find((player) => player.id === "player_2");
    expect(counterattackResponder?.hp).toBe(7);
    expect(counterattackResponder?.maxHp).toBe(8);
    expect(gameOver).toMatchObject({
      phase: "gameOver",
      isDraw: false,
      winnerPlayerId: "player_1",
    });

    expect(getConfiguringGuidance()).toEqual({
      actor: "双方玩家",
      concept: "双方手牌公开；刷新页面会回到默认角色预选，不保存当前对局。",
      entry: "使用下方“玩家 A”“玩家 B”角色选择与“开始游戏”。",
      goal: "确认本地同屏双人阵容后，再开始本局公开对局。",
      phase: "configuring",
      title: "配置",
    });
    expect(getPlayingGuidance(preparation)).toEqual({
      actor: "当前选择者：玩家 A",
      concept: "备课选择的数量和可选范围由现有面板显示；引导不重复判定。",
      entry: "使用下方“实验室老师 · 备课”面板中的卡牌与“确认备课选择”。",
      goal: "按现有备课面板选择并确认本次保留的手牌。",
      phase: "preparationSelection",
      title: "备课",
    });
    expect(getPlayingGuidance(mainAction)).toEqual({
      actor: "当前行动者：玩家 A",
      concept: "场面基准只说明当前场面的参考；是否可关联以现有操作面板的提示为准。",
      entry: "使用下方“主行动”“主动 DIY”与角色技能入口，或“结束本次行动”。",
      goal: "由当前行动玩家完成一次主行动，或结束本次行动。",
      phase: "mainAction",
      title: "主行动",
    });
    expect(getPlayingGuidance(response)).toEqual({
      actor: "当前响应者：玩家 B",
      concept: "响应 DIY 在 MVP0-P10 中关闭；引导不判断任何具体卡牌是否合法。",
      entry: "使用下方“响应窗口”内显示的选项，或“放弃响应”。",
      goal: "由当前响应者决定使用现有响应入口，或放弃响应。",
      phase: "responseWindow",
      title: "响应",
    });
    expect(getPlayingGuidance(status)).toEqual({
      actor: "当前处理者：玩家 A",
      concept: "可用处理牌由现有状态面板决定；引导不创建或判断处理选项。",
      entry: "使用下方“状态处理窗口”内显示的选项，或“放弃处理”。",
      goal: "由当前处理者处理正在等待的状态，或接受现有继续入口。",
      phase: "statusWindow",
      title: "状态处理",
    });
    expect(getPlayingGuidance(counterattack)).toEqual({
      actor: "当前反击者：玩家 B",
      concept: "真实金属选项仍延期；此处不会补充不存在的卡牌或选项。",
      entry: "使用下方“实验反击选择”面板中当前显示的选项。",
      goal: "由当前反击者在已实现的选项中完成本次实验反击。",
      phase: "experimentCounterattackWindow",
      title: "实验反击",
    });
    expect(getPlayingGuidance(gameOver)).toEqual({
      actor: "本局结果：玩家 A 获胜",
      concept: "结果已由既有对局结算确定；引导不改变胜负或重开行为。",
      entry: "查看公开日志，并使用页面顶部“按当前阵容重开”或“返回角色选择”。",
      goal: "查看公开日志与结果，再决定是否开始下一局。",
      phase: "gameOver",
      title: "对局结束",
    });

    const transientPhases: readonly GamePhase[] = [
      "setup",
      "cycleStart",
      "actionStart",
      "cleanup",
    ];
    for (const phase of transientPhases) {
      expect(getPlayingGuidance(withPhase(mainAction, phase))).toBeUndefined();
    }
  });

  it("keeps guidance controls local, stable, and non-mutating", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const game = createMainActionGame();
    const baseline = {
      activePlayerId: game.activePlayerId,
      logLength: game.log.length,
      pendingLaboratoryPreparation: game.pendingLaboratoryPreparation,
      pendingResponse: game.pendingResponse,
      pendingStatusHandling: game.pendingStatusHandling,
      pendingExperimentCounterattack: game.pendingExperimentCounterattack,
      phase: game.phase,
    };

    try {
      await act(async () => root.render(createElement(GuidanceHarness, { game })));

      const collapseButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "折叠新手引导",
      );
      expect(container.textContent).toContain("新手引导：主行动");
      if (!collapseButton) throw new Error("Expected guidance collapse control.");

      await act(async () => collapseButton.click());
      expect(collapseButton.getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(collapseButton);
      expect(container.textContent).toContain(
        "当前目标：由当前行动玩家完成一次主行动，或结束本次行动。",
      );
      expect(container.textContent).not.toContain("当前行动者：玩家 A");

      await act(async () => collapseButton.click());
      const skipButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "跳过新手引导",
      );
      if (!skipButton) throw new Error("Expected guidance skip control.");

      await act(async () => skipButton.click());
      const showButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "重新显示新手引导",
      );
      if (!showButton) throw new Error("Expected stable guidance restore control.");
      expect(container.querySelector(".new-player-guidance")?.getAttribute("aria-label")).toBe("新手引导");
      expect(container.textContent).toContain(
        "当前目标：由当前行动玩家完成一次主行动，或结束本次行动。",
      );
      expect(container.textContent).not.toContain("当前行动者：玩家 A");
      expect(container.textContent).not.toContain(
        "使用下方“主行动”“主动 DIY”与角色技能入口，或“结束本次行动”。",
      );
      expect(container.textContent).not.toContain(
        "场面基准只说明当前场面的参考；是否可关联以现有操作面板的提示为准。",
      );
      expect(document.activeElement).toBe(showButton);

      await act(async () => showButton.click());
      const restoredCollapseButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "折叠新手引导",
      );
      expect(document.activeElement).toBe(restoredCollapseButton);
      expect(container.textContent).toContain("当前行动者：玩家 A");
      expect(container.textContent).toContain(
        "使用下方“主行动”“主动 DIY”与角色技能入口，或“结束本次行动”。",
      );
      expect(container.textContent).toContain(
        "场面基准只说明当前场面的参考；是否可关联以现有操作面板的提示为准。",
      );
      expect(getPlayingGuidance(game)?.title).toBe("主行动");
      expect({
        activePlayerId: game.activePlayerId,
        logLength: game.log.length,
        pendingLaboratoryPreparation: game.pendingLaboratoryPreparation,
        pendingResponse: game.pendingResponse,
        pendingStatusHandling: game.pendingStatusHandling,
        pendingExperimentCounterattack: game.pendingExperimentCounterattack,
        phase: game.phase,
      }).toEqual(baseline);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("keeps only the current goal and exact restore control visible while English details are hidden", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const game = createMainActionGame();
    const baseline = JSON.stringify(game);

    try {
      await act(async () => root.render(createElement(
        LocaleProvider,
        null,
        createElement(LocaleSwitch),
        createElement(GuidanceHarness, { game }),
      )));
      const englishButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "English",
      );
      if (!englishButton) throw new Error("Expected English locale control.");
      await act(async () => englishButton.click());

      const hideButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Hide new player guidance",
      );
      if (!hideButton) throw new Error("Expected English hide control.");
      await act(async () => hideButton.click());

      const showButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Show new player guidance again",
      );
      if (!showButton) throw new Error("Expected exact English restore control.");
      expect(document.activeElement).toBe(showButton);
      expect(container.querySelector(".new-player-guidance")?.getAttribute("aria-label")).toBe(
        "New player guidance",
      );
      expect(container.textContent).toContain(
        "Current goal: The active player completes one main action or ends this action.",
      );
      expect(container.textContent).not.toContain("Active player: Player A");
      expect(container.textContent).not.toContain(
        "Use Main action, Active DIY, character-skill entries, or End this action below.",
      );
      expect(container.textContent).not.toContain(
        "The table reference only describes the current reference; use the existing action-panel notice to determine association.",
      );

      await act(async () => showButton.click());
      const collapseButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Collapse guidance",
      );
      expect(document.activeElement).toBe(collapseButton);
      expect(container.textContent).toContain("Active player: Player A");
      expect(JSON.stringify(game)).toBe(baseline);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
