import fs from 'fs';

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } });
    return { url, status: res.status, ok: res.ok };
  } catch (err) {
    return { url, status: 'ERROR', error: err.message };
  }
}

async function run() {
  const pageContent = fs.readFileSync('src/app/(storefront)/page.tsx', 'utf-8');
  const productsContent = fs.readFileSync('src/lib/data/products.ts', 'utf-8');
  
  const allText = pageContent + '\n' + productsContent;
  const matches = [...allText.matchAll(/https:\/\/[^'"\s)]+/g)].map(m => m[0]);
  const uniqueUrls = [...new Set(matches)].filter(u => 
    u.includes('unsplash.com') || 
    u.includes('googleusercontent.com') || 
    u.includes('supabase.co') ||
    u.endsWith('.jpg') || 
    u.endsWith('.png') || 
    u.endsWith('.webp')
  );

  console.log(`Checking ${uniqueUrls.length} image URLs...`);
  const results = await Promise.all(uniqueUrls.map(checkUrl));
  
  let failed = 0;
  for (const r of results) {
    if (!r.ok) {
      console.log(`FAILED (${r.status}): ${r.url}`);
      failed++;
    }
  }
  
  if (failed === 0) {
    console.log(`ALL ${uniqueUrls.length} image URLs returned 200 OK!`);
  } else {
    console.log(`${failed} URLs failed.`);
  }
}

run();

