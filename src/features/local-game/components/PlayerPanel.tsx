import type { CardInstanceId, GameState, Player } from "../../../game/engine/types";
import { CardDebugCard } from "./CardDebugCard";

type PlayerPanelProps = {
  game: GameState;
  player: Player;
  selectedCardId?: CardInstanceId;
  onSelectCard: (cardInstanceId: CardInstanceId) => void;
};

export function PlayerPanel({ game, player, selectedCardId, onSelectCard }: PlayerPanelProps) {
  const statusText = player.statuses.length > 0
    ? player.statuses.map((status) => `${status.statusId} (${status.id})`).join(", ")
    : "无";

  return (
    <section className="debug-section player-panel" aria-labelledby={`${player.id}-title`}>
      <div className="player-panel__header">
        <div>
          <h2 id={`${player.id}-title`}>{player.name}</h2>
          <p>{player.id}</p>
        </div>
        {game.activePlayerId === player.id ? <span className="active-pill">当前行动</span> : null}
      </div>
      <dl className="player-stats">
        <div>
          <dt>HP / maxHp</dt>
          <dd>
            {player.hp} / {player.maxHp}
          </dd>
        </div>
        <div>
          <dt>淘汰</dt>
          <dd>{player.eliminated ? "是" : "否"}</dd>
        </div>
        <div>
          <dt>FIRE</dt>
          <dd>{player.statuses.some((status) => status.statusId === "FIRE") ? "有" : "无"}</dd>
        </div>
        <div>
          <dt>SO2_LEAK</dt>
          <dd>{player.statuses.some((status) => status.statusId === "SO2_LEAK") ? "有" : "无"}</dd>
        </div>
        <div>
          <dt>本周期 DIY</dt>
          <dd>{player.usedDIYThisCycle ? "已用" : "未用"}</dd>
        </div>
        <div>
          <dt>手牌</dt>
          <dd>{player.hand.length}</dd>
        </div>
      </dl>
      <p className="status-line">状态：{statusText}</p>
      <div className="hand-grid">
        {player.hand.map((cardInstanceId) => (
          <CardDebugCard
            cardInstanceId={cardInstanceId}
            game={game}
            key={cardInstanceId}
            onSelect={onSelectCard}
            selected={selectedCardId === cardInstanceId}
          />
        ))}
      </div>
    </section>
  );
}
