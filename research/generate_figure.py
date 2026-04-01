#!/usr/bin/env python3

import csv
import sys
from pathlib import Path

import matplotlib.pyplot as plt


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: generate_figure.py <input-csv> <output-png> <title>", file=sys.stderr)
        return 1

    input_csv = Path(sys.argv[1])
    output_png = Path(sys.argv[2])
    title = sys.argv[3]

    xs = []
    ys = []
    with input_csv.open("r", encoding="utf-8") as handle:
      reader = csv.DictReader(handle)
      for row in reader:
          xs.append(float(row["x"]))
          ys.append(float(row["y"]))

    plt.style.use("seaborn-v0_8-whitegrid")
    fig, ax = plt.subplots(figsize=(7.2, 4.5))
    ax.plot(xs, ys, color="#145DA0", linewidth=2.5, marker="o", markersize=5)
    ax.set_title(title, fontsize=13, pad=12)
    ax.set_xlabel("Condition index")
    ax.set_ylabel("Observed response")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.tight_layout()
    output_png.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_png, dpi=220)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
