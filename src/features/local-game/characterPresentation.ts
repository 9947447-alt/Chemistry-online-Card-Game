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

export const skillTypeLabels: Record<CharacterSkillType, string> = {
  active: "主动",
  passive: "被动",
  response: "响应",
};

export const implementationStatusLabels: Record<
  CharacterSkillImplementationStatus,
  string
> = {
  "display-only-8a": "8A 仅展示",
  "implemented-8b-1": "8B-1 已实现",
  "implemented-8b-2": "8B-2 已实现",
  "implemented-8c-2": "8C-2 已实现",
  "implemented-8c-3": "8C-3 已实现",
  "implemented-8c-4-partial": "8C-4 部分实现",
  "implemented-phase10": "Phase 10 已实现",
  "planned-8b": "8B 计划实现",
  "planned-8c": "8C 计划实现",
  deferred: "延期",
};

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
