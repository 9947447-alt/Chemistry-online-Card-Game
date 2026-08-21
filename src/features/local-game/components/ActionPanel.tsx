import { useMemo, useState } from "react";
import { useLocale } from "../../../app/locale";
import type { GameAction } from "../../../game/engine/actions";
import type {
  CardInstanceId,
  CharacterUsageKey,
  GameState,
  PlayerId,
} from "../../../game/engine/types";
import type { PlayerControllerSelection } from "../localGameSession";
import {
  canPlayAgainstCurrentTableReference,
  canExecuteMainActionEffect,
  describeTableReferenceAssociation,
  formatList,
  getActivePlayer,
  getAlkaliRecoveryCards,
  getCardDefinition,
  getOpponentTargets,
} from "../localGameView";
import {
  getOptionalCardDisplayName,
  getPlayerDisplayName,
  getSkillDisplayName,
} from "../presentationLocale";

type ActionPanelProps = {
  game: GameState;
  playerControllers?: PlayerControllerSelection;
  selectedCardId?: CardInstanceId;
  onSelectCard: (cardInstanceId: CardInstanceId | undefined) => void;
  dispatchGameAction: (action: GameAction) => void;
};

type DrawSkillId = "extra_lesson" | "emergency_supply";

function SkillRow({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="character-active-skill">
      <div><strong>{title}</strong><span>{desc}</span></div>
      <div className="candidate-grid">{children}</div>
    </div>
  );
}

function CharacterSkillActions({
  game,
  activePlayer,
  disabled = false,
  dispatchGameAction,
}: {
  game: GameState;
  activePlayer: NonNullable<ReturnType<typeof getActivePlayer>>;
  disabled?: boolean;
  dispatchGameAction: (action: GameAction) => void;
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const targets = getOpponentTargets(game, activePlayer.id);

  if (activePlayer.characterId === "caustic_soda_captain") {
    const used = Boolean(activePlayer.characterUsage.perCycle.caustic_soda_captain_alkali_recovery);
    const cards = used ? [] : getAlkaliRecoveryCards(game, activePlayer);
    return (
      <SkillRow
        desc={isEnglish ? "Discard physical strong-alkali to recover 2 HP · once per cycle" : "弃置实体强碱牌回复 2 HP · 每周期一次"}
        title={getSkillDisplayName("alkali_recovery", locale)}
      >
        {cards.length > 0 ? cards.map((cardInstanceId) => (
          <button
            className="primary-button"
            disabled={disabled}
            key={cardInstanceId}
            onClick={() => dispatchGameAction({
              type: "ACTIVATE_CHARACTER_SKILL",
              playerId: activePlayer.id,
              skillId: "alkali_recovery",
              cardInstanceId,
            })}
            type="button"
          >
            {isEnglish ? "Use " : "使用 "}{getOptionalCardDisplayName(getCardDefinition(game, cardInstanceId), locale)}
          </button>
        )) : (
          <button className="primary-button" disabled type="button">
            {used ? (isEnglish ? "Used this cycle" : "本周期已用") : (isEnglish ? "Currently unavailable" : "当前不可发动")}
          </button>
        )}
      </SkillRow>
    );
  }

  if (activePlayer.characterId === "sulfuric_acid_factory_director") {
    const used = Boolean(activePlayer.characterUsage.perCycle.sulfuric_acid_factory_director_exhaust_discharge);
    return (
      <SkillRow
        desc={isEnglish ? "Give other living player Exhaust Leak · once per cycle" : "使其他存活玩家获得尾气泄漏状态 · 每周期一次"}
        title={getSkillDisplayName("exhaust_discharge", locale)}
      >
        {targets.map((target) => (
          <button
            className="primary-button"
            disabled={disabled || used}
            key={target.id}
            onClick={() => dispatchGameAction({
              type: "ACTIVATE_CHARACTER_SKILL",
              playerId: activePlayer.id,
              skillId: "exhaust_discharge",
              targetPlayerId: target.id,
            })}
            type="button"
          >
            {isEnglish ? "Target " : "对 "}{getPlayerDisplayName(target, locale)}
          </button>
        ))}
      </SkillRow>
    );
  }

  if (activePlayer.characterId === "clumsy_party_secretary") {
    const used = Boolean(activePlayer.characterUsage.perCycle.clumsy_party_secretary_shared_active);
    const skills = ["exhaust_leak", "lab_fire", "exothermic_accident"] as const;
    return (
      <SkillRow
        desc={`${isEnglish ? "Three skills share once per cycle · " : "三项技能共享每周期一次 · "}${used ? (isEnglish ? "used" : "已用") : (isEnglish ? "available" : "可用")}`}
        title={isEnglish ? "Secretary shared active skills" : "书记共享主动技能"}
      >
        {skills.map((skillId) => (
          <button
            className="primary-button"
            disabled={disabled || used || targets.length === 0}
            key={skillId}
            onClick={() => dispatchGameAction({
              type: "ACTIVATE_CHARACTER_SKILL",
              playerId: activePlayer.id,
              skillId,
            })}
            type="button"
          >
            {isEnglish ? "Activate " : "发动"}{getSkillDisplayName(skillId, locale)}
          </button>
        ))}
      </SkillRow>
    );
  }

  return null;
}

export function ActionPanel({
  game,
  playerControllers,
  selectedCardId,
  onSelectCard,
  dispatchGameAction,
}: ActionPanelProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const activePlayer = getActivePlayer(game);
  const isAi = Boolean(
    activePlayer &&
      playerControllers &&
      playerControllers[activePlayer.id === "player_1" ? 0 : 1] === "ai",
  );
  const targets = activePlayer ? getOpponentTargets(game, activePlayer.id) : [];
  const [targetByCardId, setTargetByCardId] = useState<Record<CardInstanceId, PlayerId>>({});
  const activeCharacterSkill: {
    id: DrawSkillId;
    usageKey: CharacterUsageKey;
  } | undefined = activePlayer?.characterId === "laboratory_teacher"
    ? {
        id: "extra_lesson",
        usageKey: "laboratory_teacher_extra_lesson",
      }
    : activePlayer?.characterId === "chemical_factory_ceo"
      ? {
          id: "emergency_supply",
          usageKey: "chemical_factory_ceo_emergency_supply",
        }
      : undefined;
  const executableCardIds = useMemo(() => {
    if (!activePlayer) {
      return new Set<CardInstanceId>();
    }

    return new Set(
      activePlayer.hand.filter((cardInstanceId) =>
        canExecuteMainActionEffect(game, activePlayer, cardInstanceId),
      ),
    );
  }, [activePlayer, game]);

  if (game.phase !== "mainAction" || !activePlayer) {
    return null;
  }

  return (
    <section className="debug-section action-panel" aria-labelledby="main-action-title">
      <div className="panel-heading">
        <div>
          <p className="debug-kicker">{isEnglish ? "It is the active player's main action" : "轮到当前玩家进行主行动"}</p>
          <h2 id="main-action-title">{isEnglish ? "Main action" : "主行动"}</h2>
        </div>
        <button
          className="secondary-button"
          disabled={isAi}
          onClick={() => dispatchGameAction({ type: "PASS_ACTION", playerId: activePlayer.id })}
          type="button"
        >
          {isEnglish ? "End this action" : "结束本次行动"}
        </button>
      </div>
      <p className="panel-note">
        {isEnglish ? "Active player" : "当前行动玩家"}：{getPlayerDisplayName(activePlayer, locale)}
        {isAi ? ` · ${isEnglish ? "NATBA-0 AI is taking action..." : "NATBA-0 AI 正在自动行动..."}` : ""}
      </p>
      <details className="debug-details"><summary>{isEnglish ? "Debug details" : "调试详情"}</summary><p>PLAY_CARD / PLAY_REFERENCE_CARD / PASS_ACTION</p></details>
      {activeCharacterSkill ? (
        <div className="character-active-skill">
          <div>
            <strong>{getSkillDisplayName(activeCharacterSkill.id, locale)}</strong>
            <span>{isEnglish ? "Hand of 4 or fewer · once per cycle · ends action" : "手牌不超过 4 张 · 每周期一次 · 发动后结束行动"}</span>
          </div>
          <button
            className="primary-button"
            disabled={
              isAi ||
              activePlayer.hand.length > 4 ||
              Boolean(activePlayer.characterUsage.perCycle[activeCharacterSkill.usageKey]) ||
              game.deck.length + game.discardPile.length === 0
            }
            onClick={() =>
              dispatchGameAction({
                type: "ACTIVATE_CHARACTER_SKILL",
                playerId: activePlayer.id,
                skillId: activeCharacterSkill.id,
              })
            }
            type="button"
          >
            {isEnglish ? "Activate " : "发动"}{getSkillDisplayName(activeCharacterSkill.id, locale)}
          </button>
        </div>
      ) : null}
      <CharacterSkillActions
        activePlayer={activePlayer}
        disabled={isAi}
        dispatchGameAction={dispatchGameAction}
        game={game}
      />
      <p className="empty-note">{isEnglish ? "Normal play updates table reference." : "普通出牌只更新场面基准。"}</p>
      <div className="action-card-list">
        {activePlayer.hand.map((cardInstanceId) => {
          const definition = getCardDefinition(game, cardInstanceId);
          const canAssociate = canPlayAgainstCurrentTableReference(
            game,
            activePlayer,
            cardInstanceId,
          );
          const associationLabel = describeTableReferenceAssociation(
            game,
            activePlayer,
            cardInstanceId,
            locale,
          );
          const canExecute = executableCardIds.has(cardInstanceId);
          const isOxygen = definition?.id === "substance_o2";
          const targetPlayerId = isOxygen
            ? activePlayer.id
            : targetByCardId[cardInstanceId] ?? targets[0]?.id;

          return (
            <article
              className={`action-card${selectedCardId === cardInstanceId ? " is-selected" : ""}`}
              key={cardInstanceId}
              onClick={() => onSelectCard(cardInstanceId)}
            >
              <div>
                <strong>{getOptionalCardDisplayName(definition, locale)}</strong>
                <span className={`association-line${canAssociate ? " is-allowed" : " is-blocked"}`}>
                  {associationLabel}
                </span>
                <details className="debug-details" onClick={(e) => e.stopPropagation()}>
                  <summary>{isEnglish ? "Debug details" : "调试详情"}</summary>
                  <span>{cardInstanceId} · {formatList(definition?.tags ?? [])}</span>
                </details>
              </div>
              {canExecute && !isOxygen ? (
                <label className="field-row compact-field">
                  <span>{isEnglish ? "Effect target" : "执行效果目标"}</span>
                  <select
                    onChange={(event) =>
                      setTargetByCardId((current) => ({
                        ...current,
                        [cardInstanceId]: event.target.value,
                      }))
                    }
                    onClick={(event) => event.stopPropagation()}
                    value={targetPlayerId ?? ""}
                  >
                    {targets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {getPlayerDisplayName(target, locale)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="action-card__actions">
                {canExecute && (
                  <button
                    className="primary-button"
                    disabled={isAi}
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatchGameAction({ type: "PLAY_CARD", playerId: activePlayer.id, cardInstanceId, targetPlayerId });
                    }}
                    type="button"
                  >
                    {isEnglish ? "Run effect" : "执行效果"}
                  </button>
                )}
                <button
                  className="secondary-button"
                  disabled={isAi || !canAssociate}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatchGameAction({ type: "PLAY_REFERENCE_CARD", playerId: activePlayer.id, cardInstanceId });
                  }}
                  type="button"
                >
                  {canAssociate ? (isEnglish ? "Play" : "普通出牌") : (isEnglish ? "Cannot play" : "不可出牌")}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
