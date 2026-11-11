'use strict';

/** A stable seeded generator for reproducible experiments (not cryptography). */
function createRandom(seed = 1) {
  const text = String(seed);
  let state = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    state = Math.imul(state ^ text.charCodeAt(i), 16777619);
  }
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, rng = Math.random) {
  const result = Array.from(items);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pick(items, rng = Math.random) {
  if (items.length === 0) throw new RangeError('Cannot pick from an empty collection');
  return items[Math.floor(rng() * items.length)];
}

/** Box–Muller normal sample; latency cannot be negative. */
function randomNormal(rng = Math.random, mean = 50, sd = 4.5) {
  if (!Number.isFinite(mean) || !Number.isFinite(sd) || sd < 0) {
    throw new RangeError('Normal mean must be finite and standard deviation nonnegative');
  }
  const magnitude = Math.sqrt(-2 * Math.log(1 - rng()));
  return Math.max(0, mean + sd * magnitude * Math.cos(2 * Math.PI * rng()));
}

module.exports = { createRandom, randomNormal, shuffle, pick };
