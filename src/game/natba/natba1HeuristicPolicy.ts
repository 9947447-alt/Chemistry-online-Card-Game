import type { RandomSource } from "../../shared/random";
import { cardDefinitionsById } from "../data/cardDefinitions";
import type { GameAction } from "../engine/actions";
import type { AIObservation, AIObservationOpponent } from "../engine/aiObservation";
import type { DecisionContext } from "../engine/decisionContext";
import type { CardDefinition, CardInstanceId, CharacterId } from "../engine/types";
import type { NATBAPolicy } from "./types";

function getCardDefinition(
  cardInstanceId: CardInstanceId | undefined,
  observation: AIObservation,
): CardDefinition | undefined {
  if (!cardInstanceId) {
    return undefined;
  }
  const selfHandIndex = observation.self.hand.indexOf(cardInstanceId);
  if (selfHandIndex !== -1 && observation.self.handCards[selfHandIndex]) {
    return observation.self.handCards[selfHandIndex];
  }
  const discardCard = observation.discardPileCards.find(
    (card) => card.cardInstanceId === cardInstanceId,
  );
  if (discardCard) {
    return discardCard.definition;
  }
  if (cardDefinitionsById.has(cardInstanceId)) {
    return cardDefinitionsById.get(cardInstanceId);
  }
  const lastUnderscore = cardInstanceId.lastIndexOf("_");
  if (lastUnderscore !== -1) {
    const candidateDefId = cardInstanceId.slice(0, lastUnderscore);
    if (cardDefinitionsById.has(candidateDefId)) {
      return cardDefinitionsById.get(candidateDefId);
    }
  }
  return undefined;
}

export function scoreFiniteAction(
  action: GameAction,
  observation: AIObservation,
): number {
  const self = observation.self;
  const opponents = observation.opponents;
  const primaryOpponent: AIObservationOpponent | undefined =
    opponents.find((op) => op.playerId !== self.playerId && !op.eliminated) ??
    opponents[0];

  const opponentHp = primaryOpponent ? primaryOpponent.hp : 10;
  const opponentHandCount = primaryOpponent ? primaryOpponent.handCount : 0;
  const opponentHasSo2 = primaryOpponent
    ? primaryOpponent.statuses.some((s) => s.statusId === "SO2_LEAK")
    : false;
  const selfHasFire = self.statuses.some((s) => s.statusId === "FIRE");
  const missingHp = Math.max(0, self.maxHp - self.hp);

  switch (action.type) {
    case "PASS_ACTION": {
      return 10;
    }

    case "PASS_RESPONSE": {
      return 0;
    }

    case "PASS_STATUS_HANDLING": {
      return 0;
    }

    case "RESPOND_WITH_CARD": {
      let score = 160;
      const def = getCardDefinition(action.cardInstanceId, observation);
      if (def) {
        if (def.id === "substance_na2co3" || def.id === "ion_co3") {
          score += 40;
        } else if (def.type === "ion") {
          score += 25;
        } else {
          score += 5;
        }
      }
      if (self.hp <= 3) {
        score += 80;
      }
      return score;
    }

    case "HANDLE_STATUS_WITH_CARD": {
      let score = 190;
      const def = getCardDefinition(action.cardInstanceId, observation);
      if (def) {
        if (def.id === "substance_h2o" || def.id === "substance_co2") {
          score += 35;
        } else if (def.id === "ion_oh") {
          score += 25;
        }
      }
      if (self.hp <= 4) {
        score += 80;
      }
      return score;
    }

    case "RESOLVE_EXPERIMENT_COUNTERATTACK": {
      if (action.option === "recover") {
        let score = 150;
        if (missingHp >= 2) {
          score += 40;
        }
        if (self.hp <= 3) {
          score += 60;
        }
        if (self.hp === self.maxHp) {
          score = 0;
        }
        return score;
      }
      if (action.option === "acid-base-pursuit") {
        let score = 180;
        if (opponentHp <= 2) {
          score += 70;
        }
        if (self.hp === self.maxHp) {
          score += 30;
        }
        return score;
      }
      return 0;
    }

    case "PLAY_CARD": {
      const def = getCardDefinition(action.cardInstanceId, observation);
      if (!def) {
        return 40;
      }

      if (def.id === "substance_o2" || action.targetPlayerId === self.playerId) {
        if (missingHp >= 2) {
          return 130 + (self.hp <= 3 ? 50 : 0);
        }
        if (missingHp === 1) {
          return 70;
        }
        return 0;
      }

      if (def.id === "substance_so2") {
        if (!opponentHasSo2) {
          return 120 + (opponentHp <= 3 ? 30 : 0);
        }
        return 20;
      }

      let score = 115;
      if (opponentHp <= 2) {
        score += 80;
      } else if (opponentHp <= 4) {
        score += 40;
      }

      if (opponentHandCount === 0) {
        score += 40;
      } else if (opponentHandCount <= 2) {
        score += 20;
      }

      if (self.characterId === "acid_king" && def.tags.includes("strong-acid")) {
        score += 80;
      } else if (self.characterId === "caustic_soda_captain" && def.tags.includes("strong-alkali")) {
        score += 40;
      } else if (
        self.characterId === "sulfuric_acid_factory_director" &&
        def.id === "substance_h2so4_dilute"
      ) {
        score += 35;
      }

      return score;
    }

    case "PLAY_REFERENCE_CARD": {
      // 桌面基准牌纯垫牌，不产生伤害，打分低于 PASS 与进攻动作
      return 5;
    }

    case "PLAY_DIY_SELECTION": {
      const compDefs = action.componentCardInstanceIds
        .map((id) => getCardDefinition(id, observation))
        .filter((d): d is CardDefinition => Boolean(d));

      const hasC = compDefs.some((d) => d.id === "element_c");
      const hasO = compDefs.some((d) => d.id === "element_o");
      const hasS = compDefs.some((d) => d.id === "element_s");
      const hasH = compDefs.some((d) => d.id === "ion_h");
      const hasOH = compDefs.some((d) => d.id === "ion_oh");

      if ((hasC && hasO) || (hasH && hasOH && !action.targetPlayerId)) {
        if (selfHasFire) {
          return 180;
        }
        return 0;
      }

      if (hasS && hasO) {
        if (!opponentHasSo2) {
          return 125;
        }
        return 20;
      }

      let score = 135;
      if (opponentHp <= 2) {
        score += 80;
      }
      if (opponentHandCount === 0) {
        score += 35;
      }
      if (self.characterId === "chemistry_enthusiast" && !self.usedDIYThisCycle) {
        score += 60;
      }
      return score;
    }

    case "ACTIVATE_CHARACTER_SKILL": {
      switch (action.skillId) {
        case "extra_lesson":
        case "emergency_supply":
          return 160;

        case "alkali_recovery":
          if (missingHp >= 2) {
            return 130;
          }
          if (missingHp === 1) {
            return 80;
          }
          return 10;

        case "exhaust_discharge":
          if (!opponentHasSo2) {
            return 125;
          }
          return 25;

        case "exhaust_leak":
          return 135 + (opponentHp <= 2 ? 60 : 0);

        case "exothermic_accident":
          if (opponentHp <= 1) {
            return 300;
          }
          if (self.hp <= 1 && opponentHp > 1) {
            return -100;
          }
          return 140;

        case "lab_fire":
          if (selfHasFire) {
            return 110;
          }
          if (self.hp >= 6 || opponentHp <= 3) {
            return 100;
          }
          if (self.hp <= 3) {
            return -30;
          }
          return 75;

        default:
          return 60;
      }
    }

    default:
      return 0;
  }
}

export function evaluateCandidateCard(
  def: CardDefinition,
  alreadyKept: readonly CardDefinition[],
  selfCharacterId: CharacterId,
): number {
  let score = 35;

  if (def.tags.includes("strong-acid")) {
    score = 130;
  } else if (def.tags.includes("strong-alkali")) {
    score = 125;
  } else if (def.id === "substance_o2") {
    score = 95;
  } else if (def.id === "substance_so2") {
    score = 90;
  } else if (def.id === "ion_h" || def.id === "ion_oh") {
    score = 80;
  } else if (def.tags.includes("carbonate")) {
    score = 70;
  } else if (def.tags.includes("fire-extinguish")) {
    score = 55;
  }

  if (selfCharacterId === "acid_king" && (def.tags.includes("acid") || def.id === "ion_h")) {
    score += 35;
  } else if (selfCharacterId === "caustic_soda_captain" && (def.tags.includes("base") || def.id === "ion_oh")) {
    score += 35;
  } else if (
    selfCharacterId === "sulfuric_acid_factory_director" &&
    (def.id === "substance_h2so4_dilute" || def.id === "ion_so4")
  ) {
    score += 30;
  }

  const sameDefCount = alreadyKept.filter((k) => k.id === def.id).length;
  const sameTypeExtinguishCount = alreadyKept.filter((k) =>
    k.tags.includes("fire-extinguish"),
  ).length;

  if (def.tags.includes("fire-extinguish")) {
    if (sameTypeExtinguishCount === 1) {
      score -= 25;
    } else if (sameTypeExtinguishCount >= 2) {
      score -= 60;
    }
  }

  if (def.id === "substance_o2" && sameDefCount >= 2) {
    score -= 40;
  }
  if (def.id === "substance_so2" && sameDefCount >= 2) {
    score -= 50;
  }

  if (
    def.id === "ion_h" &&
    alreadyKept.some(
      (k) => k.id === "ion_oh" || k.id === "ion_cl" || k.id === "ion_so4",
    )
  ) {
    score += 25;
  }
  if (
    def.id === "ion_oh" &&
    alreadyKept.some(
      (k) =>
        k.id === "ion_h" ||
        k.id === "ion_na" ||
        k.id === "ion_k" ||
        k.id === "ion_ca",
    )
  ) {
    score += 25;
  }
  if (def.id === "element_s" && alreadyKept.some((k) => k.id === "element_o")) {
    score += 20;
  }
  if (def.id === "element_o" && alreadyKept.some((k) => k.id === "element_s")) {
    score += 15;
  }

  return score;
}

export function selectLaboratoryPreparationCards(
  candidateCardInstanceIds: readonly CardInstanceId[],
  keepCount: number,
  observation: AIObservation,
  random: RandomSource,
): CardInstanceId[] {
  const candidates = [...candidateCardInstanceIds];
  const keptCardInstanceIds: CardInstanceId[] = [];
  const keptDefinitions: CardDefinition[] = [];

  while (keptCardInstanceIds.length < keepCount && candidates.length > 0) {
    let bestScore = Number.NEGATIVE_INFINITY;
    const bestCandidates: number[] = [];

    for (let index = 0; index < candidates.length; index += 1) {
      const cardId = candidates[index];
      const def = getCardDefinition(cardId, observation) ?? {
        id: cardId,
        name: "Unknown",
        type: "substance" as const,
        formula: "Unknown",
        tags: [],
        allowedTimings: [],
        rulesText: "",
      };

      const score = evaluateCandidateCard(def, keptDefinitions, observation.self.characterId);
      if (score > bestScore) {
        bestScore = score;
        bestCandidates.length = 0;
        bestCandidates.push(index);
      } else if (score === bestScore) {
        bestCandidates.push(index);
      }
    }

    let bestIndex = 0;
    if (bestCandidates.length > 1) {
      const pick = Math.floor(random() * bestCandidates.length);
      bestIndex = bestCandidates[Math.min(Math.max(0, pick), bestCandidates.length - 1)];
    } else {
      bestIndex = bestCandidates[0] ?? 0;
    }

    const [selectedCardId] = candidates.splice(bestIndex, 1);
    keptCardInstanceIds.push(selectedCardId);
    const selectedDef = getCardDefinition(selectedCardId, observation);
    if (selectedDef) {
      keptDefinitions.push(selectedDef);
    }
  }

  return keptCardInstanceIds;
}

export const natba1HeuristicPolicy: NATBAPolicy = (
  observation: AIObservation,
  context: DecisionContext,
  random: RandomSource = Math.random,
): GameAction | undefined => {
  if (context.kind === "finite-actions") {
    if (context.legalActions.length === 0) {
      return undefined;
    }

    let highestScore = Number.NEGATIVE_INFINITY;
    const bestActions: GameAction[] = [];

    for (const action of context.legalActions) {
      const score = scoreFiniteAction(action, observation);
      if (score > highestScore) {
        highestScore = score;
        bestActions.length = 0;
        bestActions.push(action);
      } else if (score === highestScore) {
        bestActions.push(action);
      }
    }

    if (bestActions.length === 0) {
      return context.legalActions[0];
    }

    if (bestActions.length === 1) {
      return bestActions[0];
    }

    const selectedIndex = Math.floor(random() * bestActions.length);
    const clampedIndex = Math.min(
      Math.max(0, selectedIndex),
      bestActions.length - 1,
    );
    return bestActions[clampedIndex];
  }

  if (context.kind === "laboratory-preparation") {
    const keptCardInstanceIds = selectLaboratoryPreparationCards(
      context.candidateCardInstanceIds,
      context.keepCount,
      observation,
      random,
    );

    return {
      type: "CONFIRM_LABORATORY_PREPARATION",
      playerId: context.playerId,
      keptCardInstanceIds,
    };
  }

  return undefined;
};
