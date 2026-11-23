import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateOrganizationSchema,
  generateWebSiteSchema,
  generateProductSchema,
  generateBreadcrumbSchema,
  generateArticleSchema,
  generateFAQSchema,
} from '../../src/lib/services/structured-data.ts';
import robots from '../../src/app/robots.ts';
import sitemap from '../../src/app/sitemap.ts';
import { getAllProducts } from '../../src/lib/data/products.ts';
import { getAllBlogPosts } from '../../src/lib/data/blog.ts';
import { BRAND } from '../../src/lib/constants/brand.ts';

test('SEO & Schema.org JSON-LD Generation (PRD 14)', async (t) => {
  await t.test('Organization schema embeds verified brand identity & East Champaran address', () => {
    const schema = generateOrganizationSchema();
    assert.equal(schema['@type'], 'Organization');
    assert.equal(schema.name, 'InfiniCharm');
    assert.equal(schema.legalName, 'Techily Fly');
    assert.equal(schema.founder.name, 'AbdurRahman Ibn Ghufran');
    assert.equal(schema.address.postalCode, '845427');
    assert.equal(schema.address.addressRegion, 'Bihar');
    assert.ok(schema.contactPoint.length > 0);
    assert.equal(schema.contactPoint[0].email, 'support@infinicharm.com');
  });

  await t.test('WebSite schema embeds SearchAction entrypoint', () => {
    const schema = generateWebSiteSchema();
    assert.equal(schema['@type'], 'WebSite');
    assert.equal(schema.name, 'InfiniCharm');
    assert.ok(schema.potentialAction.target.urlTemplate.includes('/shop?q='));
  });

  await t.test('Product & Offer schema converts integer paise to INR decimal price', () => {
    const products = getAllProducts();
    const mustardOil = products.find((p) => p.slug === 'kachi-ghani-mustard-oil') || products[0];
    const schema = generateProductSchema(mustardOil, mustardOil.variants[0]);

    assert.equal(schema['@type'], 'Product');
    assert.equal(schema.name, mustardOil.title);
    assert.equal(schema.sku, mustardOil.variants[0].sku);
    assert.equal(schema.offers.priceCurrency, 'INR');
    
    // Check decimal price calculation: priceInPaise / 100
    const expectedPrice = (mustardOil.variants[0].priceInPaise / 100).toFixed(2);
    assert.equal(schema.offers.price, expectedPrice);
    assert.equal(schema.offers.availability, 'https://schema.org/InStock');
    assert.equal(schema.countryOfOrigin.name, 'India');
  });

  await t.test('BreadcrumbList schema maintains hierarchical positioning', () => {
    const crumbs = [
      { name: 'Home', url: '/' },
      { name: 'Edible Oils', url: '/shop?category=edible-oils' },
      { name: 'Kachi Ghani Mustard Oil', url: '/product/kachi-ghani-mustard-oil' },
    ];
    const schema = generateBreadcrumbSchema(crumbs);

    assert.equal(schema['@type'], 'BreadcrumbList');
    assert.equal(schema.itemListElement.length, 3);
    assert.equal(schema.itemListElement[0].position, 1);
    assert.equal(schema.itemListElement[1].position, 2);
    assert.equal(schema.itemListElement[2].position, 3);
  });

  await t.test('Article schema embeds author credentials and timestamps', () => {
    const posts = getAllBlogPosts();
    const schema = generateArticleSchema(posts[0]);

    assert.equal(schema['@type'], 'Article');
    assert.equal(schema.headline, posts[0].title);
    assert.equal(schema.author.name, posts[0].authorName);
    assert.ok(schema.datePublished);
    assert.ok(schema.publisher.logo.url);
  });

  await t.test('FAQPage schema creates valid Question & Answer entities', () => {
    const faqs = [
      { question: 'Where is dispatch center?', answer: 'East Champaran, Bihar - 845427' },
      { question: 'Is mustard oil cold pressed?', answer: 'Yes, wooden kachi ghani.' },
    ];
    const schema = generateFAQSchema(faqs);

    assert.equal(schema['@type'], 'FAQPage');
    assert.equal(schema.mainEntity.length, 2);
    assert.equal(schema.mainEntity[0].name, 'Where is dispatch center?');
    assert.equal(schema.mainEntity[0].acceptedAnswer.text, 'East Champaran, Bihar - 845427');
  });
});

test('Crawler Robots & Dynamic Sitemap (PRD 14 & 16)', async (t) => {
  await t.test('robots.ts disallows administrative and checkout perimeters', () => {
    const config = robots();
    assert.ok(config.rules);
    const rule = Array.isArray(config.rules) ? config.rules[0] : config.rules;
    assert.equal(rule.allow, '/');
    const disallowList = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow || ''];
    assert.ok(disallowList.includes('/admin/'));
    assert.ok(disallowList.includes('/account/'));
    assert.ok(disallowList.includes('/checkout/'));
    const sitemapTarget = Array.isArray(config.sitemap) ? config.sitemap[0] : config.sitemap || '';
    assert.ok(sitemapTarget.endsWith('/sitemap.xml'));
  });

  await t.test('sitemap.ts enumerates all public static and dynamic URLs', () => {
    const entries = sitemap();
    assert.ok(entries.length >= 25);
    const urls = entries.map((e) => e.url);

    // Static pages
    assert.ok(urls.some((u) => u === 'https://www.infinicharm.com'));
    assert.ok(urls.some((u) => u.endsWith('/shop')));
    assert.ok(urls.some((u) => u.endsWith('/about')));
    assert.ok(urls.some((u) => u.endsWith('/contact')));
    assert.ok(urls.some((u) => u.endsWith('/faq')));
    assert.ok(urls.some((u) => u.endsWith('/blog')));

    // 6 Statutory policies
    assert.ok(urls.some((u) => u.endsWith('/policies/shipping')));
    assert.ok(urls.some((u) => u.endsWith('/policies/returns')));
    assert.ok(urls.some((u) => u.endsWith('/policies/refunds')));
    assert.ok(urls.some((u) => u.endsWith('/policies/privacy')));
    assert.ok(urls.some((u) => u.endsWith('/policies/terms')));
    assert.ok(urls.some((u) => u.endsWith('/policies/compliance')));

    // Products & blog posts
    assert.ok(urls.some((u) => u.includes('/product/')));
    assert.ok(urls.some((u) => u.includes('/blog/')));
  });
});
