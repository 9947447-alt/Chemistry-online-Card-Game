import type {
  CharacterSkillImplementationStatus,
  CharacterSkillType,
} from "../../game/engine/types";

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
