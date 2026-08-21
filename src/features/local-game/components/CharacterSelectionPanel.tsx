import { characterDefinitions, getCharacterDefinition } from "../../../game/data/characterDefinitions";
import { useLocale } from "../../../app/locale";
import type { CharacterId } from "../../../game/engine/types";
import {
  formatSkillDebugText,
  getPublicCharacterSkills,
} from "../characterPresentation";
import {
  isCharacterSelection,
  type ConfiguringLocalGameSession,
  type LocalGameSessionCommand,
} from "../localGameSession";
import { NewPlayerGuidance } from "./NewPlayerGuidance";
import { getCharacterDisplayName, getPlayerControllerDisplayName } from "../presentationLocale";
import { FirstGameExample } from "./FirstGameExample";

type CharacterSelectionPanelProps = {
  session: ConfiguringLocalGameSession;
  dispatch: (command: LocalGameSessionCommand) => void;
  guidanceVisible: boolean;
  guidanceCollapsed: boolean;
  onGuidanceVisibleChange: (visible: boolean) => void;
  onGuidanceCollapsedChange: (collapsed: boolean) => void;
};

export function CharacterSkillList({
  character,
  locale,
}: {
  character: ReturnType<typeof getCharacterDefinition>;
  locale: ReturnType<typeof useLocale>["locale"];
}) {
  return (
    <ul className="character-skill-list">
      {getPublicCharacterSkills(character, locale).map((skill) => (
        <li key={skill.name}>
          <div className="character-skill-list__heading">
            <strong>{skill.name}</strong>
            <span>
              {skill.type} · {skill.availability}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CharacterSelectionPanel({
  session,
  dispatch,
  guidanceVisible,
  guidanceCollapsed,
  onGuidanceVisibleChange,
  onGuidanceCollapsedChange,
}: CharacterSelectionPanelProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const canStart = isCharacterSelection(session.characterIds);
  const selectedCharacters = session.characterIds.map((characterId) =>
    getCharacterDefinition(characterId),
  );

  return (
    <main className="local-game-page character-selection-page">
      <section className="debug-section character-selection-hero" aria-labelledby="character-selection-title">
        <div className="character-selection-hero__heading">
          <img
            alt=""
            aria-hidden="true"
            className="character-selection-hero__icon"
            height="72"
            src="./brand/reaction-field-game-icon.svg"
            width="72"
          />
          <div>
            <p className="debug-kicker">{isEnglish ? "REACTION FIELD · Web Playtest Alpha · MVP0-P10" : "反应域 · Web Playtest Alpha · MVP0-P10"}</p>
            <h1 id="character-selection-title">{isEnglish ? "REACTION FIELD · Local two-player character selection" : "反应域 · 本地双人角色选择"}</h1>
          </div>
        </div>
        <p className="panel-note">
          {isEnglish ? "Choose characters and controllers; hands are public." : "选择角色与控制方后开始；双方手牌公开。"}
        </p>
        <p className="mirror-note">{isEnglish ? "Mirrored characters are allowed." : "试玩版允许镜像角色。"}</p>
      </section>

      <section className="debug-section character-config" aria-labelledby="lineup-title">
        <div className="panel-heading">
          <div>
            <p className="debug-kicker">{isEnglish ? "Local shared screen · 2 players · 7 characters" : "本地同屏 · 2 名玩家 · 7 个角色"}</p>
            <h2 id="lineup-title">{isEnglish ? "Current lineup" : "当前阵容"}</h2>
          </div>
        </div>
        <div className="character-select-grid">
          {([0, 1] as const).map((playerIndex) => (
            <label className="field-row character-select-field" key={`character-${playerIndex}`}>
              <span>{isEnglish ? "Player" : "玩家"} {playerIndex === 0 ? "A" : "B"}</span>
              <select
                aria-label={isEnglish ? `player_${playerIndex + 1} character` : `player_${playerIndex + 1} 角色`}
                onChange={(event) => dispatch({
                  type: "SELECT_CHARACTER",
                  playerIndex,
                  characterId: event.target.value,
                })}
                value={session.characterIds[playerIndex]}
              >
                {characterDefinitions.map((character) => (
                  <option key={character.id} value={character.id}>
                    {getCharacterDisplayName(character.id, locale)} · {character.maxHp} HP
                  </option>
                ))}
              </select>
            </label>
          ))}
          {([0, 1] as const).map((playerIndex) => (
            <label className="field-row character-controller-field" key={`controller-${playerIndex}`}>
              <span>{isEnglish ? "Controller" : "控制方"}</span>
              <select
                aria-label={isEnglish ? `player_${playerIndex + 1} controller` : `player_${playerIndex + 1} 控制方`}
                onChange={(event) => dispatch({
                  type: "SELECT_PLAYER_CONTROLLER",
                  playerIndex,
                  controller: event.target.value,
                })}
                value={session.playerControllers[playerIndex]}
              >
                <option value="human">{getPlayerControllerDisplayName("human", locale)}</option>
                <option value="ai">{getPlayerControllerDisplayName("ai", locale)}</option>
              </select>
            </label>
          ))}
        </div>
        <div className="lineup-summary" aria-live="polite">
          <strong>{isEnglish ? "Lineup confirmed" : "阵容确认"}</strong>
          {([0, 1] as const).map((i) => (
            <span key={i}>
              {isEnglish ? "Player" : "玩家"} {i === 0 ? "A" : "B"} ({getPlayerControllerDisplayName(session.playerControllers[i], locale)})：{getCharacterDisplayName(selectedCharacters[i].id, locale)}
            </span>
          ))}
          {session.characterIds[0] === session.characterIds[1] ? (
            <span className="ok-pill">{isEnglish ? "Mirrored lineup is valid" : "镜像阵容合法"}</span>
          ) : null}
        </div>
        {session.error ? <p className="error-banner">{session.error}</p> : null}
        <button
          className="primary-button start-game-button"
          disabled={!canStart}
          onClick={() => dispatch({ type: "START_LOCAL_GAME" })}
          type="button"
        >
          {isEnglish ? "Start game" : "开始游戏"}
        </button>
      </section>

      <NewPlayerGuidance
        collapsed={guidanceCollapsed}
        mode="configuring"
        onCollapsedChange={onGuidanceCollapsedChange}
        onVisibleChange={onGuidanceVisibleChange}
        visible={guidanceVisible}
      />

      <FirstGameExample />

      <section className="character-catalog" aria-labelledby="character-catalog-title">
        <div className="character-catalog__heading">
          <div>
          <p className="debug-kicker">{isEnglish ? "Character profiles" : "角色资料"}</p>
            <h2 id="character-catalog-title">{isEnglish ? "7 official character profiles" : "7 个正式角色资料"}</h2>
          </div>
          <p className="panel-note">{isEnglish ? "Skill summaries from definitions." : "技能摘要来自角色定义。"}</p>
        </div>
        <div className="character-catalog-grid">
          {characterDefinitions.map((c) => (
            <article className="debug-section character-option-card" key={c.id}>
              <div className="character-option-card__heading">
                <h2>{getCharacterDisplayName(c.id, locale)}</h2>
                <span className="active-pill">{c.maxHp} HP</span>
              </div>
              <CharacterSkillList character={c} locale={locale} />
              <details className="debug-details">
                <summary>{isEnglish ? "Debug details" : "调试详情"}</summary>
                {c.skills.map((s) => (
                  <p key={s.id}>{formatSkillDebugText(s, locale)}</p>
                ))}
              </details>
            </article>
          ))}
        </div>
        <p className="deferred-note">
          {isEnglish ? "Deferred abilities have no false entry." : "延期能力不提供虚假执行入口。"}
        </p>
      </section>
    </main>
  );
}
