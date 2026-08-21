import type { GameAction } from "../../../game/engine/actions";
import { useLocale } from "../../../app/locale";
import type { GameState } from "../../../game/engine/types";
import type { PlayerControllerSelection } from "../localGameSession";
import {
  describePendingExperimentCounterattack,
  getCardDefinition,
  getExperimentCounterattackMetalCards,
  getExperimentCounterattackPursuitCards,
  getPlayer,
  getPlayerName,
} from "../localGameView";
import { getAiAutoActionNote, getOptionalCardDisplayName, getPlayerDisplayName } from "../presentationLocale";

type ExperimentCounterattackPanelProps = {
  game: GameState;
  playerControllers?: PlayerControllerSelection;
  dispatchGameAction: (action: GameAction) => void;
};

export function ExperimentCounterattackPanel({
  game,
  playerControllers,
  dispatchGameAction,
}: ExperimentCounterattackPanelProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const pending = game.pendingExperimentCounterattack;
  const responder = pending ? getPlayer(game, pending.responderPlayerId) : undefined;
  const isAi = Boolean(
    responder &&
      playerControllers &&
      playerControllers[responder.id === "player_1" ? 0 : 1] === "ai",
  );

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
          <p className="debug-kicker">{isEnglish ? "Choose a legal option" : "请选择一个当前合法的反击选项"}</p>
          <h2 id="experiment-counterattack-title">{isEnglish ? "Experiment Counterattack selection" : "实验反击选择"}</h2>
        </div>
        <span className={used ? "warn-pill" : "ok-pill"}>
          {used ? (isEnglish ? "Used this cycle" : "本周期已用") : (isEnglish ? "Available this cycle" : "本周期可用")}
        </span>
      </div>
      <p className="panel-note">
        {isEnglish
          ? `${getPlayerDisplayName(responder, locale)} cancelled ${getPlayerDisplayName(getPlayer(game, pending.attackerPlayerId), locale)}'s attack. Choose one option.`
          : `${responder.name} 已成功响应 ${getPlayerName(game, pending.attackerPlayerId)} 的攻击，请选择一个合法反击选项。`}
        {isAi ? ` · ${getAiAutoActionNote(locale)}` : ""}
      </p>
      <details className="debug-details">
        <summary>{isEnglish ? "Debug details" : "调试详情"}</summary>
        <p>{describePendingExperimentCounterattack(game)}</p>
        <p>RESOLVE_EXPERIMENT_COUNTERATTACK</p>
      </details>

      <div className="character-active-skill">
        <div>
          <strong>{isEnglish ? "Recover 1 HP" : "回复 1 HP"}</strong>
          <span>{isEnglish ? "Blocked at full HP, Fire, or SO2 leak" : "满 HP、火情或尾气泄漏时不可选"}</span>
        </div>
        <button
          className="primary-button"
          disabled={isAi || !canRecover}
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
          <span>{isEnglish ? "Deferred: no real metal cards" : "真实金属卡牌延期实现"}</span>
        </div>
        <div className="candidate-grid">
          {metalCards.length > 0 ? (
            metalCards.map((cardInstanceId) => (
              <button className="primary-button" disabled key={cardInstanceId} type="button">
                {getOptionalCardDisplayName(getCardDefinition(game, cardInstanceId), locale)}
              </button>
            ))
          ) : (
            <button className="primary-button" disabled type="button">
              {isEnglish ? "Deferred" : "延期实现"}
            </button>
          )}
        </div>
      </div>

      <div className="character-active-skill">
        <div>
          <strong>{isEnglish ? "Acid-base pursuit counterattack" : "酸碱追击反击"}</strong>
          <span>{isEnglish ? "Pursue with opposite dilute acid/base" : "使用与原攻击相反的稀酸/稀碱追击"}</span>
        </div>
        <div className="candidate-grid">
          {pursuitCards.length > 0 ? (
            pursuitCards.map((cardInstanceId) => (
              <button
                className="primary-button"
                disabled={isAi}
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
                {getOptionalCardDisplayName(getCardDefinition(game, cardInstanceId), locale)}
              </button>
            ))
          ) : (
            <button className="primary-button" disabled type="button">
              {isEnglish ? "No pursuit cards" : "无可用追击牌"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
