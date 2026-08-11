import { getCharacterDefinition } from "../../../game/data/characterDefinitions";
import type {
  CardInstanceId,
  GameState,
  Player,
} from "../../../game/engine/types";
import {
  getPublicCharacterSkills,
  implementationStatusLabels,
  skillTypeLabels,
} from "../characterPresentation";
import { CardDebugCard } from "./CardDebugCard";

type PlayerPanelProps = {
  game: GameState;
  player: Player;
  selectedCardId?: CardInstanceId;
  onSelectCard: (cardInstanceId: CardInstanceId) => void;
  handSelectionDisabled?: boolean;
  showActivePlayerIndicator?: boolean;
};

export function PlayerPanel({
  game,
  player,
  selectedCardId,
  onSelectCard,
  handSelectionDisabled = false,
  showActivePlayerIndicator = true,
}: PlayerPanelProps) {
  const character = getCharacterDefinition(player.characterId);
  const statusText = player.statuses.length > 0
    ? player.statuses.map((status) => `${status.statusId} (${status.id})`).join(", ")
    : "无";

  return (
    <section className="debug-section player-panel" aria-labelledby={`${player.id}-title`}>
      <div className="player-panel__header">
        <div>
          <h2 id={`${player.id}-title`}>{player.name}</h2>
          <p>{character.name}</p>
        </div>
        {showActivePlayerIndicator && game.activePlayerId === player.id ? (
          <span className="active-pill">当前行动</span>
        ) : null}
      </div>
      <dl className="player-stats">
        <div>
          <dt>生命值</dt>
          <dd>
            {player.hp} / {player.maxHp}
          </dd>
        </div>
        <div>
          <dt>淘汰</dt>
          <dd>{player.eliminated ? "是" : "否"}</dd>
        </div>
        <div>
          <dt>待处理状态</dt>
          <dd>{player.statuses.length > 0 ? "有" : "无"}</dd>
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
      <p className="status-line">当前状态：{player.statuses.length > 0 ? "有待处理状态" : "正常"}</p>
      <details className="debug-details">
        <summary>调试详情</summary>
        <p className="status-line">playerId：{player.id}</p>
        <p className="status-line">状态：{statusText}</p>
      </details>
      <div className="character-readout">
        <div className="character-readout__heading">
          <h3>角色技能</h3>
          <span>{character.name}</span>
        </div>
        <ul className="character-skill-list">
          {getPublicCharacterSkills(character).map((skill) => (
            <li key={skill.name}>
              <div className="character-skill-list__heading">
                <strong>{skill.name}</strong>
                <span>
                  {skill.type} · {skill.availability}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <details className="debug-details">
          <summary>调试详情</summary>
          {character.skills.map((skill) => (
            <p key={skill.id}>{skill.id} · {skillTypeLabels[skill.type]} · {implementationStatusLabels[skill.implementationStatus]} · {skill.rulesText}{skill.implementationNote ? ` · ${skill.implementationNote}` : ""}</p>
          ))}
        </details>
      </div>
      <div className="hand-grid">
        {player.hand.map((cardInstanceId) => (
          <CardDebugCard
            cardInstanceId={cardInstanceId}
            disabled={handSelectionDisabled}
            game={game}
            key={cardInstanceId}
            onSelect={handSelectionDisabled ? undefined : onSelectCard}
            selected={!handSelectionDisabled && selectedCardId === cardInstanceId}
          />
        ))}
      </div>
    </section>
  );
}
