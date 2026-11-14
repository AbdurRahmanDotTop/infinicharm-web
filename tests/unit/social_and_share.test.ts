import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import {
  getSocialAndShareSettings,
  getPublicSocialAndShareSettings,
  updateShareSettings,
  addSocialLink,
  updateSocialLink,
  deleteSocialLink,
  reorderSocialLinks,
} from '../../src/lib/server/social-share-store.ts';

describe('Social Media Links & Content Sharing Single Source of Truth', () => {
  const rootDir = path.resolve(process.cwd(), '..', '..');
  const socialLinksMdPath = path.join(
    rootDir,
    'All_Docs',
    'Credentials_and_other',
    'SocialLinks.md'
  );

  it('verifies SocialLinks.md exists and contains verified links', () => {
    assert.ok(fs.existsSync(socialLinksMdPath), 'SocialLinks.md must exist');
    const content = fs.readFileSync(socialLinksMdPath, 'utf8');

    assert.ok(content.includes('https://thecrumb.co/InfiniCharmOfficial'));
    assert.ok(content.includes('https://infinicharm.com/'));
    assert.ok(content.includes('https://www.youtube.com/channel/UCJcnqFc-_JX0uF8-xNrU1rg'));
    assert.ok(content.includes('https://www.facebook.com/InfiniCharmOfficial'));
    assert.ok(content.includes('https://www.instagram.com/InfiniCharmofficial/'));
    assert.ok(content.includes('https://thecrumb.co/TechilyFly'));
    assert.ok(content.includes('https://thecrumb.co/AbdurRahmanDotTopTechilyFly'));
  });

  it('loads social links containing all 7 verified channels', () => {
    const settings = getSocialAndShareSettings();
    assert.ok(Array.isArray(settings.socialLinks));
    assert.ok(settings.socialLinks.length >= 7, 'Must have at least 7 verified social links');

    const urls = settings.socialLinks.map((l) => l.url);
    assert.ok(urls.includes('https://www.youtube.com/channel/UCJcnqFc-_JX0uF8-xNrU1rg'));
    assert.ok(urls.includes('https://www.facebook.com/InfiniCharmOfficial'));
    assert.ok(urls.includes('https://www.instagram.com/InfiniCharmofficial/'));
    assert.ok(urls.includes('https://thecrumb.co/InfiniCharmOfficial'));
    assert.ok(urls.includes('https://thecrumb.co/TechilyFly'));
    assert.ok(urls.includes('https://thecrumb.co/AbdurRahmanDotTopTechilyFly'));
    assert.ok(urls.includes('https://infinicharm.com/'));
  });

  it('provides public social and share settings with active channels only', () => {
    const pub = getPublicSocialAndShareSettings();
    assert.ok(Array.isArray(pub.socialLinks));
    pub.socialLinks.forEach((l) => {
      assert.strictEqual(l.isEnabled, true);
    });
    assert.ok(pub.sharing);
    assert.strictEqual(typeof pub.sharing.enableProductSharing, 'boolean');
    assert.strictEqual(typeof pub.sharing.enableBlogSharing, 'boolean');
    assert.strictEqual(typeof pub.sharing.enableOrderTrackingSharing, 'boolean');
    assert.ok(pub.sharing.channels.whatsapp);
    assert.ok(pub.sharing.channels.copyLink);
  });

  it('performs CRUD operations on social channels and updates settings cleanly', () => {
    // Add temporary channel
    const newLink = addSocialLink({
      platform: 'twitter',
      label: 'Test X Account',
      url: 'https://x.com/infinicharm_test',
      description: 'Automated test link',
    });
    assert.ok(newLink.id);
    assert.strictEqual(newLink.label, 'Test X Account');

    // Update
    const updated = updateSocialLink(newLink.id, {
      label: 'Renamed Test X Account',
      isEnabled: false,
    });
    assert.ok(updated);
    assert.strictEqual(updated?.label, 'Renamed Test X Account');
    assert.strictEqual(updated?.isEnabled, false);

    // Delete
    const deleted = deleteSocialLink(newLink.id);
    assert.strictEqual(deleted, true);

    const recheck = getSocialAndShareSettings();
    assert.strictEqual(recheck.socialLinks.some((l) => l.id === newLink.id), false);
  });

  it('updates sharing configuration properly', () => {
    const updatedSharing = updateShareSettings({
      enableProductSharing: true,
      channels: {
        whatsapp: true,
        twitter: true,
        facebook: true,
        linkedin: true,
        email: true,
        copyLink: true,
      },
      customShareMessage: 'Discover single-origin harvest essentials.',
    });
    assert.strictEqual(updatedSharing.enableProductSharing, true);
    assert.strictEqual(updatedSharing.customShareMessage, 'Discover single-origin harvest essentials.');
  });
});

describe('Storefront Public Information Sanitization & Admin Link Cleanup', () => {
  it('ensures public storefront pages do NOT expose admin@infinicharm.com or adminEmail', () => {
    const storefrontDir = path.join(process.cwd(), 'src', 'app', '(storefront)');

    function scanDir(dir: string): string[] {
      let files: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files = files.concat(scanDir(fullPath));
        } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const allStorefrontFiles = scanDir(storefrontDir);
    const violations: { file: string; line: number; match: string }[] = [];

    allStorefrontFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('admin@infinicharm.com') || line.includes('BRAND.contact.adminEmail')) {
          violations.push({ file, line: idx + 1, match: line.trim() });
        }
      });
    });

    assert.strictEqual(
      violations.length,
      0,
      `Found public admin email exposure in storefront:\n${violations
        .map((v) => `${v.file}:${v.line} -> ${v.match}`)
        .join('\n')}`
    );
  });

  it('ensures Footer component has zero admin links (/admin/login or Admin Portal)', () => {
    const footerPath = path.join(process.cwd(), 'src', 'components', 'layout', 'Footer.tsx');
    assert.ok(fs.existsSync(footerPath), 'Footer.tsx must exist');

    const content = fs.readFileSync(footerPath, 'utf8');
    assert.strictEqual(
      content.includes('/admin/login'),
      false,
      'Footer must not contain /admin/login link'
    );
    assert.strictEqual(
      content.includes('Admin Portal'),
      false,
      'Footer must not contain "Admin Portal" text'
    );
  });
});

