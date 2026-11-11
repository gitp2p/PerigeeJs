'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { Network } = require('../src/core/network');
const { quantile } = require('../src/core/statistics');
const { runSubsetRound } = require('../src/algorithms/subset');
const { UcbStrategy } = require('../src/algorithms/ucb');
const { runRandomRound } = require('../src/algorithms/random');
const { observe } = require('../src/algorithms/observations');

function makeNetwork(size, degree, edgeWeight = 5, customizeWeights = () => {}) {
  const weights = Array.from({ length: size }, (_, from) =>
    Array.from({ length: size }, (_, to) => (from === to ? 0 : edgeWeight)),
  );
  customizeWeights(weights);
  const network = new Network({ weights, nodeDelays: Array(size).fill(0) });
  for (let from = 0; from < size; from += 1) {
    for (let offset = 1; offset <= degree; offset += 1) {
      network.addEdge(from, (from + offset) % size);
    }
  }
  return network;
}

function assertDegreeInvariants(network, degree, incomingLimit) {
  for (let node = 0; node < network.outgoing.length; node += 1) {
    const peers = network.outNeighbors(node);
    assert.equal(peers.length, degree, `out-degree for node ${node}`);
    assert.equal(new Set(peers).size, degree, `unique peers for node ${node}`);
    assert.ok(!peers.includes(node), `no self connection for node ${node}`);
    assert.ok(network.incoming[node].size <= incomingLimit, `in-degree for node ${node}`);
    for (const peer of peers) {
      assert.ok(network.incoming[peer].has(node), `incoming index for ${node} -> ${peer}`);
    }
  }
}

function unevenPeerNetwork() {
  // Source zero reaches these peers directly; other routes cost at least 1000.
  return makeNetwork(6, 3, 1000, (weights) => {
    weights[0][1] = weights[1][0] = 1;
    weights[0][2] = weights[2][0] = 10;
    weights[0][3] = weights[3][0] = 100;
  });
}

test('latency quantiles sort numerically and handle both endpoints without mutating samples', () => {
  const samples = [100, 2, 10];
  assert.equal(quantile(samples, 0), 2);
  assert.equal(quantile(samples, 0.5), 10);
  assert.equal(quantile(samples, 0.9), 100);
  assert.equal(quantile(samples, 1), 100);
  assert.deepEqual(samples, [100, 2, 10]);
});

test('the final node can originate a broadcast and observations use relative peer latency', () => {
  const network = makeNetwork(3, 2);
  const observations = observe(network, () => 0.999, 10000);
  assert.equal(observations[2].get(0), 10);
  assert.equal(observations[0].get(2), 0);
});

test('subset selection retains the first best covering subset before exploring another peer', () => {
  const network = unevenPeerNetwork();
  const result = runSubsetRound(network, {
    subRounds: 10,
    quantile: 0.9,
    replacementCount: 1,
    inDegreeLimit: 5,
    rng: () => 0,
  });
  assert.equal(result.broadcasts, 10);
  assert.ok(result.replacements > 0);
  const peers = network.outNeighbors(0);
  assert.ok(peers.includes(1), 'fastest peer retained');
  assert.ok(peers.includes(2), 'deterministic first tied subset retained');
  assert.ok(!peers.includes(3), 'slower excluded peer replaced when fresh candidates exist');
  assertDegreeInvariants(network, 3, 5);
});

test('subset supports fractional percentile positions and preserves degree limits across rounds', () => {
  const network = makeNetwork(8, 3);
  for (let round = 0; round < 4; round += 1) {
    runSubsetRound(network, {
      subRounds: 3,
      quantile: 0.9,
      replacementCount: 2,
      inDegreeLimit: 4,
      rng: () => 0.5,
    });
    assertDegreeInvariants(network, 3, 4);
  }
});

test('UCB accumulates history across calls, keyed by peer identity', () => {
  const network = makeNetwork(4, 3);
  const strategy = new UcbStrategy({ exploration: 1e9 });
  strategy.step(network, { subRounds: 3, inDegreeLimit: 3, rng: () => 0 });
  const retainedSamples = strategy.history.get(0).get(1);
  assert.equal(retainedSamples.length, 3);
  strategy.step(network, { subRounds: 2, inDegreeLimit: 3, rng: () => 0.75 });
  assert.equal(strategy.history.get(0).get(1).length, 5);
  for (let node = 0; node < 4; node += 1) {
    const history = strategy.history.get(node);
    assert.deepEqual([...history.keys()].sort(), network.outNeighbors(node).sort());
    for (const samples of history.values()) {
      assert.equal(samples.length, 5);
      assert.ok(samples.every(Number.isFinite));
    }
  }
  assertDegreeInvariants(network, 3, 3);
});

test('UCB replaces a separated slow peer and drops its history while preserving retained samples', () => {
  const network = unevenPeerNetwork();
  const strategy = new UcbStrategy({ exploration: 0 });
  const result = strategy.step(network, { subRounds: 1, inDegreeLimit: 5, rng: () => 0 });
  assert.equal(result.broadcasts, 1);
  assert.ok(result.replacements > 0);
  assert.ok(network.outNeighbors(0).includes(1));
  assert.ok(!network.outNeighbors(0).includes(3));
  assert.deepEqual(strategy.history.get(0).get(1), [2]);
  assert.ok(!strategy.history.get(0).has(3));
  assertDegreeInvariants(network, 3, 5);
});

test('unreachable observations never put NaN or Infinity into UCB history', () => {
  const weights = Array.from({ length: 4 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) => (i === j ? 0 : 5)),
  );
  const network = new Network({ weights, nodeDelays: [0, 0, 0, 0] });
  network.addEdge(0, 1);
  network.addEdge(1, 0);
  network.addEdge(2, 3);
  network.addEdge(3, 2);
  const strategy = new UcbStrategy({ exploration: 1e9, penalty: 1234 });
  strategy.step(network, { subRounds: 2, inDegreeLimit: 3, rng: () => 0 });
  assert.deepEqual(strategy.history.get(2).get(3), [1234, 1234]);
  for (const history of strategy.history.values()) {
    for (const samples of history.values()) assert.ok(samples.every(Number.isFinite));
  }
});

test('all strategies terminate on saturated complete topologies and preserve every degree', () => {
  for (const strategy of ['subset', 'ucb', 'random']) {
    const network = makeNetwork(4, 3);
    const options = { subRounds: 3, replacementCount: 2, inDegreeLimit: 3, rng: () => 0 };
    if (strategy === 'subset') runSubsetRound(network, options);
    if (strategy === 'ucb') new UcbStrategy({ exploration: 0 }).step(network, options);
    if (strategy === 'random') {
      const result = runRandomRound(network, options);
      assert.equal(result.broadcasts, 0);
    }
    assertDegreeInvariants(network, 3, 3);
  }
});

test('invalid strategy settings fail before changing the graph', () => {
  const network = makeNetwork(5, 3);
  const before = network.toJSON();
  assert.throws(() => runSubsetRound(network, { subRounds: 0 }), RangeError);
  assert.throws(() => runSubsetRound(network, { quantile: 1.1 }), RangeError);
  assert.throws(() => runSubsetRound(network, { replacementCount: 3 }), RangeError);
  assert.throws(() => runRandomRound(network, { replacementCount: -1 }), RangeError);
  assert.throws(() => new UcbStrategy({ exploration: -1 }), RangeError);
  assert.throws(() => new UcbStrategy({ penalty: Infinity }), RangeError);
  assert.throws(() => new UcbStrategy().step(network, { inDegreeLimit: 2 }), RangeError);
  assert.deepEqual(network.toJSON(), before);
});
