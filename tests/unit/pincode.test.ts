import { describe, it } from 'node:test';
import assert from 'node:assert';
import { lookupPinCode } from '../../src/lib/utils/pincode.ts';

describe('Indian PIN Code Auto-Fill Utility', () => {
  it('correctly resolves brand origin East Champaran PIN code', () => {
    const info = lookupPinCode('845427');
    assert.ok(info !== null);
    assert.strictEqual(info?.district, 'East Champaran');
    assert.strictEqual(info?.state, 'Bihar');
  });

  it('correctly resolves major metro postal circles', () => {
    const delhi = lookupPinCode('110001');
    assert.ok(delhi !== null);
    assert.strictEqual(delhi?.state, 'Delhi');

    const bangalore = lookupPinCode('560001');
    assert.ok(bangalore !== null);
    assert.strictEqual(bangalore?.state, 'Karnataka');
  });

  it('returns null for invalid PIN codes', () => {
    assert.strictEqual(lookupPinCode('123'), null);
    assert.strictEqual(lookupPinCode('ABCDEF'), null);
  });
});
