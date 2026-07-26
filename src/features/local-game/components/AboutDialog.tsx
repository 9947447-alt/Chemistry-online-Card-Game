import { useRef } from "react";
import { releaseMetadata } from "../../../app/releaseMetadata";
import { characterDefinitions } from "../../../game/data/characterDefinitions";
import {
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
          查看当前 Debug Alpha 的发布身份、操作方式、角色实现状态与安全边界。
        </p>

        <section className="about-section" aria-labelledby="about-release-title">
          <h3 id="about-release-title">{releaseMetadata.displayName}</h3>
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
            <li>本地双人公开调试对局；双方手牌、牌堆数量、状态与完整日志均公开。</li>
            <li>选择双方角色后开始；按当前阶段完成备课、主行动、响应、状态处理与角色技能。</li>
            <li>酸碱响应可取消伤害；酸与碳酸盐生成虚拟 CO2；碱性牌可处理即时 SO2 或 SO2_LEAK 状态。</li>
            <li>主动 DIY 每名玩家每周期一次；角色技能与成功反应事件按正式定义和日志展示。</li>
            <li>对局进行中重开或返回角色选择需要二次确认；对局结束后可直接执行。</li>
          </ul>
        </section>

        <section className="about-section">
          <h3>七个角色与实现状态</h3>
          <div className="about-character-grid">
            {characterDefinitions.map((character) => (
              <article key={character.id}>
                <h4>{character.name} · {character.maxHp} HP</h4>
                <ul>
                  {character.skills.map((skill) => (
                    <li key={skill.id}>
                      {skill.name}：{skillTypeLabels[skill.type]} · {implementationStatusLabels[skill.implementationStatus]}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p>
            “实验反击”的回复与实体酸碱追击已实现；金属选项等待真实金属卡池。这里仅展示正式角色定义，不复制规则执行逻辑。
          </p>
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
