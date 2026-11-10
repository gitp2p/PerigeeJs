'use strict';

const { shuffle } = require('../core/random');
const { validateRound } = require('./observations');

function runRandomRound(network, {
  replacementCount = 2, inDegreeLimit = 20, rng = Math.random,
} = {}) {
  validateRound(network, { subRounds: 1, inDegreeLimit, rng });
  if (!Number.isSafeInteger(replacementCount) || replacementCount < 0
      || network.outgoing.some((peers) => replacementCount > peers.size)) {
    throw new RangeError('replacementCount must be between zero and every outgoing degree');
  }
  let replacements = 0;
  for (let node = 0; node < network.size; node += 1) {
    const removed = shuffle(network.outNeighbors(node), rng).slice(0, replacementCount);
    replacements += network.replacePeers(node, removed, inDegreeLimit, rng);
  }
  return { replacements, broadcasts: 0 };
}

module.exports = { runRandomRound };
