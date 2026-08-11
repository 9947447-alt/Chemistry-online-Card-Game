export function identityShuffle<T>(items: readonly T[]): T[] {
  return [...items];
}

export function fisherYatesShuffle<T>(items: readonly T[], random = Math.random): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}
