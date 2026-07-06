import type { GameState } from "../../../game/engine/types";

type GameLogProps = {
  game: GameState;
};

export function GameLog({ game }: GameLogProps) {
  return (
    <section className="debug-section game-log" aria-labelledby="game-log-title">
      <h2 id="game-log-title">完整游戏日志</h2>
      <ol>
        {game.log.map((entry) => (
          <li key={entry.id}>
            <span>{entry.id}</span>
            {entry.message}
          </li>
        ))}
      </ol>
    </section>
  );
}
