import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatPaise, rupeesToPaise } from '../../src/lib/utils/currency.ts';

describe('Currency Utility (Integer Paise Standard)', () => {
  it('formats integer paise correctly into INR currency strings', () => {
    const formatted = formatPaise(49900);
    assert.ok(formatted.includes('499.00'), `Expected 499.00 in ${formatted}`);
    assert.ok(formatted.includes('₹'), `Expected ₹ in ${formatted}`);
  });

  it('handles zero paise gracefully', () => {
    const formatted = formatPaise(0);
    assert.ok(formatted.includes('0.00'), `Expected 0.00 in ${formatted}`);
    assert.ok(formatted.includes('₹'), `Expected ₹ in ${formatted}`);
  });

  it('converts rupee numbers and strings to integer paise accurately', () => {
    assert.strictEqual(rupeesToPaise(499.5), 49950);
    assert.strictEqual(rupeesToPaise('499.99'), 49999);
    assert.strictEqual(rupeesToPaise(1200), 120000);
    assert.strictEqual(rupeesToPaise('invalid'), 0);
  });
});
