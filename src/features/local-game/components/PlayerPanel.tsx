import { getCharacterDefinition } from "../../../game/data/characterDefinitions";
import type {
  CardInstanceId,
  CharacterSkillImplementationStatus,
  CharacterSkillType,
  GameState,
  Player,
} from "../../../game/engine/types";
import { CardDebugCard } from "./CardDebugCard";

const skillTypeLabels: Record<CharacterSkillType, string> = {
  active: "主动",
  passive: "被动",
  response: "响应",
};

const implementationStatusLabels: Record<CharacterSkillImplementationStatus, string> = {
  "display-only-8a": "8A 仅展示",
  "planned-8b": "8B 计划实现",
  "planned-8c": "8C 计划实现",
  deferred: "延期",
};

type PlayerPanelProps = {
  game: GameState;
  player: Player;
  selectedCardId?: CardInstanceId;
  onSelectCard: (cardInstanceId: CardInstanceId) => void;
};

export function PlayerPanel({ game, player, selectedCardId, onSelectCard }: PlayerPanelProps) {
  const character = getCharacterDefinition(player.characterId);
  const statusText = player.statuses.length > 0
    ? player.statuses.map((status) => `${status.statusId} (${status.id})`).join(", ")
    : "无";

  return (
    <section className="debug-section player-panel" aria-labelledby={`${player.id}-title`}>
      <div className="player-panel__header">
        <div>
          <h2 id={`${player.id}-title`}>{player.name}</h2>
          <p>{player.id} · {character.name}</p>
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
      <div className="character-readout">
        <div className="character-readout__heading">
          <h3>角色技能</h3>
          <span>{character.name}</span>
        </div>
        <ul className="character-skill-list">
          {character.skills.map((skill) => (
            <li key={skill.id}>
              <div className="character-skill-list__heading">
                <strong>{skill.name}</strong>
                <span>
                  {skillTypeLabels[skill.type]} · {implementationStatusLabels[skill.implementationStatus]}
                </span>
              </div>
              <p>{skill.rulesText}</p>
              {skill.implementationNote ? <p className="character-skill-list__note">{skill.implementationNote}</p> : null}
            </li>
          ))}
        </ul>
      </div>
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
