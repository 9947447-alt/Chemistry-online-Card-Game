import { useRef } from "react";
import { releaseMetadata } from "../../../app/releaseMetadata";
import { characterDefinitions } from "../../../game/data/characterDefinitions";
import {
  getPublicCharacterSkills,
  implementationStatusLabels,
  skillTypeLabels,
} from "../characterPresentation";
import { ModalDialog } from "./ModalDialog";

type AboutDialogProps = Readonly<{
  onClose: () => void;
}>;

export function AboutDialog({ onClose }: AboutDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
            <h2 id="about-title">关于与帮助</h2>
          </div>
          <button
            className="secondary-button"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            关闭帮助
          </button>
        </div>

        <p id="about-description">
          查看当前试玩版的发布身份、操作方式、角色实现状态与安全边界。
        </p>

        <section className="about-section" aria-labelledby="about-release-title">
          <h3 id="about-release-title">{releaseMetadata.displayName} <span className="secondary-brand">{releaseMetadata.secondaryName}</span></h3>
          <dl className="about-metadata">
            <div><dt>发布渠道</dt><dd>{releaseMetadata.channel}</dd></div>
            <div><dt>应用版本</dt><dd>{releaseMetadata.version}</dd></div>
            <div><dt>规则版本</dt><dd>{releaseMetadata.rulesVersion}</dd></div>
            <div><dt>Commit</dt><dd>{releaseMetadata.commit}</dd></div>
          </dl>
        </section>

        <section className="about-section">
          <h3>当前能力与基本操作</h3>
          <ul>
            <li>本地同屏双人公开对局；双方手牌、牌堆数量、状态与完整日志均公开。</li>
            <li>选择双方角色后开始；按当前阶段完成备课、主行动、响应、状态处理与角色技能。</li>
            <li>酸碱响应可取消伤害；酸与碳酸盐可生成虚拟 CO2；碱性牌可处理即时或待处理效果。</li>
            <li>主动 DIY 每名玩家每周期一次；角色技能与成功反应事件按正式定义和日志展示。</li>
            <li>对局进行中重开或返回角色选择需要二次确认；对局结束后可直接执行。</li>
          </ul>
        </section>

        <section className="about-section">
          <h3>首局速查</h3>
          <ul>
            <li>先在角色选择页确认本地同屏双人阵容；双方手牌始终公开。</li>
            <li>按当前阶段面板完成备课、主行动、响应、状态处理或实验反击；完整规则以帮助与冻结文档为准。</li>
            <li>响应 DIY 关闭。酸碱中和产生虚拟 H2O；酸与碳酸盐产生虚拟 CO2；两者只记录结果，不创建 CardInstance。</li>
            <li>普通实体卡池固定为 68 张；真实金属、方程式、沉淀与通用反应链仍延期。</li>
          </ul>
        </section>

        <section className="about-section">
          <h3>七个角色与试玩能力</h3>
          <div className="about-character-grid">
            {characterDefinitions.map((character) => (
              <article key={character.id}>
                <h4>{character.name} · {character.maxHp} HP</h4>
                <ul>
                  {getPublicCharacterSkills(character).map((skill) => (
                    <li key={skill.name}>
                      {skill.name}：{skill.type} · {skill.availability}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p>
            “实验反击”在当前试玩中提供部分选择；这里仅展示角色定义的公开摘要，不复制规则执行逻辑。
          </p>
          <details className="debug-details">
            <summary>调试详情</summary>
            {characterDefinitions.map((character) => character.skills.map((skill) => (
              <p key={skill.id}>{character.id} · {skill.id} · {skillTypeLabels[skill.type]} · {implementationStatusLabels[skill.implementationStatus]} · {skill.rulesText}{"implementationNote" in skill && skill.implementationNote ? ` · ${skill.implementationNote}` : ""}</p>
            )))}
          </details>
        </section>

        <section className="about-section">
          <h3>数据、安全与内容边界</h3>
          <ul>
            <li>零网络遥测，无账号、无联网、无存档；刷新会丢失当前对局并回到默认角色预选。</li>
            <li>普通实体卡池固定为 68 张；虚拟 H2O、CO2 与技能结果不会创建额外普通 CardInstance。</li>
            <li>金属反击、方程式、沉淀、响应 DIY、多人、房间、回放和桌面安装均延期。</li>
            <li>本地安全错误报告只包含名称、应用版本、规则版本、commit、稳定错误码和非敏感运行环境概要。</li>
          </ul>
        </section>
    </ModalDialog>
  );
}
