import type {
  CharacterId,
  CharacterSkillId,
  CharacterUsageKey,
  GameState,
  PlayerId,
} from "./types";
import {
  advanceTurnFromReducer,
  drawCardsForPlayer,
  getAvailableDrawCardCount,
  type ShuffleFunction,
} from "./turnFlow";

type ImplementedActiveSkill = {
  characterId: CharacterId;
  name: string;
  drawCount: number;
  usageKey: CharacterUsageKey;
};

const implementedActiveSkills: Partial<Record<CharacterSkillId, ImplementedActiveSkill>> = {
  extra_lesson: {
    characterId: "laboratory_teacher",
    name: "补课",
    drawCount: 4,
    usageKey: "laboratory_teacher_extra_lesson",
  },
  emergency_supply: {
    characterId: "chemical_factory_ceo",
    name: "紧急调货",
    drawCount: 3,
    usageKey: "chemical_factory_ceo_emergency_supply",
  },
};

function appendSkillLog(state: GameState, message: string): GameState {
  const nextIndex = state.log.length + 1;
  return {
    ...state,
    log: [...state.log, { id: `log_${String(nextIndex).padStart(3, "0")}`, message }],
  };
}

export function activateCharacterSkill(
  state: GameState,
  playerId: PlayerId,
  skillId: CharacterSkillId,
  shuffle: ShuffleFunction,
): GameState {
  const skill = implementedActiveSkills[skillId];
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (
    state.phase !== "mainAction" ||
    !skill ||
    !player ||
    player.eliminated ||
    state.activePlayerId !== playerId ||
    player.characterId !== skill.characterId ||
    player.hand.length > 4 ||
    player.characterUsage.perCycle[skill.usageKey] ||
    getAvailableDrawCardCount(state) === 0
  ) {
    return state;
  }

  const handSizeBefore = player.hand.length;
  const drawnState = drawCardsForPlayer(state, playerId, skill.drawCount, shuffle);
  const drawnPlayer = drawnState.players.find((candidate) => candidate.id === playerId);
  const actualDrawCount = (drawnPlayer?.hand.length ?? handSizeBefore) - handSizeBefore;

  if (!drawnPlayer || actualDrawCount <= 0) {
    return state;
  }

  const usedState: GameState = {
    ...drawnState,
    players: drawnState.players.map((candidate) =>
      candidate.id === playerId
        ? {
            ...candidate,
            characterUsage: {
              ...candidate.characterUsage,
              perCycle: {
                ...candidate.characterUsage.perCycle,
                [skill.usageKey]: 1,
              },
            },
          }
        : candidate,
    ),
  };
  const loggedState = appendSkillLog(
    usedState,
    `${player.name} 发动${skill.name}，实际摸 ${actualDrawCount} 张牌，本行动结束。`,
  );

  return advanceTurnFromReducer(loggedState, shuffle);
}
