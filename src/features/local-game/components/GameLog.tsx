import type { GameState } from "../../../game/engine/types";
import { useLocale } from "../../../app/locale";
import { getPublicReactionLogView } from "../localGameView";

type GameLogProps = {
  game: GameState;
};

export function GameLog({ game }: GameLogProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";

  return (
    <section className="debug-section game-log" aria-labelledby="game-log-title">
      <h2 id="game-log-title">{isEnglish ? "Full game log" : "完整游戏日志"}</h2>
      {isEnglish ? (
        <p className="panel-note">
          The formal game record currently remains in Simplified Chinese. This display layer does not translate log messages.
        </p>
      ) : null}
      <ol>
        {game.log.map((entry) => {
          const reaction = getPublicReactionLogView(game, entry, locale);

          return (
            <li key={entry.id}>
              <div className="game-log__message">
                {reaction ? (isEnglish ? "A successful reaction was recorded." : "已记录一项成功反应。") : entry.message}
                <details className="debug-details game-log__details">
                  <summary>{isEnglish ? "Debug details" : "调试详情"}</summary>
                  <span className="game-log__entry-id">{isEnglish ? "Log ID" : "日志编号"}：{entry.id}</span>
                  {reaction ? <span className="game-log__entry-id">{JSON.stringify(entry.reaction)}</span> : null}
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
