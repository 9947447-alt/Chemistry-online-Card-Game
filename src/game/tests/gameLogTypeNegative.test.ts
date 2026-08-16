import { describe, expect, it } from "vitest";
import { appendEvent } from "../engine/logEvents";
import { createMvp0TestGame as createInitialGame } from "./createTestGame";
import { identityShuffle } from "../../shared/random";
import type { GameLogEntry, GameLogEventKey } from "../engine/types";
import { logRenderers } from "../../features/local-game/gameLogRenderer";

describe("Phase 16 GameLog Entry Type Negative Tests", () => {
  it("enforces type safety for eventKey, params, and reaction discriminating union", () => {
    const initialState = createInitialGame({ shuffle: identityShuffle });

    // 1. Mismatch Params: turn_start requires { playerId: string }, passing cycleNumber must fail TS typecheck
    // @ts-expect-error turn_start params requires playerId, not cycleNumber
    appendEvent(initialState, { eventKey: "turn_start", params: { cycleNumber: 1 } });

    // 2. Missing Reaction: reaction eventKey requires reaction property
    // @ts-expect-error reaction eventKey requires reaction property
    appendEvent(initialState, { eventKey: "reaction", params: {} });

    // 3. Unexpected Reaction: non-reaction eventKey cannot have reaction property
    appendEvent(initialState, {
      eventKey: "turn_start",
      params: { playerId: "player_1" },
      // @ts-expect-error turn_start cannot have a reaction property
      reaction: {
        definitionId: "acid_base_neutralization",
        trigger: { kind: "single-damage-response", responsePolicy: "acid-base" },
        participants: [
          {
            kind: "card",
            playerId: "player_1",
            cardInstanceId: "c1",
            cardDefinitionId: "substance_hcl_dilute",
            role: "attacker",
          },
          {
            kind: "card",
            playerId: "player_2",
            cardInstanceId: "c2",
            cardDefinitionId: "substance_naoh_dilute",
            role: "responder",
          },
        ],
        outcome: { kind: "virtual-product", product: "H2O", damageCancelled: true },
      },
    });

    const stateWithLog = appendEvent(initialState, {
      eventKey: "lose_hp",
      params: { playerId: "player_1", amount: 1 },
    });
    const entry = stateWithLog.log[stateWithLog.log.length - 1];

    if (entry.eventKey === "lose_hp") {
      // 4. Mutating Params Field: params is Readonly
      // @ts-expect-error entry.params.amount is readonly
      entry.params.amount = 5;
    }

    const stateWithReaction = appendEvent(stateWithLog, {
      eventKey: "reaction",
      params: {},
      reaction: {
        definitionId: "acid_base_neutralization",
        trigger: { kind: "single-damage-response", responsePolicy: "acid-base" },
        participants: [
          {
            kind: "card",
            playerId: "player_1",
            cardInstanceId: "c1",
            cardDefinitionId: "substance_hcl_dilute",
            role: "attacker",
          },
          {
            kind: "card",
            playerId: "player_2",
            cardInstanceId: "c2",
            cardDefinitionId: "substance_naoh_dilute",
            role: "responder",
          },
        ],
        outcome: { kind: "virtual-product", product: "H2O", damageCancelled: true },
      },
    });

    const reactionEntry = stateWithReaction.log[stateWithReaction.log.length - 1];
    if (reactionEntry.eventKey === "reaction") {
      // 5. Mutating Participants: reaction.participants is Readonly tuple
      // @ts-expect-error reaction.participants is readonly
      reactionEntry.reaction.participants.push({
        kind: "card",
        playerId: "player_1",
        cardInstanceId: "c3",
        cardDefinitionId: "substance_hcl_dilute",
        role: "responder",
      });

      // @ts-expect-error reaction.participants elements are readonly
      reactionEntry.reaction.participants[0].cardDefinitionId = "substance_h2so4_dilute";
    }

    // 6. Non-Exhaustive Renderer check:
    // Verify all 38 keys exist in logRenderers
    const keys: GameLogEventKey[] = Object.keys(logRenderers) as GameLogEventKey[];
    expect(keys.length).toBe(38);
  });
});
