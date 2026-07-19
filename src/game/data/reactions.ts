type ReactionDefinitionShape = Readonly<{
  id: string;
  name: string;
  rulesText: string;
}>;

export const reactionDefinitions = [
  {
    id: "acid_base_neutralization",
    name: "酸碱中和",
    rulesText: "合法酸碱 DAMAGE 被相反酸碱实体牌响应后完全取消，并记录虚拟 H2O 结果。",
  },
  {
    id: "acid_carbonate_co2",
    name: "酸与碳酸盐",
    rulesText: "合法酸性 DAMAGE 被 CO3^2- 或实体 Na2CO3 响应后完全取消，并记录虚拟 CO2 结果。",
  },
  {
    id: "so2_alkaline_absorption",
    name: "SO2 碱性吸收",
    rulesText: "书记即时 SO2 DAMAGE 的合法碱性吸收与 SO2_LEAK 状态处理共享同一反应定义。",
  },
] as const satisfies readonly ReactionDefinitionShape[];

export type ReactionDefinition = (typeof reactionDefinitions)[number];
export type ReactionDefinitionId = ReactionDefinition["id"];

export const reactionDefinitionIds: readonly ReactionDefinitionId[] =
  reactionDefinitions.map((definition) => definition.id);

export function getReactionDefinition(
  definitionId: ReactionDefinitionId,
): ReactionDefinition {
  const definition = reactionDefinitions.find(
    (candidate) => candidate.id === definitionId,
  );

  if (!definition) {
    throw new Error(`Unknown reaction definition: ${definitionId}`);
  }

  return definition;
}
