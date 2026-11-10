'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseLinks, fetchLocations } = require('../scripts/fetch-locations');

const analyze = path.resolve(__dirname, '../scripts/analyze.py');
const build = path.resolve(__dirname, '../scripts/build-delays.py');

function fixture(t, matrix, weights) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'perigee-analysis-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const input = path.join(directory, 'distances.txt');
  const output = path.join(directory, 'summary.json');
  writeFileSync(input, matrix);
  const args = [analyze, input, '--output', output];
  if (weights !== undefined) {
    const weightFile = path.join(directory, 'hash.txt');
    writeFileSync(weightFile, weights);
    args.push('--weights', weightFile);
  }
  return { input, output, directory, args };
}

function python(args) {
  const result = spawnSync('python3', args, { encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}

test('analysis sorts numerically and keeps unreachable destinations explicit', t => {
  const f = fixture(t, '0 100 20\n100 0 Infinity\n20 Infinity 0\n');
  const result = python(f.args);
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(readFileSync(f.output, 'utf8'));
  assert.deepEqual(summary.percentiles['50'], [20, 100, 20]);
  assert.deepEqual(summary.percentiles['90'], [100, null, null]);
  assert.deepEqual(summary.unreachableCounts, [0, 1, 1]);
  assert.equal(summary.weighted, false);
});

test('hash weights follow destination columns and preserve fractional delays', t => {
  const f = fixture(t, '0 10.5 30\n10.5 0 20\n30 20 0\n', '0 9 1');
  const result = python([...f.args, '--percentiles', '0,50,90,100']);
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(readFileSync(f.output, 'utf8'));
  assert.deepEqual(summary.percentiles['90'], [10.5, 0, 20]);
  assert.deepEqual(summary.percentiles['100'], [30, 20, 20]);
  assert.equal(summary.weighted, true);
});

test('analysis rejects malformed matrices and invalid weights', t => {
  for (const matrix of ['0 1\n', '0 NaN\n1 0\n', '0 -1\n1 0\n', '']) {
    const f = fixture(t, matrix);
    assert.notEqual(python(f.args).status, 0);
  }
  for (const weights of ['0 0', '1', '1 Infinity', '1 -1']) {
    const f = fixture(t, '0 1\n1 0\n', weights);
    assert.notEqual(python(f.args).status, 0);
  }
  const f = fixture(t, '0 1\n1 0\n');
  assert.notEqual(python([...f.args, '--percentiles', 'NaN']).status, 0);
});

test('data generation is deterministic, symmetric, and nonnegative', t => {
  const f = fixture(t, '0');
  const left = path.join(f.directory, 'left.txt');
  const right = path.join(f.directory, 'right.txt');
  for (const output of [left, right]) {
    const result = python([build, '--output', output, '--nodes', '4', '--seed', 'repeat']);
    assert.equal(result.status, 0, result.stderr);
  }
  const text = readFileSync(left, 'utf8');
  assert.equal(text, readFileSync(right, 'utf8'));
  const matrix = text.trim().split('\n').map(row => row.split(/\s+/).map(Number));
  for (let row = 0; row < matrix.length; row++) {
    assert.equal(matrix[row][row], 0);
    for (let column = 0; column < matrix.length; column++) {
      assert.equal(matrix[row][column], matrix[column][row]);
      assert.ok(matrix[row][column] >= 0);
    }
  }
});

test('location parsing validates records and caches repeated IP requests', async () => {
  const links = parseLinks('192.0.2.1 192.0.2.2 12.5\n192.0.2.2 192.0.2.1 9\n');
  assert.throws(() => parseLinks('bad-ip 192.0.2.1 3'), /line 1/);
  assert.throws(() => parseLinks('192.0.2.1 192.0.2.2 -3'), /line 1/);
  const requests = [];
  const grouped = await fetchLocations(links, {
    endpoint: 'https://example.invalid/{ip}', intervalMs: 0,
    fetchImpl: async url => {
      requests.push(url);
      return { ok: true, json: async () => ({ countryCode: 'IN', city: 'Delhi' }) };
    },
  });
  assert.equal(requests.length, 2);
  assert.deepEqual(grouped['in-in']['delhi-delhi'], [12.5, 9]);
  await assert.rejects(fetchLocations(links, {
    endpoint: 'https://example.invalid/{ip}', intervalMs: 0,
    fetchImpl: async () => ({ ok: false, status: 429 }),
  }), /HTTP 429/);
});

test('plot summary loading validates data and distinguishes algorithm directories without matplotlib', t => {
  const f = fixture(t, '0');
  const plot = path.resolve(__dirname, '../scripts/plot.py');
  const code = `
import importlib.util, json, math, pathlib, sys
spec = importlib.util.spec_from_file_location("perigee_plot", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
root = pathlib.Path(sys.argv[2])
labels = []
for algorithm in ("ucb", "subset"):
    output = root / algorithm / "summary-round-4.json"
    output.parent.mkdir()
    output.write_text(json.dumps({"nodeCount": 3, "percentiles": {"90": [20, None, 3]}}))
    values, label = module.load_series(output, 90)
    assert values == [3, 20]
    assert label.startswith(algorithm + "/summary-round-4")
    labels.append(label)
assert labels[0] != labels[1]
for bad in ({"nodeCount": 3, "percentiles": {"90": [0, 1]}},
            {"nodeCount": 1, "percentiles": {"90": ["bad"]}},
            {"nodeCount": 1, "percentiles": {"90": [True]}},
            {"nodeCount": 1, "percentiles": {"90": [float("inf")]}},
            {"nodeCount": 1, "percentiles": {"90": [-1]}}):
    output.write_text(json.dumps(bad))
    try:
        module.load_series(output, 90)
        raise AssertionError("invalid summary accepted")
    except ValueError:
        pass
for percentile in (float("nan"), float("inf"), -1, 101):
    try:
        module.load_series(output, percentile)
        raise AssertionError("invalid percentile accepted")
    except ValueError:
        pass
`;
  const result = python(['-c', code, plot, f.directory]);
  assert.equal(result.status, 0, result.stderr);
});
