import { describe, expect, it } from "vitest";
import { applyLoseHpBatch, type LoseHpTarget } from "../engine/loseHp";
import { engineReducer } from "../engine/reducer";
import type { GameState } from "../engine/types";
import { identityShuffle } from "../../shared/random";
import { expectCardZonesToBeConsistent } from "./assertCardZones";
import { createMvp0TestGame as createInitialGame } from "./createTestGame";
import { renderGameLogEntry } from "../../features/local-game/gameLogRenderer";

function createState(): GameState {
  return createInitialGame({ shuffle: identityShuffle });
}

describe("Phase 8C-1 independent lose-HP batches", () => {
  it("treats an all-zero batch as a safe no-op", () => {
    const state = createState();
    const target = state.players[1];
    const resolved = applyLoseHpBatch(state, [{ targetPlayerId: target.id, amount: 0 }]);

    expect(resolved).toBe(state);
    expect(resolved.players[1]).toMatchObject({ hp: target.hp, eliminated: false });
    expect(resolved.phase).toBe(state.phase);
    expect(resolved.log).toBe(state.log);
  });

  it("applies a single loss without entering a response window", () => {
    const state = createState();
    const target = state.players[1];
    const resolved = applyLoseHpBatch(state, [{ targetPlayerId: target.id, amount: 1 }]);

    expect(resolved.players[1]).toMatchObject({ hp: target.hp - 1, eliminated: false });
    expect(resolved.phase).toBe(state.phase);
    expect(resolved.pendingResponse).toBeUndefined();
    const lastMsg = resolved.log.at(-1) ? renderGameLogEntry(resolved.log.at(-1)!) : "";
    expect(lastMsg).toContain("失去 1 点体力");
    expect(lastMsg).not.toContain("伤害");
  });

  it("does not apply the ordinary DAMAGE minimum or 3-point cap", () => {
    const state = createState();
    const target = state.players[1];
    const resolved = applyLoseHpBatch(state, [{ targetPlayerId: target.id, amount: 8 }]);

    expect(resolved.players[1].hp).toBe(target.hp - 8);
    expect(resolved.players[1].eliminated).toBe(false);
  });

  it("floors HP at 0 and resolves elimination and gameOver after the batch", () => {
    const state = createState();
    const [survivor, target] = state.players;
    const resolved = applyLoseHpBatch(state, [
      { targetPlayerId: target.id, amount: target.hp + 5 },
    ]);

    expect(resolved.players[1]).toMatchObject({ hp: 0, eliminated: true });
    expect(resolved.phase).toBe("gameOver");
    expect(resolved.winnerPlayerId).toBe(survivor.id);
    expect(resolved.isDraw).toBeUndefined();
    expect(resolved.log.some((entry) => renderGameLogEntry(entry).includes("失去 10 点体力"))).toBe(true);
  });

  it("applies all target HP changes before one unified draw determination", () => {
    const state = createState();
    const resolved = applyLoseHpBatch(
      state,
      state.players.map((player) => ({ targetPlayerId: player.id, amount: player.hp })),
    );

    expect(resolved.players.every((player) => player.hp === 0 && player.eliminated)).toBe(true);
    expect(resolved.phase).toBe("gameOver");
    expect(resolved.winnerPlayerId).toBeUndefined();
    expect(resolved.isDraw).toBe(true);
    expect(resolved.log.filter((entry) => renderGameLogEntry(entry).includes("本局平局"))).toHaveLength(1);
  });

  it("is independent of target input order, including deterministic logs", () => {
    const state = createState();
    const targets: readonly LoseHpTarget[] = [
      { targetPlayerId: state.players[0].id, amount: 2 },
      { targetPlayerId: state.players[1].id, amount: 3 },
    ];

    const forward = applyLoseHpBatch(state, targets);
    const reverse = applyLoseHpBatch(state, [...targets].reverse());

    expect(reverse).toEqual(forward);
  });

  it.each([
    {
      name: "duplicate target",
      makeTargets: (state: GameState): readonly LoseHpTarget[] => [
        { targetPlayerId: state.players[1].id, amount: 1 },
        { targetPlayerId: state.players[1].id, amount: 1 },
      ],
    },
    {
      name: "unknown target",
      makeTargets: (): readonly LoseHpTarget[] => [
        { targetPlayerId: "player_missing", amount: 1 },
      ],
    },
    {
      name: "negative amount",
      makeTargets: (state: GameState): readonly LoseHpTarget[] => [
        { targetPlayerId: state.players[1].id, amount: -1 },
      ],
    },
    {
      name: "NaN amount",
      makeTargets: (state: GameState): readonly LoseHpTarget[] => [
        { targetPlayerId: state.players[1].id, amount: Number.NaN },
      ],
    },
    {
      name: "infinite amount",
      makeTargets: (state: GameState): readonly LoseHpTarget[] => [
        { targetPlayerId: state.players[1].id, amount: Number.POSITIVE_INFINITY },
      ],
    },
  ])("atomically rejects $name", ({ makeTargets }) => {
    const state = createState();
    const resolved = applyLoseHpBatch(state, makeTargets(state));

    expect(resolved).toBe(state);
    expect(resolved.log).toBe(state.log);
    expect(resolved.players).toBe(state.players);
  });

  it("rejects an invalid mixed batch before applying its valid entry", () => {
    const state = createState();
    const resolved = applyLoseHpBatch(state, [
      { targetPlayerId: state.players[0].id, amount: 1 },
      { targetPlayerId: "player_missing", amount: 1 },
    ]);

    expect(resolved).toBe(state);
  });

  it("preserves tableReference, usage, card zones, and phase outside gameOver", () => {
    const initial = createState();
    const activePlayer = initial.players.find((player) => player.id === initial.activePlayerId);
    const referenceCardId = activePlayer?.hand[0];

    if (!activePlayer || !referenceCardId) {
      throw new Error("Expected a real starter-deck card in the active player's hand.");
    }

    const state = engineReducer(initial, {
      type: "PLAY_REFERENCE_CARD",
      playerId: activePlayer.id,
      cardInstanceId: referenceCardId,
    });
    const target = state.players.find((player) => player.id === state.activePlayerId);

    if (!target) {
      throw new Error("Expected the next active player.");
    }

    const resolved = applyLoseHpBatch(state, [{ targetPlayerId: target.id, amount: 1 }]);

    expect(resolved.phase).toBe(state.phase);
    expect(resolved.tableReference).toEqual(state.tableReference);
    expect(resolved.cardInstances).toBe(state.cardInstances);
    expect(resolved.deck).toBe(state.deck);
    expect(resolved.discardPile).toBe(state.discardPile);
    expect(resolved.players.map((player) => player.usedDIYThisCycle)).toEqual(
      state.players.map((player) => player.usedDIYThisCycle),
    );
    expect(resolved.players.map((player) => player.characterUsage)).toEqual(
      state.players.map((player) => player.characterUsage),
    );
    expectCardZonesToBeConsistent(resolved);
  });
});
