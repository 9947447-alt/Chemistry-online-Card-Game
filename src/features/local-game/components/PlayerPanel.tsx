import { getCharacterDefinition } from "../../../game/data/characterDefinitions";
import { useLocale } from "../../../app/locale";
import type {
  CardInstanceId,
  GameState,
  Player,
} from "../../../game/engine/types";
import { CharacterSkillList } from "./CharacterSelectionPanel";
import { formatSkillDebugText } from "../characterPresentation";
import { CardDebugCard } from "./CardDebugCard";
import {
  getCharacterDisplayName,
  getPlayerDisplayName,
} from "../presentationLocale";
import { getCardDefinition } from "../localGameView";

type PlayerPanelProps = {
  game: GameState;
  player: Player;
  selectedCardId?: CardInstanceId;
  onSelectCard: (cardInstanceId: CardInstanceId) => void;
  handSelectionDisabled?: boolean;
  showActivePlayerIndicator?: boolean;
  diyMode?: boolean;
  diySelectedCardIds?: readonly CardInstanceId[];
  onToggleDiyCard?: (cardInstanceId: CardInstanceId) => void;
};

export function PlayerPanel({
  game,
  player,
  selectedCardId,
  onSelectCard,
  handSelectionDisabled = false,
  showActivePlayerIndicator = true,
  diyMode = false,
  diySelectedCardIds = [],
  onToggleDiyCard,
}: PlayerPanelProps) {
  const character = getCharacterDefinition(player.characterId);
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const statusText = player.statuses.length > 0
    ? player.statuses.map((status) => `${status.statusId} (${status.id})`).join(", ")
    : "无";

  return (
    <section className="debug-section player-panel" aria-labelledby={`${player.id}-title`}>
      <div className="player-panel__header">
        <div>
          <h2 id={`${player.id}-title`}>{getPlayerDisplayName(player, locale)}</h2>
          <p>{getCharacterDisplayName(character.id, locale)}</p>
        </div>
        {showActivePlayerIndicator && game.activePlayerId === player.id ? (
          <span className="active-pill">{isEnglish ? "Active" : "当前行动"}</span>
        ) : null}
      </div>
      <dl className="player-stats">
        {([
          [isEnglish ? "HP" : "生命值", `${player.hp} / ${player.maxHp}`],
          [isEnglish ? "Eliminated" : "淘汰", player.eliminated ? (isEnglish ? "Yes" : "是") : (isEnglish ? "No" : "否")],
          [isEnglish ? "Pending status" : "待处理状态", player.statuses.length > 0 ? (isEnglish ? "Yes" : "有") : (isEnglish ? "No" : "无")],
          [isEnglish ? "DIY this cycle" : "本周期 DIY", player.usedDIYThisCycle ? (isEnglish ? "Used" : "已用") : (isEnglish ? "Unused" : "未用")],
          [isEnglish ? "Hand" : "手牌", player.hand.length],
        ] as const).map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      <p className="status-line">{isEnglish ? "Current status" : "当前状态"}：{player.statuses.length > 0 ? (isEnglish ? "Pending status" : "有待处理状态") : (isEnglish ? "Normal" : "正常")}</p>
      <details className="debug-details">
        <summary>{isEnglish ? "Debug details" : "调试详情"}</summary>
        <p className="status-line">playerId：{player.id}</p>
        <p className="status-line">{isEnglish ? "Status" : "状态"}：{statusText}</p>
      </details>
      <div className="character-readout">
        <div className="character-readout__heading">
          <h3>{isEnglish ? "Character skills" : "角色技能"}</h3>
          <span>{getCharacterDisplayName(character.id, locale)}</span>
        </div>
        <CharacterSkillList character={character} locale={locale} />
        <details className="debug-details">
          <summary>{isEnglish ? "Debug details" : "调试详情"}</summary>
          {character.skills.map((skill) => (
            <p key={skill.id}>{formatSkillDebugText(skill, locale)}</p>
          ))}
        </details>
      </div>
      <div className="hand-grid">
        {player.hand.map((cardInstanceId) => {
          const isDiyCardDisabled =
            !diyMode
              ? handSelectionDisabled
              : handSelectionDisabled ||
                player.id !== game.activePlayerId ||
                !getCardDefinition(game, cardInstanceId)?.allowedTimings.includes("diy-component");

          const isSelected =
            !isDiyCardDisabled &&
            Boolean(diyMode ? diySelectedCardIds?.includes(cardInstanceId) : selectedCardId === cardInstanceId);

          return (
            <CardDebugCard
              cardInstanceId={cardInstanceId}
              disabled={isDiyCardDisabled}
              game={game}
              key={cardInstanceId}
              onSelect={isDiyCardDisabled ? undefined : (diyMode ? onToggleDiyCard : onSelectCard)}
              selected={isSelected}
            />
          );
        })}
      </div>
    </section>
  );
}
