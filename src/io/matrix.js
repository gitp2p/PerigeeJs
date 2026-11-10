'use strict';

const fs = require('node:fs');

function parseMatrix(text) {
  const lines = text.trim().split(/\r?\n/).filter((line) => line.trim());
  if (!text.trim()) throw new Error('Latency matrix is empty');
  const matrix = lines.map((line, row) => line.trim().split(/\s+/).map((token) => {
    const value = Number(token);
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid latency at row ${row + 1}: ${token}`);
    return value;
  }));
  if (matrix.some((row) => row.length !== matrix.length)) throw new Error('Latency matrix must be square');
  return matrix;
}

function loadMatrix(filename, nodeCount) {
  const matrix = parseMatrix(fs.readFileSync(filename, 'utf8'));
  if (nodeCount === undefined) return matrix;
  if (!Number.isSafeInteger(nodeCount) || nodeCount < 1 || nodeCount > matrix.length) {
    throw new RangeError(`Requested node count must be between 1 and ${matrix.length}`);
  }
  return matrix.slice(0, nodeCount).map((row) => row.slice(0, nodeCount));
}

function formatMatrix(matrix) {
  return `${matrix.map((row) => row.join('  ')).join('\n')}\n`;
}

module.exports = { parseMatrix, loadMatrix, formatMatrix };
