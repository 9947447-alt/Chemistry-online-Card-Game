import "./local-game.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { FeedbackLink } from "../../app/feedback";
import { LocaleSwitch, useLocale } from "../../app/locale";
import { ProjectRepositoryLink } from "../../app/projectRepository";
import { releaseMetadata } from "../../app/releaseMetadata";
import type { GameAction } from "../../game/engine/actions";
import type { CardInstanceId } from "../../game/engine/types";
import type { NATBAPolicy } from "../../game/natba/types";
import type { RandomSource } from "../../shared/random";
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
import { NewPlayerGuidance } from "./components/NewPlayerGuidance";
import { PlayerPanel } from "./components/PlayerPanel";
import { PreparationPanel } from "./components/PreparationPanel";
import { ResponsePanel } from "./components/ResponsePanel";
import { StatusPanel } from "./components/StatusPanel";
import { SuccessfulReactionNotice } from "./components/SuccessfulReactionNotice";
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
  guidanceVisible: boolean;
  guidanceCollapsed: boolean;
  onGuidanceVisibleChange: (visible: boolean) => void;
  onGuidanceCollapsedChange: (collapsed: boolean) => void;
  onRequestSessionExit: (
    kind: SessionConfirmationKind,
    trigger: HTMLButtonElement,
  ) => void;
}>;

function PlayingGame({
  session,
  dispatch,
  guidanceVisible,
  guidanceCollapsed,
  onGuidanceVisibleChange,
  onGuidanceCollapsedChange,
  onRequestSessionExit,
}: PlayingGameProps) {
  const { game, error, playerControllers } = session;
  const { locale } = useLocale();
  const isEnglish = locale === "en";
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
        playerControllers={playerControllers}
        onRestart={(trigger) => onRequestSessionExit("restart", trigger)}
        onReturnToCharacterSelection={(trigger) => onRequestSessionExit("return", trigger)}
      />
      <SuccessfulReactionNotice game={game} />
      <div className="debug-layout">
        <div className="debug-main">
          <div className="players-grid">
            {game.players.map((player, index) => (
              <PlayerPanel
                controller={playerControllers[index as 0 | 1]}
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
        <aside className="debug-sidebar" aria-label={isEnglish ? "Action panels" : "操作面板"}>
          <NewPlayerGuidance
            collapsed={guidanceCollapsed}
            game={game}
            mode="playing"
            onCollapsedChange={onGuidanceCollapsedChange}
            onVisibleChange={onGuidanceVisibleChange}
            visible={guidanceVisible}
          />
          {game.phase === "preparationSelection" ? (
            <PreparationPanel
              dispatchGameAction={dispatchGameAction}
              game={game}
              playerControllers={playerControllers}
            />
          ) : game.phase === "experimentCounterattackWindow" ? (
            <ExperimentCounterattackPanel
              dispatchGameAction={dispatchGameAction}
              game={game}
              playerControllers={playerControllers}
            />
          ) : (
            <>
              <ActionPanel
                dispatchGameAction={dispatchGameAction}
                game={game}
                onSelectCard={setSelectedCardId}
                playerControllers={playerControllers}
                selectedCardId={selectedCardId}
              />
              <DiyPanel
                dispatchGameAction={dispatchGameAction}
                game={game}
                playerControllers={playerControllers}
              />
              <ResponsePanel
                dispatchGameAction={dispatchGameAction}
                game={game}
                playerControllers={playerControllers}
              />
              <StatusPanel
                dispatchGameAction={dispatchGameAction}
                game={game}
                playerControllers={playerControllers}
              />
            </>
          )}
          {game.phase === "gameOver" ? (
            <section className="debug-section">
              <h2>{isEnglish ? "Game over" : "对局结束"}</h2>
              <p className="panel-note">
                {isEnglish ? "Use the header to restart or return to character selection." : "可查看日志，或用顶部重开/返回角色选择。"}
              </p>
              <ProjectRepositoryLink />
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
  policy?: NATBAPolicy;
  aiDelayMs?: number;
  random?: RandomSource;
}>;

export function LocalGamePage({
  createGame,
  reduceGame,
  createSession,
  policy,
  aiDelayMs,
  random,
}: LocalGamePageProps = {}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const [session, dispatch] = useLocalGameDebug({
    createGame,
    reduceGame,
    createSession,
    policy,
    aiDelayMs,
    random,
  });
  const [aboutOpen, setAboutOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<PendingSessionConfirmation | null>(null);
  const [guidanceVisible, setGuidanceVisible] = useState(true);
  const [guidanceCollapsed, setGuidanceCollapsed] = useState(true);
  const aboutTriggerRef = useRef<HTMLButtonElement>(null);
  const confirmationExecutedRef = useRef(false);
  const playingPhase = session.mode === "playing" ? session.game.phase : session.mode;
  const modalOpen = aboutOpen || confirmation !== null;

  const restoreFocus = useCallback((target: HTMLElement | null) => {
    queueMicrotask(() => {
      if (target?.isConnected) target.focus();
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
    if (session.mode !== "playing") return;
    setAboutOpen(false);
    if (!requiresSessionExitConfirmation(session.game)) {
      dispatch({ type: kind === "restart" ? "RESTART_CURRENT_LINEUP" : "RETURN_TO_CHARACTER_SELECTION" });
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
    if (!confirmation || confirmationExecutedRef.current) return;
    confirmationExecutedRef.current = true;
    const { kind, trigger } = confirmation;
    setConfirmation(null);
    dispatch({ type: kind === "restart" ? "RESTART_CURRENT_LINEUP" : "RETURN_TO_CHARACTER_SELECTION" });
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
          <div className="release-bar__actions">
            <LocaleSwitch />
            <FeedbackLink />
            <button
              className="secondary-button"
              onClick={openAbout}
              ref={aboutTriggerRef}
              type="button"
            >
              {isEnglish ? "About & help" : "关于与帮助"}
            </button>
          </div>
        </header>

        {session.mode === "configuring" ? (
          <CharacterSelectionPanel
            dispatch={dispatch}
            guidanceCollapsed={guidanceCollapsed}
            guidanceVisible={guidanceVisible}
            onGuidanceCollapsedChange={setGuidanceCollapsed}
            onGuidanceVisibleChange={setGuidanceVisible}
            session={session}
          />
        ) : session.mode === "playing" ? (
          <PlayingGame
            dispatch={dispatch}
            guidanceCollapsed={guidanceCollapsed}
            guidanceVisible={guidanceVisible}
            onGuidanceCollapsedChange={setGuidanceCollapsed}
            onGuidanceVisibleChange={setGuidanceVisible}
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
