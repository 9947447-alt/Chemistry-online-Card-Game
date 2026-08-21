import type { CardInstanceId } from "../../../game/engine/types";
import { useLocale } from "../../../app/locale";
import { formatList, getCardDefinition } from "../localGameView";
import type { GameState } from "../../../game/engine/types";
import { getCardDisplayName, getOptionalCardDisplayName } from "../presentationLocale";

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
  const { locale } = useLocale();
  const isEnglish = locale === "en";

  if (!definition) {
    return (
      <article className="debug-card is-missing">
        <button className="debug-card__select" disabled type="button">
          {getOptionalCardDisplayName(undefined, locale)} {cardInstanceId}
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
        <span className="debug-card__name">{getCardDisplayName(definition.id, definition.name, locale)}</span>
        <span className="debug-card__line">{isEnglish ? "Selectable in this game" : "可在当前对局中选择"}</span>
      </button>
      <details className="debug-details debug-card__details">
        <summary>{isEnglish ? "Debug details" : "调试详情"}</summary>
        <span className="debug-card__meta">{cardInstanceId} · {formatList(definition.tags)} · {formatList(definition.allowedTimings)}</span>
      </details>
    </article>
  );
}
