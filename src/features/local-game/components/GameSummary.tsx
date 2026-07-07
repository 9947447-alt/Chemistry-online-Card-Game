import type { GameState } from "../../../game/engine/types";
import {
  describePendingResponse,
  describePendingStatusHandling,
  describeTableReference,
  getPlayerName,
  getTotalCardCount,
} from "../localGameView";

type GameSummaryProps = {
  game: GameState;
  error?: string;
  onReset: () => void;
};

export function GameSummary({ game, error, onReset }: GameSummaryProps) {
  const winnerText = game.phase === "gameOver"
    ? game.isDraw
      ? "平局"
      : `胜者：${game.winnerPlayerId ? getPlayerName(game, game.winnerPlayerId) : "未定"}`
    : "未结束";

  return (
    <section className="debug-section debug-summary" aria-labelledby="summary-title">
      <div>
        <p className="debug-kicker">MVP 0 Debug UI</p>
        <h1 id="summary-title">本地双人公开调试对局</h1>
      </div>
      <dl className="summary-grid">
        <div>
          <dt>cycle</dt>
          <dd>{game.cycleNumber}</dd>
        </div>
        <div>
          <dt>round</dt>
          <dd>{game.roundInCycle}</dd>
        </div>
        <div>
          <dt>phase</dt>
          <dd>{game.phase}</dd>
        </div>
        <div>
          <dt>activePlayer</dt>
          <dd>{getPlayerName(game, game.activePlayerId)}</dd>
        </div>
        <div>
          <dt>deck</dt>
          <dd>{game.deck.length}</dd>
        </div>
        <div>
          <dt>discardPile</dt>
          <dd>{game.discardPile.length}</dd>
        </div>
        <div>
          <dt>CardInstance</dt>
          <dd>{getTotalCardCount(game)}</dd>
        </div>
        <div>
          <dt>gameOver</dt>
          <dd>{winnerText}</dd>
        </div>
      </dl>
      <div className="state-readout">
        <strong>PendingResponse</strong>
        <span>{describePendingResponse(game)}</span>
      </div>
      <div className="state-readout">
        <strong>pendingStatusHandling</strong>
        <span>{describePendingStatusHandling(game)}</span>
      </div>
      <div className="state-readout">
        <strong>tableReference</strong>
        <span>{describeTableReference(game)}</span>
      </div>
      <div className="summary-actions">
        {error ? <p className="error-banner">{error}</p> : <p className="quiet-banner">等待操作</p>}
        <button className="secondary-button" onClick={onReset} type="button">
          重开
        </button>
      </div>
    </section>
  );
}
