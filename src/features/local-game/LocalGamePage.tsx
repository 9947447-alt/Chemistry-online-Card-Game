import "./local-game.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { releaseMetadata } from "../../app/releaseMetadata";
import type { GameAction } from "../../game/engine/actions";
import type { CardInstanceId } from "../../game/engine/types";
import { ActionPanel } from "./components/ActionPanel";
import { AboutDialog } from "./components/AboutDialog";
import { CharacterSelectionPanel } from "./components/CharacterSelectionPanel";
import {
  ConfirmationDialog,
  type SessionConfirmationKind,
} from "./components/ConfirmationDialog";
import { DiyPanel } from "./components/DiyPanel";
import { ExperimentCounterattackPanel } from "./components/ExperimentCounterattackPanel";
import { FatalSessionPage } from "./components/FatalSessionPage";
import { GameLog } from "./components/GameLog";
import { GameSummary } from "./components/GameSummary";
import { PlayerPanel } from "./components/PlayerPanel";
import { PreparationPanel } from "./components/PreparationPanel";
import { ResponsePanel } from "./components/ResponsePanel";
import { StatusPanel } from "./components/StatusPanel";
import { useLocalGameDebug } from "./hooks/useLocalGameDebug";
import type {
  LocalGameEngineReducer,
  LocalGameFactory,
  LocalGameSessionCommand,
  LocalGameSessionInitializer,
  PlayingLocalGameSession,
} from "./localGameSession";
import { requiresSessionExitConfirmation } from "./sessionConfirmation";

type PlayingGameProps = Readonly<{
  session: PlayingLocalGameSession;
  dispatch: (command: LocalGameSessionCommand) => void;
  onRequestSessionExit: (
    kind: SessionConfirmationKind,
    trigger: HTMLButtonElement,
  ) => void;
}>;

function PlayingGame({ session, dispatch, onRequestSessionExit }: PlayingGameProps) {
  const { game, error } = session;
  const [selectedCardId, setSelectedCardId] = useState<CardInstanceId | undefined>();

  useEffect(() => {
    setSelectedCardId(undefined);
  }, [session.revision]);

  function dispatchGameAction(action: GameAction) {
    dispatch({ type: "DISPATCH_GAME_ACTION", action });
    setSelectedCardId(undefined);
  }

  return (
    <main className="local-game-page">
      <GameSummary
        error={error ?? undefined}
        game={game}
        onRestart={(trigger) => onRequestSessionExit("restart", trigger)}
        onReturnToCharacterSelection={(trigger) => onRequestSessionExit("return", trigger)}
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

type PendingSessionConfirmation = Readonly<{
  kind: SessionConfirmationKind;
  trigger: HTMLButtonElement;
}>;

export type LocalGamePageProps = Readonly<{
  createGame?: LocalGameFactory;
  reduceGame?: LocalGameEngineReducer;
  createSession?: LocalGameSessionInitializer;
}>;

export function LocalGamePage({
  createGame,
  reduceGame,
  createSession,
}: LocalGamePageProps = {}) {
  const [session, dispatch] = useLocalGameDebug(createGame, reduceGame, createSession);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<PendingSessionConfirmation | null>(null);
  const aboutTriggerRef = useRef<HTMLButtonElement>(null);
  const confirmationExecutedRef = useRef(false);
  const playingPhase = session.mode === "playing" ? session.game.phase : session.mode;
  const modalOpen = aboutOpen || confirmation !== null;

  const restoreFocus = useCallback((target: HTMLElement | null) => {
    queueMicrotask(() => {
      if (target?.isConnected) {
        target.focus();
      }
    });
  }, []);

  const closeAbout = useCallback(() => {
    setAboutOpen(false);
    restoreFocus(aboutTriggerRef.current);
  }, [restoreFocus]);

  const openAbout = useCallback(() => {
    confirmationExecutedRef.current = false;
    setConfirmation(null);
    setAboutOpen(true);
  }, []);

  const requestSessionExit = useCallback((
    kind: SessionConfirmationKind,
    trigger: HTMLButtonElement,
  ) => {
    if (session.mode !== "playing") {
      return;
    }

    setAboutOpen(false);
    if (!requiresSessionExitConfirmation(session.game)) {
      dispatch({
        type: kind === "restart"
          ? "RESTART_CURRENT_LINEUP"
          : "RETURN_TO_CHARACTER_SELECTION",
      });
      return;
    }

    confirmationExecutedRef.current = false;
    setConfirmation({ kind, trigger });
  }, [dispatch, session]);

  const cancelConfirmation = useCallback(() => {
    const trigger = confirmation?.trigger ?? null;
    confirmationExecutedRef.current = false;
    setConfirmation(null);
    restoreFocus(trigger);
  }, [confirmation, restoreFocus]);

  const confirmSessionExit = useCallback(() => {
    if (!confirmation || confirmationExecutedRef.current) {
      return;
    }

    confirmationExecutedRef.current = true;
    const { kind, trigger } = confirmation;
    setConfirmation(null);
    dispatch({
      type: kind === "restart"
        ? "RESTART_CURRENT_LINEUP"
        : "RETURN_TO_CHARACTER_SELECTION",
    });
    restoreFocus(trigger);
  }, [confirmation, dispatch, restoreFocus]);

  useEffect(() => {
    confirmationExecutedRef.current = false;
    setConfirmation(null);
    setAboutOpen(false);
  }, [playingPhase, session.mode, session.revision]);

  return (
    <>
      <div
        aria-hidden={modalOpen ? "true" : undefined}
        className="application-shell"
        inert={modalOpen}
      >
        <header className="release-bar">
          <div>
            <strong>
              {releaseMetadata.displayName}
              {session.mode === "configuring" ? (
                <span className="secondary-brand">{releaseMetadata.secondaryName}</span>
              ) : null}
            </strong>
            <span>
              {releaseMetadata.channel} · v{releaseMetadata.version} · {releaseMetadata.rulesVersion}
            </span>
          </div>
          <button
            className="secondary-button"
            onClick={openAbout}
            ref={aboutTriggerRef}
            type="button"
          >
            关于与帮助
          </button>
        </header>

        {session.mode === "configuring" ? (
          <CharacterSelectionPanel dispatch={dispatch} session={session} />
        ) : session.mode === "playing" ? (
          <PlayingGame
            dispatch={dispatch}
            onRequestSessionExit={requestSessionExit}
            session={session}
          />
        ) : (
          <FatalSessionPage dispatch={dispatch} session={session} />
        )}
      </div>

      {aboutOpen ? (
        <AboutDialog onClose={closeAbout} />
      ) : confirmation ? (
        <ConfirmationDialog
          kind={confirmation.kind}
          onCancel={cancelConfirmation}
          onConfirm={confirmSessionExit}
        />
      ) : null}
    </>
  );
}
