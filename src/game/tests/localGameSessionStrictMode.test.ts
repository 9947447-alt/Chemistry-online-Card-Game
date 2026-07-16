// @vitest-environment happy-dom

import { StrictMode, act, createElement, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useLocalGameDebug } from "../../features/local-game/hooks/useLocalGameDebug";
import type {
  CharacterSelection,
  LocalGameFactory,
  LocalGameSessionState,
} from "../../features/local-game/localGameSession";
import { createInitialGame } from "../engine/createInitialGame";
import type { GameState } from "../engine/types";
import { identityShuffle } from "../../shared/random";

type SessionHarnessProps = {
  createGame: LocalGameFactory;
  onSession: (session: LocalGameSessionState) => void;
};

function SessionHarness({ createGame, onSession }: SessionHarnessProps) {
  const [session, dispatch] = useLocalGameDebug(createGame);

  useLayoutEffect(() => {
    onSession(session);
  }, [onSession, session]);

  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "mode" }, session.mode),
    session.mode === "configuring"
      ? createElement(
          "button",
          {
            type: "button",
            onClick: () => dispatch({
              type: "SELECT_CHARACTER",
              playerIndex: 0,
              characterId: "missing_character",
            }),
          },
          "选择未知角色",
        )
      : null,
    session.mode === "configuring"
      ? createElement(
          "button",
          { type: "button", onClick: () => dispatch({ type: "START_LOCAL_GAME" }) },
          "开始游戏",
        )
      : createElement(
          "button",
          { type: "button", onClick: () => dispatch({ type: "RESTART_CURRENT_LINEUP" }) },
          "按当前阵容重开",
        ),
  );
}

function requireButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label,
  );

  if (!button) {
    throw new Error(`Expected button: ${label}`);
  }

  return button;
}

describe("Phase 9 local session React StrictMode integration", () => {
  it("creates exactly one GameState for one start and one additional GameState for one restart", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const createdGames: GameState[] = [];
    const observed: { current?: LocalGameSessionState } = {};
    const createGame = vi.fn((characterIds: CharacterSelection) => {
      const game = createInitialGame({
        characterIds: [characterIds[0], characterIds[1]],
        shuffle: identityShuffle,
      });
      createdGames.push(game);
      return game;
    });

    try {
      await act(async () => {
        root.render(createElement(
          StrictMode,
          null,
          createElement(SessionHarness, {
            createGame,
            onSession: (session) => {
              observed.current = session;
            },
          }),
        ));
      });

      await act(async () => {
        requireButton(container, "选择未知角色").click();
      });

      expect(createGame).not.toHaveBeenCalled();
      expect(observed.current?.mode).toBe("configuring");
      expect(observed.current?.error).toContain("未知角色");

      await act(async () => {
        requireButton(container, "开始游戏").click();
      });

      const started = observed.current;
      expect(createGame).toHaveBeenCalledTimes(1);
      expect(started?.mode).toBe("playing");
      if (!started || started.mode !== "playing") {
        throw new Error("Expected the StrictMode harness to enter playing mode.");
      }
      expect(started.game).toBe(createdGames[0]);
      expect(started.game.players.map((player) => player.characterId)).toEqual(
        started.characterIds,
      );

      const oldGame = started.game;
      const oldSnapshot = structuredClone(oldGame);

      await act(async () => {
        requireButton(container, "按当前阵容重开").click();
      });

      const restarted = observed.current;
      expect(createGame).toHaveBeenCalledTimes(2);
      expect(restarted?.mode).toBe("playing");
      if (!restarted || restarted.mode !== "playing") {
        throw new Error("Expected the StrictMode harness to remain in playing mode.");
      }
      expect(restarted.game).toBe(createdGames[1]);
      expect(restarted.game).not.toBe(oldGame);
      expect(restarted.game.players.map((player) => player.characterId)).toEqual(
        restarted.characterIds,
      );
      expect(oldGame).toEqual(oldSnapshot);
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });
});
