import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BRAND } from '../../src/lib/constants/brand.ts';
import { CATEGORIES } from '../../src/lib/constants/categories.ts';

describe('Brand Identity & Categories Source of Truth', () => {
  it('contains verified brand information matching official documents', () => {
    assert.strictEqual(BRAND.name, 'InfiniCharm');
    assert.strictEqual(BRAND.operatingEntity, 'TechilyFly');
    assert.strictEqual(BRAND.founder, 'AbdurRahman Ibn Ghufran');
    assert.strictEqual(BRAND.founderWebsite, 'https://www.abdurrahman.top');
    assert.strictEqual(BRAND.contact.supportEmail, 'support@infinicharm.com');
    assert.strictEqual(BRAND.contact.adminEmail, 'admin@infinicharm.com');
    assert.strictEqual(BRAND.contact.address.postalCode, '845427');
    assert.strictEqual(BRAND.contact.address.state, 'Bihar');
  });

  it('declares all 5 approved Single-Source-of-Truth categories', () => {
    assert.strictEqual(CATEGORIES.length, 5);

    const slugs = CATEGORIES.map((c) => c.slug);
    assert.ok(slugs.includes('honey'));
    assert.ok(slugs.includes('zamzam-water'));
    assert.ok(slugs.includes('takmeeli-talbeena'));
    assert.ok(slugs.includes('barliva'));
    assert.ok(slugs.includes('premium-dates'));
  });
});
