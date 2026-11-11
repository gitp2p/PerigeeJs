#!/usr/bin/env node
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { parseArgs } = require('node:util');
const { normalizeConfig } = require('./config');
const { loadMatrix } = require('./io/matrix');
const { createResultsWriter } = require('./io/results');
const { runSimulation } = require('./simulation');

const HELP = `Usage: node src/cli.js [options]

  --algorithm ucb|subset|random  Peer selection strategy (default: ucb)
  --nodes N                     Top-left matrix size (default: 100)
  --rounds N                    Optimization rounds (default: 4)
  --sub-rounds N                Messages per round (default: 20)
  --out-degree N                Outgoing peers per node (default: 8)
  --in-degree-limit N           Maximum incoming connections (default: 20)
  --replacement-count N         Subset/random exploration peers (default: 2)
  --quantile P                  Peer latency quantile, 0..1 (default: 0.9)
  --exploration N               UCB confidence multiplier (default: 130)
  --penalty N                   Disconnected observation penalty (default: 10000)
  --processing-mean N           Mean processing delay (default: 50)
  --processing-std-dev N        Processing delay deviation (default: 4.5)
  --seed VALUE                  Reproducible seed (default: 1)
  --metric symmetric|broadcast  Saved distance metric (default: symmetric)
  --checkpoints 0,4,8            Saved rounds; initial/final always included
  --weights FILE                Whitespace square latency matrix
  --output DIR                  New output directory (default: results/run-TIMESTAMP)
  --help                        Show this help
`;

const NUMERIC_OPTIONS = {
  nodes: 'nodes', rounds: 'rounds', 'sub-rounds': 'subRounds',
  'out-degree': 'outDegree', 'in-degree-limit': 'inDegreeLimit',
  'replacement-count': 'replacementCount', quantile: 'quantile', exploration: 'exploration',
  penalty: 'penalty', 'processing-mean': 'processingMean', 'processing-std-dev': 'processingStdDev',
};

function parseOptions(args) {
  const schema = Object.fromEntries([
    ...Object.keys(NUMERIC_OPTIONS), 'algorithm', 'seed', 'metric', 'checkpoints', 'weights', 'output',
  ].map((key) => [key, { type: 'string' }]));
  schema.help = { type: 'boolean', short: 'h' };
  const { values } = parseArgs({ args, options: schema, allowPositionals: false });
  if (values.help) return { help: true };
  const options = {};
  for (const [flag, name] of Object.entries(NUMERIC_OPTIONS)) {
    if (values[flag] !== undefined) {
      if (!values[flag].trim()) throw new Error(`--${flag} requires a number`);
      options[name] = Number(values[flag]);
    }
  }
  for (const name of ['algorithm', 'seed', 'metric']) {
    if (values[name] !== undefined) options[name] = values[name];
  }
  if (values.checkpoints !== undefined) {
    if (!/^\d+(,\d+)*$/.test(values.checkpoints)) throw new Error('--checkpoints requires comma-separated nonnegative integers');
    options.checkpoints = values.checkpoints.split(',').map(Number);
  }
  return {
    config: normalizeConfig(options),
    weights: path.resolve(values.weights ?? path.join(__dirname, '../data/latency-matrix.txt')),
    output: path.resolve(values.output ?? `results/run-${new Date().toISOString().replace(/[:.]/g, '-')}`),
  };
}

function main(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  const weights = loadMatrix(options.weights, options.config.nodes);
  const writer = createResultsWriter(options.output);
  const result = runSimulation({ ...options.config, weights }, {
    onSnapshot: (snapshot) => writer.writeSnapshot(snapshot),
    onRound: ({ round, replacements }) => {
      process.stdout.write(`Round ${round}/${options.config.rounds}: ${replacements} peers replaced\n`);
    },
  });
  writer.writeRun({
    version: require('../package.json').version,
    config: result.config, input: options.weights,
    inputSha256: createHash('sha256').update(fs.readFileSync(options.weights)).digest('hex'),
    summaries: result.summaries, rounds: result.rounds,
  });
  process.stdout.write(`Results: ${writer.directory}\n`);
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(`perigee: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { main, parseOptions };
