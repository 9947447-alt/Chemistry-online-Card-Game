import type { GameAction } from "../../../game/engine/actions";
import { useLocale } from "../../../app/locale";
import type { GameState } from "../../../game/engine/types";
import {
  describePendingExperimentCounterattack,
  getCardDefinition,
  getExperimentCounterattackMetalCards,
  getExperimentCounterattackPursuitCards,
  getPlayer,
  getPlayerName,
} from "../localGameView";
import { getCardDisplayName, getPlayerDisplayName } from "../presentationLocale";

type ExperimentCounterattackPanelProps = {
  game: GameState;
  dispatchGameAction: (action: GameAction) => void;
};

export function ExperimentCounterattackPanel({
  game,
  dispatchGameAction,
}: ExperimentCounterattackPanelProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const pending = game.pendingExperimentCounterattack;
  const responder = pending ? getPlayer(game, pending.responderPlayerId) : undefined;

  if (
    game.phase !== "experimentCounterattackWindow" ||
    !pending ||
    !responder
  ) {
    return null;
  }

  const pursuitCards = getExperimentCounterattackPursuitCards(game, responder);
  const metalCards = getExperimentCounterattackMetalCards(game, responder);
  const canRecover = pending.legalOptions.includes("recover");
  const used = Boolean(
    responder.characterUsage.perCycle.chemistry_enthusiast_counterattack,
  );

  return (
    <section
      className="debug-section response-panel"
      aria-labelledby="experiment-counterattack-title"
    >
      <div className="panel-heading">
        <div>
          <p className="debug-kicker">{isEnglish ? "Choose a currently legal counterattack option" : "请选择一个当前合法的反击选项"}</p>
          <h2 id="experiment-counterattack-title">{isEnglish ? "Experiment Counterattack selection" : "实验反击选择"}</h2>
        </div>
        <span className={used ? "warn-pill" : "ok-pill"}>
          {used ? (isEnglish ? "Used this cycle" : "本周期已用") : (isEnglish ? "Available this cycle" : "本周期可用")}
        </span>
      </div>
      <p className="panel-note">
        {isEnglish
          ? `${getPlayerDisplayName(responder, locale)} successfully responded to ${getPlayerDisplayName(getPlayer(game, pending.attackerPlayerId), locale)}'s attack. Choose one legal counterattack option.`
          : `${responder.name} 已成功响应 ${getPlayerName(game, pending.attackerPlayerId)} 的攻击，请选择一个合法反击选项。`}
      </p>
      <details className="debug-details">
        <summary>{isEnglish ? "Debug details" : "调试详情"}</summary>
        <p>{describePendingExperimentCounterattack(game)}</p>
        <p>RESOLVE_EXPERIMENT_COUNTERATTACK</p>
      </details>

      <div className="character-active-skill">
        <div>
          <strong>{isEnglish ? "Recover 1 HP" : "回复 1 HP"}</strong>
          <span>{isEnglish ? "Unavailable at full HP or with Fire or SO2 leak" : "满 HP、火情或尾气泄漏时不可选"}</span>
        </div>
        <button
          className="primary-button"
          disabled={!canRecover}
          onClick={() =>
            dispatchGameAction({
              type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
              playerId: responder.id,
              option: "recover",
            })
          }
          type="button"
        >
          {canRecover ? (isEnglish ? "Choose recovery" : "选择回复") : (isEnglish ? "Recovery unavailable" : "当前不可回复")}
        </button>
      </div>

      <div className="character-active-skill">
        <div>
          <strong>{isEnglish ? "Metal element counterattack" : "金属元素反击"}</strong>
          <span>{isEnglish ? "Discard a metal element card to deal 1 damage to the original attacker" : "弃置金属元素牌，对原攻击者造成 1 点伤害"}</span>
        </div>
        {metalCards.length === 0 ? (
          <p className="empty-note">{isEnglish ? "The current 68-card pool has no legal metal element card. This awaits a future real-metal card-pool phase." : "当前 68 张卡池暂无合法金属元素牌，等待后续真实金属卡池阶段启用。"}</p>
        ) : null}
      </div>

      <div className="character-active-skill">
        <div>
          <strong>{isEnglish ? "Physical acid-base pursuit" : "实体酸碱追击"}</strong>
          <span>{isEnglish ? "Base damage follows the physical definition, receives +1 at increase, and does not open another response" : "基础伤害按实体定义，increase 阶段 +1，且不再打开响应"}</span>
        </div>
        <div className="candidate-grid">
          {pursuitCards.map((cardInstanceId) => (
            <button
              className="primary-button"
              key={cardInstanceId}
              onClick={() =>
                dispatchGameAction({
                  type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
                  playerId: responder.id,
                  option: "acid-base-pursuit",
                  cardInstanceId,
                })
              }
              type="button"
            >
              {isEnglish ? "Use" : "使用"} {(() => {
                const definition = getCardDefinition(game, cardInstanceId);
                return definition
                  ? getCardDisplayName(definition.id, definition.name, locale)
                  : (isEnglish ? "Unknown card" : "未知卡牌");
              })()}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
