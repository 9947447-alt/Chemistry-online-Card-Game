import type { GamePhase, GameState, PlayerId } from "../../game/engine/types";
import type { DisplayLocale } from "../../app/locale";
import { getPlayerDisplayName } from "./presentationLocale";

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

function getPlayerName(
  game: GameState,
  playerId: PlayerId | undefined,
  locale: DisplayLocale,
): string {
  return getPlayerDisplayName(game.players.find((player) => player.id === playerId), locale);
}

type PhaseContent = readonly [title: string, goal: string, entry: string, concept: string];

const phaseData: Readonly<
  Record<Exclude<NewPlayerGuidancePhase, "configuring">, readonly [PhaseContent, PhaseContent]>
> = {
  preparationSelection: [
    [
      "备课",
      "按现有备课面板选择并确认本次保留的手牌。",
      "使用下方“实验室老师 · 备课”面板中的卡牌与“确认备课选择”。",
      "备课选择的数量和可选范围由现有面板显示；引导不重复判定。",
    ],
    [
      "Preparation",
      "Use the existing preparation panel to choose and confirm this hand's kept cards.",
      "Use the cards and Confirm preparation selection in the Laboratory Teacher · Preparation panel below.",
      "The existing panel determines the keep count and eligible cards; guidance does not make a second decision.",
    ],
  ],
  mainAction: [
    [
      "主行动",
      "由当前行动玩家完成一次主行动，或结束本次行动。",
      "使用下方“主行动”“主动 DIY”与角色技能入口，或“结束本次行动”。",
      "场面基准只说明当前场面的参考；是否可关联以现有操作面板的提示为准。",
    ],
    [
      "Main action",
      "The active player completes one main action or ends this action.",
      "Use Main action, Active DIY, character-skill entries, or End this action below.",
      "The table reference only describes the current reference; use the existing action-panel notice to determine association.",
    ],
  ],
  responseWindow: [
    [
      "响应",
      "由当前响应者决定使用现有响应入口，或放弃响应。",
      "使用下方“响应窗口”内显示的选项，或“放弃响应”。",
      "响应 DIY 在 MVP0-P10 中关闭；引导不判断任何具体卡牌是否合法。",
    ],
    [
      "Response",
      "The current responder uses an existing response entry or passes.",
      "Use the options in Response window below, or Pass response.",
      "Response DIY is disabled in MVP0-P10; guidance does not judge whether any card is legal.",
    ],
  ],
  statusWindow: [
    [
      "状态处理",
      "由当前处理者处理正在等待的状态，或接受现有继续入口。",
      "使用下方“状态处理窗口”内显示的选项，或“放弃处理”。",
      "可用处理牌由现有状态面板决定；引导不创建或判断处理选项。",
    ],
    [
      "Status handling",
      "The current handler handles the pending status or uses the existing continue entry.",
      "Use the options in Status handling window below, or Pass handling.",
      "The existing status panel determines usable cards; guidance does not create or judge handling options.",
    ],
  ],
  experimentCounterattackWindow: [
    [
      "实验反击",
      "由当前反击者在已实现的选项中完成本次实验反击。",
      "使用下方“实验反击选择”面板中当前显示的选项。",
      "真实金属选项仍延期；此处不会补充不存在的卡牌或选项。",
    ],
    [
      "Experiment Counterattack",
      "The current counterattacker completes this Experiment Counterattack with an implemented option.",
      "Use the currently displayed options in Experiment Counterattack selection below.",
      "The real metal option remains deferred; no missing card or option is added here.",
    ],
  ],
  gameOver: [
    [
      "对局结束",
      "查看公开日志与结果，再决定是否开始下一局。",
      "查看公开日志，并使用页面顶部“按当前阵容重开”或“返回角色选择”。",
      "结果已由既有对局结算确定；引导不改变胜负或重开行为。",
    ],
    [
      "Game over",
      "Review the public log and result, then decide whether to start the next game.",
      "Review the public log and use Restart with current lineup or Return to character selection in the header.",
      "Existing resolution determined the outcome; guidance does not change the outcome or restart behavior.",
    ],
  ],
};

function getPhaseFields(
  phase: Exclude<NewPlayerGuidancePhase, "configuring">,
  locale: DisplayLocale,
) {
  const [title, goal, entry, concept] = phaseData[phase][locale === "en" ? 1 : 0];
  return { title, goal, entry, concept };
}

const configuringData: readonly [PhaseContent, PhaseContent] = [
  [
    "配置",
    "确认本地同屏双人阵容后，再开始本局公开对局。",
    "使用下方“玩家 A”“玩家 B”角色选择与“开始游戏”。",
    "双方手牌公开；刷新页面会回到默认角色预选，不保存当前对局。",
  ],
  [
    "Setup",
    "Confirm the local shared-screen two-player lineup before starting this public game.",
    "Use Player A and Player B character selection and Start game below.",
    "Both hands are public; refreshing returns to the default character selections and does not save this game.",
  ],
];

export function getConfiguringGuidance(locale: DisplayLocale = "zh-CN"): NewPlayerGuidanceView {
  const [title, goal, entry, concept] = configuringData[locale === "en" ? 1 : 0];
  return {
    phase: "configuring",
    title,
    actor: locale === "en" ? "Both players" : "双方玩家",
    goal,
    entry,
    concept,
  };
}

export function getPlayingGuidance(
  game: GameState,
  locale: DisplayLocale = "zh-CN",
): NewPlayerGuidanceView | undefined {
  const phase: GamePhase = game.phase;
  const isEn = locale === "en";

  let actor = "";
  switch (phase) {
    case "preparationSelection": {
      const p = getPlayerName(game, game.pendingLaboratoryPreparation?.playerId, locale);
      actor = isEn ? `Current selector: ${p}` : `当前选择者：${p}`;
      break;
    }
    case "mainAction": {
      const p = getPlayerName(game, game.activePlayerId, locale);
      actor = isEn ? `Active player: ${p}` : `当前行动者：${p}`;
      break;
    }
    case "responseWindow": {
      const p = getPlayerName(game, game.pendingResponse?.responderId, locale);
      actor = isEn ? `Current responder: ${p}` : `当前响应者：${p}`;
      break;
    }
    case "statusWindow": {
      const p = getPlayerName(game, game.pendingStatusHandling?.playerId, locale);
      actor = isEn ? `Current handler: ${p}` : `当前处理者：${p}`;
      break;
    }
    case "experimentCounterattackWindow": {
      const p = getPlayerName(
        game,
        game.pendingExperimentCounterattack?.responderPlayerId,
        locale,
      );
      actor = isEn ? `Current counterattacker: ${p}` : `当前反击者：${p}`;
      break;
    }
    case "gameOver": {
      actor = game.isDraw
        ? isEn
          ? "Game result: Draw"
          : "本局结果：平局"
        : isEn
          ? `Game result: ${getPlayerName(game, game.winnerPlayerId, locale)} wins`
          : `本局结果：${getPlayerName(game, game.winnerPlayerId, locale)} 获胜`;
      break;
    }
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

  return {
    ...getPhaseFields(phase, locale),
    phase,
    actor,
  };
}
