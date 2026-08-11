import type { Player } from "./types";

export function hasRecoveryBlockingStatus(player: Player): boolean {
  return player.statuses.some(
    (status) => status.statusId === "SO2_LEAK" || status.statusId === "FIRE",
  );
}

export function canRecoverHp(player: Player): boolean {
  return player.hp < player.maxHp && !hasRecoveryBlockingStatus(player);
}
