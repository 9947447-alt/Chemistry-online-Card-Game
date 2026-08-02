import type { CardInstanceId } from "../../../game/engine/types";
import { formatList, getCardDefinition } from "../localGameView";
import type { GameState } from "../../../game/engine/types";

type CardDebugCardProps = {
  cardInstanceId: CardInstanceId;
  game: GameState;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (cardInstanceId: CardInstanceId) => void;
};

export function CardDebugCard({
  cardInstanceId,
  game,
  selected = false,
  disabled = false,
  onSelect,
}: CardDebugCardProps) {
  const definition = getCardDefinition(game, cardInstanceId);

  if (!definition) {
    return (
      <article className="debug-card is-missing">
        <button className="debug-card__select" disabled type="button">
          未知卡牌 {cardInstanceId}
        </button>
      </article>
    );
  }

  return (
    <article
      className={`debug-card${selected ? " is-selected" : ""}`}
    >
      <button
        className="debug-card__select"
        disabled={disabled}
        onClick={() => onSelect?.(cardInstanceId)}
        type="button"
      >
        <span className="debug-card__name">{definition.name}</span>
        <span className="debug-card__line">可在当前对局中选择</span>
      </button>
      <details className="debug-details debug-card__details">
        <summary>调试详情</summary>
        <span className="debug-card__meta">{definition.type} · {cardInstanceId}</span>
        <span className="debug-card__line">标签：{formatList(definition.tags)}</span>
        <span className="debug-card__line">时机：{formatList(definition.allowedTimings)}</span>
      </details>
    </article>
  );
}
