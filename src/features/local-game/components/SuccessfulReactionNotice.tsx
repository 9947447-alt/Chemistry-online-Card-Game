import { useEffect, useRef, useState } from "react";
import { useLocale } from "../../../app/locale";
import type { GameState } from "../../../game/engine/types";
import { getPublicReactionLogView } from "../localGameView";

type SuccessfulReactionNoticeProps = Readonly<{
  game: GameState;
}>;

const successfulReactionNoticeDurationMs = 2000;

export function SuccessfulReactionNotice({ game }: SuccessfulReactionNoticeProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const [activeEntry, setActiveEntry] = useState<GameState["log"][number] | null>(null);
  const previousLogRef = useRef<GameState["log"] | null>(null);
  const lastObservedReactionEntryRef = useRef<GameState["log"][number] | null>(null);

  useEffect(() => {
    const prev = previousLogRef.current;
    const latest = [...game.log].reverse().find((e) => e.reaction) ?? null;
    previousLogRef.current = game.log;

    if (!prev || prev.length > game.log.length || !prev.every((e, i) => game.log[i] === e)) {
      lastObservedReactionEntryRef.current = latest;
      setActiveEntry(null);
      return;
    }
    if (!latest || lastObservedReactionEntryRef.current === latest) return;
    lastObservedReactionEntryRef.current = latest;
    setActiveEntry(latest);
  }, [game.log]);

  useEffect(() => {
    if (!activeEntry) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setActiveEntry(null);
    }, successfulReactionNoticeDurationMs);

    return () => window.clearTimeout(timer);
  }, [activeEntry]);

  const currentActiveEntry = activeEntry
    ? game.log.find((entry) => entry === activeEntry && entry.reaction)
    : undefined;
  const reaction = currentActiveEntry
    ? getPublicReactionLogView(game, currentActiveEntry, locale, game.logPresentationContext)
    : undefined;

  if (!reaction) {
    return null;
  }

  return (
    <section
      aria-atomic="true"
      aria-live="polite"
      className="successful-reaction-notice"
      role="status"
    >
      <strong>
        {isEnglish ? "Successful reaction" : "成功反应"} · {reaction.name}
      </strong>
      <span>{reaction.outcome}</span>
    </section>
  );
}
