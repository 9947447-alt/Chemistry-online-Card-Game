// @vitest-environment happy-dom

import { StrictMode, act, createElement, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useLocalGameDebug } from "../../features/local-game/hooks/useLocalGameDebug";
import type {
  CharacterSelection,
  LocalGameEngineReducer,
  LocalGameFactory,
  LocalGameSessionCommand,
  LocalGameSessionInitializer,
  LocalGameSessionState,
} from "../../features/local-game/localGameSession";
import { createInitialGame } from "../engine/createInitialGame";
import type { GameState } from "../engine/types";
import { identityShuffle } from "../../shared/random";

type SessionHarnessProps = {
  createGame: LocalGameFactory;
  reduceGame?: LocalGameEngineReducer;
  createSession?: LocalGameSessionInitializer;
  onDispatch?: (dispatch: (command: LocalGameSessionCommand) => void) => void;
  onSession: (session: LocalGameSessionState) => void;
};

function SessionHarness({
  createGame,
  reduceGame,
  createSession,
  onDispatch,
  onSession,
}: SessionHarnessProps) {
  const [session, dispatch] = useLocalGameDebug(createGame, reduceGame, createSession);

  useLayoutEffect(() => {
    onSession(session);
  }, [onSession, session]);

  useLayoutEffect(() => {
    onDispatch?.(dispatch);
  }, [dispatch, onDispatch]);

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
      : session.mode === "playing"
        ? createElement(
            "div",
            null,
            createElement(
              "button",
              { type: "button", onClick: () => dispatch({ type: "RESTART_CURRENT_LINEUP" }) },
              "按当前阵容重开",
            ),
            createElement(
              "button",
              {
                type: "button",
                onClick: () => dispatch({
                  type: "DISPATCH_GAME_ACTION",
                  action: { type: "PASS_ACTION", playerId: session.game.activePlayerId },
                }),
              },
              "触发游戏操作",
            ),
          )
        : createElement(
            "div",
            null,
            createElement(
              "button",
              {
                type: "button",
                onClick: () => dispatch({ type: "RECOVER_FATAL_WITH_CURRENT_LINEUP" }),
              },
              "按原阵容创建全新对局",
            ),
            createElement(
              "button",
              {
                type: "button",
                onClick: () => dispatch({ type: "RETURN_TO_CHARACTER_SELECTION" }),
              },
              "返回角色选择",
            ),
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

  it("calls the factory once for a failed start and once for explicit fatal recovery", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const observed: { current?: LocalGameSessionState } = {};
    const createGame = vi.fn((characterIds: CharacterSelection) => {
      if (createGame.mock.calls.length === 1) {
        throw new Error("PRIVATE_FACTORY_MESSAGE");
      }
      return createInitialGame({
        characterIds: [characterIds[0], characterIds[1]],
        shuffle: identityShuffle,
      });
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

      await act(async () => requireButton(container, "开始游戏").click());
      expect(createGame).toHaveBeenCalledTimes(1);
      expect(observed.current?.mode).toBe("fatal");
      expect(container.textContent).not.toContain("PRIVATE_FACTORY_MESSAGE");

      await act(async () => {
        requireButton(container, "按原阵容创建全新对局").click();
      });
      expect(createGame).toHaveBeenCalledTimes(2);
      expect(observed.current?.mode).toBe("playing");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("contains an initializer exception and invokes no factory until explicit recovery", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const observed: { current?: LocalGameSessionState } = {};
    const createGame = vi.fn((characterIds: CharacterSelection) => createInitialGame({
      characterIds: [characterIds[0], characterIds[1]],
      shuffle: identityShuffle,
    }));
    const createSession = vi.fn((): LocalGameSessionState => {
      throw new Error("PRIVATE_INITIALIZER_MESSAGE");
    });

    try {
      await act(async () => {
        root.render(createElement(
          StrictMode,
          null,
          createElement(SessionHarness, {
            createGame,
            createSession,
            onSession: (session) => {
              observed.current = session;
            },
          }),
        ));
      });

      expect(createSession).toHaveBeenCalledTimes(2);
      expect(createGame).not.toHaveBeenCalled();
      expect(observed.current?.mode).toBe("fatal");

      await act(async () => {
        requireButton(container, "按原阵容创建全新对局").click();
      });
      expect(createGame).toHaveBeenCalledTimes(1);
      expect(observed.current?.mode).toBe("playing");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("calls the factory once for a failed restart and once for explicit recovery", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const observed: { current?: LocalGameSessionState } = {};
    const createGame = vi.fn((characterIds: CharacterSelection) => {
      if (createGame.mock.calls.length === 2) {
        throw new Error("PRIVATE_RESTART_MESSAGE");
      }
      return createInitialGame({
        characterIds: [characterIds[0], characterIds[1]],
        shuffle: identityShuffle,
      });
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

      await act(async () => requireButton(container, "开始游戏").click());
      expect(createGame).toHaveBeenCalledTimes(1);
      await act(async () => requireButton(container, "按当前阵容重开").click());
      expect(createGame).toHaveBeenCalledTimes(2);
      expect(observed.current?.mode).toBe("fatal");

      await act(async () => {
        requireButton(container, "按原阵容创建全新对局").click();
      });
      expect(createGame).toHaveBeenCalledTimes(3);
      expect(observed.current?.mode).toBe("playing");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("converts a reducer throw to fatal through the real hook and rejects old actions", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const observed: { current?: LocalGameSessionState } = {};
    const exposedDispatch: { current?: (command: LocalGameSessionCommand) => void } = {};
    const createdGames: GameState[] = [];
    const createGame = vi.fn((characterIds: CharacterSelection) => {
      const game = createInitialGame({
        characterIds: [characterIds[0], characterIds[1]],
        shuffle: identityShuffle,
      });
      createdGames.push(game);
      return game;
    });
    const reduceGame = vi.fn<LocalGameEngineReducer>(() => {
      throw new Error("PRIVATE_REDUCER_MESSAGE_AND_STACK");
    });

    try {
      await act(async () => {
        root.render(createElement(
          StrictMode,
          null,
          createElement(SessionHarness, {
            createGame,
            reduceGame,
            onDispatch: (dispatch) => {
              exposedDispatch.current = dispatch;
            },
            onSession: (session) => {
              observed.current = session;
            },
          }),
        ));
      });

      await act(async () => requireButton(container, "开始游戏").click());
      const started = observed.current;
      expect(createGame).toHaveBeenCalledOnce();
      expect(started?.mode).toBe("playing");
      if (!started || started.mode !== "playing") {
        throw new Error("Expected a playing session before the reducer failure.");
      }
      const oldGame = started.game;

      await act(async () => requireButton(container, "触发游戏操作").click());
      const fatal = observed.current;
      expect(reduceGame).toHaveBeenCalledOnce();
      expect(fatal?.mode).toBe("fatal");
      expect(fatal && "game" in fatal).toBe(false);
      expect(JSON.stringify(fatal)).not.toContain("PRIVATE_REDUCER_MESSAGE_AND_STACK");

      await act(async () => {
        exposedDispatch.current?.({
          type: "DISPATCH_GAME_ACTION",
          action: { type: "PASS_ACTION", playerId: oldGame.activePlayerId },
        });
      });
      expect(observed.current).toBe(fatal);
      expect(reduceGame).toHaveBeenCalledOnce();

      await act(async () => {
        requireButton(container, "按原阵容创建全新对局").click();
      });
      const recovered = observed.current;
      expect(createGame).toHaveBeenCalledTimes(2);
      expect(recovered?.mode).toBe("playing");
      if (!recovered || recovered.mode !== "playing") {
        throw new Error("Expected explicit fatal recovery to enter playing.");
      }
      expect(recovered.game).toBe(createdGames[1]);
      expect(recovered.game).not.toBe(oldGame);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("stays fatal when recovery throws and returns to configuration without a loop", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const observed: { current?: LocalGameSessionState } = {};
    const createGame = vi.fn((characterIds: CharacterSelection) => {
      if (createGame.mock.calls.length > 1) {
        throw new Error("PRIVATE_RECOVERY_MESSAGE");
      }
      return createInitialGame({
        characterIds: [characterIds[0], characterIds[1]],
        shuffle: identityShuffle,
      });
    });
    const reduceGame = vi.fn<LocalGameEngineReducer>(() => {
      throw new Error("PRIVATE_REDUCER_MESSAGE");
    });

    try {
      await act(async () => {
        root.render(createElement(
          StrictMode,
          null,
          createElement(SessionHarness, {
            createGame,
            reduceGame,
            onSession: (session) => {
              observed.current = session;
            },
          }),
        ));
      });

      await act(async () => requireButton(container, "开始游戏").click());
      await act(async () => requireButton(container, "触发游戏操作").click());
      expect(observed.current?.mode).toBe("fatal");

      await act(async () => {
        requireButton(container, "按原阵容创建全新对局").click();
      });
      expect(createGame).toHaveBeenCalledTimes(2);
      expect(observed.current?.mode).toBe("fatal");
      if (observed.current?.mode === "fatal") {
        expect(observed.current.error.code).toBe("GAME_RECOVERY_FAILED");
        expect("game" in observed.current).toBe(false);
      }

      await act(async () => requireButton(container, "返回角色选择").click());
      expect(observed.current?.mode).toBe("configuring");
      expect(observed.current && "game" in observed.current).toBe(false);
      expect(createGame).toHaveBeenCalledTimes(2);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
