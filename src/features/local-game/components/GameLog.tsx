import type { GameState } from "../../../game/engine/types";
import { getReactionLogView } from "../localGameView";

type GameLogProps = {
  game: GameState;
};

export function GameLog({ game }: GameLogProps) {
  return (
    <section className="debug-section game-log" aria-labelledby="game-log-title">
      <h2 id="game-log-title">完整游戏日志</h2>
      <ol>
        {game.log.map((entry) => {
          const reaction = getReactionLogView(game, entry);

          return (
            <li key={entry.id}>
              <div className="game-log__message">
                <span className="game-log__entry-id">{entry.id}</span>
                {entry.message}
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
