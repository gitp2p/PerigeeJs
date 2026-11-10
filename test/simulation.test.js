'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runSimulation, normalizeConfig, parseMatrix, loadMatrix } = require('..');
const { parseOptions } = require('../src/cli');

const root = path.join(__dirname, '..');
const weights = Array.from({ length: 8 }, (_, i) =>
  Array.from({ length: 8 }, (_, j) => (i === j ? 0 : (i + j) * 10)),
);

test('each strategy produces identical snapshots for the same seed and observes exact round boundaries', () => {
  for (const algorithm of ['ucb', 'subset', 'random']) {
    const run = () => {
      const snapshots = [];
      const result = runSimulation({
        weights, algorithm, rounds: 3, subRounds: 3, outDegree: 3,
        inDegreeLimit: 5, seed: 'repeatable', checkpoints: [2],
      }, { onSnapshot: (snapshot) => snapshots.push(snapshot) });
      assert.deepEqual(result.summaries.map(({ round }) => round), [0, 2, 3]);
      assert.equal(result.rounds.length, 3);
      assert.equal(result.rounds.reduce((sum, round) => sum + round.broadcasts, 0), algorithm === 'random' ? 0 : 9);
      for (let node = 0; node < result.network.size; node += 1) {
        assert.equal(result.network.outNeighbors(node).length, 3);
        assert.ok(result.network.incoming[node].size <= 5);
      }
      return snapshots;
    };
    assert.deepEqual(run(), run());
  }
});

test('zero rounds saves only the baseline and does not optimize', () => {
  const result = runSimulation({ weights, rounds: 0, outDegree: 3 });
  assert.deepEqual(result.rounds, []);
  assert.deepEqual(result.summaries.map(({ round }) => round), [0]);
});

test('configuration rejects invalid inputs and accepts small UCB graphs', () => {
  assert.equal(normalizeConfig({ algorithm: 'ucb', nodes: 2, outDegree: 1, inDegreeLimit: 1 }).nodes, 2);
  for (const options of [
    { nodes: 1 }, { rounds: -1 }, { subRounds: 0 }, { quantile: NaN },
    { outDegree: 20, inDegreeLimit: 19 }, { algorithm: 'unknown' },
    { seed: Infinity }, { checkpoints: [0, 1.5] },
    { algorithm: 'subset', replacementCount: 8 },
    { algorithm: 'random', replacementCount: 9 },
    { algorithm: 'subset', nodes: 50, outDegree: 30, inDegreeLimit: 30, replacementCount: 15 },
  ]) assert.throws(() => normalizeConfig(options));
  assert.throws(() => runSimulation({ weights, nodes: 9 }), /matching/);
  assert.throws(() => parseOptions(['--not-a-real-flag']), /Unknown/);
  assert.throws(() => parseOptions(['--checkpoints', '0,,4']), /comma-separated/);
  assert.throws(() => parseOptions(['--rounds', '']), /requires a number/);
});

test('input parser accepts whitespace but rejects truncated or invalid latency matrices', () => {
  assert.deepEqual(parseMatrix('0  10\r\n 10\t0\n'), [[0, 10], [10, 0]]);
  for (const text of ['', '0 1\n1', '0 Infinity\n1 0', '0 -1\n1 0', '0 NaN\n1 0']) {
    assert.throws(() => parseMatrix(text));
  }
  assert.equal(loadMatrix(path.join(root, 'data/latency-matrix.txt'), 8).length, 8);
  assert.throws(() => loadMatrix(path.join(root, 'data/latency-matrix.txt'), 1001), /between 1 and 1000/);
});

test('CLI runs from another working directory, writes reproducible results and protects existing output', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'perigee-cli-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'run');
  const args = [path.join(root, 'src/cli.js'), '--nodes', '10', '--out-degree', '3',
    '--rounds', '2', '--sub-rounds', '3', '--output', output];
  const result = spawnSync(process.execPath, args, { cwd: directory, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'run.json'), 'utf8'));
  assert.match(manifest.inputSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(manifest.summaries.map(({ round }) => round), [0, 2]);
  const graph = JSON.parse(fs.readFileSync(path.join(output, 'graph-round-2.json'), 'utf8'));
  assert.equal(graph.nodes.length, 10);
  assert.equal(graph.edges.length, 30);
  assert.equal(graph.nodeDelays.length, 10);
  const matrix = fs.readFileSync(path.join(output, 'distances-round-2.txt'), 'utf8');
  assert.equal(matrix.trim().split('\n').length, 10);

  const analysisOutput = path.join(directory, 'analysis.json');
  const analysis = spawnSync('python3', [path.join(root, 'scripts/analyze.py'),
    path.join(output, 'distances-round-2.txt'), '--output', analysisOutput], { encoding: 'utf8' });
  assert.equal(analysis.status, 0, analysis.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(analysisOutput, 'utf8')).percentiles,
    manifest.summaries.at(-1).percentiles);

  const existing = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.notEqual(existing.status, 0);
  assert.match(existing.stderr, /exist/i);
  assert.equal(fs.readFileSync(path.join(output, 'distances-round-2.txt'), 'utf8'), matrix);
});

test('CLI help and invalid requests do not create result directories', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'perigee-invalid-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'must-not-exist');
  for (const [flags, expectedStatus] of [[['--help'], 0], [['--nodes', '1001'], 1], [['--rounds', '-1'], 1]]) {
    const result = spawnSync(process.execPath, [path.join(root, 'src/cli.js'), ...flags, '--output', output], { encoding: 'utf8' });
    assert.equal(result.status, expectedStatus, result.stderr);
    assert.equal(fs.existsSync(output), false);
  }
});
