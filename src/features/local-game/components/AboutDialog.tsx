import { useRef } from "react";
import { useLocale } from "../../../app/locale";
import { releaseMetadata } from "../../../app/releaseMetadata";
import { ProjectRepositoryLink } from "../../../app/projectRepository";
import { characterDefinitions } from "../../../game/data/characterDefinitions";
import {
  formatSkillDebugText,
  getPublicCharacterSkills,
} from "../characterPresentation";
import { getCharacterDisplayName } from "../presentationLocale";
import { ModalDialog } from "./ModalDialog";

type AboutDialogProps = Readonly<{
  onClose: () => void;
}>;

export function AboutDialog({ onClose }: AboutDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { locale } = useLocale();
  const isEnglish = locale === "en";

  return (
    <ModalDialog
      ariaDescribedBy="about-description"
      ariaLabelledBy="about-title"
      className="about-dialog"
      initialFocusRef={closeButtonRef}
      onRequestClose={onClose}
      role="dialog"
    >
        <div className="modal-heading">
          <div>
            <p className="debug-kicker">{releaseMetadata.channel}</p>
            <h2 id="about-title">{isEnglish ? "About & help" : "关于与帮助"}</h2>
          </div>
          <button
            className="secondary-button"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            {isEnglish ? "Close help" : "关闭帮助"}
          </button>
        </div>

        <p id="about-description">
          {isEnglish ? "Release identity, controls, and safety." : "查看发布身份、操作与安全边界。"}
        </p>

        <section className="about-section" aria-labelledby="about-release-title">
          <h3 id="about-release-title">{releaseMetadata.displayName} <span className="secondary-brand">{releaseMetadata.secondaryName}</span></h3>
          <p className="panel-note">{releaseMetadata.version} ({releaseMetadata.commit}) · {releaseMetadata.rulesVersion}</p>
          <ProjectRepositoryLink />
        </section>

        <section className="about-section">
          <h3>{isEnglish ? "Controls" : "当前能力与基本操作"}</h3>
          <ul>
            {[
              ["本地公开对局；手牌、牌堆、状态与日志公开。", "Public hands, deck, status, and log."],
              ["按阶段完成备课、主行动、响应、状态处理与角色技能。", "Follow phase panels."],
              ["酸碱中和产生虚拟 H2O；酸与碳酸盐产生虚拟 CO2；两者只记录结果，不创建 CardInstance。", "Virtual H2O/CO2; no CardInstance."],
              ["主动 DIY 每周期一次；角色技能按定义展示。", "DIY once per cycle."],
              ["对局中重开需确认；对局结束后可直接执行。", "In-game restart needs confirm."],
            ].map(([zh, en]) => (
              <li key={zh}>{isEnglish ? en : zh}</li>
            ))}
          </ul>
        </section>

        <section className="about-section">
          <h3>{isEnglish ? "Quick guide" : "首局速查"}</h3>
          <ul>
            {[
              ["在角色选择页确认阵容；双方手牌公开。", "Confirm lineup; hands are public."],
              ["按当前面板完成各阶段操作或实验反击。", "Follow the active panel."],
              ["响应 DIY 关闭。中和产出虚拟 H2O，酸+碳酸盐产出虚拟 CO2。", "Virtual H2O/CO2 only."],
              ["卡池固定 68 张；真实金属、方程式与反应链延期。", "68-card pool; metals deferred."],
            ].map(([zh, en]) => (
              <li key={zh}>{isEnglish ? en : zh}</li>
            ))}
          </ul>
        </section>

        <section className="about-section">
          <h3>{isEnglish ? "Seven characters and playtest capabilities" : "七个角色与试玩能力"}</h3>
          <div className="about-character-grid">
            {characterDefinitions.map((character) => (
              <article key={character.id}>
                <h4>{getCharacterDisplayName(character.id, locale)} · {character.maxHp} HP</h4>
                <ul>
                  {getPublicCharacterSkills(character, locale).map((skill) => (
                    <li key={skill.name}>
                      {skill.name}：{skill.type} · {skill.availability}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p>
            {isEnglish ? "Counterattack is partial." : "实验反击为部分选择。"}
          </p>
          <details className="debug-details">
            <summary>{isEnglish ? "Debug details" : "调试详情"}</summary>
            {characterDefinitions.map((character) => character.skills.map((skill) => (
              <p key={skill.id}>{character.id} · {formatSkillDebugText(skill, locale)}</p>
            )))}
          </details>
        </section>

        <section className="about-section">
          <h3>{isEnglish ? "Safety" : "数据、安全与内容边界"}</h3>
          <ul>
            {[
              ["零网络遥测，无账号、无联网、无存档；刷新即丢失对局。", "No telemetry, accounts, or saves."],
              ["卡池固定 68 张；虚拟产物不创建实体 CardInstance。", "68-card pool; no virtual CardInstance."],
              ["金属反击、方程式、沉淀与多人房间延期。", "Metals, equations, and rooms deferred."],
              ["本地安全诊断仅含版本、commit 与错误码。", "Diagnostics: version, commit, code."],
            ].map(([zh, en]) => (
              <li key={zh}>{isEnglish ? en : zh}</li>
            ))}
          </ul>
          <p className="panel-note">{isEnglish ? "Feedback opens Microsoft Forms." : "反馈打开 Microsoft Forms。"}</p>
        </section>
    </ModalDialog>
  );
}
