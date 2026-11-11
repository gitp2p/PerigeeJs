'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Network, createRandomNetwork } = require('../src/core/network');
const { createRandom, randomNormal, shuffle, pick } = require('../src/core/random');
const { broadcast, shortestPaths, allPairsShortestPaths } = require('../src/core/propagation');
const { quantile, mean } = require('../src/core/statistics');

function fixture(size, latency = 1) {
  return {
    weights: Array.from({ length: size }, (_, from) => Array.from({ length: size }, (_, to) => from === to ? 0 : latency)),
    nodeDelays: Array(size).fill(0),
  };
}

function assertDegrees(network, degree, inDegreeLimit) {
  for (let node = 0; node < network.size; node += 1) {
    assert.equal(network.outgoing[node].size, degree);
    assert.ok(network.incoming[node].size <= inDegreeLimit);
    assert.ok(!network.outgoing[node].has(node));
    for (const peer of network.outNeighbors(node)) assert.ok(network.incoming[peer].has(node));
  }
}

test('network validates latency data before constructing a graph', () => {
  assert.throws(() => new Network({ weights: [[0, 1]], nodeDelays: [1] }), /square matrix/);
  assert.throws(() => new Network({ weights: [[NaN]], nodeDelays: [0] }), /finite nonnegative/);
  assert.throws(() => new Network({ weights: [[0]], nodeDelays: [-1] }), /finite nonnegative/);
  assert.throws(() => new Network({ weights: [[Infinity]], nodeDelays: [0] }), /finite nonnegative/);
  assert.throws(() => new Network({ weights: Array(1), nodeDelays: [0] }), /square matrix/);
  assert.throws(() => new Network({ weights: [Array(1)], nodeDelays: [0] }), /square matrix/);
  assert.throws(() => new Network({ ...fixture(2), nodes: [] }), /metadata/);
});

test('edge mutations keep directed ownership and bidirectional latency consistent', () => {
  const network = new Network({ weights: [[0, 8], [3, 0]], nodeDelays: [0, 0] });
  assert.equal(network.addEdge(0, 1), true);
  assert.equal(network.addEdge(0, 1), false);
  assert.deepEqual(network.outNeighbors(0), [1]);
  assert.deepEqual(network.outNeighbors(1), []);
  assert.equal(network.neighbors(1).get(0), 8);
  network.addEdge(1, 0);
  assert.equal(network.neighbors(0).get(1), 3);
  network.removeEdge(1, 0);
  assert.equal(network.neighbors(0).get(1), 8);
  assert.equal(network.removeEdge(1, 0), false);
  assert.throws(() => network.addEdge(0, 0), /Self/);
  assert.throws(() => network.outNeighbors(2), /Invalid node/);
  assert.deepEqual(network.toJSON().edges, [{ v: '0', w: '1', value: 8 }]);
});

test('broadcast counts sender processing delays, while evaluation can use symmetric costs', () => {
  const network = new Network({
    weights: [[0, 10, 100, 0], [10, 0, 20, 0], [100, 20, 0, 0], [0, 0, 0, 0]],
    nodeDelays: [2, 4, 6, 0],
  });
  network.addEdge(0, 1);
  network.addEdge(1, 2);
  network.addEdge(0, 2);
  assert.deepEqual(broadcast(network, 0), [0, 12, 36, Infinity]);
  assert.deepEqual(broadcast(network, 2), [40, 26, 0, Infinity]);
  assert.deepEqual(shortestPaths(network, 0, { metric: 'symmetric' }), [0, 13, 38, Infinity]);
  assert.deepEqual(shortestPaths(network, 2, { metric: 'symmetric' }), [38, 25, 0, Infinity]);
  assert.equal(allPairsShortestPaths(network).length, 4);
  assert.throws(() => shortestPaths(network, 0, { metric: 'bad' }), /Unknown path metric/);
});

test('zero-weight cycles terminate and long routes are not capped at 10000', () => {
  const network = new Network({
    weights: [[0, 0, 30000], [0, 0, 20000], [30000, 20000, 0]],
    nodeDelays: [0, 0, 0],
  });
  network.addEdge(0, 1);
  network.addEdge(1, 2);
  network.addEdge(2, 0);
  assert.deepEqual(broadcast(network, 0), [0, 0, 20000]);
});

test('Dijkstra results agree with independent Floyd–Warshall reference', () => {
  const rng = createRandom('paths');
  const size = 12;
  const data = fixture(size);
  data.weights = data.weights.map((row) => row.map(() => Math.floor(rng() * 100)));
  data.nodeDelays = data.nodeDelays.map(() => Math.floor(rng() * 10));
  const network = createRandomNetwork({ ...data, outDegree: 3, inDegreeLimit: 4, rng });
  const expected = Array.from({ length: size }, (_, node) => Array.from({ length: size }, (_, peer) => node === peer ? 0 : Infinity));
  for (let node = 0; node < size; node += 1) {
    for (const [peer, weight] of network.neighbors(node)) expected[node][peer] = weight + network.nodeDelays[node];
  }
  for (let via = 0; via < size; via += 1) {
    for (let from = 0; from < size; from += 1) {
      for (let to = 0; to < size; to += 1) {
        expected[from][to] = Math.min(expected[from][to], expected[from][via] + expected[via][to]);
      }
    }
  }
  assert.deepEqual(allPairsShortestPaths(network), expected);
});

test('random topology is reproducible with exact feasible degrees, including saturated cases', () => {
  const options = { ...fixture(30), outDegree: 7, inDegreeLimit: 7 };
  const first = createRandomNetwork({ ...options, rng: createRandom('topology') });
  const second = createRandomNetwork({ ...options, rng: createRandom('topology') });
  assert.deepEqual(first.toJSON(), second.toJSON());
  assertDegrees(first, 7, 7);
  assert.throws(() => createRandomNetwork({ ...options, inDegreeLimit: 6 }), /at least/);
  assert.throws(() => createRandomNetwork({ ...options, outDegree: 30 }), /smaller/);
  const complete = createRandomNetwork({ ...fixture(5), outDegree: 4, inDegreeLimit: 4 });
  assert.equal(complete.replacePeers(0, [1, 2], 4, createRandom(1)), 0);
  assertDegrees(complete, 4, 4);
});

test('rewiring uses available peers and preserves all graph invariants under repeated changes', () => {
  const rng = createRandom('rewiring');
  const network = createRandomNetwork({ ...fixture(20), outDegree: 4, inDegreeLimit: 6, rng });
  for (let round = 0; round < 30; round += 1) {
    for (let node = 0; node < network.size; node += 1) {
      network.replacePeers(node, network.outNeighbors(node).slice(0, 2), 6, rng);
      assertDegrees(network, 4, 6);
    }
  }
  const empty = new Network(fixture(3));
  assert.equal(empty.fillConnections(0, 2, 1, createRandom(1), new Set([1])), 1);
  assert.deepEqual(empty.outNeighbors(0), [2]);
});

test('statistics sort numerically without mutation and keep unreachable values', () => {
  const values = [100, 2, 10, 1];
  assert.equal(quantile(values, 0.5), 10);
  assert.equal(quantile(values, 1), 100);
  assert.equal(quantile([2, Infinity], 0.9), Infinity);
  assert.deepEqual(values, [100, 2, 10, 1]);
  assert.equal(mean([2, 4, 6]), 4);
  assert.throws(() => quantile([], 0.9), /nonempty/);
  assert.throws(() => quantile([NaN], 0.9), /NaN/);
  assert.throws(() => quantile([1], -0.1), /between/);
});

test('seeded randomness includes every candidate without mutating inputs', () => {
  const first = createRandom(123);
  const second = createRandom(123);
  assert.deepEqual(Array.from({ length: 30 }, first), Array.from({ length: 30 }, second));
  const items = [0, 1, 2, 3];
  assert.deepEqual(shuffle(items, () => 0), [1, 2, 3, 0]);
  assert.deepEqual(items, [0, 1, 2, 3]);
  assert.equal(pick(items, () => 0.999999), 3);
  assert.throws(() => pick([]), /empty/);
  assert.equal(randomNormal(() => 0, 50, 0), 50);
  assert.throws(() => randomNormal(Math.random, 0, -1), /standard deviation/);
});
