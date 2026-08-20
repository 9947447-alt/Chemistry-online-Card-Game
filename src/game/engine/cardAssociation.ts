import { cardDefinitionsById } from "../data/cardDefinitions";
import type { CardDefinition, CardInstanceId, GameState, PlayerId } from "./types";

// Current MVP mapping for ion-to-ion links that are not uniquely derivable from
// card text alone. These pairs mirror the adopted DIY/response relationships.
const explicitIonAssociationPairs = [
  ["H+", "OH-"],
  ["H+", "Cl-"],
  ["H+", "SO4^2-"],
  ["H+", "CO3^2-"],
  ["Na+", "OH-"],
  ["K+", "OH-"],
  ["Ca2+", "OH-"],
  ["Na+", "CO3^2-"],
] as const;

const explicitIonAssociationKeys = new Set(
  explicitIonAssociationPairs.map(([left, right]) => makePairKey(left, right)),
);

function makePairKey(left: string, right: string): string {
  return [left, right].sort().join("::");
}

function getDefinitionForCard(
  state: GameState,
  cardInstanceId: CardInstanceId,
): CardDefinition | undefined {
  const instance = state.cardInstances[cardInstanceId];
  return instance ? cardDefinitionsById.get(instance.definitionId) : undefined;
}

function hasIntersection(left: readonly string[] | undefined, right: readonly string[] | undefined) {
  if (!left || !right) {
    return false;
  }

  const rightItems = new Set(right);
  return left.some((item) => rightItems.has(item));
}

function hasSameElementCategory(reference: CardDefinition, candidate: CardDefinition) {
  return (
    reference.type === "element" &&
    candidate.type === "element" &&
    Boolean(reference.elementCategory) &&
    reference.elementCategory === candidate.elementCategory
  );
}

function hasSharedElement(reference: CardDefinition, candidate: CardDefinition) {
  return hasIntersection(reference.elements, candidate.elements);
}

function hasSharedIon(reference: CardDefinition, candidate: CardDefinition) {
  return hasIntersection(reference.ionsProvided, candidate.ionsProvided);
}

function hasExplicitIonAssociation(reference: CardDefinition, candidate: CardDefinition) {
  const referenceIons = reference.ionsProvided ?? [];
  const candidateIons = candidate.ionsProvided ?? [];

  return referenceIons.some((referenceIon) =>
    candidateIons.some((candidateIon) =>
      explicitIonAssociationKeys.has(makePairKey(referenceIon, candidateIon)),
    ),
  );
}

function hasAcidBaseRelationship(reference: CardDefinition, candidate: CardDefinition) {
  return (
    (reference.tags.includes("acid") && candidate.tags.includes("base")) ||
    (reference.tags.includes("base") && candidate.tags.includes("acid"))
  );
}

function hasCarbonateAcidRelationship(reference: CardDefinition, candidate: CardDefinition) {
  return (
    (reference.tags.includes("carbonate") && candidate.tags.includes("acid")) ||
    (reference.tags.includes("acid") && candidate.tags.includes("carbonate"))
  );
}

function hasGasAbsorptionRelationship(reference: CardDefinition, candidate: CardDefinition) {
  return (
    (reference.tags.includes("harmful-gas") && candidate.tags.includes("alkaline-absorb")) ||
    (reference.tags.includes("alkaline-absorb") && candidate.tags.includes("harmful-gas"))
  );
}

export function areCardDefinitionsAssociated(
  reference: CardDefinition,
  candidate: CardDefinition,
): boolean {
  if (reference.id === candidate.id) {
    return true;
  }

  return (
    hasSameElementCategory(reference, candidate) ||
    hasSharedElement(reference, candidate) ||
    hasSharedIon(reference, candidate) ||
    hasExplicitIonAssociation(reference, candidate) ||
    hasAcidBaseRelationship(reference, candidate) ||
    hasCarbonateAcidRelationship(reference, candidate) ||
    hasGasAbsorptionRelationship(reference, candidate)
  );
}

export function canPlayCardAgainstTableReference(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): boolean {
  const tableReference = state.tableReference;

  if (!tableReference) {
    return true;
  }

  const player = state.players.find((candidate) => candidate.id === playerId);
  const candidateDefinition = getDefinitionForCard(state, cardInstanceId);
  const referenceDefinition = cardDefinitionsById.get(tableReference.definitionId);

  if (!player || !player.hand.includes(cardInstanceId) || !candidateDefinition || !referenceDefinition) {
    return false;
  }

  return areCardDefinitionsAssociated(referenceDefinition, candidateDefinition);
}
