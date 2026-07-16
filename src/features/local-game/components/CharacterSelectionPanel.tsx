import { characterDefinitions, getCharacterDefinition } from "../../../game/data/characterDefinitions";
import type { CharacterId } from "../../../game/engine/types";
import {
  implementationStatusLabels,
  skillTypeLabels,
} from "../characterPresentation";
import {
  isCharacterSelection,
  type ConfiguringLocalGameSession,
  type LocalGameSessionCommand,
} from "../localGameSession";

type CharacterSelectionPanelProps = {
  session: ConfiguringLocalGameSession;
  dispatch: (command: LocalGameSessionCommand) => void;
};

export function CharacterSelectionPanel({
  session,
  dispatch,
}: CharacterSelectionPanelProps) {
  const canStart = isCharacterSelection(session.characterIds);
  const selectedCharacters = session.characterIds.map((characterId) =>
    getCharacterDefinition(characterId),
  );

  return (
    <main className="local-game-page character-selection-page">
      <section className="debug-section character-selection-hero" aria-labelledby="character-selection-title">
        <div>
          <p className="debug-kicker">Phase 9 · Local Debug Alpha</p>
          <h1 id="character-selection-title">双人角色选择</h1>
        </div>
        <p className="panel-note">
          选择两名玩家的角色后再创建本地对局。角色选择只属于页面配置，不会写入尚未创建的 GameState。
        </p>
        <p className="mirror-note">Debug Alpha 允许镜像角色；该能力不预先冻结未来正式实体角色牌模式。</p>
      </section>

      <section className="debug-section character-config" aria-labelledby="lineup-title">
        <div className="panel-heading">
          <div>
            <p className="debug-kicker">2 Players · 7 Characters</p>
            <h2 id="lineup-title">当前阵容</h2>
          </div>
        </div>
        <div className="character-select-grid">
          {([0, 1] as const).map((playerIndex) => (
            <label className="field-row character-select-field" key={playerIndex}>
              <span>player_{playerIndex + 1}</span>
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
          <strong>选择摘要</strong>
          <span>player_1：{selectedCharacters[0].name}</span>
          <span>player_2：{selectedCharacters[1].name}</span>
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
            <p className="debug-kicker">Formal Character Definitions</p>
            <h2 id="character-catalog-title">7 个正式角色资料</h2>
          </div>
          <p className="panel-note">技能名称、类型、规则文本与实现状态直接来自正式角色定义。</p>
        </div>
        <div className="character-catalog-grid">
          {characterDefinitions.map((character) => (
            <article className="debug-section character-option-card" key={character.id}>
              <div className="character-option-card__heading">
                <div>
                  <h2>{character.name}</h2>
                  <p>{character.id}</p>
                </div>
                <span className="active-pill">{character.maxHp} HP</span>
              </div>
              <ul className="character-skill-list">
                {character.skills.map((skill) => (
                  <li key={skill.id}>
                    <div className="character-skill-list__heading">
                      <strong>{skill.name}</strong>
                      <span>
                        {skillTypeLabels[skill.type]} · {implementationStatusLabels[skill.implementationStatus]}
                      </span>
                    </div>
                    <p>{skill.rulesText}</p>
                    {"implementationNote" in skill && skill.implementationNote ? (
                      <p className="character-skill-list__note">{skill.implementationNote}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="deferred-note">
          不可用或部分实现：实验反击的金属选项等待真实金属卡池；硫酸盐副产等待通用反应事件系统。延期技能不提供虚假执行入口。
        </p>
      </section>
    </main>
  );
}
