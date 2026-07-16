import type { GameAction } from "../../../game/engine/actions";
import type { GameState } from "../../../game/engine/types";
import {
  describePendingExperimentCounterattack,
  getCardDefinition,
  getExperimentCounterattackMetalCards,
  getExperimentCounterattackPursuitCards,
  getPlayer,
  getPlayerName,
} from "../localGameView";

type ExperimentCounterattackPanelProps = {
  game: GameState;
  dispatchGameAction: (action: GameAction) => void;
};

export function ExperimentCounterattackPanel({
  game,
  dispatchGameAction,
}: ExperimentCounterattackPanelProps) {
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
          <p className="debug-kicker">RESOLVE_EXPERIMENT_COUNTERATTACK</p>
          <h2 id="experiment-counterattack-title">实验反击选择</h2>
        </div>
        <span className={used ? "warn-pill" : "ok-pill"}>
          {used ? "本周期已用" : "本周期可用"}
        </span>
      </div>
      <p className="panel-note">{describePendingExperimentCounterattack(game)}</p>
      <p className="panel-note">
        原攻击者：{getPlayerName(game, pending.attackerPlayerId)}。窗口建立后必须选择一个合法选项。
      </p>

      <div className="character-active-skill">
        <div>
          <strong>回复 1 HP</strong>
          <span>满 HP、FIRE 或 SO2_LEAK 时不可选</span>
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
          {canRecover ? "选择回复" : "当前不可回复"}
        </button>
      </div>

      <div className="character-active-skill">
        <div>
          <strong>金属元素反击</strong>
          <span>弃置金属元素牌，对原攻击者造成 1 点伤害</span>
        </div>
        {metalCards.length === 0 ? (
          <p className="empty-note">当前 68 张卡池暂无合法金属元素牌，等待后续真实金属卡池阶段启用。</p>
        ) : null}
      </div>

      <div className="character-active-skill">
        <div>
          <strong>实体酸碱追击</strong>
          <span>基础伤害按实体定义，increase 阶段 +1，且不再打开响应</span>
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
              使用 {getCardDefinition(game, cardInstanceId)?.name ?? cardInstanceId}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
