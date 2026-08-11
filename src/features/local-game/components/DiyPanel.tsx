import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../../../app/locale";
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
import {
  getCardDisplayName,
  getDiyRecipeDisplayName,
  getPlayerDisplayName,
} from "../presentationLocale";

type DiyPanelProps = {
  game: GameState;
  dispatchGameAction: (action: GameAction) => void;
};

export function DiyPanel({ game, dispatchGameAction }: DiyPanelProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
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
          <p className="debug-kicker">{isEnglish ? "Choose a recipe and components, then run it" : "选择配方和组件后执行"}</p>
          <h2 id="diy-title">{isEnglish ? "Active DIY" : "主动 DIY"}</h2>
        </div>
        <span className={activePlayer.usedDIYThisCycle ? "warn-pill" : "ok-pill"}>
          {activePlayer.usedDIYThisCycle ? (isEnglish ? "Used this cycle" : "本周期已用") : (isEnglish ? "Available this cycle" : "本周期可用")}
        </span>
      </div>
      <details className="debug-details"><summary>{isEnglish ? "Debug details" : "调试详情"}</summary><p>START_ACTIVE_DIY</p></details>
      <label className="field-row">
        <span>{isEnglish ? "Recipe" : "配方"}</span>
        <select value={recipe.id} onChange={(event) => setRecipeId(event.target.value)}>
          {recipes.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {getDiyRecipeDisplayName(candidate.id, candidate.name, locale)}
            </option>
          ))}
        </select>
      </label>
      <div className="recipe-list" aria-label={isEnglish ? "All MVP 0 active DIY recipes" : "全部 MVP 0 主动 DIY 配方"}>
        {recipes.map((candidate) => (
          <button
            className={`recipe-chip${candidate.id === recipe.id ? " is-selected" : ""}`}
            key={candidate.id}
            onClick={() => setRecipeId(candidate.id)}
            type="button"
          >
            {getDiyRecipeDisplayName(candidate.id, candidate.name, locale)}
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
          const definition = cardDefinitionById.get(slot.definitionId);
          const definitionName = definition
            ? getCardDisplayName(definition.id, definition.name, locale)
            : slot.definitionId;

          return (
            <label className="field-row" key={slot.slotId}>
              <span>{definitionName}</span>
              <select
                onChange={(event) =>
                  setComponentIds((current) => ({
                    ...current,
                    [slot.slotId]: event.target.value,
                  }))
                }
                value={componentIds[slot.slotId] ?? ""}
              >
                <option value="">{isEnglish ? "Select" : "选择"} {definitionName}</option>
                {options.map((cardInstanceId) => {
                  const cardDefinition = getCardDefinition(game, cardInstanceId);
                  return (
                    <option key={cardInstanceId} value={cardInstanceId}>
                      {cardDefinition
                        ? getCardDisplayName(cardDefinition.id, cardDefinition.name, locale)
                        : (isEnglish ? "Unknown card" : "未知卡牌")}
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
          <span>{isEnglish ? "DIY target" : "DIY 目标"}</span>
          <select
            onChange={(event) => setTargetPlayerId(event.target.value)}
            value={targetPlayerId ?? ""}
          >
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {getPlayerDisplayName(target, locale)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="empty-note">{isEnglish ? "This recipe does not require a target." : "此配方不需要选择目标。"}</p>
      )}
      <details className="debug-details">
        <summary>{isEnglish ? "Debug details" : "调试详情"}</summary>
        <p>targetPlayerId：{recipe.requiresTarget ? targetPlayerId ?? (isEnglish ? "not selected" : "未选择") : (isEnglish ? "not set" : "未设置")}</p>
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
        {isEnglish ? "Run active DIY" : "执行主动 DIY"}
      </button>
    </section>
  );
}
