import type { GameAction } from "../../../game/engine/actions";
import { useLocale } from "../../../app/locale";
import type { GameState } from "../../../game/engine/types";
import {
  describePendingResponse,
  getPlayer,
  getResponseCards,
} from "../localGameView";
import { CardDebugCard } from "./CardDebugCard";
import { getPlayerDisplayName } from "../presentationLocale";

type ResponsePanelProps = {
  game: GameState;
  dispatchGameAction: (action: GameAction) => void;
};

export function ResponsePanel({ game, dispatchGameAction }: ResponsePanelProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const pendingResponse = game.pendingResponse;
  const responder = pendingResponse ? getPlayer(game, pendingResponse.responderId) : undefined;
  const responseCards = responder ? getResponseCards(game, responder) : [];

  if (game.phase !== "responseWindow" || !pendingResponse || !responder) {
    return null;
  }

  return (
    <section className="debug-section response-panel" aria-labelledby="response-title">
      <div className="panel-heading">
        <div>
          <p className="debug-kicker">{isEnglish ? "The current responder may choose a legal response card" : "当前响应者可选择合法响应牌"}</p>
          <h2 id="response-title">{isEnglish ? "Response window" : "响应窗口"}</h2>
        </div>
        <button
          className="secondary-button"
          onClick={() => dispatchGameAction({ type: "PASS_RESPONSE", playerId: responder.id })}
          type="button"
        >
          {isEnglish ? "Pass response" : "放弃响应"}
        </button>
      </div>
      <p className="panel-note">{isEnglish ? `${getPlayerDisplayName(responder, locale)} decides whether to respond to the current effect.` : `轮到 ${responder.name} 决定是否响应当前效果。`}</p>
      <details className="debug-details">
        <summary>{isEnglish ? "Debug details" : "调试详情"}</summary>
        <p>{describePendingResponse(game)}</p>
        <p>RESPOND_WITH_CARD / PASS_RESPONSE</p>
      </details>
      <div className="candidate-grid">
        {responseCards.length > 0 ? (
          responseCards.map((cardInstanceId) => (
            <CardDebugCard
              cardInstanceId={cardInstanceId}
              game={game}
              key={cardInstanceId}
              onSelect={() =>
                dispatchGameAction({
                  type: "RESPOND_WITH_CARD",
                  playerId: responder.id,
                  cardInstanceId,
                })
              }
            />
          ))
        ) : (
          <p className="empty-note">{isEnglish ? "The current responder has no response card available according to the UI's existing check." : "当前响应者没有 UI 判定可用的响应牌。"}</p>
        )}
      </div>
    </section>
  );
}
