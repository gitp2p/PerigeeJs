'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { formatMatrix } = require('./matrix');

function writeJson(filename, value) {
  fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function createResultsWriter(outputDirectory) {
  const directory = path.resolve(outputDirectory);
  // Each run owns a fresh directory; an existing result can never be overwritten.
  fs.mkdirSync(path.dirname(directory), { recursive: true });
  fs.mkdirSync(directory);
  return {
    directory,
    writeSnapshot({ round, graph, distances, nodeDelays, summary }) {
      writeJson(path.join(directory, `graph-round-${round}.json`), { ...graph, nodeDelays });
      fs.writeFileSync(path.join(directory, `distances-round-${round}.txt`), formatMatrix(distances), { flag: 'wx' });
      writeJson(path.join(directory, `summary-round-${round}.json`), summary);
    },
    writeRun(result) {
      writeJson(path.join(directory, 'run.json'), result);
    },
  };
}

module.exports = { createResultsWriter };
