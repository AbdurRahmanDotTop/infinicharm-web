import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAuditLogs, logAdminAction } from '../../src/lib/services/audit.ts';
import { CATEGORIES } from '../../src/lib/constants/categories.ts';
import { INITIAL_BLOG_POSTS } from '../../src/lib/data/blog.ts';
import { BRAND } from '../../src/lib/constants/brand.ts';

test('Audit Logging Service - initialization & recording', async (t) => {
  await t.test('returns initial audit entries in non-browser environment', () => {
    const logs = getAuditLogs();
    assert.ok(Array.isArray(logs));
    assert.ok(logs.length >= 2);
    assert.equal(logs[0].actorEmail, 'admin@infinicharm.com');
  });

  await t.test('logAdminAction generates valid immutable entry', () => {
    const entry = logAdminAction(
      'UPDATE_PRODUCT_STOCK',
      'product_variants',
      'var-oil-1l',
      { before: 10, after: 15 },
      'admin@infinicharm.com'
    );

    assert.ok(entry.id.startsWith('aud-'));
    assert.equal(entry.action, 'UPDATE_PRODUCT_STOCK');
    assert.equal(entry.resourceType, 'product_variants');
    assert.equal(entry.resourceId, 'var-oil-1l');
    assert.deepEqual(entry.diff, { before: 10, after: 15 });
    assert.equal(entry.actorEmail, 'admin@infinicharm.com');
    assert.ok(entry.createdAt);
  });
});

test('Category Taxonomy & Governance Integrity', async (t) => {
  await t.test('defines all 5 approved categories from Single Source of Truth', () => {
    assert.equal(CATEGORIES.length, 5);
    const slugs = CATEGORIES.map((c) => c.slug);
    assert.ok(slugs.includes('honey'));
    assert.ok(slugs.includes('zamzam-water'));
    assert.ok(slugs.includes('takmeeli-talbeena'));
    assert.ok(slugs.includes('barliva'));
    assert.ok(slugs.includes('premium-dates'));
  });

  await t.test('all categories enforce statutory compliance requirement', () => {
    CATEGORIES.forEach((cat) => {
      assert.ok(cat.complianceRequirement && cat.complianceRequirement.length > 5);
      assert.ok(cat.name && cat.name.length > 0);
      assert.ok(cat.description && cat.description.length > 10);
    });
  });
});

test('Blog & Editorial CMS Integrity', async (t) => {
  await t.test('initial blog articles contain authoritative content', () => {
    assert.ok(INITIAL_BLOG_POSTS.length >= 3);
    INITIAL_BLOG_POSTS.forEach((post) => {
      assert.ok(post.id);
      assert.ok(post.title);
      assert.ok(post.slug);
      assert.ok(post.authorName);
      assert.ok(post.contentMarkdown.length > 100);
      assert.equal(post.status, 'PUBLISHED');
      assert.ok(post.seoTitle);
      assert.ok(post.seoDescription);
    });
  });
});

test('Brand & Regulatory Policy Suite', async (t) => {
  await t.test('publishes all 6 mandatory Indian e-commerce policies', () => {
    assert.equal(BRAND.policies.length, 6);
    const policyHrefs = BRAND.policies.map((p) => p.href);
    assert.ok(policyHrefs.includes('/policies/shipping'));
    assert.ok(policyHrefs.includes('/policies/returns'));
    assert.ok(policyHrefs.includes('/policies/refunds'));
    assert.ok(policyHrefs.includes('/policies/privacy'));
    assert.ok(policyHrefs.includes('/policies/terms'));
    assert.ok(policyHrefs.includes('/policies/compliance'));
  });

  await t.test('authoritative dispatch location & leadership preserved', () => {
    assert.equal(BRAND.name, 'InfiniCharm');
    assert.equal(BRAND.operatingEntity, 'TechilyFly');
    assert.equal(BRAND.founder, 'AbdurRahman Ibn Ghufran');
    assert.equal(BRAND.contact.address.postalCode, '845427');
    assert.equal(BRAND.contact.address.district, 'East Champaran');
    assert.equal(BRAND.contact.address.state, 'Bihar');
  });
});

