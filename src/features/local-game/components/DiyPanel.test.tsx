// @vitest-environment happy-dom

import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider, LocaleSwitch } from "../../../app/locale";
import { createInitialGame } from "../../../game/engine/createInitialGame";
import type {
  CardDefinitionId,
  CardInstanceId,
  GameState,
  PlayerId,
  PlayerStatus,
} from "../../../game/engine/types";
import { identityShuffle } from "../../../shared/random";
import { LocalGamePage } from "../LocalGamePage";
import { DiyPanel } from "./DiyPanel";
import { PlayerPanel } from "./PlayerPanel";

function createGame(): GameState {
  const initial = createInitialGame({
    characterIds: ["caustic_soda_captain", "acid_king"],
    shuffle: identityShuffle,
  });
  return initial;
}

function setHandCards(
  state: GameState,
  playerId: PlayerId,
  cards: readonly { id: CardInstanceId; definitionId: CardDefinitionId }[],
): GameState {
  const newCardInstances = { ...state.cardInstances };
  const cardIds: CardInstanceId[] = [];

  for (const card of cards) {
    cardIds.push(card.id);
    newCardInstances[card.id] = {
      id: card.id,
      definitionId: card.definitionId,
      ownerId: playerId,
      zone: { type: "hand", playerId },
    };
  }

  return {
    ...state,
    cardInstances: newCardInstances,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, hand: cardIds } : p,
    ),
  };
}

function addStatusToPlayer(
  state: GameState,
  playerId: PlayerId,
  statusId: PlayerStatus["statusId"],
): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId
        ? {
            ...p,
            statuses: [
              ...p.statuses,
              {
                id: `status_${statusId}_test`,
                statusId,
                sourcePlayerId: playerId,
                createdAt: 1,
              },
            ],
          }
        : p,
    ),
  };
}

describe("Phase 18E — DIY Hand-Selection Preview UI", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(globalThis.navigator, "language", {
      configurable: true,
      value: "zh-CN",
    });
    Object.defineProperty(globalThis.navigator, "languages", {
      configurable: true,
      value: ["zh-CN"],
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function render(element: React.ReactElement) {
    act(() => {
      root.render(createElement(LocaleProvider, null, element));
    });
  }

  describe("1. DIY Selection Context Entry & Cancel Purity", () => {
    it("entering and canceling DIY mode does not modify GameState or dispatch actions", () => {
      const initialGame = createGame();
      const dispatchMock = vi.fn();

      function Harness() {
        const [diyMode, setDiyMode] = useState(false);
        const [selectedCardIds, setSelectedCardIds] = useState<readonly CardInstanceId[]>([]);
        const [targetPlayerId, setTargetPlayerId] = useState<PlayerId | undefined>();

        return (
          <DiyPanel
            diyMode={diyMode}
            dispatchGameAction={dispatchMock}
            game={initialGame}
            onCancelDiyMode={() => {
              setDiyMode(false);
              setSelectedCardIds([]);
              setTargetPlayerId(undefined);
            }}
            onEnterDiyMode={() => {
              setDiyMode(true);
              setSelectedCardIds([]);
              setTargetPlayerId(undefined);
            }}
            onTargetPlayerChange={setTargetPlayerId}
            selectedCardIds={selectedCardIds}
            targetPlayerId={targetPlayerId}
          />
        );
      }

      render(<Harness />);

      // Initial idle state: "进入 DIY 选牌" button exists
      const enterBtn = container.querySelector<HTMLButtonElement>("button.secondary-button");
      expect(enterBtn?.textContent).toContain("进入 DIY 选牌");
      expect(dispatchMock).not.toHaveBeenCalled();

      // Click enter DIY mode
      act(() => {
        enterBtn?.click();
      });

      // Now in DIY mode: cancel button and counter exist
      expect(container.textContent).toContain("取消 / 退出 DIY 选牌");
      expect(container.textContent).toContain("已选 0 张组件");
      expect(dispatchMock).not.toHaveBeenCalled();

      // Click cancel DIY mode
      const cancelBtn = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (btn) => btn.textContent?.includes("取消 / 退出 DIY 选牌"),
      );
      expect(cancelBtn).toBeDefined();

      act(() => {
        cancelBtn?.click();
      });

      // Returned to idle state
      expect(container.textContent).toContain("进入 DIY 选牌");
      expect(dispatchMock).not.toHaveBeenCalled();
    });
  });

  describe("2. Hand Selection Rules, Independent Instance Selection & Hand Ordering", () => {
    it("allows active player to select/deselect diy-component cards while disabling non-component and opponent cards", () => {
      let game = createGame();
      // Setup Player 1 hand with 2 identical ion_h cards, 1 ion_cl card, and 1 non-component card (substance_hcl_dilute)
      game = setHandCards(game, "player_1", [
        { id: "inst_h_1", definitionId: "ion_h" },
        { id: "inst_h_2", definitionId: "ion_h" },
        { id: "inst_cl_1", definitionId: "ion_cl" },
        { id: "inst_substance_1", definitionId: "substance_hcl_dilute" },
      ]);
      // Setup Player 2 hand
      game = setHandCards(game, "player_2", [
        { id: "inst_p2_h", definitionId: "ion_h" },
      ]);

      const onToggleDiyCard = vi.fn();
      const onSelectNormalCard = vi.fn();

      // Test Player 1 in DIY mode
      render(
        <div>
          <PlayerPanel
            diyMode={true}
            diySelectedCardIds={["inst_h_1"]}
            game={game}
            onSelectCard={onSelectNormalCard}
            onToggleDiyCard={onToggleDiyCard}
            player={game.players[0]!}
          />
          <PlayerPanel
            diyMode={true}
            diySelectedCardIds={["inst_h_1"]}
            game={game}
            onSelectCard={onSelectNormalCard}
            onToggleDiyCard={onToggleDiyCard}
            player={game.players[1]!}
          />
        </div>,
      );

      const p1Panel = container.querySelector(".player-panel[aria-labelledby='player_1-title']");
      expect(p1Panel).not.toBeNull();

      const p1Cards = Array.from(p1Panel!.querySelectorAll<HTMLButtonElement>(".debug-card__select"));
      expect(p1Cards.length).toBe(4);

      // Card 0: inst_h_1 (selected)
      expect(p1Cards[0]?.disabled).toBe(false);
      expect(p1Cards[0]?.getAttribute("aria-pressed")).toBe("true");
      expect(p1Cards[0]?.closest(".debug-card")?.classList.contains("is-selected")).toBe(true);

      // Card 1: inst_h_2 (unselected, independent instance of ion_h)
      expect(p1Cards[1]?.disabled).toBe(false);
      expect(p1Cards[1]?.getAttribute("aria-pressed")).toBe("false");
      expect(p1Cards[1]?.closest(".debug-card")?.classList.contains("is-selected")).toBe(false);

      // Card 2: inst_cl_1 (unselected)
      expect(p1Cards[2]?.disabled).toBe(false);
      expect(p1Cards[2]?.getAttribute("aria-pressed")).toBe("false");

      // Card 3: inst_substance_1 (substance card without diy-component timing -> must be disabled in DIY mode)
      expect(p1Cards[3]?.disabled).toBe(true);

      // Opponent (Player 2) cards must be disabled in DIY mode
      const p2Panel = container.querySelector(".player-panel[aria-labelledby='player_2-title']");
      const p2Cards = Array.from(p2Panel!.querySelectorAll<HTMLButtonElement>(".debug-card__select"));
      expect(p2Cards.length).toBe(1);
      expect(p2Cards[0]?.disabled).toBe(true);

      // Clicking Card 1 (inst_h_2) triggers onToggleDiyCard with inst_h_2
      act(() => {
        p1Cards[1]?.click();
      });
      expect(onToggleDiyCard).toHaveBeenCalledWith("inst_h_2");
      expect(onSelectNormalCard).not.toHaveBeenCalled();
    });

    it("toggling selected card deselects it and keeps hand ordering intact", () => {
      let game = createGame();
      game = setHandCards(game, "player_1", [
        { id: "inst_h_1", definitionId: "ion_h" },
        { id: "inst_cl_1", definitionId: "ion_cl" },
        { id: "inst_h_2", definitionId: "ion_h" },
      ]);

      function Harness() {
        const [selectedIds, setSelectedIds] = useState<readonly CardInstanceId[]>(["inst_cl_1"]);
        return (
          <PlayerPanel
            diyMode={true}
            diySelectedCardIds={selectedIds}
            game={game}
            onSelectCard={() => {}}
            onToggleDiyCard={(id) => {
              setSelectedIds((prev) =>
                prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
              );
            }}
            player={game.players[0]!}
          />
        );
      }

      render(<Harness />);

      const p1Panel = container.querySelector(".player-panel");
      let cardButtons = Array.from(p1Panel!.querySelectorAll<HTMLButtonElement>(".debug-card__select"));

      // Check initial selection
      expect(cardButtons[0]?.getAttribute("aria-pressed")).toBe("false"); // inst_h_1
      expect(cardButtons[1]?.getAttribute("aria-pressed")).toBe("true");  // inst_cl_1
      expect(cardButtons[2]?.getAttribute("aria-pressed")).toBe("false"); // inst_h_2

      // Click card 1 (inst_cl_1) to deselect
      act(() => {
        cardButtons[1]?.click();
      });

      cardButtons = Array.from(p1Panel!.querySelectorAll<HTMLButtonElement>(".debug-card__select"));
      expect(cardButtons[1]?.getAttribute("aria-pressed")).toBe("false");

      // Verify hand order is completely unchanged
      const cardNames = cardButtons.map((btn) => btn.querySelector(".debug-card__name")?.textContent);
      expect(cardNames).toEqual(["H+", "Cl-", "H+"]);
    });
  });

  describe("3. Four-State Semantic Preview & Target Semantics", () => {
    it("displays NO_RECIPE_MATCH when 0 cards selected and when unmatched cards selected", () => {
      const game = createGame();
      const dispatchMock = vi.fn();

      // 0 cards selected
      render(
        <DiyPanel
          diyMode={true}
          dispatchGameAction={dispatchMock}
          game={game}
          onCancelDiyMode={() => {}}
          onEnterDiyMode={() => {}}
          onTargetPlayerChange={() => {}}
          selectedCardIds={[]}
          targetPlayerId={undefined}
        />,
      );

      expect(container.textContent).toContain("尚未选择材料");
      expect(container.textContent).toContain("请在当前手牌中点击组件牌");
      const executeBtn = container.querySelector<HTMLButtonElement>("button.primary-button");
      expect(executeBtn?.disabled).toBe(true);

      // Unmatched selection: e.g. 1 ion_h only
      let gameWithCards = setHandCards(game, "player_1", [
        { id: "inst_h_1", definitionId: "ion_h" },
      ]);
      render(
        <DiyPanel
          diyMode={true}
          dispatchGameAction={dispatchMock}
          game={gameWithCards}
          onCancelDiyMode={() => {}}
          onEnterDiyMode={() => {}}
          onTargetPlayerChange={() => {}}
          selectedCardIds={["inst_h_1"]}
          targetPlayerId={undefined}
        />,
      );

      expect(container.textContent).toContain("未匹配到配方");
      expect(container.textContent).toContain("当前所选手牌组合未匹配任何有效 DIY 配方");
      expect(container.querySelector<HTMLButtonElement>("button.primary-button")?.disabled).toBe(true);
    });

    it("displays MATCHED_NOT_EXECUTABLE with target selection for target-required recipe without auto-selecting", () => {
      let game = createGame();
      game = setHandCards(game, "player_1", [
        { id: "inst_h_1", definitionId: "ion_h" },
        { id: "inst_cl_1", definitionId: "ion_cl" },
      ]);

      const dispatchMock = vi.fn();
      let selectedTarget: PlayerId | undefined = undefined;

      function Harness() {
        const [target, setTarget] = useState<PlayerId | undefined>(selectedTarget);
        return (
          <DiyPanel
            diyMode={true}
            dispatchGameAction={dispatchMock}
            game={game}
            onCancelDiyMode={() => {}}
            onEnterDiyMode={() => {}}
            onTargetPlayerChange={(t) => {
              selectedTarget = t;
              setTarget(t);
            }}
            selectedCardIds={["inst_h_1", "inst_cl_1"]}
            targetPlayerId={target}
          />
        );
      }

      render(<Harness />);

      // Matched dilute HCl, but target not chosen
      expect(container.textContent).toContain("H+ + Cl- -> 稀 HCl");
      expect(container.textContent).toContain("需要选择目标玩家");

      // Target dropdown is rendered and starts empty
      const targetSelect = container.querySelector<HTMLSelectElement>("select");
      expect(targetSelect).not.toBeNull();
      expect(targetSelect?.value).toBe("");

      // Execute button is disabled
      const executeBtn = container.querySelector<HTMLButtonElement>("button.primary-button");
      expect(executeBtn?.disabled).toBe(true);

      // Select target player_2
      act(() => {
        targetSelect!.value = "player_2";
        targetSelect!.dispatchEvent(new Event("change", { bubbles: true }));
      });

      // Now EXECUTABLE
      expect(container.textContent).toContain("生成虚拟产品 稀 HCl");
      expect(container.textContent).toContain("对 玩家 B 造成 酸性伤害基础值 1 点");
      expect(executeBtn?.disabled).toBe(false);

      // Click execute
      act(() => {
        executeBtn?.click();
      });

      expect(dispatchMock).toHaveBeenCalledTimes(1);
      expect(dispatchMock).toHaveBeenCalledWith({
        type: "PLAY_DIY_SELECTION",
        playerId: "player_1",
        componentCardInstanceIds: ["inst_h_1", "inst_cl_1"],
        targetPlayerId: "player_2",
      });
      // Invariant: No recipeId in action payload
      const actionPayload = dispatchMock.mock.calls[0][0];
      expect(actionPayload).not.toHaveProperty("recipeId");
      expect(actionPayload.type).toBe("PLAY_DIY_SELECTION");
    });

    it("displays MATCHED_NOT_EXECUTABLE with OWN_FIRE_REQUIRED for CO2 recipe when player has no fire", () => {
      let game = createGame();
      game = setHandCards(game, "player_1", [
        { id: "inst_c_1", definitionId: "element_c" },
        { id: "inst_o_1", definitionId: "element_o" },
        { id: "inst_o_2", definitionId: "element_o" },
      ]);

      render(
        <DiyPanel
          diyMode={true}
          dispatchGameAction={vi.fn()}
          game={game}
          onCancelDiyMode={() => {}}
          onEnterDiyMode={() => {}}
          onTargetPlayerChange={() => {}}
          selectedCardIds={["inst_c_1", "inst_o_1", "inst_o_2"]}
          targetPlayerId={undefined}
        />,
      );

      expect(container.textContent).toContain("C + O + O -> CO2");
      expect(container.textContent).toContain("需要自身处于火情状态");
      expect(container.querySelector("select")).toBeNull(); // No target dropdown
      expect(container.querySelector<HTMLButtonElement>("button.primary-button")?.disabled).toBe(true);
    });

    it("displays EXECUTABLE for CO2 recipe when player has FIRE status and dispatches PLAY_DIY_SELECTION without target", () => {
      let game = createGame();
      game = setHandCards(game, "player_1", [
        { id: "inst_c_1", definitionId: "element_c" },
        { id: "inst_o_1", definitionId: "element_o" },
        { id: "inst_o_2", definitionId: "element_o" },
      ]);
      game = addStatusToPlayer(game, "player_1", "FIRE");

      const dispatchMock = vi.fn();

      render(
        <DiyPanel
          diyMode={true}
          dispatchGameAction={dispatchMock}
          game={game}
          onCancelDiyMode={() => {}}
          onEnterDiyMode={() => {}}
          onTargetPlayerChange={() => {}}
          selectedCardIds={["inst_c_1", "inst_o_1", "inst_o_2"]}
          targetPlayerId={undefined}
        />,
      );

      expect(container.textContent).toContain("C + O + O -> CO2");
      expect(container.textContent).toContain("生成 CO2 并移除自身火情；不创建实体卡牌。");
      const executeBtn = container.querySelector<HTMLButtonElement>("button.primary-button");
      expect(executeBtn?.disabled).toBe(false);

      act(() => {
        executeBtn?.click();
      });

      expect(dispatchMock).toHaveBeenCalledTimes(1);
      expect(dispatchMock).toHaveBeenCalledWith({
        type: "PLAY_DIY_SELECTION",
        playerId: "player_1",
        componentCardInstanceIds: ["inst_c_1", "inst_o_1", "inst_o_2"],
        targetPlayerId: undefined,
      });
      const actionPayload = dispatchMock.mock.calls[0][0];
      expect(actionPayload).not.toHaveProperty("recipeId");
    });

    it("displays MATCHED_NOT_EXECUTABLE with UNEXPECTED_TARGET if target is provided for no-target recipe", () => {
      let game = createGame();
      game = setHandCards(game, "player_1", [
        { id: "inst_c_1", definitionId: "element_c" },
        { id: "inst_o_1", definitionId: "element_o" },
        { id: "inst_o_2", definitionId: "element_o" },
      ]);
      game = addStatusToPlayer(game, "player_1", "FIRE");

      render(
        <DiyPanel
          diyMode={true}
          dispatchGameAction={vi.fn()}
          game={game}
          onCancelDiyMode={() => {}}
          onEnterDiyMode={() => {}}
          onTargetPlayerChange={() => {}}
          selectedCardIds={["inst_c_1", "inst_o_1", "inst_o_2"]}
          targetPlayerId={"player_2"}
        />,
      );

      expect(container.textContent).toContain("此配方不需要选择目标");
      expect(container.querySelector<HTMLButtonElement>("button.primary-button")?.disabled).toBe(true);
    });

    it("displays SO2 leak outcome preview for SO2 recipe with valid target", () => {
      let game = createGame();
      game = setHandCards(game, "player_1", [
        { id: "inst_s_1", definitionId: "element_s" },
        { id: "inst_o_1", definitionId: "element_o" },
        { id: "inst_o_2", definitionId: "element_o" },
      ]);

      const dispatchMock = vi.fn();

      render(
        <DiyPanel
          diyMode={true}
          dispatchGameAction={dispatchMock}
          game={game}
          onCancelDiyMode={() => {}}
          onEnterDiyMode={() => {}}
          onTargetPlayerChange={() => {}}
          selectedCardIds={["inst_s_1", "inst_o_1", "inst_o_2"]}
          targetPlayerId={"player_2"}
        />,
      );

      expect(container.textContent).toContain("S + O + O -> SO2");
      expect(container.textContent).toContain("生成 SO2，使 玩家 B 获得 SO2 泄漏；不创建实体卡牌。");
      const executeBtn = container.querySelector<HTMLButtonElement>("button.primary-button");
      expect(executeBtn?.disabled).toBe(false);

      act(() => {
        executeBtn?.click();
      });

      expect(dispatchMock).toHaveBeenCalledWith({
        type: "PLAY_DIY_SELECTION",
        playerId: "player_1",
        componentCardInstanceIds: ["inst_s_1", "inst_o_1", "inst_o_2"],
        targetPlayerId: "player_2",
      });
    });
  });

  describe("4. Integration Flow in LocalGamePage", () => {
    it("full selection flow in LocalGamePage: enter -> select cards -> pick target -> execute -> resets DIY state", () => {
      let customGame = createGame();
      customGame = { ...customGame, activePlayerId: "player_1" };
      customGame = setHandCards(customGame, "player_1", [
        { id: "p1_h", definitionId: "ion_h" },
        { id: "p1_cl", definitionId: "ion_cl" },
      ]);

      render(
        <LocalGamePage
          createGame={() => customGame}
          createSession={() => ({
            mode: "playing",
            characterIds: ["caustic_soda_captain", "acid_king"],
            revision: 1,
            game: customGame,
            error: null,
          })}
        />,
      );

      // Normal main action state: click "进入 DIY 选牌"
      const enterBtn = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (btn) => btn.textContent?.includes("进入 DIY 选牌"),
      );
      expect(enterBtn).toBeDefined();
      act(() => {
        enterBtn?.click();
      });

      // Select p1_h and p1_cl from hand
      const p1Panel = container.querySelector(".player-panel[aria-labelledby='player_1-title']");
      const handButtons = Array.from(p1Panel!.querySelectorAll<HTMLButtonElement>(".debug-card__select"));
      expect(handButtons.length).toBe(2);

      act(() => {
        handButtons[0]?.click(); // select H+
      });
      act(() => {
        handButtons[1]?.click(); // select Cl-
      });

      // DIY Panel shows target selection required
      expect(container.textContent).toContain("需要选择目标玩家");

      // Select player_2 in target dropdown
      const targetSelect = container.querySelector<HTMLSelectElement>(".diy-panel select");
      expect(targetSelect).not.toBeNull();
      act(() => {
        targetSelect!.value = "player_2";
        targetSelect!.dispatchEvent(new Event("change", { bubbles: true }));
      });

      // Execute button enabled
      const executeBtn = container.querySelector<HTMLButtonElement>(".diy-panel .diy-execute-button");
      expect(executeBtn?.disabled).toBe(false);

      act(() => {
        executeBtn?.click();
      });

      // After execution, game moves to responseWindow phase and DIY state is reset
      expect(container.textContent).toContain("响应");
      expect(container.querySelector(".diy-panel")).toBeNull(); // DiyPanel is hidden outside mainAction
    });

    it("normal main action card selection resumes cleanly after exiting DIY context", () => {
      let customGame = createGame();
      customGame = setHandCards(customGame, "player_1", [
        { id: "p1_substance_hcl", definitionId: "substance_hcl_dilute" },
      ]);

      render(
        <LocalGamePage
          createGame={() => customGame}
          createSession={() => ({
            mode: "playing",
            characterIds: ["caustic_soda_captain", "acid_king"],
            revision: 1,
            game: customGame,
            error: null,
          })}
        />,
      );

      // Enter DIY mode
      const enterBtn = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (btn) => btn.textContent?.includes("进入 DIY 选牌"),
      );
      act(() => {
        enterBtn?.click();
      });

      // In DIY mode, substance card is disabled
      const p1Panel = container.querySelector(".player-panel[aria-labelledby='player_1-title']");
      const cardBtn = p1Panel!.querySelector<HTMLButtonElement>(".debug-card__select");
      expect(cardBtn?.disabled).toBe(true);

      // Cancel DIY mode
      const cancelBtn = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (btn) => btn.textContent?.includes("取消 / 退出 DIY 选牌"),
      );
      act(() => {
        cancelBtn?.click();
      });

      // Outside DIY mode, substance card is enabled for normal selection
      const activeCardBtn = container.querySelector<HTMLButtonElement>(
        ".player-panel[aria-labelledby='player_1-title'] .debug-card__select",
      );
      expect(activeCardBtn?.disabled).toBe(false);
      act(() => {
        activeCardBtn?.click();
      });
      // Normal card is selected
      expect(activeCardBtn?.closest(".debug-card")?.classList.contains("is-selected")).toBe(true);
    });
  });

  describe("5. Bilingual Support (zh-CN / en)", () => {
    it("renders all preview states, blockers, and controls in English when locale switched", () => {
      let game = createGame();
      game = setHandCards(game, "player_1", [
        { id: "inst_h_1", definitionId: "ion_h" },
        { id: "inst_cl_1", definitionId: "ion_cl" },
      ]);

      render(
        <div>
          <LocaleSwitch />
          <DiyPanel
            diyMode={true}
            dispatchGameAction={vi.fn()}
            game={game}
            onCancelDiyMode={() => {}}
            onEnterDiyMode={() => {}}
            onTargetPlayerChange={() => {}}
            selectedCardIds={["inst_h_1", "inst_cl_1"]}
            targetPlayerId={"player_2"}
          />
        </div>,
      );

      // Switch to English
      const enBtn = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (btn) => btn.textContent === "English",
      );
      expect(enBtn).toBeDefined();
      act(() => {
        enBtn?.click();
      });

      // Check English strings
      expect(container.textContent).toContain("Active DIY");
      expect(container.textContent).toContain("Cancel / Exit DIY");
      expect(container.textContent).toContain("2 card(s) selected");
      expect(container.textContent).toContain("Produces the virtual product dilute HCl");
      expect(container.textContent).toContain("the base acid damage value to Player B is 1");
      expect(container.textContent).toContain("Play DIY");
    });
  });

  describe("6. Finding 2 Closure: Stale Target Auto-Recovery & Authoritative Legality", () => {
    it("auto-clears stale target and evaluates OWN_FIRE_REQUIRED without exiting DIY mode when switching from target-required (H+ + Cl-) to H2O (H+ + OH-)", () => {
      let game = createGame();
      game = setHandCards(game, "player_1", [
        { id: "inst_h_1", definitionId: "ion_h" },
        { id: "inst_cl_1", definitionId: "ion_cl" },
        { id: "inst_oh_1", definitionId: "ion_oh" },
      ]);

      let targetPlayerId: PlayerId | undefined = "player_2";
      const onTargetPlayerChange = vi.fn((newTarget: PlayerId | undefined) => {
        targetPlayerId = newTarget;
      });

      // Render with H+ + Cl- and target player_2 (EXECUTABLE)
      render(
        <DiyPanel
          diyMode={true}
          dispatchGameAction={vi.fn()}
          game={game}
          onCancelDiyMode={() => {}}
          onEnterDiyMode={() => {}}
          onTargetPlayerChange={onTargetPlayerChange}
          selectedCardIds={["inst_h_1", "inst_cl_1"]}
          targetPlayerId={targetPlayerId}
        />,
      );

      expect(container.querySelector(".diy-preview.is-executable")).not.toBeNull();
      expect(container.textContent).toContain("生成虚拟产品 稀 HCl");

      // Switch selection to H+ + OH- while preserving targetPlayerId = player_2 in parent state
      // useEffect in DiyPanel fires on UNEXPECTED_TARGET and calls onTargetPlayerChange(undefined)
      act(() => {
        root.render(
          <DiyPanel
            diyMode={true}
            dispatchGameAction={vi.fn()}
            game={game}
            onCancelDiyMode={() => {}}
            onEnterDiyMode={() => {}}
            onTargetPlayerChange={onTargetPlayerChange}
            selectedCardIds={["inst_h_1", "inst_oh_1"]}
            targetPlayerId={targetPlayerId}
          />,
        );
      });

      // onTargetPlayerChange(undefined) was called to clear stale target
      expect(onTargetPlayerChange).toHaveBeenCalledWith(undefined);

      // Re-render with cleared target
      act(() => {
        root.render(
          <DiyPanel
            diyMode={true}
            dispatchGameAction={vi.fn()}
            game={game}
            onCancelDiyMode={() => {}}
            onEnterDiyMode={() => {}}
            onTargetPlayerChange={onTargetPlayerChange}
            selectedCardIds={["inst_h_1", "inst_oh_1"]}
            targetPlayerId={undefined}
          />,
        );
      });

      // Authoritative evaluation: player_1 has no FIRE, so OWN_FIRE_REQUIRED blocker is shown (not UNEXPECTED_TARGET)
      expect(container.querySelector(".diy-preview.is-blocked")).not.toBeNull();
      expect(container.textContent).toContain("需要自身处于火情状态");
      expect(container.textContent).not.toContain("此配方不需要选择目标");
    });

    it("auto-clears stale target and evaluates EXECUTABLE when player has FIRE status on CO2 switch", () => {
      let game = createGame();
      // Add FIRE status to player_1 with proper PlayerStatus fields
      game = {
        ...game,
        players: game.players.map((p) =>
          p.id === "player_1"
            ? { ...p, statuses: [{ id: "fire_1", statusId: "FIRE" as const, createdAt: 0 }] }
            : p,
        ),
      };
      game = setHandCards(game, "player_1", [
        { id: "inst_h_1", definitionId: "ion_h" },
        { id: "inst_cl_1", definitionId: "ion_cl" },
        { id: "inst_c_1", definitionId: "element_c" },
        { id: "inst_o_1", definitionId: "element_o" },
        { id: "inst_o_2", definitionId: "element_o" },
      ]);

      let targetPlayerId: PlayerId | undefined = "player_2";
      const onTargetPlayerChange = vi.fn((newTarget: PlayerId | undefined) => {
        targetPlayerId = newTarget;
      });

      // Switch selection to C + O + O with stale target
      act(() => {
        render(
          <DiyPanel
            diyMode={true}
            dispatchGameAction={vi.fn()}
            game={game}
            onCancelDiyMode={() => {}}
            onEnterDiyMode={() => {}}
            onTargetPlayerChange={onTargetPlayerChange}
            selectedCardIds={["inst_c_1", "inst_o_1", "inst_o_2"]}
            targetPlayerId={targetPlayerId}
          />,
        );
      });

      expect(onTargetPlayerChange).toHaveBeenCalledWith(undefined);

      // Re-render with cleared target
      act(() => {
        root.render(
          <DiyPanel
            diyMode={true}
            dispatchGameAction={vi.fn()}
            game={game}
            onCancelDiyMode={() => {}}
            onEnterDiyMode={() => {}}
            onTargetPlayerChange={onTargetPlayerChange}
            selectedCardIds={["inst_c_1", "inst_o_1", "inst_o_2"]}
            targetPlayerId={undefined}
          />,
        );
      });

      // With FIRE status, CO2 is EXECUTABLE
      expect(container.querySelector(".diy-preview.is-executable")).not.toBeNull();
      expect(container.textContent).toContain("生成 CO2 并移除自身火情");
      expect(container.querySelector<HTMLButtonElement>(".diy-execute-button")?.disabled).toBe(false);
    });
  });
});
