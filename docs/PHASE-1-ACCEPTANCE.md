# InfiniCharm Phase 1 — Acceptance Checklist

## Scope
- [x] Astro + TypeScript static frontend foundation
- [x] Responsive home page and product catalogue
- [x] Static product-detail routes generated from typed product data
- [x] Client-side product search and category filter
- [x] Local browser-only demo cart (no account or sensitive information)
- [x] Seller and admin UI previews marked as non-secure demos
- [x] Cloudinary delivery URL helper with a local fallback image
- [x] Cloudflare Pages static build configuration

## Must be verified locally by the project owner
- [ ] `npm install` completes without errors
- [ ] `npm run check` passes
- [ ] `npm run build` completes and creates `dist/`
- [ ] Homepage, shop, each product, cart, seller preview, admin preview, about, and 404 route checked in browser
- [ ] Responsive behavior checked at phone, tablet, and desktop widths
- [ ] Keyboard navigation and visible focus checked
- [ ] Cloudinary URL verified against the owner's own uploaded public ID
- [ ] Git repository contains no `.env`, credentials, or other secrets
- [ ] Cloudflare Pages preview URL tested before connecting a custom domain

## Explicitly not production-ready yet
- No authentication, authorization, or real admin access control
- No live database, catalogue management, seller onboarding, or stock tracking
- No trusted checkout or order-processing backend
- No online payments, refunds, tax calculations, or shipping integrations
- No product image upload UI; upload test assets manually to Cloudinary in Phase 1
- No monitoring, backup, incident response, or external security assessment yet
