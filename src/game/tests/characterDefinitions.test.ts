import { describe, expect, it } from "vitest";
import { cardDefinitions } from "../data/cardDefinitions";
import {
  characterDefinitions,
  getCharacterDefinition,
} from "../data/characterDefinitions";
import { starterDeck, starterDeckSize } from "../data/starterDeck";
import { createInitialGame } from "../engine/createInitialGame";
import type { CharacterId } from "../engine/types";
import { identityShuffle } from "../../shared/random";
import { expectCardZonesToBeConsistent } from "./assertCardZones";

const expectedCharacterIds: CharacterId[] = [
  "laboratory_teacher",
  "chemical_factory_ceo",
  "clumsy_party_secretary",
  "caustic_soda_captain",
  "acid_king",
  "chemistry_enthusiast",
  "sulfuric_acid_factory_director",
];

function asRuntimeCharacterIds(values: readonly unknown[]): [CharacterId, CharacterId] {
  return values as unknown as [CharacterId, CharacterId];
}

describe("Phase 8A character definitions", () => {
  it("defines all seven characters exactly once", () => {
    const ids = characterDefinitions.map((definition) => definition.id);

    expect(ids).toEqual(expectedCharacterIds);
    expect(new Set(ids).size).toBe(expectedCharacterIds.length);
    expect(characterDefinitions.every((definition) => definition.skills.length > 0)).toBe(true);
  });

  it("sets chemistry enthusiast maxHp to 8 and every other character to 10", () => {
    for (const definition of characterDefinitions) {
      expect(definition.maxHp, definition.id).toBe(
        definition.id === "chemistry_enthusiast" ? 8 : 10,
      );
    }
  });

  it("marks only the implemented 8B-1 passives as complete", () => {
    const teacherSkills = getCharacterDefinition("laboratory_teacher").skills;
    const ceoSkills = getCharacterDefinition("chemical_factory_ceo").skills;

    expect(teacherSkills.find((skill) => skill.id === "lesson_preparation")?.implementationStatus).toBe(
      "implemented-8b-1",
    );
    expect(ceoSkills.find((skill) => skill.id === "capital_reserve")?.implementationStatus).toBe(
      "implemented-8b-1",
    );
    expect(teacherSkills.find((skill) => skill.id === "extra_lesson")?.implementationStatus).toBe(
      "planned-8b",
    );
    expect(ceoSkills.find((skill) => skill.id === "emergency_supply")?.implementationStatus).toBe(
      "planned-8b",
    );
  });

  it("mounts the default debug characters with empty usage state", () => {
    const state = createInitialGame({ shuffle: identityShuffle });

    expect(state.players.map((player) => player.characterId)).toEqual([
      "laboratory_teacher",
      "chemical_factory_ceo",
    ]);
    expect(state.players.map((player) => [player.hp, player.maxHp])).toEqual([
      [10, 10],
      [10, 10],
    ]);
    expect(state.players.every((player) => Object.keys(player.characterUsage.perCycle).length === 0)).toBe(true);
    expect(state.players.every((player) => Object.keys(player.characterUsage.perRound).length === 0)).toBe(true);
  });

  it("allows explicit character mounting and derives initial HP from the definition", () => {
    const state = createInitialGame({
      characterIds: ["chemistry_enthusiast", "chemistry_enthusiast"],
      shuffle: identityShuffle,
    });

    expect(state.players.map((player) => player.characterId)).toEqual([
      "chemistry_enthusiast",
      "chemistry_enthusiast",
    ]);
    expect(state.players.map((player) => [player.hp, player.maxHp])).toEqual([
      [8, 8],
      [8, 8],
    ]);
  });

  it("creates independent character usage records for both players", () => {
    const state = createInitialGame({
      characterIds: ["chemistry_enthusiast", "chemistry_enthusiast"],
      shuffle: identityShuffle,
    });
    const [playerOne, playerTwo] = state.players;

    expect(playerOne.characterUsage).not.toBe(playerTwo.characterUsage);
    expect(playerOne.characterUsage.perCycle).not.toBe(playerTwo.characterUsage.perCycle);
    expect(playerOne.characterUsage.perRound).not.toBe(playerTwo.characterUsage.perRound);

    playerOne.characterUsage.perCycle.chemistry_enthusiast_counterattack = 1;
    playerOne.characterUsage.perRound.sulfuric_acid_factory_director_sulfate_byproduct = 1;

    expect(playerTwo.characterUsage.perCycle).toEqual({});
    expect(playerTwo.characterUsage.perRound).toEqual({});
  });

  it.each([
    ["one", ["laboratory_teacher"]],
    [
      "three",
      ["laboratory_teacher", "chemical_factory_ceo", "chemistry_enthusiast"],
    ],
  ] satisfies [string, readonly CharacterId[]][])(
    "rejects a runtime character configuration containing %s role entries",
    (_label, runtimeCharacterIds) => {
      expect(() =>
        createInitialGame({
          characterIds: asRuntimeCharacterIds(runtimeCharacterIds),
          shuffle: identityShuffle,
        }),
      ).toThrow("Character configuration must contain exactly 2 characterIds.");
    },
  );

  it("rejects an unknown character definition at initialization", () => {
    expect(() =>
      createInitialGame({
        characterIds: ["missing_character" as CharacterId, "chemical_factory_ceo"],
        shuffle: identityShuffle,
      }),
    ).toThrow("Unknown character definition");
  });

  it("keeps characters and lab fire outside the 68-card ordinary pool", () => {
    const state = createInitialGame({ shuffle: identityShuffle });
    const labFireDefinition = cardDefinitions.find(
      (definition) => definition.id === "event_lab_fire",
    );

    expect(starterDeckSize).toBe(68);
    expect(
      starterDeck.some((entry) =>
        characterDefinitions.some((character) => character.id === entry.definitionId),
      ),
    ).toBe(false);
    expect(Object.keys(state.cardInstances)).toHaveLength(68);
    expect(
      Object.values(state.cardInstances).some(
        (instance) => instance.definitionId === "event_lab_fire",
      ),
    ).toBe(false);
    expect(labFireDefinition?.allowedTimings).toEqual([]);
    expect(getCharacterDefinition("clumsy_party_secretary").skills.some((skill) => skill.id === "lab_fire")).toBe(true);
    expectCardZonesToBeConsistent(state);
  });
});
