import type { GameAction } from "../../../game/engine/actions";
import { useLocale } from "../../../app/locale";
import type { GameState } from "../../../game/engine/types";
import type { PlayerControllerSelection } from "../localGameSession";
import {
  getPlayer,
  getPlayerStatusById,
  getStatusHandlingCards,
} from "../localGameView";
import { CardDebugCard } from "./CardDebugCard";
import { getAiAutoActionNote, getPlayerDisplayName, getStatusDisplayName } from "../presentationLocale";

type StatusPanelProps = {
  game: GameState;
  playerControllers?: PlayerControllerSelection;
  dispatchGameAction: (action: GameAction) => void;
};

export function StatusPanel({ game, playerControllers, dispatchGameAction }: StatusPanelProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const pendingStatusHandling = game.pendingStatusHandling;
  const player = pendingStatusHandling ? getPlayer(game, pendingStatusHandling.playerId) : undefined;
  const isAi = Boolean(
    player &&
      playerControllers &&
      playerControllers[player.id === "player_1" ? 0 : 1] === "ai",
  );
  const status = getPlayerStatusById(player, pendingStatusHandling?.statusInstanceId);
  const handlingCards = player ? getStatusHandlingCards(game, player, status) : [];

  if (game.phase !== "statusWindow" || !pendingStatusHandling || !player || !status) {
    return null;
  }

  return (
    <section className="debug-section status-panel" aria-labelledby="status-title">
      <div className="panel-heading">
        <div>
          <p className="debug-kicker">{isEnglish ? "Handle status or pass" : "请处理当前状态，或放弃处理"}</p>
          <h2 id="status-title">{isEnglish ? "Status handling window" : "状态处理窗口"}</h2>
        </div>
        <button
          className="secondary-button"
          disabled={isAi}
          onClick={() =>
            dispatchGameAction({
              type: "PASS_STATUS_HANDLING",
              playerId: player.id,
              statusInstanceId: status.id,
            })
          }
          type="button"
        >
          {isEnglish ? "Pass handling" : "放弃处理"}
        </button>
      </div>
      <p className="panel-note">
        {isEnglish ? `${getPlayerDisplayName(player, locale)} is handling ${getStatusDisplayName(status.statusId, locale)}.` : `${player.name} 正在处理一项状态`}
        {isAi ? ` · ${getAiAutoActionNote(locale)}` : ""}
      </p>
      <details className="debug-details"><summary>{isEnglish ? "Debug details" : "调试详情"}</summary><p>HANDLE_STATUS_WITH_CARD / PASS_STATUS_HANDLING · {status.statusId} ({status.id})</p></details>
      <div className="candidate-grid">
        {handlingCards.length > 0 ? (
          handlingCards.map((cardInstanceId) => (
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
                        type: "HANDLE_STATUS_WITH_CARD",
                        playerId: player.id,
                        statusInstanceId: status.id,
                        cardInstanceId,
                      })
              }
            />
          ))
        ) : (
          <p className="empty-note">{isEnglish ? "No handling cards available." : "当前无可用处理牌。"}</p>
        )}
      </div>
    </section>
  );
}
