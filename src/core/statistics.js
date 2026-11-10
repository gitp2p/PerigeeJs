'use strict';

function validateValues(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new RangeError('Expected a nonempty array of numbers');
  }
  if (Array.from(values).some((value) => typeof value !== 'number' || Number.isNaN(value))) {
    throw new TypeError('Statistics require numbers without NaN');
  }
}

/** Historical order statistic: index floor(p * n), clamped at n - 1. */
function quantile(values, p) {
  validateValues(values);
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    throw new RangeError('Quantile must be between 0 and 1');
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

function mean(values) {
  validateValues(values);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

module.exports = { quantile, mean };
