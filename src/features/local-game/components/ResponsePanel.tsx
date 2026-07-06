import type { GameAction } from "../../../game/engine/actions";
import type { GameState } from "../../../game/engine/types";
import {
  describePendingResponse,
  getPlayer,
  getResponseCards,
} from "../localGameView";
import { CardDebugCard } from "./CardDebugCard";

type ResponsePanelProps = {
  game: GameState;
  dispatchGameAction: (action: GameAction) => void;
};

export function ResponsePanel({ game, dispatchGameAction }: ResponsePanelProps) {
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
          <p className="debug-kicker">RESPOND_WITH_CARD / PASS_RESPONSE</p>
          <h2 id="response-title">响应窗口</h2>
        </div>
        <button
          className="secondary-button"
          onClick={() => dispatchGameAction({ type: "PASS_RESPONSE", playerId: responder.id })}
          type="button"
        >
          PASS_RESPONSE
        </button>
      </div>
      <p className="panel-note">{describePendingResponse(game)}</p>
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
          <p className="empty-note">当前响应者没有 UI 判定可用的响应牌。</p>
        )}
      </div>
    </section>
  );
}
