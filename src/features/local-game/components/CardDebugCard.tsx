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
      <button className="debug-card is-missing" type="button" disabled>
        未知卡牌 {cardInstanceId}
      </button>
    );
  }

  return (
    <button
      className={`debug-card${selected ? " is-selected" : ""}`}
      disabled={disabled}
      onClick={() => onSelect?.(cardInstanceId)}
      type="button"
    >
      <span className="debug-card__name">{definition.name}</span>
      <span className="debug-card__meta">
        {definition.type} · {cardInstanceId}
      </span>
      <span className="debug-card__line">标签：{formatList(definition.tags)}</span>
      <span className="debug-card__line">时机：{formatList(definition.allowedTimings)}</span>
    </button>
  );
}
