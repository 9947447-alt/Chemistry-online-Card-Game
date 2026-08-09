import { useEffect, useRef } from "react";
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
  const showControlRef = useRef<HTMLButtonElement>(null);
  const collapseControlRef = useRef<HTMLButtonElement>(null);
  const previousVisibleRef = useRef(visible);
  const previousCollapsedRef = useRef(collapsed);
  const guidance = mode === "configuring"
    ? getConfiguringGuidance()
    : game
      ? getPlayingGuidance(game)
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
      <section className="new-player-guidance new-player-guidance--hidden" aria-label="新手引导">
        <button
          className="secondary-button new-player-guidance__show"
          onClick={() => onVisibleChange(true)}
          ref={showControlRef}
          type="button"
        >
          重新显示新手引导
        </button>
      </section>
    );
  }

  const contentId = `new-player-guidance-${guidance.phase}`;

  return (
    <section className="debug-section new-player-guidance" aria-labelledby={`${contentId}-title`}>
      <div className="panel-heading new-player-guidance__heading">
        <div>
          <p className="debug-kicker">首局提示 · 当前阶段</p>
          <h2 id={`${contentId}-title`}>新手引导：{guidance.title}</h2>
        </div>
        <button
          aria-controls={contentId}
          aria-expanded={!collapsed}
          className="secondary-button"
          onClick={() => onCollapsedChange(!collapsed)}
          ref={collapseControlRef}
          type="button"
        >
          {collapsed ? "展开新手引导" : "折叠新手引导"}
        </button>
      </div>
      {!collapsed ? (
        <div className="new-player-guidance__content" id={contentId}>
          <p className="new-player-guidance__actor">{guidance.actor}</p>
          <dl className="new-player-guidance__facts">
            <div><dt>本阶段目标</dt><dd>{guidance.goal}</dd></div>
            <div><dt>操作入口</dt><dd>{guidance.entry}</dd></div>
            <div><dt>相关概念</dt><dd>{guidance.concept}</dd></div>
          </dl>
          <p className="panel-note">需要完整规则说明时，请使用页面顶部“关于与帮助”。</p>
          <button
            className="secondary-button new-player-guidance__skip"
            onClick={() => onVisibleChange(false)}
            type="button"
          >
            跳过新手引导
          </button>
        </div>
      ) : null}
    </section>
  );
}
