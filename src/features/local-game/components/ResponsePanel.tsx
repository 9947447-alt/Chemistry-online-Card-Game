import type { GameAction } from "../../../game/engine/actions";
import { useLocale } from "../../../app/locale";
import type { GameState } from "../../../game/engine/types";
import type { PlayerControllerSelection } from "../localGameSession";
import {
  describePendingResponse,
  getPlayer,
  getResponseCards,
} from "../localGameView";
import { CardDebugCard } from "./CardDebugCard";
import { getAiAutoActionNote, getPlayerDisplayName } from "../presentationLocale";

type ResponsePanelProps = {
  game: GameState;
  playerControllers?: PlayerControllerSelection;
  dispatchGameAction: (action: GameAction) => void;
};

export function ResponsePanel({ game, playerControllers, dispatchGameAction }: ResponsePanelProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const pendingResponse = game.pendingResponse;
  const responder = pendingResponse ? getPlayer(game, pendingResponse.responderId) : undefined;
  const isAi = Boolean(
    responder &&
      playerControllers &&
      playerControllers[responder.id === "player_1" ? 0 : 1] === "ai",
  );
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
          disabled={isAi}
          onClick={() => dispatchGameAction({ type: "PASS_RESPONSE", playerId: responder.id })}
          type="button"
        >
          {isEnglish ? "Pass response" : "放弃响应"}
        </button>
      </div>
      <p className="panel-note">
        {isEnglish ? `${getPlayerDisplayName(responder, locale)} decides whether to respond to the current effect.` : `轮到 ${responder.name} 决定是否响应当前效果。`}
        {isAi ? ` · ${getAiAutoActionNote(locale)}` : ""}
      </p>
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
              disabled={isAi}
              game={game}
              key={cardInstanceId}
              onSelect={
                isAi
                  ? undefined
                  : () =>
                      dispatchGameAction({
                        type: "RESPOND_WITH_CARD",
                        playerId: responder.id,
                        cardInstanceId,
                      })
              }
            />
          ))
        ) : (
          <p className="empty-note">{isEnglish ? "No response cards available." : "当前无可用响应牌。"}</p>
        )}
      </div>
    </section>
  );
}
