import type { GameState } from "../../../game/engine/types";
import { useLocale } from "../../../app/locale";
import { releaseMetadata } from "../../../app/releaseMetadata";
import {
  describePendingResponse,
  describePendingStatusHandling,
  describeTableReference,
  getTotalCardCount,
} from "../localGameView";
import { getPlayerDisplayName } from "../presentationLocale";

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
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const winnerText = game.phase === "gameOver"
    ? game.isDraw
      ? (isEnglish ? "Draw" : "平局")
      : `${isEnglish ? "Winner" : "胜者"}：${game.winnerPlayerId
        ? getPlayerDisplayName(game.players.find((player) => player.id === game.winnerPlayerId), locale)
        : (isEnglish ? "Undetermined" : "未定")}`
    : (isEnglish ? "Not finished" : "未结束");

  return (
    <section className="debug-section debug-summary" aria-labelledby="summary-title">
      <div>
        <p className="debug-kicker">{releaseMetadata.displayName}</p>
        <h1 id="summary-title">{isEnglish ? "Local public two-player game" : "本地双人公开对局"}</h1>
      </div>
      <dl className="summary-grid">
        <div>
          <dt>{isEnglish ? "Experiment cycle" : "实验周期"}</dt>
          <dd>{game.cycleNumber}</dd>
        </div>
        <div>
          <dt>{isEnglish ? "Round in cycle" : "本周期轮次"}</dt>
          <dd>{game.roundInCycle}</dd>
        </div>
        <div>
          <dt>{isEnglish ? "Current phase" : "当前阶段"}</dt>
          <dd>{game.phase === "mainAction" ? (isEnglish ? "Main action" : "主行动") : game.phase === "gameOver" ? (isEnglish ? "Game over" : "对局结束") : (isEnglish ? "Waiting for handling" : "等待处理")}</dd>
        </div>
        <div>
          <dt>{isEnglish ? "Active player" : "当前行动玩家"}</dt>
          <dd>{getPlayerDisplayName(game.players.find((player) => player.id === game.activePlayerId), locale)}</dd>
        </div>
        <div>
          <dt>{isEnglish ? "Deck" : "牌堆"}</dt>
          <dd>{game.deck.length}</dd>
        </div>
        <div>
          <dt>{isEnglish ? "Discard pile" : "弃牌堆"}</dt>
          <dd>{game.discardPile.length}</dd>
        </div>
        <div>
          <dt>{isEnglish ? "Public game" : "公开对局"}</dt>
          <dd>{isEnglish ? "Both hands visible" : "双方手牌可见"}</dd>
        </div>
        <div>
          <dt>{isEnglish ? "Outcome" : "胜负"}</dt>
          <dd>{winnerText}</dd>
        </div>
      </dl>
      <details className="debug-details">
        <summary>{isEnglish ? "Debug details" : "调试详情"}</summary>
        <dl className="debug-detail-list">
          <div><dt>{isEnglish ? "Release channel" : "发布渠道"}</dt><dd>{releaseMetadata.channel}</dd></div>
          <div><dt>{isEnglish ? "App version" : "应用版本"}</dt><dd>{releaseMetadata.version}</dd></div>
          <div><dt>{isEnglish ? "Rules version" : "规则版本"}</dt><dd>{releaseMetadata.rulesVersion}</dd></div>
          <div><dt>Commit</dt><dd>{releaseMetadata.commit}</dd></div>
          <div><dt>phase</dt><dd>{game.phase}</dd></div>
          <div><dt>CardInstance</dt><dd>{getTotalCardCount(game)}</dd></div>
          <div><dt>PendingResponse</dt><dd>{describePendingResponse(game)}</dd></div>
          <div><dt>pendingStatusHandling</dt><dd>{describePendingStatusHandling(game)}</dd></div>
          <div><dt>tableReference</dt><dd>{describeTableReference(game)}</dd></div>
        </dl>
      </details>
      <div className="summary-actions">
        {error ? <p className="error-banner">{error}</p> : <p className="quiet-banner">{isEnglish ? "Awaiting action" : "等待操作"}</p>}
        <div className="session-actions">
          <button
            className="secondary-button"
            onClick={(event) => onRestart(event.currentTarget)}
            type="button"
          >
            {isEnglish ? "Restart with current lineup" : "按当前阵容重开"}
          </button>
          <button
            className="secondary-button"
            onClick={(event) => onReturnToCharacterSelection(event.currentTarget)}
            type="button"
          >
            {isEnglish ? "Return to character selection" : "返回角色选择"}
          </button>
        </div>
      </div>
    </section>
  );
}
