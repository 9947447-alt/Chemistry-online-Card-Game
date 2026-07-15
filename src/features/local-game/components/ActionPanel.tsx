import { useMemo, useState } from "react";
import type { GameAction } from "../../../game/engine/actions";
import type {
  CardInstanceId,
  CharacterUsageKey,
  GameState,
  PlayerId,
} from "../../../game/engine/types";
import {
  canPlayAgainstCurrentTableReference,
  canExecuteMainActionEffect,
  describeTableReferenceAssociation,
  formatList,
  getActivePlayer,
  getAlkaliRecoveryCards,
  getCardDefinition,
  getOpponentTargets,
  getPlayerName,
} from "../localGameView";

type ActionPanelProps = {
  game: GameState;
  selectedCardId?: CardInstanceId;
  onSelectCard: (cardInstanceId: CardInstanceId | undefined) => void;
  dispatchGameAction: (action: GameAction) => void;
};

type DrawSkillId = "extra_lesson" | "emergency_supply";

function CharacterSkillActions({
  game,
  activePlayer,
  dispatchGameAction,
}: {
  game: GameState;
  activePlayer: NonNullable<ReturnType<typeof getActivePlayer>>;
  dispatchGameAction: (action: GameAction) => void;
}) {
  const targets = getOpponentTargets(game, activePlayer.id);

  if (activePlayer.characterId === "caustic_soda_captain") {
    const used = Boolean(
      activePlayer.characterUsage.perCycle.caustic_soda_captain_alkali_recovery,
    );
    const cards = used ? [] : getAlkaliRecoveryCards(game, activePlayer);
    return (
      <div className="character-active-skill">
        <div>
          <strong>碱液回收</strong>
          <span>弃置一张实体强碱物质牌，回复 2 HP · 每周期一次</span>
        </div>
        <div className="candidate-grid">
          {cards.length > 0 ? cards.map((cardInstanceId) => (
            <button
              className="primary-button"
              key={cardInstanceId}
              onClick={() => dispatchGameAction({
                type: "ACTIVATE_CHARACTER_SKILL",
                playerId: activePlayer.id,
                skillId: "alkali_recovery",
                cardInstanceId,
              })}
              type="button"
            >
              使用 {getCardDefinition(game, cardInstanceId)?.name ?? cardInstanceId}
            </button>
          )) : (
            <button className="primary-button" disabled type="button">
              {used ? "本周期已用" : "当前不可发动"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (activePlayer.characterId === "sulfuric_acid_factory_director") {
    const used = Boolean(
      activePlayer.characterUsage.perCycle.sulfuric_acid_factory_director_exhaust_discharge,
    );
    return (
      <div className="character-active-skill">
        <div>
          <strong>排放尾气</strong>
          <span>使一名其他存活玩家获得 SO2_LEAK · 每周期一次</span>
        </div>
        <div className="candidate-grid">
          {targets.map((target) => (
            <button
              className="primary-button"
              disabled={used}
              key={target.id}
              onClick={() => dispatchGameAction({
                type: "ACTIVATE_CHARACTER_SKILL",
                playerId: activePlayer.id,
                skillId: "exhaust_discharge",
                targetPlayerId: target.id,
              })}
              type="button"
            >
              对 {target.name} 发动
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (activePlayer.characterId === "clumsy_party_secretary") {
    const used = Boolean(
      activePlayer.characterUsage.perCycle.clumsy_party_secretary_shared_active,
    );
    const skills = [
      ["exhaust_leak", "尾气泄漏"],
      ["lab_fire", "实验台起火"],
      ["exothermic_accident", "强放热事故"],
    ] as const;
    return (
      <div className="character-active-skill">
        <div>
          <strong>书记共享主动技能</strong>
          <span>三项技能共享每周期一次 · 当前：{used ? "已用" : "可用"}</span>
        </div>
        <div className="candidate-grid">
          {skills.map(([skillId, name]) => (
            <button
              className="primary-button"
              disabled={used || targets.length === 0}
              key={skillId}
              onClick={() => dispatchGameAction({
                type: "ACTIVATE_CHARACTER_SKILL",
                playerId: activePlayer.id,
                skillId,
              })}
              type="button"
            >
              发动{name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export function ActionPanel({
  game,
  selectedCardId,
  onSelectCard,
  dispatchGameAction,
}: ActionPanelProps) {
  const activePlayer = getActivePlayer(game);
  const targets = activePlayer ? getOpponentTargets(game, activePlayer.id) : [];
  const [targetByCardId, setTargetByCardId] = useState<Record<CardInstanceId, PlayerId>>({});
  const activeCharacterSkill: {
    id: DrawSkillId;
    name: string;
    usageKey: CharacterUsageKey;
  } | undefined = activePlayer?.characterId === "laboratory_teacher"
    ? {
        id: "extra_lesson",
        name: "补课",
        usageKey: "laboratory_teacher_extra_lesson",
      }
    : activePlayer?.characterId === "chemical_factory_ceo"
      ? {
          id: "emergency_supply",
          name: "紧急调货",
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
          <p className="debug-kicker">PLAY_CARD / PLAY_REFERENCE_CARD / PASS_ACTION</p>
          <h2 id="main-action-title">主行动</h2>
        </div>
        <button
          className="secondary-button"
          onClick={() => dispatchGameAction({ type: "PASS_ACTION", playerId: activePlayer.id })}
          type="button"
        >
          PASS_ACTION
        </button>
      </div>
      <p className="panel-note">当前行动玩家：{activePlayer.name}</p>
      {activeCharacterSkill ? (
        <div className="character-active-skill">
          <div>
            <strong>{activeCharacterSkill.name}</strong>
            <span>手牌不超过 4 张 · 每周期一次 · 发动后结束行动</span>
          </div>
          <button
            className="primary-button"
            disabled={
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
            发动{activeCharacterSkill.name}
          </button>
        </div>
      ) : null}
      <CharacterSkillActions
        activePlayer={activePlayer}
        dispatchGameAction={dispatchGameAction}
        game={game}
      />
      <p className="empty-note">普通出牌不需要目标，不触发原有效果，只更新场面基准并推进一次行动。</p>
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
                <strong>{definition?.name ?? "未知卡牌"}</strong>
                <span>
                  {definition?.type ?? "unknown"} · {cardInstanceId}
                </span>
                <span>标签：{formatList(definition?.tags ?? [])}</span>
                <span>时机：{formatList(definition?.allowedTimings ?? [])}</span>
                <span className={`association-line${canAssociate ? " is-allowed" : " is-blocked"}`}>
                  {associationLabel}
                </span>
              </div>
              {canExecute && !isOxygen ? (
                <label className="field-row compact-field">
                  <span>执行效果目标</span>
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
                        {getPlayerName(game, target.id)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="action-card__actions">
                {canExecute ? (
                  <button
                    className="primary-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      dispatchGameAction({
                        type: "PLAY_CARD",
                        playerId: activePlayer.id,
                        cardInstanceId,
                        targetPlayerId,
                      });
                    }}
                    type="button"
                  >
                    执行效果
                  </button>
                ) : null}
                {canAssociate ? (
                  <button
                    className="secondary-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      dispatchGameAction({
                        type: "PLAY_REFERENCE_CARD",
                        playerId: activePlayer.id,
                        cardInstanceId,
                      });
                    }}
                    type="button"
                  >
                    普通出牌
                  </button>
                ) : (
                  <button className="secondary-button" disabled type="button">
                    不可出牌
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
