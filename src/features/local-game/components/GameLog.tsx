import type { GameState } from "../../../game/engine/types";
import { useLocale } from "../../../app/locale";
import { getPublicReactionLogView } from "../localGameView";
import { renderGameLogEntry } from "../gameLogRenderer";

type GameLogProps = {
  game: GameState;
};

export function GameLog({ game }: GameLogProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const context = game.logPresentationContext;

  return (
    <section className="debug-section game-log" aria-labelledby="game-log-title">
      <h2 id="game-log-title">{isEnglish ? "Full game log" : "完整游戏日志"}</h2>
      <ol>
        {game.log.map((entry) => {
          const reaction = getPublicReactionLogView(game, entry, locale, context);

          return (
            <li key={entry.id}>
              <div className="game-log__message">
                {renderGameLogEntry(entry, locale, context)}
                <details className="debug-details game-log__details">
                  <summary>{isEnglish ? "Debug details" : "调试详情"}</summary>
                  <span className="game-log__entry-id">{entry.id}</span>
                </details>
              </div>
              {reaction ? (
                <div className="game-log__reaction" aria-label={`${isEnglish ? "Successful reaction" : "成功反应"}：${reaction.name}`}>
                  <strong>{isEnglish ? "Successful reaction" : "成功反应"} · {reaction.name}</strong>
                  <span>{isEnglish ? "Entry" : "入口"}：{reaction.trigger}</span>
                  {reaction.participants.map((participant) => (
                    <span key={participant}>{participant}</span>
                  ))}
                  <span>{isEnglish ? "Result" : "结果"}：{reaction.outcome}</span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
