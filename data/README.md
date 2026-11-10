# Bundled data

All datasets below are retained from the original repository. The refactor does not establish their measurement dates, accuracy, licensing, or node identity mapping. Files were moved without changing their contents; duplicate copies were consolidated.

| Current file | Original path(s) | Use |
| --- | --- | --- |
| `latency-matrix.txt` | `weight1`, `src/weight1` | Default 1000 × 1000 symmetric link matrix |
| `alternate-latency-matrix.txt` | `graphWeights`, `src/graphWeights` | Alternate 1000 × 1000 symmetric matrix |
| `raw/bitnodes.json` | `Data/bitnodes.json` | Original node snapshot |
| `raw/oldbitnodes.json` | `Data/oldbitnodes.json` | Older node snapshot |
| `raw/country-city-delays.json` | `Data/delays.json`, `newDelays.json` | Grouped country/city samples |
| `raw/countries.txt` | `Data/countries.txt` | Country code list |
| `raw/link-delays.txt` | `Data/linkDelays.txt` | Historical delay vector |
| `raw/planetlab-latencies.txt` | `Data/pl_latencies.txt` | Original latency records |
| `raw/legacy-delays.txt` | `Data/delays` | Other historical delay records |
| `raw/ip-link-delays.txt` | `linkipsdelays` | IP/IP/delay lookup input |
| `raw/legacy-country-delays.json` | `delays.json` | Distinct historical country samples |
| `raw/original-country-delays.json` | `orignialDealys.json` | Distinct original samples |
| `raw/example-delays.txt` | `testdelays` | Small historical sample |
| `raw/example-graph.json` | `src/graph.json` | Historical graph snapshot |

The default simulator uses only `latency-matrix.txt`. It selects the top-left block for smaller experiments and assigns numeric node IDs. The raw node snapshots were previously sampled independently from the loaded matrix; they do not prove an index-to-IP or index-to-country mapping. For meaningful labeled nodes, supply your own verified aligned `metadata` to the library runner.

Matrix values must be finite and nonnegative. The bundled matrices contain zero off-diagonal delays; these are retained as zero rather than treated as missing. Synthetic data can be generated separately using `scripts/build-delays.py`.
