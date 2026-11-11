'use strict';

const { quantile: percentile } = require('../core/statistics');
const { observe, validateRound, validateScoring } = require('./observations');

function* combinations(values, count, start = 0, selected = []) {
  if (selected.length === count) {
    yield selected.slice();
    return;
  }
  const remaining = count - selected.length;
  for (let index = start; index <= values.length - remaining; index += 1) {
    selected.push(values[index]);
    yield* combinations(values, count, index + 1, selected);
    selected.pop();
  }
}

function runSubsetRound(network, {
  subRounds = 100, quantile = 0.9, replacementCount = 2,
  penalty = 10000, inDegreeLimit = 20, rng = Math.random,
} = {}) {
  validateRound(network, { subRounds, inDegreeLimit, rng });
  validateScoring(quantile, penalty);
  if (!Number.isSafeInteger(replacementCount) || replacementCount < 0
      || network.outgoing.some((peers) => replacementCount >= peers.size)) {
    throw new RangeError('replacementCount must be an integer smaller than every outgoing degree');
  }

  const observations = Array.from({ length: subRounds }, () => observe(network, rng, penalty));
  const removals = network.outgoing.map((outgoing, node) => {
    const peers = [...outgoing.keys()];
    let bestScore = Infinity;
    let bestPeers = peers.slice(0, peers.length - replacementCount);
    for (const retained of combinations(peers, peers.length - replacementCount)) {
      const scores = observations.map((message) => Math.min(
        ...retained.map((peer) => message[node].get(peer)),
      ));
      const score = percentile(scores, quantile);
      if (score < bestScore) {
        bestScore = score;
        bestPeers = retained;
      }
    }
    const retained = new Set(bestPeers);
    return peers.filter((peer) => !retained.has(peer));
  });

  let replacements = 0;
  for (let node = 0; node < network.size; node += 1) {
    replacements += network.replacePeers(node, removals[node], inDegreeLimit, rng);
  }
  return { replacements, broadcasts: subRounds };
}

module.exports = { runSubsetRound, combinations };
