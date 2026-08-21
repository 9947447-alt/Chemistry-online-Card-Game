// @vitest-environment happy-dom

import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { LocalGamePage } from "./LocalGamePage";
import { createInitialGame } from "../../game/engine/createInitialGame";
import { identityShuffle } from "../../shared/random";
import type { LocalGameFactory } from "./localGameSession";
import type { NATBAPolicy } from "../../game/natba/types";
import type { AIObservation } from "../../game/engine/aiObservation";
import { natba0RandomLegalPolicy } from "../../game/natba/natba0Policy";

const deterministicGameFactory: LocalGameFactory = (characterIds) =>
  createInitialGame({
    characterIds: [characterIds[0], characterIds[1]],
    shuffle: identityShuffle,
  });

describe("Phase 19D — Solo vs AI Session Integration", () => {
  it("allows selecting Human vs NATBA-0 AI in configuration and renders lineup summary", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <StrictMode>
            <LocalGamePage
              createGame={deterministicGameFactory}
              aiDelayMs={0}
            />
          </StrictMode>,
        );
      });

      const controllerSelects = container.querySelectorAll(
        "select[aria-label*='controller'], select[aria-label*='控制方']",
      );
      expect(controllerSelects).toHaveLength(2);

      expect(container.textContent).toContain("玩家 A (人类)");
      expect(container.textContent).toContain("玩家 B (人类)");

      const playerBControllerSelect = controllerSelects[1] as HTMLSelectElement;
      await act(async () => {
        playerBControllerSelect.value = "ai";
        playerBControllerSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });

      expect(container.textContent).toContain("玩家 B (NATBA AI)");
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  it("ensures AI decision policy only receives fair AIObservation without opponent hand contents", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    const receivedObservations: AIObservation[] = [];
    const spyPolicy: NATBAPolicy = (observation, context, random) => {
      receivedObservations.push(observation);
      return natba0RandomLegalPolicy(observation, context, random);
    };

    try {
      await act(async () => {
        root.render(
          <StrictMode>
            <LocalGamePage
              createGame={deterministicGameFactory}
              policy={spyPolicy}
              aiDelayMs={0}
            />
          </StrictMode>,
        );
      });

      const controllerSelects = container.querySelectorAll(
        "select[aria-label*='controller'], select[aria-label*='控制方']",
      );
      const playerBControllerSelect = controllerSelects[1] as HTMLSelectElement;
      await act(async () => {
        playerBControllerSelect.value = "ai";
        playerBControllerSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });

      const startButton = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("开始游戏"),
      );

      await act(async () => {
        startButton?.click();
      });

      expect(container.textContent).toContain("实验室老师 · 备课");
      expect(container.textContent).toContain("本地人机公开对局");

      const candidateButtons = container.querySelectorAll(".preparation-candidate-grid button.debug-card__select");
      expect(candidateButtons.length).toBe(20);

      await act(async () => {
        for (let i = 0; i < 10; i += 1) {
          (candidateButtons[i] as HTMLButtonElement).click();
        }
      });

      const confirmPrepButton = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("确认备课选择"),
      );
      expect(confirmPrepButton).toBeDefined();

      await act(async () => {
        confirmPrepButton?.click();
      });

      const passActionButton = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("结束本次行动"),
      );
      expect(passActionButton).toBeDefined();

      await act(async () => {
        passActionButton?.click();
      });

      expect(receivedObservations.length).toBeGreaterThan(0);
      for (const obs of receivedObservations) {
        expect(obs.viewerPlayerId).toBe("player_2");
        expect(obs.self.playerId).toBe("player_2");
        expect(obs.self.handCards.length).toBeGreaterThan(0);

        for (const opp of obs.opponents) {
          expect(opp.playerId).toBe("player_1");
          expect(opp.handCount).toBeGreaterThanOrEqual(0);
          expect((opp as any).hand).toBeUndefined();
          expect((opp as any).handCards).toBeUndefined();
        }
      }
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  it("handles AI laboratory preparation automatically when AI is the laboratory teacher", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <StrictMode>
            <LocalGamePage
              createGame={deterministicGameFactory}
              aiDelayMs={0}
            />
          </StrictMode>,
        );
      });

      const characterSelects = container.querySelectorAll(
        "select[aria-label*='character'], select[aria-label*='角色']",
      );
      const controllerSelects = container.querySelectorAll(
        "select[aria-label*='controller'], select[aria-label*='控制方']",
      );

      await act(async () => {
        const p1Char = characterSelects[0] as HTMLSelectElement;
        p1Char.value = "chemical_factory_ceo";
        p1Char.dispatchEvent(new Event("change", { bubbles: true }));

        const p2Char = characterSelects[1] as HTMLSelectElement;
        p2Char.value = "laboratory_teacher";
        p2Char.dispatchEvent(new Event("change", { bubbles: true }));

        const p2Ctrl = controllerSelects[1] as HTMLSelectElement;
        p2Ctrl.value = "ai";
        p2Ctrl.dispatchEvent(new Event("change", { bubbles: true }));
      });

      const startButton = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("开始游戏"),
      );

      await act(async () => {
        startButton?.click();
      });

      const mainActionHeading = Array.from(container.querySelectorAll("h2")).find(
        (h) => h.textContent?.includes("主行动"),
      );
      expect(mainActionHeading).toBeDefined();
      expect(container.textContent).toContain("化工厂 CEO");
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  it("runs human vs AI actions without deadlock or illegal action errors", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <StrictMode>
            <LocalGamePage
              createGame={deterministicGameFactory}
              aiDelayMs={0}
            />
          </StrictMode>,
        );
      });

      const controllerSelects = container.querySelectorAll(
        "select[aria-label*='controller'], select[aria-label*='控制方']",
      );
      await act(async () => {
        const p2Ctrl = controllerSelects[1] as HTMLSelectElement;
        p2Ctrl.value = "ai";
        p2Ctrl.dispatchEvent(new Event("change", { bubbles: true }));
      });

      await act(async () => {
        const startButton = Array.from(container.querySelectorAll("button")).find(
          (b) => b.textContent?.includes("开始游戏"),
        );
        startButton?.click();
      });

      const candidateButtons = container.querySelectorAll(
        ".preparation-candidate-grid button.debug-card__select",
      );
      await act(async () => {
        for (let i = 0; i < 10; i += 1) {
          (candidateButtons[i] as HTMLButtonElement).click();
        }
      });
      await act(async () => {
        const confirmPrepButton = Array.from(container.querySelectorAll("button")).find(
          (b) => b.textContent?.includes("确认备课选择"),
        );
        confirmPrepButton?.click();
      });

      for (let step = 0; step < 5; step += 1) {
        const passButton = Array.from(container.querySelectorAll("button")).find(
          (b) =>
            !b.disabled &&
            (b.textContent?.includes("结束本次行动") ||
              b.textContent?.includes("放弃响应") ||
              b.textContent?.includes("放弃处理")),
        );
        if (passButton) {
          await act(async () => {
            passButton.click();
          });
        }
      }

      expect(container.querySelector(".error-banner")).toBeNull();
      expect(container.textContent).not.toContain("操作不合法");
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });
});