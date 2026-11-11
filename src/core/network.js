'use strict';

const { shuffle } = require('./random');

function nonnegative(value) {
  return Number.isFinite(value) && value >= 0;
}

/** Directed peer ownership with bidirectional transport over every connection. */
class Network {
  constructor({ weights, nodeDelays, nodes } = {}) {
    if (!Array.isArray(weights) || weights.length === 0) {
      throw new TypeError('Weights must be a nonempty square matrix');
    }
    const size = weights.length;
    if (Array.from(weights).some((row) => !Array.isArray(row) || row.length !== size || !Array.from(row).every(nonnegative))) {
      throw new TypeError('Weights must be a square matrix of finite nonnegative numbers');
    }
    if (!Array.isArray(nodeDelays) || nodeDelays.length !== size || !Array.from(nodeDelays).every(nonnegative)) {
      throw new TypeError('Node delays must contain one finite nonnegative number per node');
    }
    if (nodes !== undefined && (!Array.isArray(nodes) || nodes.length !== size)) {
      throw new TypeError('Node metadata must contain one item per node');
    }
    this.size = size;
    this.weights = weights.map((row) => [...row]);
    this.nodeDelays = [...nodeDelays];
    this.nodes = nodes ? [...nodes] : Array.from({ length: size }, (_, id) => ({ id }));
    this.outgoing = Array.from({ length: size }, () => new Map());
    this.incoming = Array.from({ length: size }, () => new Set());
  }

  validateNode(node) {
    if (!Number.isInteger(node) || node < 0 || node >= this.size) {
      throw new RangeError(`Invalid node index: ${node}`);
    }
  }

  addEdge(from, to) {
    this.validateNode(from);
    this.validateNode(to);
    if (from === to) throw new RangeError('Self connections are not allowed');
    if (this.outgoing[from].has(to)) return false;
    this.outgoing[from].set(to, this.weights[from][to]);
    this.incoming[to].add(from);
    return true;
  }

  removeEdge(from, to) {
    this.validateNode(from);
    this.validateNode(to);
    const removed = this.outgoing[from].delete(to);
    if (removed) this.incoming[to].delete(from);
    return removed;
  }

  outNeighbors(node) {
    this.validateNode(node);
    return [...this.outgoing[node].keys()];
  }

  neighbors(node) {
    this.validateNode(node);
    const neighbors = new Map(this.outgoing[node]);
    for (const peer of this.incoming[node]) {
      const latency = this.outgoing[peer].get(node);
      neighbors.set(peer, Math.min(neighbors.get(peer) ?? Infinity, latency));
    }
    return neighbors;
  }

  canConnect(from, to, inDegreeLimit) {
    this.validateNode(from);
    this.validateNode(to);
    if (!Number.isInteger(inDegreeLimit) || inDegreeLimit < 0) {
      throw new RangeError('Incoming degree limit must be a nonnegative integer');
    }
    return from !== to && !this.outgoing[from].has(to) && this.incoming[to].size < inDegreeLimit;
  }

  fillConnections(node, targetDegree, inDegreeLimit, rng = Math.random, excluded = new Set()) {
    this.validateNode(node);
    if (!Number.isInteger(targetDegree) || targetDegree < 0 || targetDegree >= this.size) {
      throw new RangeError('Outgoing degree must be an integer smaller than the network');
    }
    // Validate the limit even when there is no room or no candidate.
    this.canConnect(node, node, inDegreeLimit);
    const candidates = shuffle(Array.from({ length: this.size }, (_, id) => id)
      .filter((id) => !excluded.has(id) && this.canConnect(node, id, inDegreeLimit)), rng);
    let added = 0;
    for (const peer of candidates) {
      if (this.outgoing[node].size >= targetDegree) break;
      this.addEdge(node, peer);
      added += 1;
    }
    return added;
  }

  replacePeers(node, peersToRemove, inDegreeLimit, rng = Math.random) {
    this.validateNode(node);
    const peers = [...new Set(peersToRemove)];
    for (const peer of peers) {
      this.validateNode(peer);
      if (!this.outgoing[node].has(peer)) throw new RangeError(`Node ${peer} is not an outgoing peer of ${node}`);
    }
    this.canConnect(node, node, inDegreeLimit);
    if (peers.length === 0) return 0;
    const originalDegree = this.outgoing[node].size;
    for (const peer of peers) this.removeEdge(node, peer);
    this.fillConnections(node, originalDegree, inDegreeLimit, rng, new Set(peers));
    // Saturated networks may have no new peers; keep existing connections instead
    // of reducing degree or entering an unbounded random rejection loop.
    for (const peer of peers) {
      if (this.outgoing[node].size >= originalDegree) break;
      this.addEdge(node, peer);
    }
    return peers.filter((peer) => !this.outgoing[node].has(peer)).length;
  }

  toJSON() {
    return {
      options: { directed: true, multigraph: false, compound: false },
      nodes: this.nodes.map((value, node) => ({ v: String(node), value })),
      edges: this.outgoing.flatMap((peers, node) => [...peers].map(([peer, value]) => ({
        v: String(node), w: String(peer), value,
      }))),
    };
  }
}

function createRandomNetwork({ weights, nodeDelays, nodes, outDegree = 8, inDegreeLimit = 20, rng = Math.random }) {
  const network = new Network({ weights, nodeDelays, nodes });
  if (!Number.isInteger(outDegree) || outDegree < 0 || outDegree >= network.size) {
    throw new RangeError('Outgoing degree must be an integer smaller than the network');
  }
  if (!Number.isInteger(inDegreeLimit) || inDegreeLimit < outDegree) {
    throw new RangeError('Incoming degree limit must be an integer at least the outgoing degree');
  }
  // Start with a feasible regular graph, then diversify it with bounded swaps.
  // This is a randomized regular topology, not a uniform Erdos–Renyi sample.
  // Random rejection can deadlock after earlier nodes consume capacity.
  const ordering = shuffle(Array.from({ length: network.size }, (_, id) => id), rng);
  const offsets = shuffle(Array.from({ length: network.size - 1 }, (_, index) => index + 1), rng).slice(0, outDegree);
  for (let index = 0; index < network.size; index += 1) {
    for (const offset of offsets) {
      network.addEdge(ordering[index], ordering[(index + offset) % network.size]);
    }
  }
  const edges = network.outgoing.flatMap((peers, source) => [...peers.keys()].map((peer) => [source, peer]));
  for (let attempt = 0; attempt < edges.length * 4; attempt += 1) {
    const first = Math.floor(rng() * edges.length);
    const second = Math.floor(rng() * edges.length);
    const [sourceA, peerA] = edges[first];
    const [sourceB, peerB] = edges[second];
    if (sourceA === sourceB || peerA === peerB || sourceA === peerB || sourceB === peerA
      || network.outgoing[sourceA].has(peerB) || network.outgoing[sourceB].has(peerA)) continue;
    network.removeEdge(sourceA, peerA);
    network.removeEdge(sourceB, peerB);
    network.addEdge(sourceA, peerB);
    network.addEdge(sourceB, peerA);
    edges[first] = [sourceA, peerB];
    edges[second] = [sourceB, peerA];
  }
  return network;
}

module.exports = { Network, createRandomNetwork };
