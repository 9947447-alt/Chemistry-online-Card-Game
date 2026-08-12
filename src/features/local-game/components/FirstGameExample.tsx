import { useLocale } from "../../../app/locale";

export function FirstGameExample() {
  const { locale } = useLocale();
  const isEnglish = locale === "en";

  return (
    <section className="debug-section first-game-example" aria-labelledby="first-game-example-title">
      <p className="debug-kicker">
        {isEnglish ? "Three-step example · Display only" : "三步玩法示例 · 仅作展示"}
      </p>
      <h2 id="first-game-example-title">
        {isEnglish ? "See how one action can resolve" : "查看一次行动如何结算"}
      </h2>
      <details className="first-game-example__details">
        <summary>{isEnglish ? "Open the three-step example" : "展开三步玩法示例"}</summary>
        <ol>
          <li>
            {isEnglish
              ? "Play a card: The active player chooses a card through the available action controls."
              : "出牌：当前玩家选择一张符合现有操作条件的牌。"}
          </li>
          <li>
            {isEnglish
              ? "Respond: The other player may use the available response controls."
              : "响应：另一位玩家可使用现有响应入口。"}
          </li>
          <li>
            {isEnglish
              ? "Resolve and record: If an implemented successful reaction occurs, its result is shown and recorded in the public log."
              : "反应与记录：若形成已实现的成功反应，结果显示并写入公开日志。"}
          </li>
        </ol>
        <p className="panel-note">
          {isEnglish
            ? "This example does not judge card legality and does not imply that every play creates a reaction."
            : "本示例不判断卡牌合法性，也不表示每次出牌都会产生反应。"}
        </p>
      </details>
    </section>
  );
}
