import type { CharacterDefinition, CharacterId } from "../engine/types";

export const characterDefinitions = [
  {
    id: "laboratory_teacher",
    name: "实验室老师",
    maxHp: 10,
    skills: [
      {
        id: "lesson_preparation",
        name: "备课",
        type: "passive",
        rulesText: "周期开始摸 20 张，选择 10 张作为手牌，其余弃置。",
        implementationStatus: "implemented-8b-1",
      },
      {
        id: "extra_lesson",
        name: "补课",
        type: "active",
        rulesText: "每周期一次；手牌不超过 4 张时摸 4 张，并占用本行动。",
        implementationStatus: "implemented-8b-2",
      },
    ],
  },
  {
    id: "chemical_factory_ceo",
    name: "化工厂 CEO",
    maxHp: 10,
    skills: [
      {
        id: "capital_reserve",
        name: "资金储备",
        type: "passive",
        rulesText: "周期开始摸 14 张；手牌上限始终为 14。",
        implementationStatus: "implemented-8b-1",
      },
      {
        id: "emergency_supply",
        name: "紧急调货",
        type: "active",
        rulesText: "每周期一次；手牌不超过 4 张时摸 3 张，并占用本行动。",
        implementationStatus: "implemented-8b-2",
      },
    ],
  },
  {
    id: "clumsy_party_secretary",
    name: "手残党党委书记",
    maxHp: 10,
    skills: [
      {
        id: "exhaust_leak",
        name: "尾气泄漏",
        type: "active",
        rulesText: "共享每周期一次；其他存活玩家分别受到 2 点可被碱性吸收响应的 SO2 伤害。",
        implementationStatus: "implemented-8c-3",
      },
      {
        id: "lab_fire",
        name: "实验台起火",
        type: "active",
        rulesText: "共享每周期一次；以虚拟技能效果使其他存活玩家获得 FIRE。",
        implementationStatus: "implemented-8c-3",
      },
      {
        id: "exothermic_accident",
        name: "强放热事故",
        type: "active",
        rulesText: "共享每周期一次；其他存活玩家失去 1 HP，该效果不属于 DAMAGE。",
        implementationStatus: "implemented-8c-3",
      },
    ],
  },
  {
    id: "caustic_soda_captain",
    name: "烧碱大队队长",
    maxHp: 10,
    skills: [
      {
        id: "strong_alkali_protection",
        name: "强碱防护",
        type: "passive",
        rulesText: "免疫带有正式碱性伤害标签的 DAMAGE。",
        implementationStatus: "implemented-8c-2",
      },
      {
        id: "alkali_recovery",
        name: "碱液回收",
        type: "active",
        rulesText: "每周期一次；弃置实体强碱物质牌回复 2 HP，并占用本行动。",
        implementationStatus: "implemented-8c-3",
      },
      {
        id: "strong_alkali_mastery",
        name: "强碱专精",
        type: "passive",
        rulesText: "实体强碱牌造成 DAMAGE 时伤害 +1，最终仍受 3 点上限。",
        implementationStatus: "implemented-8c-2",
      },
    ],
  },
  {
    id: "acid_king",
    name: "酸王",
    maxHp: 10,
    skills: [
      {
        id: "acid_corrosion",
        name: "酸性侵蚀",
        type: "passive",
        rulesText: "实体强酸物质牌造成 DAMAGE 时，攻击方伤害设定值为 3。",
        implementationStatus: "implemented-8c-2",
      },
      {
        id: "acid_resistant_layer",
        name: "耐酸层",
        type: "passive",
        rulesText: "受到正式酸性伤害时伤害 -1，最低为 1；免疫仍优先。",
        implementationStatus: "implemented-8c-2",
      },
    ],
  },
  {
    id: "chemistry_enthusiast",
    name: "化学爱好者",
    maxHp: 8,
    skills: [
      {
        id: "diy_experiment",
        name: "DIY 实验",
        type: "passive",
        rulesText: "每周期首次成功主动 DIY 若造成 DAMAGE，该次伤害 +1。",
        implementationStatus: "implemented-8c-2",
      },
      {
        id: "experiment_counterattack",
        name: "实验反击",
        type: "response",
        rulesText: "每周期一次；完全抵消攻击后，从合法的回复或实体酸碱追击中选择。",
        implementationStatus: "implemented-8c-4-partial",
        implementationNote: "8C-4 部分实现：回复与实体酸碱追击可用；金属选项等待真实金属卡池。",
      },
    ],
  },
  {
    id: "sulfuric_acid_factory_director",
    name: "硫酸厂厂长",
    maxHp: 10,
    skills: [
      {
        id: "exhaust_discharge",
        name: "排放尾气",
        type: "active",
        rulesText: "每周期一次；使一名其他存活玩家获得 SO2_LEAK，并占用本行动。",
        implementationStatus: "implemented-8c-3",
      },
      {
        id: "sulfuric_acid_process",
        name: "硫酸工艺",
        type: "passive",
        rulesText: "实体 H2SO4 牌造成 DAMAGE 时伤害 +1，最终仍受 3 点上限。",
        implementationStatus: "implemented-8c-2",
      },
      {
        id: "sulfate_byproduct",
        name: "硫酸盐副产",
        type: "passive",
        rulesText: "自己的实体物质牌以正式 ionsProvided 提供 SO4^2- 并成功参与 Phase 10 反应时摸 1，每实验轮次一次。",
        implementationStatus: "implemented-phase10",
        implementationNote: "Phase 10 已实现；虚拟 DIY、仅作为 DIY 组件的 SO4^2- 与空牌堆失败均不消耗次数。",
      },
    ],
  },
] satisfies readonly CharacterDefinition[];

const characterDefinitionById = new Map<CharacterId, CharacterDefinition>(
  characterDefinitions.map((definition) => [definition.id, definition]),
);

export function getCharacterDefinition(characterId: CharacterId): CharacterDefinition {
  const definition = characterDefinitionById.get(characterId);

  if (!definition) {
    throw new Error(`Unknown character definition: ${characterId}`);
  }

  return definition;
}
