'use strict';

/** Small binary min-heap used to avoid recursive propagation and stack limits. */
class MinHeap {
  constructor() {
    this.items = [];
  }

  push(item) {
    const items = this.items;
    items.push(item);
    let index = items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (items[parent][0] <= item[0]) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = item;
  }

  pop() {
    const items = this.items;
    const result = items[0];
    const tail = items.pop();
    if (items.length === 0) return result;
    let index = 0;
    while (index * 2 + 1 < items.length) {
      let child = index * 2 + 1;
      if (child + 1 < items.length && items[child + 1][0] < items[child][0]) child += 1;
      if (tail[0] <= items[child][0]) break;
      items[index] = items[child];
      index = child;
    }
    items[index] = tail;
    return result;
  }

  get size() {
    return this.items.length;
  }
}

function shortestPaths(network, source, { metric = 'broadcast' } = {}) {
  network.validateNode(source);
  if (metric !== 'broadcast' && metric !== 'symmetric') {
    throw new RangeError(`Unknown path metric: ${metric}`);
  }
  const distances = Array(network.size).fill(Infinity);
  const queue = new MinHeap();
  distances[source] = 0;
  queue.push([0, source]);
  while (queue.size > 0) {
    const [distance, node] = queue.pop();
    if (distance !== distances[node]) continue;
    for (const [peer, latency] of network.neighbors(node)) {
      const processing = metric === 'broadcast'
        ? network.nodeDelays[node]
        : (network.nodeDelays[node] + network.nodeDelays[peer]) / 2;
      const candidate = distance + latency + processing;
      if (candidate < distances[peer]) {
        distances[peer] = candidate;
        queue.push([candidate, peer]);
      }
    }
  }
  return distances;
}

function broadcast(network, source) {
  return shortestPaths(network, source);
}

function allPairsShortestPaths(network, options) {
  return Array.from({ length: network.size }, (_, source) => shortestPaths(network, source, options));
}

module.exports = { broadcast, shortestPaths, allPairsShortestPaths };
