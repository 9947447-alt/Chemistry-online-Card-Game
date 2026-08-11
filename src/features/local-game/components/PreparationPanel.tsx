import { useEffect, useState } from "react";
import { useLocale } from "../../../app/locale";
import type { GameAction } from "../../../game/engine/actions";
import type { CardInstanceId, GameState } from "../../../game/engine/types";
import { CardDebugCard } from "./CardDebugCard";
import { getPlayerDisplayName } from "../presentationLocale";

type PreparationPanelProps = {
  game: GameState;
  dispatchGameAction: (action: GameAction) => void;
};

export function PreparationPanel({ game, dispatchGameAction }: PreparationPanelProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const pending = game.pendingLaboratoryPreparation;
  const [selectedIds, setSelectedIds] = useState<CardInstanceId[]>([]);
  const currentPlayer = game.players.find((player) => player.id === pending?.playerId);
  const validCandidateIds = pending?.candidateCardInstanceIds.filter((cardInstanceId) => {
    const instance = game.cardInstances[cardInstanceId];
    return (
      currentPlayer?.hand.includes(cardInstanceId) &&
      instance?.ownerId === currentPlayer.id &&
      instance.zone.type === "hand" &&
      instance.zone.playerId === currentPlayer.id
    );
  }) ?? [];
  const validCandidateIdSet = new Set(validCandidateIds);
  const validSelectedIds = selectedIds.filter((cardInstanceId) =>
    validCandidateIdSet.has(cardInstanceId),
  );
  const selectionKey = pending
    ? `${pending.playerId}:${validCandidateIds.join(",")}`
    : "none";

  useEffect(() => {
    setSelectedIds([]);
  }, [game, selectionKey]);

  if (game.phase !== "preparationSelection" || !pending) {
    return null;
  }

  function toggleCard(cardInstanceId: CardInstanceId) {
    setSelectedIds((current) =>
      current.includes(cardInstanceId)
        ? current.filter((id) => id !== cardInstanceId)
        : [...current, cardInstanceId],
    );
  }

  return (
    <section className="debug-section preparation-panel" aria-labelledby="preparation-title">
      <div className="panel-heading">
        <div>
          <p className="debug-kicker">{isEnglish ? "Keep the required number of cards" : "请保留指定数量的手牌"}</p>
          <h2 id="preparation-title">{isEnglish ? "Laboratory Teacher · Preparation" : "实验室老师 · 备课"}</h2>
        </div>
        <strong className="selection-count">
          {isEnglish ? "Selected" : "已选"} {validSelectedIds.length} / {pending.keepCount}
        </strong>
      </div>
      <p className="panel-note">{isEnglish ? "Current selector" : "当前选择玩家"}：{getPlayerDisplayName(currentPlayer, locale)}</p>
      <details className="debug-details"><summary>{isEnglish ? "Debug details" : "调试详情"}</summary><p>LABORATORY_PREPARATION</p></details>
      <div className="preparation-candidate-grid">
        {validCandidateIds.map((cardInstanceId) => (
          <CardDebugCard
            cardInstanceId={cardInstanceId}
            game={game}
            key={cardInstanceId}
            onSelect={toggleCard}
            selected={validSelectedIds.includes(cardInstanceId)}
          />
        ))}
      </div>
      <button
        className="primary-button"
        disabled={validSelectedIds.length !== pending.keepCount}
        onClick={() => {
          dispatchGameAction({
            type: "CONFIRM_LABORATORY_PREPARATION",
            playerId: pending.playerId,
            keptCardInstanceIds: validSelectedIds,
          });
          setSelectedIds([]);
        }}
        type="button"
      >
        {isEnglish ? "Confirm preparation selection" : "确认备课选择"}
      </button>
    </section>
  );
}
