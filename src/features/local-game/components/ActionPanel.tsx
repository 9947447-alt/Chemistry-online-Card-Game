import { useEffect, useMemo, useState } from "react";
import type { GameAction } from "../../../game/engine/actions";
import type { CardInstanceId, GameState, PlayerId } from "../../../game/engine/types";
import {
  getActivePlayer,
  getCardDefinition,
  getMainActionCards,
  getOpponentTargets,
  getPlayerName,
} from "../localGameView";
import { CardDebugCard } from "./CardDebugCard";

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
  const mainActionCards = activePlayer ? getMainActionCards(game, activePlayer) : [];
  const selectedDefinition = selectedCardId ? getCardDefinition(game, selectedCardId) : undefined;
  const selectedIsOxygen = selectedDefinition?.id === "substance_o2";
  const targets = activePlayer ? getOpponentTargets(game, activePlayer.id) : [];
  const defaultTarget = selectedIsOxygen ? activePlayer?.id : targets[0]?.id;
  const [targetPlayerId, setTargetPlayerId] = useState<PlayerId | undefined>(defaultTarget);
  const selectableIds = useMemo(() => new Set(mainActionCards), [mainActionCards]);

  useEffect(() => {
    if (selectedCardId && !selectableIds.has(selectedCardId)) {
      onSelectCard(undefined);
    }
  }, [onSelectCard, selectableIds, selectedCardId]);

  useEffect(() => {
    setTargetPlayerId(defaultTarget);
  }, [defaultTarget, selectedCardId]);

  if (game.phase !== "mainAction" || !activePlayer) {
    return null;
  }

  const canSubmit = Boolean(selectedCardId && selectedDefinition && selectableIds.has(selectedCardId));

  return (
    <section className="debug-section action-panel" aria-labelledby="main-action-title">
      <div className="panel-heading">
        <div>
          <p className="debug-kicker">PLAY_CARD / PASS_ACTION</p>
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
      <div className="candidate-grid">
        {mainActionCards.length > 0 ? (
          mainActionCards.map((cardInstanceId) => (
            <CardDebugCard
              cardInstanceId={cardInstanceId}
              game={game}
              key={cardInstanceId}
              onSelect={onSelectCard}
              selected={selectedCardId === cardInstanceId}
            />
          ))
        ) : (
          <p className="empty-note">没有可作为主行动打出的手牌。</p>
        )}
      </div>
      <label className="field-row">
        <span>目标</span>
        <select
          disabled={!selectedDefinition}
          onChange={(event) => setTargetPlayerId(event.target.value)}
          value={targetPlayerId ?? ""}
        >
          {selectedIsOxygen && activePlayer ? (
            <option value={activePlayer.id}>{activePlayer.name}</option>
          ) : (
            targets.map((target) => (
              <option key={target.id} value={target.id}>
                {getPlayerName(game, target.id)}
              </option>
            ))
          )}
        </select>
      </label>
      <button
        className="primary-button"
        disabled={!canSubmit}
        onClick={() => {
          if (!activePlayer || !selectedCardId) {
            return;
          }

          dispatchGameAction({
            type: "PLAY_CARD",
            playerId: activePlayer.id,
            cardInstanceId: selectedCardId,
            targetPlayerId,
          });
        }}
        type="button"
      >
        执行 PLAY_CARD
      </button>
    </section>
  );
}
