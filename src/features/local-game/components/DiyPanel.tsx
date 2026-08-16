import { useLocale } from "../../../app/locale";
import type { GameAction } from "../../../game/engine/actions";
import { analyzeDIYSelection } from "../../../game/engine/diy";
import type { CardInstanceId, GameState, PlayerId } from "../../../game/engine/types";
import { getActivePlayer, getOpponentTargets } from "../localGameView";
import {
  getDiyBlockerDisplayName,
  getDiyOutcomeDescription,
  getDiyRecipeDisplayName,
  getPlayerDisplayName,
} from "../presentationLocale";

export type DiyPanelProps = {
  game: GameState;
  dispatchGameAction: (action: GameAction) => void;
  diyMode: boolean;
  onEnterDiyMode: () => void;
  onCancelDiyMode: () => void;
  selectedCardIds: readonly CardInstanceId[];
  targetPlayerId: PlayerId | undefined;
  onTargetPlayerChange: (targetPlayerId: PlayerId | undefined) => void;
};

export function DiyPanel({
  game,
  dispatchGameAction,
  diyMode,
  onEnterDiyMode,
  onCancelDiyMode,
  selectedCardIds,
  targetPlayerId,
  onTargetPlayerChange,
}: DiyPanelProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const activePlayer = getActivePlayer(game);

  if (game.phase !== "mainAction" || !activePlayer) {
    return null;
  }

  const t = (en: string, zh: string) => (isEnglish ? en : zh);
  const targets = getOpponentTargets(game, activePlayer.id);

  const analysis = analyzeDIYSelection(
    game,
    activePlayer.id,
    selectedCardIds,
    targetPlayerId,
  );

  const canExecute = analysis.status === "EXECUTABLE";
  const needsTargetSelect =
    (analysis.status === "MATCHED_NOT_EXECUTABLE" &&
      (analysis.blockerCode === "TARGET_PLAYER_REQUIRED" ||
        analysis.blockerCode === "TARGET_PLAYER_INVALID")) ||
    (analysis.status === "EXECUTABLE" && "targetPlayerId" in analysis.outcome);

  return (
    <section className="debug-section diy-panel" aria-labelledby="diy-title">
      <div className="panel-heading">
        <div>
          <p className="debug-kicker">
            {diyMode
              ? t("Select component cards directly from hand", "直接在手牌中多选组件卡牌")
              : t("Enter DIY mode to select component cards from hand", "进入选牌模式后直接在手牌中选择")}
          </p>
          <h2 id="diy-title">{t("Active DIY", "主动 DIY")}</h2>
        </div>
        <span className={activePlayer.usedDIYThisCycle ? "warn-pill" : "ok-pill"}>
          {activePlayer.usedDIYThisCycle
            ? t("Used this cycle", "本周期已用")
            : t("Available this cycle", "本周期可用")}
        </span>
      </div>

      <details className="debug-details">
        <summary>{t("Debug details", "调试详情")}</summary>
        <p>PLAY_DIY_SELECTION</p>
        <p>diyMode: {diyMode ? "true" : "false"}</p>
        <p>status: {analysis.status}</p>
        {"recipeId" in analysis ? <p>recipeId: {analysis.recipeId}</p> : null}
        {"blockerCode" in analysis ? <p>blockerCode: {analysis.blockerCode}</p> : null}
        <p>selectedCount: {selectedCardIds.length}</p>
        <p>targetPlayerId: {targetPlayerId ?? t("not selected", "未选择")}</p>
      </details>

      {!diyMode ? (
        <div className="diy-entry-controls">
          <p className="panel-note">
            {t("Click below to enter DIY Selection mode and select cards from your hand.", "点击下方按钮进入 DIY 选牌模式，直接在手牌中多选组件卡牌。")}
          </p>
          <button
            className="secondary-button"
            onClick={onEnterDiyMode}
            type="button"
          >
            {t("Enter DIY Selection", "进入 DIY 选牌")}
          </button>
        </div>
      ) : (
        <>
          <div className="diy-controls-bar">
            <button
              className="secondary-button"
              onClick={onCancelDiyMode}
              type="button"
            >
              {t("Cancel / Exit DIY", "取消 / 退出 DIY 选牌")}
            </button>
            <span className="selection-count">
              {isEnglish
                ? `${selectedCardIds.length} card(s) selected`
                : `已选 ${selectedCardIds.length} 张组件`}
            </span>
          </div>

          <div className="diy-preview-area" aria-label={t("DIY Preview", "DIY 预览")}>
            {analysis.status === "INVALID_SELECTION" ? (
              <div className="diy-preview is-invalid">
                <strong>{t("Invalid Selection", "非法选择")}</strong>
                <p>{t("Selection contains invalid or non-component cards.", "所选卡牌包含无效卡牌或非组件卡牌。")}</p>
              </div>
            ) : analysis.status === "NO_RECIPE_MATCH" ? (
              <div className="diy-preview is-no-match">
                <strong>
                  {selectedCardIds.length === 0
                    ? t("No Cards Selected", "尚未选择材料")
                    : t("No Recipe Match", "未匹配到配方")}
                </strong>
                <p>
                  {selectedCardIds.length === 0
                    ? t(
                        "Click component cards in your hand (e.g. H+, OH-, Cl-, C, O) to form a DIY recipe.",
                        "请在当前手牌中点击组件牌（如 H+、OH-、Cl-、C、O 等）以匹配 DIY 配方。",
                      )
                    : t(
                        "Current card combination does not match any valid DIY recipe.",
                        "当前所选手牌组合未匹配任何有效 DIY 配方。",
                      )}
                </p>
              </div>
            ) : (
              <div className={`diy-preview ${analysis.status === "EXECUTABLE" ? "is-executable" : "is-blocked"}`}>
                <div className="diy-recipe-name">
                  <strong>{getDiyRecipeDisplayName(analysis.recipeId, analysis.recipeId, locale)}</strong>
                </div>
                {analysis.status === "EXECUTABLE" ? (
                  <p className="diy-outcome-preview">
                    {getDiyOutcomeDescription(analysis.recipeId, analysis.outcome, locale, game.logPresentationContext)}
                  </p>
                ) : (
                  <p className="diy-blocker-note">
                    {getDiyBlockerDisplayName(analysis.blockerCode, locale)}
                  </p>
                )}
              </div>
            )}
          </div>

          {needsTargetSelect ? (
            <label className="field-row">
              <span>{t("DIY target", "DIY 目标")}</span>
              <select
                onChange={(event) =>
                  onTargetPlayerChange(
                    event.target.value ? (event.target.value as PlayerId) : undefined,
                  )
                }
                value={targetPlayerId ?? ""}
              >
                <option value="">{t("Select target", "请选择目标")}</option>
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {getPlayerDisplayName(target, locale)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {analysis.status === "MATCHED_NOT_EXECUTABLE" &&
          analysis.blockerCode === "UNEXPECTED_TARGET" ? (
            <p className="empty-note">
              {t("This recipe does not require a target.", "此配方不需要选择目标。")}
            </p>
          ) : null}

          <button
            className="primary-button diy-execute-button"
            disabled={!canExecute}
            onClick={() => {
              if (analysis.status === "EXECUTABLE") {
                dispatchGameAction({
                  type: "PLAY_DIY_SELECTION",
                  playerId: activePlayer.id,
                  componentCardInstanceIds: [...selectedCardIds],
                  targetPlayerId:
                    "targetPlayerId" in analysis.outcome
                      ? analysis.outcome.targetPlayerId
                      : undefined,
                });
              }
            }}
            type="button"
          >
            {t("Play DIY", "执行 DIY")}
          </button>
        </>
      )}
    </section>
  );
}
