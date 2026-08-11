import { useEffect, useMemo, useState } from "react";
import type { GameAction } from "../../../game/engine/actions";
import type { CardInstanceId, GameState, PlayerId } from "../../../game/engine/types";
import {
  cardDefinitionById,
  getActivePlayer,
  getAvailableComponentCards,
  getCardDefinition,
  getOpponentTargets,
  getPlayableDiyRecipes,
  getRecipeById,
  getRequiredComponentSlots,
} from "../localGameView";

type DiyPanelProps = {
  game: GameState;
  dispatchGameAction: (action: GameAction) => void;
};

export function DiyPanel({ game, dispatchGameAction }: DiyPanelProps) {
  const activePlayer = getActivePlayer(game);
  const recipes = getPlayableDiyRecipes();
  const [recipeId, setRecipeId] = useState(recipes[0]?.id);
  const recipe = getRecipeById(recipeId);
  const slots = useMemo(() => (recipe ? getRequiredComponentSlots(recipe) : []), [recipe]);
  const [componentIds, setComponentIds] = useState<Record<string, CardInstanceId>>({});
  const [targetPlayerId, setTargetPlayerId] = useState<PlayerId | undefined>();
  const targets = activePlayer ? getOpponentTargets(game, activePlayer.id) : [];
  const defaultTargetPlayerId = targets[0]?.id;

  useEffect(() => {
    setComponentIds({});
    setTargetPlayerId(recipe?.requiresTarget ? defaultTargetPlayerId : undefined);
  }, [defaultTargetPlayerId, recipe?.id, recipe?.requiresTarget]);

  if (game.phase !== "mainAction" || !activePlayer || !recipe) {
    return null;
  }

  const selectedComponentIds = slots
    .map((slot) => componentIds[slot.slotId])
    .filter((cardInstanceId): cardInstanceId is CardInstanceId => Boolean(cardInstanceId));
  const allComponentsSelected = selectedComponentIds.length === slots.length;
  const canSubmit =
    allComponentsSelected &&
    !activePlayer.usedDIYThisCycle &&
    (!recipe.requiresTarget || Boolean(targetPlayerId));

  return (
    <section className="debug-section diy-panel" aria-labelledby="diy-title">
      <div className="panel-heading">
        <div>
          <p className="debug-kicker">选择配方和组件后执行</p>
          <h2 id="diy-title">主动 DIY</h2>
        </div>
        <span className={activePlayer.usedDIYThisCycle ? "warn-pill" : "ok-pill"}>
          {activePlayer.usedDIYThisCycle ? "本周期已用" : "本周期可用"}
        </span>
      </div>
      <details className="debug-details"><summary>调试详情</summary><p>START_ACTIVE_DIY</p></details>
      <label className="field-row">
        <span>配方</span>
        <select value={recipe.id} onChange={(event) => setRecipeId(event.target.value)}>
          {recipes.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
      </label>
      <div className="recipe-list" aria-label="全部 MVP 0 主动 DIY 配方">
        {recipes.map((candidate) => (
          <button
            className={`recipe-chip${candidate.id === recipe.id ? " is-selected" : ""}`}
            key={candidate.id}
            onClick={() => setRecipeId(candidate.id)}
            type="button"
          >
            {candidate.name}
          </button>
        ))}
      </div>
      <div className="component-slots">
        {slots.map((slot) => {
          const selectedForOtherSlots = selectedComponentIds.filter(
            (cardInstanceId) => cardInstanceId !== componentIds[slot.slotId],
          );
          const options = getAvailableComponentCards(
            game,
            activePlayer,
            slot.definitionId,
            selectedForOtherSlots,
          );
          const definitionName = cardDefinitionById.get(slot.definitionId)?.name ?? slot.definitionId;

          return (
            <label className="field-row" key={slot.slotId}>
              <span>{slot.label}</span>
              <select
                onChange={(event) =>
                  setComponentIds((current) => ({
                    ...current,
                    [slot.slotId]: event.target.value,
                  }))
                }
                value={componentIds[slot.slotId] ?? ""}
              >
                <option value="">选择 {definitionName}</option>
                {options.map((cardInstanceId) => {
                  const cardDefinition = getCardDefinition(game, cardInstanceId);
                  return (
                    <option key={cardInstanceId} value={cardInstanceId}>
                      {cardDefinition?.name ?? "未知卡牌"}
                    </option>
                  );
                })}
              </select>
            </label>
          );
        })}
      </div>
      {recipe.requiresTarget ? (
        <label className="field-row">
          <span>DIY 目标</span>
          <select
            onChange={(event) => setTargetPlayerId(event.target.value)}
            value={targetPlayerId ?? ""}
          >
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="empty-note">此配方不需要选择目标。</p>
      )}
      <details className="debug-details">
        <summary>调试详情</summary>
        <p>targetPlayerId：{recipe.requiresTarget ? targetPlayerId ?? "未选择" : "未设置"}</p>
      </details>
      <button
        className="primary-button"
        disabled={!canSubmit}
        onClick={() =>
          dispatchGameAction({
            type: "START_ACTIVE_DIY",
            playerId: activePlayer.id,
            recipeId: recipe.id,
            componentCardInstanceIds: selectedComponentIds,
            targetPlayerId: recipe.requiresTarget ? targetPlayerId : undefined,
          })
        }
        type="button"
      >
        执行主动 DIY
      </button>
    </section>
  );
}
