import test from 'node:test';
import assert from 'node:assert';
import {
  parseCsvText,
  parsePriceToPaise,
  mapCsvCategory,
  generateSlug,
  importCategoriesFromCsvDirectory,
  importProductsFromCsvDirectory,
} from '../../src/lib/server/csv-importer.ts';

test('CSV Parser — correctly parses RFC 4180 multiline and quoted strings', () => {
  const sample = `UID,Title,Price,Description\nS-01,"Product, with comma","₹1,500.00","Line 1\nLine 2"`;
  const rows = parseCsvText(sample);

  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0][0], 'UID');
  assert.strictEqual(rows[1][1], 'Product, with comma');
  assert.strictEqual(rows[1][2], '₹1,500.00');
  assert.strictEqual(rows[1][3], 'Line 1\nLine 2');
});

test('Price Parser — accurately converts INR currency strings to integer paise', () => {
  assert.strictEqual(parsePriceToPaise('₹2,400.00'), 240000);
  assert.strictEqual(parsePriceToPaise('₹149.00'), 14900);
  assert.strictEqual(parsePriceToPaise('1250'), 125000);
  assert.strictEqual(parsePriceToPaise(''), 0);
});

test('Category Mapper — correctly maps CSV category terms to approved category IDs', () => {
  assert.strictEqual(mapCsvCategory('Food & Grocery', 'Honey'), 'cat-honey');
  assert.strictEqual(mapCsvCategory('Food & Beverages', 'Zamzam Water'), 'cat-zamzam-water');
  assert.strictEqual(mapCsvCategory('Health Food', 'Takmeeli Talbeena'), 'cat-takmeeli-talbeena');
  assert.strictEqual(mapCsvCategory('Health Food', 'Barliva'), 'cat-barliva');
  assert.strictEqual(mapCsvCategory('Dry Fruits', 'Premium Dates'), 'cat-premium-dates');
});

test('Slug Generator — produces clean SEO URL slugs', () => {
  assert.strictEqual(generateSlug('100% Kashmiri Honey'), '100-kashmiri-honey');
  assert.strictEqual(generateSlug('Zamzam Water – 5 Litres'), 'zamzam-water-5-litres');
});

test('CSV Directory Ingestion — loads all 5 categories & 4 approved products from All_Docs/Products', () => {
  const categories = importCategoriesFromCsvDirectory();
  assert.strictEqual(categories.length, 5, 'Should parse all 5 approved categories from CSV');
  assert.deepStrictEqual(
    categories.map((c) => c.name),
    ['Honey', 'Zamzam Water', 'Takmeeli Talbeena', 'Barliva', 'Premium Dates']
  );

  const products = importProductsFromCsvDirectory();
  assert.strictEqual(products.length, 4, 'Should parse all 4 approved products from CSV');

  const kashmiriHoney = products.find((p) => p.id === 'S-01-P-01');
  assert.ok(kashmiriHoney, 'Should find product S-01-P-01 (100% Kashmiri Honey)');
  assert.strictEqual(kashmiriHoney?.brand, 'IC-HONEY');
  assert.strictEqual(kashmiriHoney?.categoryId, 'cat-honey');
  assert.strictEqual(kashmiriHoney?.variants[0].priceInPaise, 240000);
  assert.ok(kashmiriHoney?.media[0].externalUrl.includes('blogger.googleusercontent.com'));

  const zamzam = products.find((p) => p.id === 'S-01-P-02');
  assert.ok(zamzam, 'Should find product S-01-P-02 (Zamzam Water – 5 Litres)');
  assert.strictEqual(zamzam?.variants[0].priceInPaise, 600000);

  const talbeena = products.find((p) => p.id === 'S-01-P-03');
  assert.ok(talbeena, 'Should find product S-01-P-03 (Takmeeli Talbeena)');
  assert.strictEqual(talbeena?.variants[0].priceInPaise, 30000);

  const dates = products.find((p) => p.id === 'S-01-P-04');
  assert.ok(dates, 'Should find product S-01-P-04 (Premium Dates – 1 KG)');
  assert.strictEqual(dates?.variants[0].priceInPaise, 90000);
});
