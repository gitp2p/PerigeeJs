#!/usr/bin/env python3
"""Summarize per-source reach delays from a whitespace distance matrix."""

import argparse
import json
import math
from pathlib import Path


def read_matrix(path):
    rows = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append([float(value) for value in line.split()])
    if not rows or any(len(row) != len(rows) for row in rows):
        raise ValueError("distance matrix must be nonempty and square")
    if any(math.isnan(value) or value < 0 for row in rows for value in row):
        raise ValueError("distances must be nonnegative numbers or Infinity")
    return rows


def read_weights(path, size):
    weights = [float(value) for value in Path(path).read_text(encoding="utf-8").split()]
    if len(weights) != size:
        raise ValueError("weight count must equal the number of matrix columns")
    if any(not math.isfinite(value) or value < 0 for value in weights):
        raise ValueError("weights must be finite and nonnegative")
    if not math.isfinite(sum(weights)) or sum(weights) <= 0:
        raise ValueError("weights must have a finite positive total")
    return weights


def reach_delay(delays, fraction, weights=None):
    """Use historical floor(p*n) ranks or cumulative weighted reach."""
    if not 0 <= fraction <= 1:
        raise ValueError("percentiles must lie between 0 and 100")
    if weights is None:
        ordered = sorted(delays)
        return ordered[min(math.floor(fraction * len(ordered)), len(ordered) - 1)]
    ordered = sorted((delay, weight) for delay, weight in zip(delays, weights) if weight > 0)
    target = fraction * sum(weights)
    cumulative = 0.0
    for delay, weight in ordered:
        cumulative += weight
        if cumulative >= target:
            return delay
    return ordered[-1][0]


def summarize(matrix, percentiles, weights=None):
    values = {}
    for percentile in percentiles:
        results = [reach_delay(row, percentile / 100, weights) for row in matrix]
        values[format(percentile, "g")] = [value if math.isfinite(value) else None for value in results]
    return {
        "nodeCount": len(matrix),
        "weighted": weights is not None,
        "percentiles": values,
        "unreachableCounts": [sum(math.isinf(value) for value in row) for row in matrix],
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("matrix", type=Path, help="whitespace-delimited square distance matrix")
    parser.add_argument("--output", type=Path, help="default: MATRIX.summary.json")
    parser.add_argument("--weights", type=Path, help="optional whitespace-separated destination hash weights")
    parser.add_argument("--percentiles", default="50,90", help="comma-separated percentages, default: 50,90")
    args = parser.parse_args(argv)
    try:
        percentiles = [float(value) for value in args.percentiles.split(",")]
        if any(not math.isfinite(value) or not 0 <= value <= 100 for value in percentiles):
            raise ValueError("percentiles must lie between 0 and 100")
        matrix = read_matrix(args.matrix)
        weights = read_weights(args.weights, len(matrix)) if args.weights else None
        result = summarize(matrix, percentiles, weights)
        result["source"] = str(args.matrix.resolve())
        output = args.output or Path(str(args.matrix) + ".summary.json")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        print(output)
    except (OSError, ValueError) as error:
        parser.exit(1, f"error: {error}\n")


if __name__ == "__main__":
    main()
