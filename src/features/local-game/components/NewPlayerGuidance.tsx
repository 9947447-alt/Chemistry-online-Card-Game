import { useEffect, useRef } from "react";
import { useLocale } from "../../../app/locale";
import type { GameState } from "../../../game/engine/types";
import {
  getConfiguringGuidance,
  getPlayingGuidance,
} from "../newPlayerGuidance";

type NewPlayerGuidanceProps = Readonly<{
  game?: GameState;
  mode: "configuring" | "playing";
  visible: boolean;
  collapsed: boolean;
  onVisibleChange: (visible: boolean) => void;
  onCollapsedChange: (collapsed: boolean) => void;
}>;

export function NewPlayerGuidance({
  game,
  mode,
  visible,
  collapsed,
  onVisibleChange,
  onCollapsedChange,
}: NewPlayerGuidanceProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const showControlRef = useRef<HTMLButtonElement>(null);
  const collapseControlRef = useRef<HTMLButtonElement>(null);
  const previousVisibleRef = useRef(visible);
  const previousCollapsedRef = useRef(collapsed);
  const guidance = mode === "configuring"
    ? getConfiguringGuidance(locale)
    : game
      ? getPlayingGuidance(game, locale)
      : undefined;

  useEffect(() => {
    if (previousVisibleRef.current && !visible) {
      showControlRef.current?.focus();
    }
    if (!previousVisibleRef.current && visible) {
      collapseControlRef.current?.focus();
    }
    previousVisibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (previousCollapsedRef.current !== collapsed) {
      collapseControlRef.current?.focus();
    }
    previousCollapsedRef.current = collapsed;
  }, [collapsed]);

  if (!guidance) {
    return null;
  }

  if (!visible) {
    return (
      <section className="new-player-guidance new-player-guidance--hidden" aria-label={isEnglish ? "New player guidance" : "新手引导"}>
        <p className="new-player-guidance__goal">
          <strong>{isEnglish ? "Current goal: " : "当前目标："}</strong>
          {guidance.goal}
        </p>
        <button
          className="secondary-button new-player-guidance__show"
          onClick={() => onVisibleChange(true)}
          ref={showControlRef}
          type="button"
        >
          {isEnglish ? "Show new player guidance again" : "重新显示新手引导"}
        </button>
      </section>
    );
  }

  const contentId = `new-player-guidance-${guidance.phase}`;

  return (
    <section className="debug-section new-player-guidance" aria-labelledby={`${contentId}-title`}>
      <div className="panel-heading new-player-guidance__heading">
        <div>
          <p className="debug-kicker">{isEnglish ? "First-game guidance · Current phase" : "首局提示 · 当前阶段"}</p>
          <h2 id={`${contentId}-title`}>{isEnglish ? "New player guidance: " : "新手引导："}{guidance.title}</h2>
        </div>
        <button
          aria-controls={contentId}
          aria-expanded={!collapsed}
          className="secondary-button"
          onClick={() => onCollapsedChange(!collapsed)}
          ref={collapseControlRef}
          type="button"
        >
          {collapsed ? (isEnglish ? "Expand guidance" : "展开新手引导") : (isEnglish ? "Collapse guidance" : "折叠新手引导")}
        </button>
      </div>
      <p className="new-player-guidance__goal">
        <strong>{isEnglish ? "Current goal: " : "当前目标："}</strong>
        {guidance.goal}
      </p>
      {!collapsed ? (
        <div className="new-player-guidance__content" id={contentId}>
          <p className="new-player-guidance__actor">{guidance.actor}</p>
          <dl className="new-player-guidance__facts">
            {([
              [isEnglish ? "Action entry" : "操作入口", guidance.entry],
              [isEnglish ? "Concept" : "相关概念", guidance.concept],
            ] as const).map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          <p className="panel-note">{isEnglish ? "For complete rules guidance, use About & help in the header." : "需要完整规则说明时，请使用页面顶部“关于与帮助”。"}</p>
          <button
            className="secondary-button new-player-guidance__skip"
            onClick={() => onVisibleChange(false)}
            type="button"
          >
            {isEnglish ? "Hide new player guidance" : "跳过新手引导"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
