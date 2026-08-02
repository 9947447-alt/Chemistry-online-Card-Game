// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createInitialGame } from "../../../game/engine/createInitialGame";
import type { GameState } from "../../../game/engine/types";
import { identityShuffle } from "../../../shared/random";
import { createConfiguringLocalGameSession } from "../localGameSession";
import { AboutDialog } from "./AboutDialog";
import { ActionPanel } from "./ActionPanel";
import { CharacterSelectionPanel } from "./CharacterSelectionPanel";
import { ExperimentCounterattackPanel } from "./ExperimentCounterattackPanel";
import { PlayerPanel } from "./PlayerPanel";

function publicText(container: HTMLElement) {
  const copy = container.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("details").forEach((details) => details.remove());
  return copy.textContent ?? "";
}

describe("Phase 12 character presentation", () => {
  it("keeps implementation terms inside closed debug details across public character panels", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const game = createInitialGame({
      characterIds: ["sulfuric_acid_factory_director", "chemical_factory_ceo"],
      shuffle: identityShuffle,
    });

    try {
      await act(async () => root.render(createElement("div", undefined,
        createElement(CharacterSelectionPanel, { dispatch: vi.fn(), session: createConfiguringLocalGameSession() }),
        createElement(PlayerPanel, { game, onSelectCard: vi.fn(), player: game.players[0] }),
        createElement(AboutDialog, { onClose: vi.fn() }),
      )));

      const visibleText = publicText(container);
      for (const internalTerm of ["8B-1", "8C-2", "DAMAGE", "ionsProvided", "FIRE", "SO2_LEAK"]) {
        expect(visibleText).not.toContain(internalTerm);
      }
      const details = Array.from(container.querySelectorAll("details"));
      expect(details.length).toBeGreaterThan(0);
      expect(details.every((detail) => !detail.open)).toBe(true);
      expect(container.textContent).toContain("ionsProvided");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("renders player-readable status labels in reachable action and counterattack panels", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const actionGame = {
      ...createInitialGame({
        characterIds: ["sulfuric_acid_factory_director", "chemical_factory_ceo"],
        shuffle: identityShuffle,
      }),
      pendingLaboratoryPreparation: undefined,
      phase: "mainAction" as const,
    };
    const initialCounterattackGame = createInitialGame({
      characterIds: ["clumsy_party_secretary", "chemistry_enthusiast"],
      shuffle: identityShuffle,
    });
    const counterattackGame = {
      ...initialCounterattackGame,
      pendingLaboratoryPreparation: undefined,
      phase: "experimentCounterattackWindow",
      pendingExperimentCounterattack: {
        attackerPlayerId: "player_1",
        continuation: { kind: "single-response" },
        legalMetalCardInstanceIds: [],
        legalOptions: ["recover"],
        legalPursuitCardInstanceIds: [],
        originalDamageContext: {
          baseAmount: 1,
          responsePolicy: "acid-base",
          source: {
            cardDefinitionId: "substance_hcl_dilute",
            cardInstanceId: "substance_hcl_dilute_01",
            kind: "card",
            sourcePlayerId: "player_1",
          },
          tags: [],
          targetPlayerId: "player_2",
        },
        responderPlayerId: "player_2",
        responseType: "acid-base",
      },
    } as GameState;

    try {
      await act(async () => root.render(createElement("div", undefined,
        createElement(ActionPanel, {
          dispatchGameAction: vi.fn(),
          game: actionGame,
          onSelectCard: vi.fn(),
        }),
        createElement(ExperimentCounterattackPanel, {
          dispatchGameAction: vi.fn(),
          game: counterattackGame,
        }),
      )));

      const visibleText = publicText(container);
      expect(visibleText).toContain("尾气泄漏状态");
      expect(visibleText).toContain("火情或尾气泄漏时不可选");
      expect(visibleText).not.toContain("FIRE");
      expect(visibleText).not.toContain("SO2_LEAK");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
