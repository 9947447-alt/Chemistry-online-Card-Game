import type {
  CharacterDefinition,
  CharacterSkillImplementationStatus,
  CharacterSkillType,
} from "../../game/engine/types";
import type { DisplayLocale } from "../../app/locale";
import {
  getImplementationStatusDisplayName,
  getSkillAvailabilityDisplayName,
  getSkillDisplayName,
  getSkillTypeDisplayName,
} from "./presentationLocale";

export type PublicCharacterSkill = Readonly<{
  name: string;
  type: string;
  availability: string;
}>;

export function getPublicCharacterSkills(
  character: CharacterDefinition,
  locale: DisplayLocale = "zh-CN",
): readonly PublicCharacterSkill[] {
  return character.skills.map((skill) => ({
    name: getSkillDisplayName(skill.id, locale),
    type: getSkillTypeDisplayName(skill.type, locale),
    availability: getSkillAvailabilityDisplayName(skill.implementationStatus, locale),
  }));
}

export function formatSkillDebugText(skill: CharacterDefinition["skills"][number], locale: DisplayLocale): string {
  return `${skill.id} · ${getSkillTypeDisplayName(skill.type, locale)} · ${getImplementationStatusDisplayName(skill.implementationStatus, locale)} · ${skill.rulesText}${"implementationNote" in skill && skill.implementationNote ? ` · ${skill.implementationNote}` : ""}`;
}
