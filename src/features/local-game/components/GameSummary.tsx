import type { GameState } from "../../../game/engine/types";
import { releaseMetadata } from "../../../app/releaseMetadata";
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
  onRestart: (trigger: HTMLButtonElement) => void;
  onReturnToCharacterSelection: (trigger: HTMLButtonElement) => void;
};

export function GameSummary({
  game,
  error,
  onRestart,
  onReturnToCharacterSelection,
}: GameSummaryProps) {
  const winnerText = game.phase === "gameOver"
    ? game.isDraw
      ? "平局"
      : `胜者：${game.winnerPlayerId ? getPlayerName(game, game.winnerPlayerId) : "未定"}`
    : "未结束";

  return (
    <section className="debug-section debug-summary" aria-labelledby="summary-title">
      <div>
        <p className="debug-kicker">{releaseMetadata.displayName}</p>
        <h1 id="summary-title">本地双人公开对局</h1>
      </div>
      <dl className="summary-grid">
        <div>
          <dt>实验周期</dt>
          <dd>{game.cycleNumber}</dd>
        </div>
        <div>
          <dt>本周期轮次</dt>
          <dd>{game.roundInCycle}</dd>
        </div>
        <div>
          <dt>当前阶段</dt>
          <dd>{game.phase === "mainAction" ? "主行动" : game.phase === "gameOver" ? "对局结束" : "等待处理"}</dd>
        </div>
        <div>
          <dt>当前行动玩家</dt>
          <dd>{getPlayerName(game, game.activePlayerId)}</dd>
        </div>
        <div>
          <dt>牌堆</dt>
          <dd>{game.deck.length}</dd>
        </div>
        <div>
          <dt>弃牌堆</dt>
          <dd>{game.discardPile.length}</dd>
        </div>
        <div>
          <dt>公开对局</dt>
          <dd>双方手牌可见</dd>
        </div>
        <div>
          <dt>胜负</dt>
          <dd>{winnerText}</dd>
        </div>
      </dl>
      <details className="debug-details">
        <summary>调试详情</summary>
        <dl className="debug-detail-list">
          <div><dt>发布渠道</dt><dd>{releaseMetadata.channel}</dd></div>
          <div><dt>应用版本</dt><dd>{releaseMetadata.version}</dd></div>
          <div><dt>规则版本</dt><dd>{releaseMetadata.rulesVersion}</dd></div>
          <div><dt>Commit</dt><dd>{releaseMetadata.commit}</dd></div>
          <div><dt>phase</dt><dd>{game.phase}</dd></div>
          <div><dt>CardInstance</dt><dd>{getTotalCardCount(game)}</dd></div>
          <div><dt>PendingResponse</dt><dd>{describePendingResponse(game)}</dd></div>
          <div><dt>pendingStatusHandling</dt><dd>{describePendingStatusHandling(game)}</dd></div>
          <div><dt>tableReference</dt><dd>{describeTableReference(game)}</dd></div>
        </dl>
      </details>
      <div className="summary-actions">
        {error ? <p className="error-banner">{error}</p> : <p className="quiet-banner">等待操作</p>}
        <div className="session-actions">
          <button
            className="secondary-button"
            onClick={(event) => onRestart(event.currentTarget)}
            type="button"
          >
            按当前阵容重开
          </button>
          <button
            className="secondary-button"
            onClick={(event) => onReturnToCharacterSelection(event.currentTarget)}
            type="button"
          >
            返回角色选择
          </button>
        </div>
      </div>
    </section>
  );
}
