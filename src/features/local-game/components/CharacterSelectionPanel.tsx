import { characterDefinitions, getCharacterDefinition } from "../../../game/data/characterDefinitions";
import type { CharacterId } from "../../../game/engine/types";
import {
  getPublicCharacterSkills,
  implementationStatusLabels,
  skillTypeLabels,
} from "../characterPresentation";
import {
  isCharacterSelection,
  type ConfiguringLocalGameSession,
  type LocalGameSessionCommand,
} from "../localGameSession";
import { NewPlayerGuidance } from "./NewPlayerGuidance";

type CharacterSelectionPanelProps = {
  session: ConfiguringLocalGameSession;
  dispatch: (command: LocalGameSessionCommand) => void;
  guidanceVisible: boolean;
  guidanceCollapsed: boolean;
  onGuidanceVisibleChange: (visible: boolean) => void;
  onGuidanceCollapsedChange: (collapsed: boolean) => void;
};

export function CharacterSelectionPanel({
  session,
  dispatch,
  guidanceVisible,
  guidanceCollapsed,
  onGuidanceVisibleChange,
  onGuidanceCollapsedChange,
}: CharacterSelectionPanelProps) {
  const canStart = isCharacterSelection(session.characterIds);
  const selectedCharacters = session.characterIds.map((characterId) =>
    getCharacterDefinition(characterId),
  );

  return (
    <main className="local-game-page character-selection-page">
      <NewPlayerGuidance
        collapsed={guidanceCollapsed}
        mode="configuring"
        onCollapsedChange={onGuidanceCollapsedChange}
        onVisibleChange={onGuidanceVisibleChange}
        visible={guidanceVisible}
      />
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
            <p className="debug-kicker">反应域 · Web Playtest Alpha · MVP0-P10</p>
            <h1 id="character-selection-title">反应域 · 本地双人角色选择</h1>
          </div>
        </div>
        <p className="panel-note">
          选择两名玩家的角色后开始本地同屏对局；双方手牌公开。刷新页面会丢失本局进度。
        </p>
        <p className="mirror-note">试玩版允许镜像角色；该能力不预先冻结未来正式实体角色牌模式。</p>
      </section>

      <section className="debug-section character-config" aria-labelledby="lineup-title">
        <div className="panel-heading">
          <div>
            <p className="debug-kicker">本地同屏 · 2 名玩家 · 7 个角色</p>
            <h2 id="lineup-title">当前阵容</h2>
          </div>
        </div>
        <div className="character-select-grid">
          {([0, 1] as const).map((playerIndex) => (
            <label className="field-row character-select-field" key={playerIndex}>
                <span>玩家 {playerIndex === 0 ? "A" : "B"}</span>
              <select
                aria-label={`player_${playerIndex + 1} 角色`}
                onChange={(event) => dispatch({
                  type: "SELECT_CHARACTER",
                  playerIndex,
                  characterId: event.target.value,
                })}
                value={session.characterIds[playerIndex]}
              >
                {characterDefinitions.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name} · {character.maxHp} HP
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="lineup-summary" aria-live="polite">
          <strong>阵容确认</strong>
          <span>玩家 A：{selectedCharacters[0].name}</span>
          <span>玩家 B：{selectedCharacters[1].name}</span>
          {session.characterIds[0] === session.characterIds[1] ? (
            <span className="ok-pill">镜像阵容合法</span>
          ) : null}
        </div>
        {session.error ? <p className="error-banner">{session.error}</p> : null}
        <button
          className="primary-button start-game-button"
          disabled={!canStart}
          onClick={() => dispatch({ type: "START_LOCAL_GAME" })}
          type="button"
        >
          开始游戏
        </button>
      </section>

      <section className="character-catalog" aria-labelledby="character-catalog-title">
        <div className="character-catalog__heading">
          <div>
          <p className="debug-kicker">角色资料</p>
            <h2 id="character-catalog-title">7 个正式角色资料</h2>
          </div>
          <p className="panel-note">技能摘要来自角色定义；具体实现说明可在调试详情中查看。</p>
        </div>
        <div className="character-catalog-grid">
          {characterDefinitions.map((character) => (
            <article className="debug-section character-option-card" key={character.id}>
              <div className="character-option-card__heading">
                <div>
                  <h2>{character.name}</h2>
                  <p>{character.maxHp} HP</p>
                </div>
                <span className="active-pill">{character.maxHp} HP</span>
              </div>
              <ul className="character-skill-list">
                {getPublicCharacterSkills(character).map((skill) => (
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
              <details className="debug-details">
                <summary>调试详情</summary>
                {character.skills.map((skill) => (
                  <p key={skill.id}>{skill.id} · {skillTypeLabels[skill.type]} · {implementationStatusLabels[skill.implementationStatus]} · {skill.rulesText}{"implementationNote" in skill && skill.implementationNote ? ` · ${skill.implementationNote}` : ""}</p>
                ))}
              </details>
            </article>
          ))}
        </div>
        <p className="deferred-note">
          不可用或部分实现：实验反击的金属选项等待真实金属卡池；硫酸盐副产已在 Phase 10 通过结构化成功反应事件启用。延期能力不提供虚假执行入口。
        </p>
      </section>
    </main>
  );
}
