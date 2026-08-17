# Answer format contract for closed-form analysis questions

This file exists because the RELAI optimizer cannot read `.relai/benchmarks/`: that
prefix is on its hardcoded snapshot exclusion list, so the scoring code is invisible
to it. Without this note it is asked to produce exactly-matching output while unable
to see what "matching" means. Everything below mirrors the grader exactly.

## How an answer is extracted

Only text matching this pattern is read from the reply:

    @([a-zA-Z0-9_]+)\[([^\]]+)\]

So `@mean_fare[34.65]` yields the field `mean_fare` with value `34.65`. Prose is
ignored entirely. A correct number stated in a sentence scores zero.

## How a value is compared

For each expected field, in this order:

1. exact string equality, then
2. if both sides parse as floats, equal when `abs(a - b) < 1e-6`.

A field the reply never emits is wrong. A question is correct only when **every**
expected field is correct; partial credit is reported separately but does not make
a question pass.

## What this implies for analysis

These follow directly from exact matching, and are the conventions that most often
decide correctness:

- **Rounding.** Round once, at the end, to the number of decimal places the question
  asks for. Rounding an intermediate value and then rounding again shifts the last
  digit, which fails a `1e-6` comparison.
- **Standard deviation.** State which convention you used. `numpy.std` defaults to
  population (`ddof=0`) while `pandas.Series.std` defaults to sample (`ddof=1`); the
  two differ in the digits an exact match depends on.
- **Outlier thresholds.** When a question names a method such as Z-score, use its
  stated threshold literally rather than a default from another convention. The count
  of outliers changes every downstream statistic.
- **Ordering.** When a question says "previous" or "next", follow the row order the
  file supplies unless it explicitly asks for chronological order.
- **Serialization.** When a field's value is a dict or list, reproduce the exact
  spacing of the requested format, including a space after each colon and comma.
  `{'A': 0, 'B': 1}` and `{'A':0, 'B':1}` are different strings and only one matches.
- **Emit the answer last.** Put the formatted answer on its own line at the end of
  the reply. A reply that reasons well but never emits the pattern scores zero.
