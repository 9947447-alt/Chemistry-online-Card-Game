import "./local-game.css";
import { useState } from "react";
import type { GameAction } from "../../game/engine/actions";
import type { CardInstanceId } from "../../game/engine/types";
import { ActionPanel } from "./components/ActionPanel";
import { CharacterSelectionPanel } from "./components/CharacterSelectionPanel";
import { DiyPanel } from "./components/DiyPanel";
import { GameLog } from "./components/GameLog";
import { GameSummary } from "./components/GameSummary";
import { PlayerPanel } from "./components/PlayerPanel";
import { PreparationPanel } from "./components/PreparationPanel";
import { ResponsePanel } from "./components/ResponsePanel";
import { ExperimentCounterattackPanel } from "./components/ExperimentCounterattackPanel";
import { StatusPanel } from "./components/StatusPanel";
import { useLocalGameDebug } from "./hooks/useLocalGameDebug";
import type {
  LocalGameSessionAction,
  PlayingLocalGameSession,
} from "./localGameSession";

type PlayingGameProps = {
  session: PlayingLocalGameSession;
  dispatch: (action: LocalGameSessionAction) => void;
};

function PlayingGame({ session, dispatch }: PlayingGameProps) {
  const { game, error } = session;
  const [selectedCardId, setSelectedCardId] = useState<CardInstanceId | undefined>();

  function dispatchGameAction(action: GameAction) {
    dispatch({ type: "DISPATCH_GAME_ACTION", action });
    setSelectedCardId(undefined);
  }

  return (
    <main className="local-game-page">
      <GameSummary
        error={error ?? undefined}
        game={game}
        onRestart={() => dispatch({ type: "RESTART_CURRENT_LINEUP" })}
        onReturnToCharacterSelection={() => dispatch({ type: "RETURN_TO_CHARACTER_SELECTION" })}
      />
      <div className="debug-layout">
        <div className="debug-main">
          <div className="players-grid">
            {game.players.map((player) => (
              <PlayerPanel
                game={game}
                handSelectionDisabled={game.phase !== "mainAction"}
                key={player.id}
                onSelectCard={setSelectedCardId}
                player={player}
                selectedCardId={selectedCardId}
                showActivePlayerIndicator={game.phase !== "preparationSelection"}
              />
            ))}
          </div>
          <GameLog game={game} />
        </div>
        <aside className="debug-sidebar" aria-label="操作面板">
          {game.phase === "preparationSelection" ? (
            <PreparationPanel dispatchGameAction={dispatchGameAction} game={game} />
          ) : game.phase === "experimentCounterattackWindow" ? (
            <ExperimentCounterattackPanel
              dispatchGameAction={dispatchGameAction}
              game={game}
            />
          ) : (
            <>
              <ActionPanel
                dispatchGameAction={dispatchGameAction}
                game={game}
                onSelectCard={setSelectedCardId}
                selectedCardId={selectedCardId}
              />
              <DiyPanel dispatchGameAction={dispatchGameAction} game={game} />
              <ResponsePanel dispatchGameAction={dispatchGameAction} game={game} />
              <StatusPanel dispatchGameAction={dispatchGameAction} game={game} />
            </>
          )}
          {game.phase === "gameOver" ? (
            <section className="debug-section">
              <h2>对局结束</h2>
              <p className="panel-note">
                可以查看完整日志，或使用顶部“按当前阵容重开”“返回角色选择”。
              </p>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

export function LocalGamePage() {
  const [session, dispatch] = useLocalGameDebug();

  if (session.mode === "configuring") {
    return <CharacterSelectionPanel dispatch={dispatch} session={session} />;
  }

  return (
    <PlayingGame
      dispatch={dispatch}
      key={session.revision}
      session={session}
    />
  );
}
