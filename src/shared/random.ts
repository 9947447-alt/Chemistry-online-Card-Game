export type RandomSource = () => number;
export type ShuffleFunction = <T>(items: readonly T[]) => T[];

export function createMulberry32(seed: number): RandomSource {
  let state = seed >>> 0;
  return function mulberry32(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createFisherYatesShuffle(random: RandomSource): ShuffleFunction {
  return function seededFisherYatesShuffle<T>(items: readonly T[]): T[] {
    return fisherYatesShuffle(items, random);
  };
}

export function createSeededShuffle(seed: number | RandomSource): ShuffleFunction {
  const random = typeof seed === "function" ? seed : createMulberry32(seed);
  return createFisherYatesShuffle(random);
}

export function identityShuffle<T>(items: readonly T[]): T[] {
  return [...items];
}

export function fisherYatesShuffle<T>(items: readonly T[], random: RandomSource = Math.random): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

