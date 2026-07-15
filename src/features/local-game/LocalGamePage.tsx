import "./local-game.css";
import { useState } from "react";
import type { GameAction } from "../../game/engine/actions";
import type { CardInstanceId } from "../../game/engine/types";
import { ActionPanel } from "./components/ActionPanel";
import { DiyPanel } from "./components/DiyPanel";
import { GameLog } from "./components/GameLog";
import { GameSummary } from "./components/GameSummary";
import { PlayerPanel } from "./components/PlayerPanel";
import { PreparationPanel } from "./components/PreparationPanel";
import { ResponsePanel } from "./components/ResponsePanel";
import { StatusPanel } from "./components/StatusPanel";
import { useLocalGameDebug } from "./hooks/useLocalGameDebug";

export function LocalGamePage() {
  const [{ game, error }, dispatch] = useLocalGameDebug();
  const [selectedCardId, setSelectedCardId] = useState<CardInstanceId | undefined>();

  function dispatchGameAction(action: GameAction) {
    dispatch(action);
    setSelectedCardId(undefined);
  }

  return (
    <main className="local-game-page">
      <GameSummary game={game} error={error} onReset={() => dispatch({ type: "RESET_GAME" })} />
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
              <p className="panel-note">可以查看完整日志，或点击顶部“重开”。</p>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
