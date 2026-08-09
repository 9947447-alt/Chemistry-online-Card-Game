import type { GamePhase, GameState, PlayerId } from "../../game/engine/types";

export type NewPlayerGuidancePhase =
  | "configuring"
  | "preparationSelection"
  | "mainAction"
  | "responseWindow"
  | "statusWindow"
  | "experimentCounterattackWindow"
  | "gameOver";

export type NewPlayerGuidanceView = Readonly<{
  phase: NewPlayerGuidancePhase;
  title: string;
  actor: string;
  goal: string;
  entry: string;
  concept: string;
}>;

function getPlayerName(game: GameState, playerId: PlayerId | undefined): string {
  return game.players.find((player) => player.id === playerId)?.name ?? "当前玩家";
}

const phaseCopy: Readonly<Record<Exclude<NewPlayerGuidancePhase, "configuring">, Omit<
  NewPlayerGuidanceView,
  "actor" | "phase"
>>> = {
  preparationSelection: {
    title: "备课",
    goal: "按现有备课面板选择并确认本次保留的手牌。",
    entry: "使用下方“实验室老师 · 备课”面板中的卡牌与“确认备课选择”。",
    concept: "备课选择的数量和可选范围由现有面板显示；引导不重复判定。",
  },
  mainAction: {
    title: "主行动",
    goal: "由当前行动玩家完成一次主行动，或结束本次行动。",
    entry: "使用下方“主行动”“主动 DIY”与角色技能入口，或“结束本次行动”。",
    concept: "场面基准只说明当前场面的参考；是否可关联以现有操作面板的提示为准。",
  },
  responseWindow: {
    title: "响应",
    goal: "由当前响应者决定使用现有响应入口，或放弃响应。",
    entry: "使用下方“响应窗口”内显示的选项，或“放弃响应”。",
    concept: "响应 DIY 在 MVP0-P10 中关闭；引导不判断任何具体卡牌是否合法。",
  },
  statusWindow: {
    title: "状态处理",
    goal: "由当前处理者处理正在等待的状态，或接受现有继续入口。",
    entry: "使用下方“状态处理窗口”内显示的选项，或“放弃处理”。",
    concept: "可用处理牌由现有状态面板决定；引导不创建或判断处理选项。",
  },
  experimentCounterattackWindow: {
    title: "实验反击",
    goal: "由当前反击者在已实现的选项中完成本次实验反击。",
    entry: "使用下方“实验反击选择”面板中当前显示的选项。",
    concept: "真实金属选项仍延期；此处不会补充不存在的卡牌或选项。",
  },
  gameOver: {
    title: "对局结束",
    goal: "查看公开日志与结果，再决定是否开始下一局。",
    entry: "查看公开日志，并使用页面顶部“按当前阵容重开”或“返回角色选择”。",
    concept: "结果已由既有对局结算确定；引导不改变胜负或重开行为。",
  },
};

export function getConfiguringGuidance(): NewPlayerGuidanceView {
  return {
    phase: "configuring",
    title: "配置",
    actor: "双方玩家",
    goal: "确认本地同屏双人阵容后，再开始本局公开对局。",
    entry: "使用下方“玩家 A”“玩家 B”角色选择与“开始游戏”。",
    concept: "双方手牌公开；刷新页面会回到默认角色预选，不保存当前对局。",
  };
}

export function getPlayingGuidance(game: GameState): NewPlayerGuidanceView | undefined {
  const phase: GamePhase = game.phase;

  switch (phase) {
    case "preparationSelection":
      return {
        ...phaseCopy.preparationSelection,
        phase,
        actor: `当前选择者：${getPlayerName(game, game.pendingLaboratoryPreparation?.playerId)}`,
      };
    case "mainAction":
      return {
        ...phaseCopy.mainAction,
        phase,
        actor: `当前行动者：${getPlayerName(game, game.activePlayerId)}`,
      };
    case "responseWindow":
      return {
        ...phaseCopy.responseWindow,
        phase,
        actor: `当前响应者：${getPlayerName(game, game.pendingResponse?.responderId)}`,
      };
    case "statusWindow":
      return {
        ...phaseCopy.statusWindow,
        phase,
        actor: `当前处理者：${getPlayerName(game, game.pendingStatusHandling?.playerId)}`,
      };
    case "experimentCounterattackWindow":
      return {
        ...phaseCopy.experimentCounterattackWindow,
        phase,
        actor: `当前反击者：${getPlayerName(
          game,
          game.pendingExperimentCounterattack?.responderPlayerId,
        )}`,
      };
    case "gameOver":
      return {
        ...phaseCopy.gameOver,
        phase,
        actor: game.isDraw
          ? "本局结果：平局"
          : `本局结果：${getPlayerName(game, game.winnerPlayerId)} 获胜`,
      };
    case "setup":
    case "cycleStart":
    case "actionStart":
    case "cleanup":
      return undefined;
    default: {
      const exhaustivePhase: never = phase;
      return exhaustivePhase;
    }
  }
}
