import type { GameAction } from "../../../game/engine/actions";
import type { GameState } from "../../../game/engine/types";
import {
  getPlayer,
  getPlayerStatusById,
  getStatusHandlingCards,
} from "../localGameView";
import { CardDebugCard } from "./CardDebugCard";

type StatusPanelProps = {
  game: GameState;
  dispatchGameAction: (action: GameAction) => void;
};

export function StatusPanel({ game, dispatchGameAction }: StatusPanelProps) {
  const pendingStatusHandling = game.pendingStatusHandling;
  const player = pendingStatusHandling ? getPlayer(game, pendingStatusHandling.playerId) : undefined;
  const status = getPlayerStatusById(player, pendingStatusHandling?.statusInstanceId);
  const handlingCards = player ? getStatusHandlingCards(game, player, status) : [];

  if (game.phase !== "statusWindow" || !pendingStatusHandling || !player || !status) {
    return null;
  }

  return (
    <section className="debug-section status-panel" aria-labelledby="status-title">
      <div className="panel-heading">
        <div>
          <p className="debug-kicker">请处理当前状态，或放弃处理</p>
          <h2 id="status-title">状态处理窗口</h2>
        </div>
        <button
          className="secondary-button"
          onClick={() =>
            dispatchGameAction({
              type: "PASS_STATUS_HANDLING",
              playerId: player.id,
              statusInstanceId: status.id,
            })
          }
          type="button"
        >
          放弃处理
        </button>
      </div>
      <p className="panel-note">
        {player.name} 正在处理一项状态
      </p>
      <details className="debug-details"><summary>调试详情</summary><p>HANDLE_STATUS_WITH_CARD / PASS_STATUS_HANDLING · {status.statusId} ({status.id})</p></details>
      <div className="candidate-grid">
        {handlingCards.length > 0 ? (
          handlingCards.map((cardInstanceId) => (
            <CardDebugCard
              cardInstanceId={cardInstanceId}
              game={game}
              key={cardInstanceId}
              onSelect={() =>
                dispatchGameAction({
                  type: "HANDLE_STATUS_WITH_CARD",
                  playerId: player.id,
                  statusInstanceId: status.id,
                  cardInstanceId,
                })
              }
            />
          ))
        ) : (
          <p className="empty-note">当前玩家没有 UI 判定可用的状态处理牌。</p>
        )}
      </div>
    </section>
  );
}
