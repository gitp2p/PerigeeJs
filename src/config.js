'use strict';

const DEFAULTS = Object.freeze({
  algorithm: 'ucb', nodes: 100, rounds: 4, subRounds: 20,
  outDegree: 8, inDegreeLimit: 20, replacementCount: 2,
  quantile: 0.9, exploration: 130, penalty: 10000,
  processingMean: 50, processingStdDev: 4.5, seed: '1',
  metric: 'symmetric',
});

function integer(name, value, minimum) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be an integer >= ${minimum}`);
  }
}

function normalizeConfig(options = {}) {
  const config = { ...DEFAULTS, ...options };
  for (const name of ['nodes', 'outDegree', 'inDegreeLimit', 'subRounds']) integer(name, config[name], 1);
  for (const name of ['rounds', 'replacementCount']) integer(name, config[name], 0);
  for (const name of ['exploration', 'penalty', 'processingMean', 'processingStdDev']) {
    if (!Number.isFinite(config[name]) || config[name] < 0) {
      throw new RangeError(`${name} must be finite and nonnegative`);
    }
  }
  if (config.outDegree >= config.nodes) throw new RangeError('outDegree must be smaller than nodes');
  if (config.inDegreeLimit < config.outDegree) throw new RangeError('inDegreeLimit must be >= outDegree');
  if (!['ucb', 'subset', 'random'].includes(config.algorithm)) throw new RangeError('algorithm must be ucb, subset, or random');
  if (!['symmetric', 'broadcast'].includes(config.metric)) throw new RangeError('metric must be symmetric or broadcast');
  if (!Number.isFinite(config.quantile) || config.quantile < 0 || config.quantile > 1) {
    throw new RangeError('quantile must be between 0 and 1');
  }
  if ((config.algorithm === 'random' && config.replacementCount > config.outDegree)
      || (config.algorithm === 'subset' && config.replacementCount >= config.outDegree)) {
    throw new RangeError('replacementCount exceeds the strategy outgoing degree');
  }
  if (!['string', 'number'].includes(typeof config.seed)
      || (typeof config.seed === 'number' && !Number.isFinite(config.seed))) {
    throw new TypeError('seed must be a string or finite number');
  }
  const checkpoints = options.checkpoints ?? [0, 4, 8, 16, 32, 64, 128, 256, 384, 512];
  if (!Array.isArray(checkpoints)) throw new TypeError('checkpoints must be an array of round numbers');
  checkpoints.forEach((round) => integer('checkpoint', round, 0));
  config.checkpoints = [...new Set([0, config.rounds, ...checkpoints.filter((round) => round <= config.rounds)])]
    .sort((a, b) => a - b);
  // Reject accidental exponential subset searches before allocating observations.
  if (config.algorithm === 'subset') {
    let count = 1;
    const k = Math.min(config.replacementCount, config.outDegree - config.replacementCount);
    for (let index = 1; index <= k; index += 1) count *= (config.outDegree - index + 1) / index;
    if (count > 100000) throw new RangeError('Subset search exceeds 100000 combinations; reduce outDegree or replacementCount');
  }
  return config;
}

module.exports = { DEFAULTS, normalizeConfig };
