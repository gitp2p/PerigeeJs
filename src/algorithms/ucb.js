'use strict';

const { observe, validateRound, validateScoring } = require('./observations');

// Keep samples ordered once, rather than copying and sorting the whole history
// for every quantile evaluation. The history map stores sorted samples.
function insertSample(samples, value) {
  let low = 0;
  let high = samples.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (samples[middle] <= value) low = middle + 1;
    else high = middle;
  }
  samples.splice(low, 0, value);
}

class UcbStrategy {
  constructor({ quantile = 0.9, exploration = 130, penalty = 10000 } = {}) {
    validateScoring(quantile, penalty);
    if (!Number.isFinite(exploration) || exploration < 0) {
      throw new RangeError('exploration must be finite and nonnegative');
    }
    this.quantile = quantile;
    this.exploration = exploration;
    this.penalty = penalty;
    this.history = new Map();
    this.totalBroadcasts = 0;
    this.network = null;
  }

  step(network, { subRounds = 100, inDegreeLimit = 20, rng = Math.random } = {}) {
    validateRound(network, { subRounds, inDegreeLimit, rng });
    if (this.network && this.network !== network) {
      throw new Error('A UcbStrategy instance belongs to one network; create a new strategy for another');
    }
    this.network = network;
    let replacements = 0;
    for (let round = 0; round < subRounds; round += 1) {
      const observations = observe(network, rng, this.penalty);
      this.totalBroadcasts += 1;
      const removals = observations.map((scores, node) => {
        if (!this.history.has(node)) this.history.set(node, new Map());
        const history = this.history.get(node);
        for (const peer of history.keys()) {
          if (!scores.has(peer)) history.delete(peer);
        }
        let minUpper = Infinity;
        let maxLower = -Infinity;
        let worstPeer;
        for (const [peer, score] of scores) {
          if (!history.has(peer)) history.set(peer, []);
          const samples = history.get(peer);
          insertSample(samples, score);
          const estimate = samples[Math.min(samples.length - 1, Math.floor(this.quantile * samples.length))];
          const radius = this.exploration * Math.sqrt(
            Math.log(Math.max(2, this.totalBroadcasts)) / (2 * samples.length),
          );
          minUpper = Math.min(minUpper, estimate + radius);
          if (estimate - radius > maxLower) {
            maxLower = estimate - radius;
            worstPeer = peer;
          }
        }
        return minUpper < maxLower ? [worstPeer] : [];
      });
      for (let node = 0; node < network.size; node += 1) {
        replacements += network.replacePeers(node, removals[node], inDegreeLimit, rng);
        const retained = new Set(network.outNeighbors(node));
        for (const peer of this.history.get(node).keys()) {
          if (!retained.has(peer)) this.history.get(node).delete(peer);
        }
      }
    }
    return { replacements, broadcasts: subRounds };
  }
}

module.exports = { UcbStrategy };
