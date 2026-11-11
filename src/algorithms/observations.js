'use strict';

const { broadcast } = require('../core/propagation');

function validateRound(network, { subRounds, inDegreeLimit, rng }) {
  if (!Number.isSafeInteger(subRounds) || subRounds < 1) {
    throw new RangeError('subRounds must be a positive integer');
  }
  if (!Number.isSafeInteger(inDegreeLimit) || inDegreeLimit < 1) {
    throw new RangeError('inDegreeLimit must be a positive integer');
  }
  if (network.incoming.some((peers) => peers.size > inDegreeLimit)) {
    throw new RangeError('The network already exceeds inDegreeLimit');
  }
  if (typeof rng !== 'function') throw new TypeError('rng must be a function');
}

function validateScoring(quantile, penalty) {
  if (!Number.isFinite(quantile) || quantile < 0 || quantile > 1) {
    throw new RangeError('quantile must be between 0 and 1');
  }
  if (!Number.isFinite(penalty) || penalty < 0) {
    throw new RangeError('penalty must be finite and nonnegative');
  }
}

// Freeze each message's observations before any node changes its connections.
function observe(network, rng, penalty) {
  const source = Math.floor(rng() * network.size);
  const arrivals = broadcast(network, source);
  return network.outgoing.map((peers, node) => new Map(
    [...peers].map(([peer, latency]) => {
      const score = arrivals[peer] + network.nodeDelays[peer] + latency - arrivals[node];
      return [peer, Number.isFinite(score) ? Math.max(0, score) : penalty];
    }),
  ));
}

module.exports = { observe, validateRound, validateScoring };
