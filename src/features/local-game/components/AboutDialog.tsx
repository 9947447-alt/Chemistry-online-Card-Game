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

const capabilitiesItems: readonly [string, string][] = [
  ["本地同屏双人公开对局；双方手牌、牌堆数量、状态与完整日志均公开。", "A local shared-screen public two-player game; both hands, deck counts, statuses, and the full log are public."],
  ["选择双方角色后开始；按当前阶段完成备课、主行动、响应、状态处理与角色技能。", "Choose both characters, then complete preparation, main action, response, status handling, and character skills for the current phase."],
  ["酸碱响应可取消伤害；酸与碳酸盐可生成虚拟 CO2；碱性牌可处理即时或待处理效果。", "Acid-base responses can cancel damage; acid and carbonate can produce virtual CO2; alkaline cards can handle immediate or pending effects."],
  ["主动 DIY 每名玩家每周期一次；角色技能与成功反应事件按正式定义和日志展示。", "Each player may use active DIY once per cycle; character skills and successful reaction events follow their formal definitions and log display."],
  ["对局进行中重开或返回角色选择需要二次确认；对局结束后可直接执行。", "Restarting or returning during a game needs confirmation; after game over these actions run directly."],
];

const guideItems: readonly [string, string][] = [
  ["先在角色选择页确认本地同屏双人阵容；双方手牌始终公开。", "Confirm a local shared-screen two-player lineup on the character selection page; both hands remain public."],
  ["按当前阶段面板完成备课、主行动、响应、状态处理或实验反击；完整规则以帮助与冻结文档为准。", "Use the panel for the current phase to complete preparation, main action, response, status handling, or Experiment Counterattack. The help and freeze documents remain authoritative."],
  ["响应 DIY 关闭。酸碱中和产生虚拟 H2O；酸与碳酸盐产生虚拟 CO2；两者只记录结果，不创建 CardInstance。", "Response DIY is disabled. Acid-base neutralization produces virtual H2O and acid-carbonate produces virtual CO2; both only record results and create no CardInstance."],
  ["普通实体卡池固定为 68 张；真实金属、方程式、沉淀与通用反应链仍延期。", "The ordinary physical card pool is fixed at 68. Real metals, equations, precipitation, and general reaction chains remain deferred."],
];

const boundaryItems: readonly [string, string][] = [
  ["零网络遥测，无账号、无联网、无存档；刷新会丢失当前对局并回到默认角色预选。", "No game telemetry, accounts, online play, or saves; refreshing discards the current game and returns to the default selections."],
  ["普通实体卡池固定为 68 张；虚拟 H2O、CO2 与技能结果不会创建额外普通 CardInstance。", "The ordinary physical card pool is fixed at 68; virtual H2O, CO2, and skill results never create extra ordinary CardInstances."],
  ["金属反击、方程式、沉淀、响应 DIY、多人、房间、回放和桌面安装均延期。", "Metal counterattacks, equations, precipitation, response DIY, multiplayer, rooms, replays, and desktop installation are deferred."],
  ["本地安全错误报告只包含名称、应用版本、规则版本、commit、稳定错误码和非敏感运行环境概要。", "Local safe diagnostics contain only the name, app version, rules version, commit, stable error code, and a non-sensitive environment summary."],
];

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
          {isEnglish ? "Review this playtest's release identity, controls, character implementation status, and safety boundaries." : "查看当前试玩版的发布身份、操作方式、角色实现状态与安全边界。"}
        </p>

        <section className="about-section" aria-labelledby="about-release-title">
          <h3 id="about-release-title">{releaseMetadata.displayName} <span className="secondary-brand">{releaseMetadata.secondaryName}</span></h3>
          <dl className="about-metadata">
            {([
              [isEnglish ? "Release channel" : "发布渠道", releaseMetadata.channel],
              [isEnglish ? "App version" : "应用版本", releaseMetadata.version],
              [isEnglish ? "Rules version" : "规则版本", releaseMetadata.rulesVersion],
              ["Commit", releaseMetadata.commit],
            ] as const).map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          <ProjectRepositoryLink />
        </section>

        <section className="about-section">
          <h3>{isEnglish ? "Current capabilities and basic controls" : "当前能力与基本操作"}</h3>
          <ul>
            {capabilitiesItems.map(([zh, en]) => (
              <li key={zh}>{isEnglish ? en : zh}</li>
            ))}
          </ul>
        </section>

        <section className="about-section">
          <h3>{isEnglish ? "First-game quick guide" : "首局速查"}</h3>
          <ul>
            {guideItems.map(([zh, en]) => (
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
            {isEnglish ? "Experiment Counterattack offers partial choices in this playtest. This area shows only public summaries from character definitions and does not copy rule execution logic." : "“实验反击”在当前试玩中提供部分选择；这里仅展示角色定义的公开摘要，不复制规则执行逻辑。"}
          </p>
          <details className="debug-details">
            <summary>{isEnglish ? "Debug details" : "调试详情"}</summary>
            {characterDefinitions.map((character) => character.skills.map((skill) => (
              <p key={skill.id}>{character.id} · {formatSkillDebugText(skill, locale)}</p>
            )))}
          </details>
        </section>

        <section className="about-section">
          <h3>{isEnglish ? "Data, safety, and content boundaries" : "数据、安全与内容边界"}</h3>
          <ul>
            {boundaryItems.map(([zh, en]) => (
              <li key={zh}>{isEnglish ? en : zh}</li>
            ))}
          </ul>
          <p className="panel-note">反馈 / Feedback：点击反馈将离开游戏，提交内容由 Microsoft Forms 处理。 / Clicking Feedback leaves the game and Microsoft Forms handles submitted content.</p>
        </section>
    </ModalDialog>
  );
}
