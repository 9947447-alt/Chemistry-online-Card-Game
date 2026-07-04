import "./local-game.css";

export function LocalGamePage() {
  return (
    <main className="local-game-page">
      <section className="local-game-panel" aria-labelledby="mvp0-title">
        <p className="local-game-kicker">MVP 0</p>
        <h1 id="mvp0-title">化学在线卡牌游戏 · MVP 0 引擎准备中</h1>
        <p className="local-game-note">
          当前阶段仅初始化项目骨架，规则引擎 Alpha 尚未实现。
        </p>
      </section>
    </main>
  );
}
