import "./local-game.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { FeedbackLink } from "../../app/feedback";
import { LocaleSwitch, useLocale } from "../../app/locale";
import { ProjectRepositoryLink } from "../../app/projectRepository";
import { releaseMetadata } from "../../app/releaseMetadata";
import type { GameAction } from "../../game/engine/actions";
import type { CardInstanceId, PlayerId } from "../../game/engine/types";
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
  const { game, error } = session;
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const [selectedCardId, setSelectedCardId] = useState<CardInstanceId | undefined>();
  const [diyMode, setDiyMode] = useState(false);
  const [diySelectedCardIds, setDiySelectedCardIds] = useState<readonly CardInstanceId[]>([]);
  const [diyTargetPlayerId, setDiyTargetPlayerId] = useState<PlayerId | undefined>();

  function resetDiyState() {
    setDiyMode(false);
    setDiySelectedCardIds([]);
    setDiyTargetPlayerId(undefined);
  }

  useEffect(() => {
    setSelectedCardId(undefined);
    resetDiyState();
  }, [session.revision]);

  useEffect(() => {
    if (game.phase !== "mainAction") {
      resetDiyState();
    }
  }, [game.phase, game.activePlayerId]);

  useEffect(() => {
    const activePlayer = game.players.find((p) => p.id === game.activePlayerId);
    if (!activePlayer) return;
    const handSet = new Set(activePlayer.hand);
    setDiySelectedCardIds((prev) => {
      const filtered = prev.filter((id) => handSet.has(id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [game]);

  function dispatchGameAction(action: GameAction) {
    dispatch({ type: "DISPATCH_GAME_ACTION", action });
    setSelectedCardId(undefined);
    resetDiyState();
  }

  const handleEnterDiyMode = () => {
    setSelectedCardId(undefined);
    setDiyMode(true);
    setDiySelectedCardIds([]);
    setDiyTargetPlayerId(undefined);
  };

  const handleToggleDiyCard = (cardInstanceId: CardInstanceId) => {
    setDiySelectedCardIds((prev) =>
      prev.includes(cardInstanceId)
        ? prev.filter((id) => id !== cardInstanceId)
        : [...prev, cardInstanceId],
    );
  };

  return (
    <main className="local-game-page">
      <GameSummary
        error={error ?? undefined}
        game={game}
        onRestart={(trigger) => onRequestSessionExit("restart", trigger)}
        onReturnToCharacterSelection={(trigger) => onRequestSessionExit("return", trigger)}
      />
      <SuccessfulReactionNotice game={game} />
      <div className="debug-layout">
        <div className="debug-main">
          <div className="players-grid">
            {game.players.map((player) => (
              <PlayerPanel
                diyMode={diyMode}
                diySelectedCardIds={diySelectedCardIds}
                game={game}
                handSelectionDisabled={game.phase !== "mainAction"}
                key={player.id}
                onSelectCard={setSelectedCardId}
                onToggleDiyCard={handleToggleDiyCard}
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
              <DiyPanel
                diyMode={diyMode}
                dispatchGameAction={dispatchGameAction}
                game={game}
                onCancelDiyMode={resetDiyState}
                onEnterDiyMode={handleEnterDiyMode}
                onTargetPlayerChange={setDiyTargetPlayerId}
                selectedCardIds={diySelectedCardIds}
                targetPlayerId={diyTargetPlayerId}
              />
              <ResponsePanel dispatchGameAction={dispatchGameAction} game={game} />
              <StatusPanel dispatchGameAction={dispatchGameAction} game={game} />
            </>
          )}
          {game.phase === "gameOver" ? (
            <section className="debug-section">
              <h2>{isEnglish ? "Game over" : "对局结束"}</h2>
              <p className="panel-note">
                {isEnglish ? "Review the full log, or use the header to restart with the current lineup or return to character selection." : "可以查看完整日志，或使用顶部“按当前阵容重开”“返回角色选择”。"}
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
}>;

export function LocalGamePage({
  createGame,
  reduceGame,
  createSession,
}: LocalGamePageProps = {}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const [session, dispatch] = useLocalGameDebug(createGame, reduceGame, createSession);
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
