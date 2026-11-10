#!/usr/bin/env python3
"""Generate a reproducible latency matrix, processing delays, or hash weights."""

import argparse
import math
import random
from pathlib import Path


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--nodes", type=int, default=1000)
    parser.add_argument("--seed", default="perigee")
    parser.add_argument("--kind", choices=("matrix", "processing", "hash"), default="matrix")
    parser.add_argument("--mean", type=float, default=200)
    parser.add_argument("--stddev", type=float, default=50)
    args = parser.parse_args(argv)
    if args.nodes < 1:
        parser.error("--nodes must be positive")
    if any(not math.isfinite(value) or value < 0 for value in (args.mean, args.stddev)):
        parser.error("--mean and --stddev must be finite and nonnegative")
    rng = random.Random(args.seed)
    if args.kind == "matrix":
        matrix = [[0.0] * args.nodes for _ in range(args.nodes)]
        for row in range(args.nodes):
            for column in range(row + 1, args.nodes):
                matrix[row][column] = matrix[column][row] = max(0, rng.gauss(args.mean, args.stddev))
    elif args.kind == "processing":
        matrix = [[max(0, rng.gauss(args.mean, args.stddev)) for _ in range(args.nodes)]]
    else:
        weights = [rng.expovariate(1) for _ in range(args.nodes)]
        scale = args.nodes / sum(weights)
        matrix = [[weight * scale for weight in weights]]
    try:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text("".join("  ".join(format(value, ".12g") for value in row) + "\n" for row in matrix), encoding="utf-8")
        print(args.output)
    except OSError as error:
        parser.exit(1, f"error: {error}\n")


if __name__ == "__main__":
    main()
