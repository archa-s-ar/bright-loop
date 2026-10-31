// src/utils/decimal.js
// Decimal-safe arithmetic helpers using Prisma.Decimal (decimal.js under the hood).
// ALL pricing, tax and discount calculations MUST use these helpers.

const { Prisma } = require('@prisma/client');

const ZERO = new Prisma.Decimal(0);

/**
 * Safely convert a value to Prisma.Decimal.
 * @param {string|number|Prisma.Decimal} val
 * @returns {Prisma.Decimal}
 */
function toDecimal(val) {
  if (val instanceof Prisma.Decimal) return val;
  return new Prisma.Decimal(val ?? 0);
}

/**
 * Add two decimal values.
 */
function add(a, b) {
  return toDecimal(a).plus(toDecimal(b));
}

/**
 * Subtract b from a.
 */
function subtract(a, b) {
  return toDecimal(a).minus(toDecimal(b));
}

/**
 * Multiply two decimal values.
 */
function multiply(a, b) {
  return toDecimal(a).times(toDecimal(b));
}

/**
 * Divide a by b. Returns ZERO if b is zero.
 */
function divide(a, b) {
  const dB = toDecimal(b);
  if (dB.isZero()) return ZERO;
  return toDecimal(a).dividedBy(dB);
}

/**
 * Round to 2 decimal places (banker's rounding / ROUND_HALF_UP).
 */
function round2(val) {
  return toDecimal(val).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Clamp a value so it never goes below zero.
 */
function clampPositive(val) {
  const d = toDecimal(val);
  return d.lessThan(ZERO) ? ZERO : d;
}

/**
 * Format a Decimal as a string with 2 decimal places.
 */
function format(val) {
  return round2(val).toFixed(2);
}

module.exports = { toDecimal, add, subtract, multiply, divide, round2, clampPositive, format, ZERO };
