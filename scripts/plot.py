#!/usr/bin/env python3
"""Plot sorted reach delays from one or more analyze.py summary files."""

import argparse
import json
import math
from pathlib import Path


def load_series(path, percentile):
    """Validate a summary and return sorted finite values and a distinct label."""
    if not math.isfinite(percentile) or not 0 <= percentile <= 100:
        raise ValueError("percentile must lie between 0 and 100")
    path = Path(path)
    summary = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(summary, dict):
        raise ValueError(f"{path}: summary must be a JSON object")
    size = summary.get("nodeCount")
    if isinstance(size, bool) or not isinstance(size, int) or size < 1:
        raise ValueError(f"{path}: nodeCount must be a positive integer")
    key = format(percentile, "g")
    percentiles = summary.get("percentiles")
    if not isinstance(percentiles, dict) or key not in percentiles:
        raise ValueError(f"{path}: summary has no percentile {key}")
    values = percentiles[key]
    if not isinstance(values, list) or len(values) != size:
        raise ValueError(f"{path}: percentile {key} must contain nodeCount values")
    if any(value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or
                                  not math.isfinite(value) or value < 0) for value in values):
        raise ValueError(f"{path}: percentile values must be finite nonnegative numbers or null")
    finite = sorted(value for value in values if value is not None)
    label = f"{path.resolve().parent.name}/{path.stem}"
    if len(finite) != len(values):
        label += f" ({len(values) - len(finite)} unreachable omitted)"
    return finite, label


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("summaries", nargs="+", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--percentile", type=float, default=90)
    args = parser.parse_args(argv)
    try:
        series = [load_series(path, args.percentile) for path in args.summaries]
        import matplotlib
        matplotlib.use("Agg")
        from matplotlib import pyplot as plt
        figure, axis = plt.subplots()
        key = format(args.percentile, "g")
        for finite, label in series:
            axis.plot(range(1, len(finite) + 1), finite, label=label)
        axis.set_xlabel("Source nodes sorted by reach delay")
        axis.set_ylabel(f"Delay to reach {key}% of destination weight")
        axis.grid(alpha=0.3)
        axis.legend()
        figure.tight_layout()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        figure.savefig(args.output, dpi=150)
        plt.close(figure)
        print(args.output)
    except ImportError:
        parser.exit(1, "error: plotting requires pip install -r requirements-plot.txt\n")
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(1, f"error: {error}\n")


if __name__ == "__main__":
    main()
