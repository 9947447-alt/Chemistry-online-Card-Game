import { describe, expect, it } from "vitest";
import {
  createFisherYatesShuffle,
  createMulberry32,
  createSeededShuffle,
  fisherYatesShuffle,
  identityShuffle,
} from "../../shared/random";

describe("shared/random", () => {
  describe("createMulberry32", () => {
    it("produces deterministic sequences for identical seeds", () => {
      const prng1 = createMulberry32(42);
      const prng2 = createMulberry32(42);

      const seq1 = Array.from({ length: 100 }, () => prng1());
      const seq2 = Array.from({ length: 100 }, () => prng2());

      expect(seq1).toEqual(seq2);
    });

    it("produces different sequences for different seeds", () => {
      const prng1 = createMulberry32(42);
      const prng2 = createMulberry32(43);

      const seq1 = Array.from({ length: 10 }, () => prng1());
      const seq2 = Array.from({ length: 10 }, () => prng2());

      expect(seq1).not.toEqual(seq2);
    });

    it("outputs numbers in the [0, 1) range", () => {
      const prng = createMulberry32(123456789);

      for (let i = 0; i < 1000; i += 1) {
        const val = prng();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    it("handles boundary seeds safely (0, negative, large 32-bit values)", () => {
      const prngZero = createMulberry32(0);
      const prngNegative = createMulberry32(-1);
      const prngMaxUint = createMulberry32(0xffffffff);

      expect(prngZero()).toBeGreaterThanOrEqual(0);
      expect(prngNegative()).toBeGreaterThanOrEqual(0);
      expect(prngMaxUint()).toBeGreaterThanOrEqual(0);
    });
  });

  describe("identityShuffle", () => {
    it("returns a shallow copy of items without reordering", () => {
      const items = [1, 2, 3, 4, 5];
      const result = identityShuffle(items);

      expect(result).toEqual(items);
      expect(result).not.toBe(items);
    });
  });

  describe("createFisherYatesShuffle & createSeededShuffle", () => {
    it("produces identical shuffles given identical seeds", () => {
      const shuffleA = createSeededShuffle(20260821);
      const shuffleB = createSeededShuffle(20260821);

      const items = ["a", "b", "c", "d", "e", "f", "g", "h"];
      const resultA1 = shuffleA(items);
      const resultB1 = shuffleB(items);

      expect(resultA1).toEqual(resultB1);

      const resultA2 = shuffleA(items);
      const resultB2 = shuffleB(items);

      expect(resultA2).toEqual(resultB2);
    });

    it("produces permutations containing the exact original items", () => {
      const shuffle = createSeededShuffle(999);
      const items = [10, 20, 30, 40, 50];
      const result = shuffle(items);

      expect(result.length).toBe(items.length);
      expect([...result].sort((a, b) => a - b)).toEqual(items);
    });

    it("accepts a custom RandomSource function in createFisherYatesShuffle", () => {
      let counter = 0;
      const fakeRng = () => {
        counter += 0.1;
        return counter % 1;
      };
      const shuffle = createFisherYatesShuffle(fakeRng);
      const items = [1, 2, 3, 4];
      const result = shuffle(items);

      expect(result.length).toBe(4);
    });

    it("fisherYatesShuffle uses Math.random by default when no random is passed", () => {
      const items = [1, 2, 3, 4, 5];
      const result = fisherYatesShuffle(items);

      expect(result.length).toBe(items.length);
      expect([...result].sort((a, b) => a - b)).toEqual(items);
    });
  });
});
