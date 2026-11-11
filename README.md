# PerigeeJs

A JavaScript research simulator for peer-to-peer topology selection and message propagation. Compare subset selection, UCB selection, and a random rewiring baseline using the same latency matrix and seed.

## Requirements and quick start

- Node.js 22 or newer. The simulator has **no runtime dependencies**.
- Python 3.9 or newer for analysis scripts and the complete test suite.
- Matplotlib is optional, only for generating plots.

```sh
npm start
```

The default experiment uses 100 nodes from the bundled matrix, eight outgoing peers per node, four optimization rounds, and 20 broadcasts per round. Results go into a new timestamped directory under `results/`. The simulation runs offline.

```sh
# Compare strategies with identical initial conditions.
npm run simulate -- --algorithm ucb --seed comparison --output results/ucb
npm run simulate -- --algorithm subset --seed comparison --output results/subset
npm run simulate -- --algorithm random --seed comparison --output results/random

# Larger experiment; all-pairs output and longer histories take more time/memory.
npm run simulate -- --nodes 1000 --rounds 128 --sub-rounds 100 --seed 42

# Show all configuration flags.
npm start -- --help
```

Output directories must be new. Reusing an existing directory fails before writing to it. Paths passed by the caller are relative to the caller's working directory; the default input resolves relative to the installed project.

## How the simulation works

Each directed edge records which node owns an outgoing peer connection. Messages travel in **both directions** over that connection. Incoming connections are capped separately. Self connections and duplicate outgoing peers are excluded. If reciprocal connections have different latencies, transport uses the faster available connection.

The initial graph is a randomized regular directed graph: a shuffled circulant construction followed by bounded edge swaps. Every node starts with exactly the requested incoming and outgoing degree. It is not a uniform sample of all directed graphs. A disconnected graph is valid and remains visible in the metrics.

For each broadcast, iterative Dijkstra computes earliest arrivals using:

```text
arrival[v] = min(arrival[u] + linkLatency(u, v) + processingDelay[u])
peerScore(u, v) = arrival[v] + processingDelay[v] + linkLatency(u, v) - arrival[u]
```

Processing delays are nonnegative normal samples, defaulting to mean 50 and standard deviation 4.5. All random choices use the configured seed. Unreachable observations use the configurable finite penalty (default 10000); reachable paths are never capped at that value.

- **Subset:** collect a round of observations, enumerate retained peer subsets, and minimize the configured quantile of each subset's best per-message peer score. Retain `outDegree - replacementCount` peers and explore replacements. Defaults retain six of eight. Decisions use observations from one unchanged topology; applying replacements proceeds in node order while respecting available incoming capacity.
- **UCB:** keep sorted score histories keyed by node and peer across rounds. Replace a peer when its lower confidence bound exceeds the smallest upper bound. The interval radius is `exploration * sqrt(log(max(2, totalBroadcasts)) / (2 * sampleCount))`. Decisions for one message use a frozen observation snapshot; replacement histories start fresh. This preserves the project's heuristic; it is not a statistical guarantee for latency quantiles.
- **Random:** replace random outgoing peers once per optimization round, without observing broadcasts. It is a baseline, not another learning algorithm.

Replacement selection uses a finite candidate list. When incoming capacity prevents finding enough new peers, old connections are restored so every node keeps its outgoing degree. The returned replacement count reflects actual changed peers.

Numeric quantiles use the historical rank `min(n - 1, floor(p * n))`, including the source node at distance zero. This differs from interpolated percentile definitions. Subset searches exceeding 100000 combinations are rejected by configuration validation.

## Output and analysis

Round zero is the baseline. A run performs exactly `--rounds` optimization rounds and always saves the initial and final topology. Additional checkpoints can be selected with `--checkpoints 0,4,8`.

| File | Contents |
| --- | --- |
| `run.json` | Version, resolved configuration, input path and SHA-256, round counts, summaries |
| `graph-round-N.json` | Graphlib-compatible graph structure plus node processing delays |
| `distances-round-N.txt` | Whitespace square all-pairs distance matrix |
| `summary-round-N.json` | Per-source 50% and 90% reach delay, unreachable counts, mean 90% reach delay |

Saved distances default to the legacy evaluation metric, **symmetric**: `linkLatency + (processingDelay[u] + processingDelay[v]) / 2`. Use `--metric broadcast` to evaluate the same sender-delay metric used during learning. The manifest and summaries name the selected metric. No conversion or truncation to integer delays is applied. Unreachable distances are `Infinity` in text matrices and `null` in JSON percentiles; `unreachableCounts` records how many destinations each source cannot reach.

```sh
# Uniform node reach percentiles, using only the Python standard library.
python3 scripts/analyze.py results/ucb/distances-round-4.txt \
  --output results/ucb/reach.json

# Optional destination hash-power weights: one nonnegative value per matrix column.
python3 scripts/analyze.py results/ucb/distances-round-4.txt \
  --weights my-hash-weights.txt --percentiles 50,90,99 \
  --output results/ucb/weighted-reach.json

# Optional plot of sorted per-source reach delays.
python3 -m venv .venv
.venv/bin/pip install -r requirements-plot.txt
.venv/bin/python scripts/plot.py results/ucb/summary-round-4.json \
  results/subset/summary-round-4.json --percentile 90 --output results/comparison.png
```

Weighted analysis selects the first destination delay whose cumulative positive weight reaches the requested fraction. Uniform analysis uses the historical rank definition above. Supply weights in matrix-column order; the original repository does not identify a verified matrix-index-to-Bitnodes mapping.

## Library usage

Requiring the package does not run experiments, write files, or fetch data.

```js
const { loadMatrix, runSimulation } = require('./');

const weights = loadMatrix('./data/latency-matrix.txt', 100);
const result = runSimulation({
  weights,
  algorithm: 'ucb',
  seed: 'experiment-1',
  rounds: 4,
  subRounds: 20,
}, {
  onSnapshot({ round, distances, summary }) {
    console.log(round, summary.meanReach90);
  },
});

console.log(result.network.toJSON());
```

`runSimulation` accepts optional `nodeDelays` and `metadata` arrays aligned with the matrix. It returns `{ config, network, summaries, rounds }`. Snapshot matrices are passed to the callback instead of being retained for the whole run. The synchronous callback can save or inspect each checkpoint.

The package also exports `Network`, `createRandomNetwork`, `broadcast`, `shortestPaths`, `allPairsShortestPaths`, `UcbStrategy`, `runSubsetRound`, `runRandomRound`, seeded random utilities, and matrix/statistics helpers. A `UcbStrategy` instance belongs to one network. Its `history` maps node IDs to peer IDs to sorted numeric samples. Large runs retain those samples; storage grows with observations for surviving peers. All-pairs checkpoints require quadratic matrix storage.

## Data tools

The [dataset index](data/README.md) describes the retained original files. Custom input must be a square whitespace matrix of finite nonnegative latency values. `--nodes N` selects its top-left `N × N` block; this is not a random sample of matrix rows.

```sh
python3 scripts/build-delays.py --kind matrix --nodes 100 --seed demo \
  --output results/synthetic.txt
npm start -- --weights results/synthetic.txt --nodes 100

python3 scripts/build-delays.py --kind hash --nodes 100 --seed demo \
  --output results/hash-weights.txt
```

`scripts/fetch-locations.js` replaces the original IP lookup script. It requires explicit input, output, and endpoint arguments, performs sequential cached requests with timeouts and rate spacing, and expects provider JSON containing `countryCode` (or `country_code`) and `city`:

```sh
node scripts/fetch-locations.js --input data/raw/ip-link-delays.txt \
  --output results/country-city-delays.json \
  --endpoint 'https://YOUR_PROVIDER/path/{ip}' --interval-ms 2700
```

The provider receives the input IP addresses. Data collection is an explicit separate step and never runs as part of a simulation or test.

## Development

```sh
npm ci --ignore-scripts
npm run check
npm test
```

Tests cover independent shortest-path reference results, graph and degree invariants, saturated rewiring, persistent UCB history, subset selection, seeded reproducibility, invalid inputs, CLI output protection, and agreement between JavaScript and Python summaries. CI runs the checks on Node 22 and 24 with Python 3.12.

```text
src/core/         network, propagation, seeded randomness, statistics
src/algorithms/   peer observations and selection strategies
src/io/           matrix loading and result writing
src/config.js     validated experiment configuration
src/simulation.js reusable simulation runner
src/cli.js        command line interface
scripts/          analysis, optional plots, data preparation
data/             original datasets, consolidated without duplicate copies
test/             unit and integration tests
```

## License

The original repository has no license file. This refactor does not add or assume a license. Attribution from the original package metadata is retained.
