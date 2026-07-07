import { useMemo, useState } from "react";
import type { GameAction } from "../../../game/engine/actions";
import type { CardInstanceId, GameState, PlayerId } from "../../../game/engine/types";
import {
  canPlayAgainstCurrentTableReference,
  canExecuteMainActionEffect,
  describeTableReferenceAssociation,
  formatList,
  getActivePlayer,
  getCardDefinition,
  getOpponentTargets,
  getPlayerName,
} from "../localGameView";

type ActionPanelProps = {
  game: GameState;
  selectedCardId?: CardInstanceId;
  onSelectCard: (cardInstanceId: CardInstanceId | undefined) => void;
  dispatchGameAction: (action: GameAction) => void;
};

export function ActionPanel({
  game,
  selectedCardId,
  onSelectCard,
  dispatchGameAction,
}: ActionPanelProps) {
  const activePlayer = getActivePlayer(game);
  const targets = activePlayer ? getOpponentTargets(game, activePlayer.id) : [];
  const [targetByCardId, setTargetByCardId] = useState<Record<CardInstanceId, PlayerId>>({});
  const executableCardIds = useMemo(() => {
    if (!activePlayer) {
      return new Set<CardInstanceId>();
    }

    return new Set(
      activePlayer.hand.filter((cardInstanceId) =>
        canExecuteMainActionEffect(game, activePlayer, cardInstanceId),
      ),
    );
  }, [activePlayer, game]);

  if (game.phase !== "mainAction" || !activePlayer) {
    return null;
  }

  return (
    <section className="debug-section action-panel" aria-labelledby="main-action-title">
      <div className="panel-heading">
        <div>
          <p className="debug-kicker">PLAY_CARD / PLAY_REFERENCE_CARD / PASS_ACTION</p>
          <h2 id="main-action-title">主行动</h2>
        </div>
        <button
          className="secondary-button"
          onClick={() => dispatchGameAction({ type: "PASS_ACTION", playerId: activePlayer.id })}
          type="button"
        >
          PASS_ACTION
        </button>
      </div>
      <p className="panel-note">当前行动玩家：{activePlayer.name}</p>
      <p className="empty-note">普通出牌不需要目标，不触发原有效果，只更新场面基准并推进一次行动。</p>
      <div className="action-card-list">
        {activePlayer.hand.map((cardInstanceId) => {
          const definition = getCardDefinition(game, cardInstanceId);
          const canAssociate = canPlayAgainstCurrentTableReference(
            game,
            activePlayer,
            cardInstanceId,
          );
          const associationLabel = describeTableReferenceAssociation(
            game,
            activePlayer,
            cardInstanceId,
          );
          const canExecute = executableCardIds.has(cardInstanceId);
          const isOxygen = definition?.id === "substance_o2";
          const targetPlayerId = isOxygen
            ? activePlayer.id
            : targetByCardId[cardInstanceId] ?? targets[0]?.id;

          return (
            <article
              className={`action-card${selectedCardId === cardInstanceId ? " is-selected" : ""}`}
              key={cardInstanceId}
              onClick={() => onSelectCard(cardInstanceId)}
            >
              <div>
                <strong>{definition?.name ?? "未知卡牌"}</strong>
                <span>
                  {definition?.type ?? "unknown"} · {cardInstanceId}
                </span>
                <span>标签：{formatList(definition?.tags ?? [])}</span>
                <span>时机：{formatList(definition?.allowedTimings ?? [])}</span>
                <span className={`association-line${canAssociate ? " is-allowed" : " is-blocked"}`}>
                  {associationLabel}
                </span>
              </div>
              {canExecute && !isOxygen ? (
                <label className="field-row compact-field">
                  <span>执行效果目标</span>
                  <select
                    onChange={(event) =>
                      setTargetByCardId((current) => ({
                        ...current,
                        [cardInstanceId]: event.target.value,
                      }))
                    }
                    onClick={(event) => event.stopPropagation()}
                    value={targetPlayerId ?? ""}
                  >
                    {targets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {getPlayerName(game, target.id)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="action-card__actions">
                {canExecute ? (
                  <button
                    className="primary-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      dispatchGameAction({
                        type: "PLAY_CARD",
                        playerId: activePlayer.id,
                        cardInstanceId,
                        targetPlayerId,
                      });
                    }}
                    type="button"
                  >
                    执行效果
                  </button>
                ) : null}
                {canAssociate ? (
                  <button
                    className="secondary-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      dispatchGameAction({
                        type: "PLAY_REFERENCE_CARD",
                        playerId: activePlayer.id,
                        cardInstanceId,
                      });
                    }}
                    type="button"
                  >
                    普通出牌
                  </button>
                ) : (
                  <button className="secondary-button" disabled type="button">
                    不可出牌
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
