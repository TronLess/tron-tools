/**
 * @tronless/tron-units
 * BigInt-safe conversions between SUN and TRX, and generic token-decimal helpers.
 * 1 TRX = 1,000,000 SUN. USDT TRC-20 has 6 decimals.
 */

export const TRX_DECIMALS = 6;
export const SUN_PER_TRX = 1_000_000n;

/** Well-known mainnet TRC-20 tokens (decimals as published on TronScan). */
export const TOKENS = Object.freeze({
  TRX: Object.freeze({ symbol: 'TRX', decimals: 6, address: null, name: 'TRON' }),
  USDT: Object.freeze({ symbol: 'USDT', decimals: 6, address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', name: 'Tether USD' }),
  USDC: Object.freeze({ symbol: 'USDC', decimals: 6, address: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8', name: 'USD Coin' }),
  USDD: Object.freeze({ symbol: 'USDD', decimals: 18, address: 'TPYmHEhy5n8TCEfYGqW2rPxsghSfzghPDn', name: 'Decentralized USD' }),
  WTRX: Object.freeze({ symbol: 'WTRX', decimals: 6, address: 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR', name: 'Wrapped TRX' }),
  TUSD: Object.freeze({ symbol: 'TUSD', decimals: 18, address: 'TUpMhErZL2fhh4sVNULAbNKLokS4GjC1F4', name: 'TrueUSD' }),
  BTT: Object.freeze({ symbol: 'BTT', decimals: 18, address: 'TAFjULxiVgT4qTk6u9RXaJKrhPRAfuCQoa', name: 'BitTorrent' }),
  JST: Object.freeze({ symbol: 'JST', decimals: 18, address: 'TCFLL5dx5ZJdKnWuesXxi1VPwjLVmWZZy9', name: 'JUST' }),
  SUN: Object.freeze({ symbol: 'SUN', decimals: 18, address: 'TSSMHYeV2uE9qYH95DqyoCuNCzEL1NvU3S', name: 'SUN' }),
  WIN: Object.freeze({ symbol: 'WIN', decimals: 6, address: 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wQSqE', name: 'WINkLink' }),
});

function assertDecimals(decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 77) {
    throw new RangeError(`decimals must be an integer between 0 and 77, got ${decimals}`);
  }
}

/**
 * Parse a human decimal amount ("1.5") into the smallest unit as BigInt.
 * Accepts string, number (must be finite; strings are safer), or bigint (treated as whole units).
 * Throws if the value has more fractional digits than `decimals`.
 * @param {string|number|bigint} value
 * @param {number} decimals
 * @returns {bigint}
 */
export function parseUnits(value, decimals) {
  assertDecimals(decimals);
  if (typeof value === 'bigint') return value * 10n ** BigInt(decimals);
  let str = typeof value === 'number' ? numberToPlainString(value) : String(value).trim();
  if (!/^-?\d*(\.\d*)?$/.test(str) || str === '' || str === '-' || str === '.' || str === '-.') {
    throw new SyntaxError(`Invalid decimal amount: ${JSON.stringify(value)}`);
  }
  let negative = false;
  if (str.startsWith('-')) {
    negative = true;
    str = str.slice(1);
  }
  const [wholeRaw, fracRaw = ''] = str.split('.');
  const whole = wholeRaw || '0';
  if (fracRaw.length > decimals) {
    throw new RangeError(`Too many decimal places: ${JSON.stringify(value)} has ${fracRaw.length}, max ${decimals}`);
  }
  const frac = fracRaw.padEnd(decimals, '0');
  const result = BigInt(whole + frac);
  return negative ? -result : result;
}

/**
 * Format a smallest-unit integer as a decimal string.
 * @param {bigint|string|number} raw
 * @param {number} decimals
 * @param {{trim?: boolean, fixed?: number, thousands?: boolean}} [options]
 *   trim (default true) removes trailing zeros; fixed forces N decimals; thousands adds separators.
 * @returns {string}
 */
export function formatUnits(raw, decimals, options = {}) {
  assertDecimals(decimals);
  let n = typeof raw === 'bigint' ? raw : BigInt(typeof raw === 'number' ? Math.trunc(raw) : String(raw).trim());
  const negative = n < 0n;
  if (negative) n = -n;
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  let frac = (n % base).toString().padStart(decimals, '0');
  if (options.fixed !== undefined) {
    frac = frac.slice(0, options.fixed).padEnd(options.fixed, '0');
  } else if (options.trim !== false) {
    frac = frac.replace(/0+$/, '');
  }
  let wholeStr = whole.toString();
  if (options.thousands) wholeStr = wholeStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const out = frac.length ? `${wholeStr}.${frac}` : wholeStr;
  return negative ? `-${out}` : out;
}

/** TRX → SUN (bigint). `toSun("1.5") === 1500000n` */
export function toSun(trx) {
  return parseUnits(trx, TRX_DECIMALS);
}

/** SUN → TRX string. `fromSun(1500000) === "1.5"` */
export function fromSun(sun, options) {
  return formatUnits(sun, TRX_DECIMALS, options);
}

/** SUN → JS number (float). Fine for display, do not use for accounting. */
export function sunToNumber(sun) {
  return Number(fromSun(sun));
}

/** Format SUN as "1.5 TRX". */
export function formatTrx(sun, options = {}) {
  return `${fromSun(sun, options)} TRX`;
}

/**
 * Resolve a token descriptor from a symbol (e.g. "USDT"), a decimals number, or an object {decimals, symbol}.
 * @param {string|number|{decimals:number, symbol?:string}} token
 */
export function resolveToken(token) {
  if (typeof token === 'number') return { symbol: '', decimals: token, address: null };
  if (typeof token === 'string') {
    const t = TOKENS[token.toUpperCase()];
    if (!t) throw new Error(`Unknown token symbol "${token}". Pass { decimals } explicitly.`);
    return t;
  }
  if (token && typeof token === 'object' && Number.isInteger(token.decimals)) return token;
  throw new Error('token must be a symbol, decimals number or { decimals } object');
}

/** Human amount → raw token units. `parseToken("12.5", "USDT") === 12500000n` */
export function parseToken(value, token) {
  return parseUnits(value, resolveToken(token).decimals);
}

/** Raw token units → human amount. `formatToken(12500000n, "USDT") === "12.5"` */
export function formatToken(raw, token, options) {
  return formatUnits(raw, resolveToken(token).decimals, options);
}

/** Raw token units → "12.5 USDT". */
export function formatTokenAmount(raw, token, options) {
  const t = resolveToken(token);
  return `${formatUnits(raw, t.decimals, options)}${t.symbol ? ` ${t.symbol}` : ''}`;
}

/** JSON.stringify replacer that turns BigInt into strings. */
export function bigintReplacer(_key, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

function numberToPlainString(num) {
  if (!Number.isFinite(num)) throw new RangeError(`Not a finite number: ${num}`);
  const s = String(num);
  if (!/e/i.test(s)) return s;
  // Expand exponent notation without floating-point rounding surprises.
  const [mant, expStr] = s.toLowerCase().split('e');
  const exp = Number(expStr);
  const negative = mant.startsWith('-');
  const digits = mant.replace('-', '').replace('.', '');
  const pointIndex = (mant.replace('-', '').split('.')[0] || '').length + exp;
  let out;
  if (pointIndex <= 0) out = `0.${'0'.repeat(-pointIndex)}${digits}`;
  else if (pointIndex >= digits.length) out = digits + '0'.repeat(pointIndex - digits.length);
  else out = `${digits.slice(0, pointIndex)}.${digits.slice(pointIndex)}`;
  return negative ? `-${out}` : out;
}

export default {
  TRX_DECIMALS,
  SUN_PER_TRX,
  TOKENS,
  parseUnits,
  formatUnits,
  toSun,
  fromSun,
  sunToNumber,
  formatTrx,
  resolveToken,
  parseToken,
  formatToken,
  formatTokenAmount,
  bigintReplacer,
};
