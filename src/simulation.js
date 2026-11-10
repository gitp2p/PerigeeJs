'use strict';

const { normalizeConfig } = require('./config');
const { createRandom, randomNormal } = require('./core/random');
const { createRandomNetwork } = require('./core/network');
const { allPairsShortestPaths } = require('./core/propagation');
const { mean, quantile } = require('./core/statistics');
const { runSubsetRound } = require('./algorithms/subset');
const { UcbStrategy } = require('./algorithms/ucb');
const { runRandomRound } = require('./algorithms/random');

function summarize(distances) {
  const percentiles = {};
  for (const percent of [50, 90]) {
    percentiles[percent] = distances.map((row) => {
      const value = quantile(row, percent / 100);
      return Number.isFinite(value) ? value : null;
    });
  }
  return {
    nodeCount: distances.length, weighted: false, percentiles,
    unreachableCounts: distances.map((row) => row.filter((value) => !Number.isFinite(value)).length),
    meanReach90: percentiles[90].some((value) => value === null) ? null : mean(percentiles[90]),
  };
}

/** Run synchronously without filesystem or network side effects. */
function runSimulation(options, { onSnapshot = () => {}, onRound = () => {} } = {}) {
  const { weights, nodeDelays, nodes: nodeCount = weights?.length, metadata, ...rest } = options ?? {};
  const config = normalizeConfig({ ...rest, ...(nodeCount === undefined ? {} : { nodes: nodeCount }) });
  if (!Array.isArray(weights) || weights.length !== config.nodes) {
    throw new RangeError('Provide a weights matrix matching the configured node count');
  }
  const rng = createRandom(config.seed);
  const delays = nodeDelays ?? Array.from({ length: config.nodes }, () => randomNormal(
    rng, config.processingMean, config.processingStdDev,
  ));
  const network = createRandomNetwork({
    weights, nodeDelays: delays, nodes: metadata, outDegree: config.outDegree,
    inDegreeLimit: config.inDegreeLimit, rng,
  });
  const ucb = config.algorithm === 'ucb' ? new UcbStrategy(config) : null;
  const checkpoints = new Set(config.checkpoints);
  const summaries = [];
  const rounds = [];
  for (let round = 0; round <= config.rounds; round += 1) {
    if (checkpoints.has(round)) {
      const distances = allPairsShortestPaths(network, { metric: config.metric });
      const summary = { ...summarize(distances), round, metric: config.metric };
      onSnapshot({ round, graph: network.toJSON(), distances, nodeDelays: [...network.nodeDelays], summary });
      summaries.push(summary);
    }
    if (round === config.rounds) break;
    const roundOptions = { ...config, rng };
    const result = config.algorithm === 'ucb' ? ucb.step(network, roundOptions)
      : config.algorithm === 'subset' ? runSubsetRound(network, roundOptions)
        : runRandomRound(network, roundOptions);
    const progress = { round: round + 1, ...result };
    rounds.push(progress);
    onRound(progress);
  }
  return { config, network, summaries, rounds };
}

module.exports = { runSimulation, summarize };
