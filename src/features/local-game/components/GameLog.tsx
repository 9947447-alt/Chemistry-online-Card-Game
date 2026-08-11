import type { GameState } from "../../../game/engine/types";
import { getPublicReactionLogView } from "../localGameView";

type GameLogProps = {
  game: GameState;
};

export function GameLog({ game }: GameLogProps) {
  return (
    <section className="debug-section game-log" aria-labelledby="game-log-title">
      <h2 id="game-log-title">完整游戏日志</h2>
      <ol>
        {game.log.map((entry) => {
          const reaction = getPublicReactionLogView(game, entry);

          return (
            <li key={entry.id}>
              <div className="game-log__message">
                {reaction ? "已记录一项成功反应。" : entry.message}
                <details className="debug-details game-log__details">
                  <summary>调试详情</summary>
                  <span className="game-log__entry-id">日志编号：{entry.id}</span>
                  {reaction ? <span className="game-log__entry-id">{JSON.stringify(entry.reaction)}</span> : null}
                </details>
              </div>
              {reaction ? (
                <div className="game-log__reaction" aria-label={`成功反应：${reaction.name}`}>
                  <strong>成功反应 · {reaction.name}</strong>
                  <span>入口：{reaction.trigger}</span>
                  {reaction.participants.map((participant) => (
                    <span key={participant}>{participant}</span>
                  ))}
                  <span>结果：{reaction.outcome}</span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
