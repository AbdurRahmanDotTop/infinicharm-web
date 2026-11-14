# InfiniCharm — Artisan & Heritage E-Commerce Marketplace

[![Next.js 15](https://img.shields.io/badge/Next.js-15.1.0-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0.0-blue?logo=react)](https://react.dev/)
[![TypeScript 5.6](https://img.shields.io/badge/TypeScript-5.6.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.15-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-Edge-f38020?logo=cloudflare)](https://pages.cloudflare.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_RLS-3ecf8e?logo=supabase)](https://supabase.com/)

**Operating Brand:** TechilyFly India  
**Founder & CEO:** AbdurRahman Ibn Ghufran  
**Registered Headquarters:** Ward No. 07, Lahsaniya, Khoripakar, Patahi, Dhaka, Motihari, East Champaran, Bihar - 845427  
**Official Portal:** [https://www.infinicharm.com](https://www.infinicharm.com)  

---

## 1. Overview & Architectural Vision

**InfiniCharm** is a full-featured e-commerce marketplace dedicated to verified heritage products, artisan purity, natural foods, and regional craft essentials:
- **100% Kashmiri Honey:** Nectar-sourced, raw, NMR lab certified.
- **Natural Zamzam Water:** Authorized Saudi import, non-tampered pilgrim packs.
- **Takmeeli Talbeena:** Traditional whole-grain sunnah nutrition.
- **Barliva Artisan Line:** Roasted barley and ancient dietary blends.
- **Premium Medjool & Ajwa Dates:** Authenticated origin harvests.

The platform provides a complete WooCommerce-grade customer experience with server-enforced financial integrity, dual-method email verification (numeric OTP + 1-click links), and centralized administrative governance.

---

## 2. Core Engineering Invariants

1. **Strict Real Data (Zero Mock/Demo Data):**  
   Zero fabricated products, fake reviews, or dummy analytics. When tables or search queries return no records, the storefront renders elegant, informative empty states with actionable navigation shortcuts.
2. **Server Financial Authority:**  
   Every item price, inclusive GST tax slab (Intra-State CGST+SGST vs. Inter-State IGST), shipping fee, coupon discount, and payable total is strictly calculated on the server in integer **paise** ($1 \text{ INR} = 100 \text{ paise}$).
3. **External Media Precedence & SSRF Defense:**  
   No media binaries are stored on application server disks or database byte arrays. All media references use secure external HTTPS URLs resolved via a deterministic hierarchy (`SKU > Variant > Product`) with strict SSRF defense blocking private IP ranges and cloud metadata endpoints.
4. **Responsive 10-Viewport Cleanliness:**  
   Verified across 10 distinct viewports from `320px` to `2560px` with zero horizontal overflow, robust focus management, and WCAG 2.2 AA accessibility standards.
5. **Secure Authentication & RBAC:**  
   Customer accounts protected by modern salted scrypt password hashing, session versioning, single-use verification tokens, and strict role-based access control protecting administrative modules.

---

## 3. Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend Framework** | Next.js 15 (App Router), React 19, Server & Client Components |
| **Language & Typing** | TypeScript 5.6 (strict mode enabled, zero `any` leaks) |
| **Styling & Design System** | Tailwind CSS 3.4 with custom Warm Editorial design tokens |
| **Database & Auth Engine** | Supabase Cloud PostgreSQL 15 with Row-Level Security (RLS) & SSR Cookies |
| **Edge Hosting & CDN** | Cloudflare Pages with Edge compatibility flags & global CDN delivery |
| **Email & Notifications** | Brevo Transactional API v3 & SMTP relay with admin template engine |
| **Payment Gateways** | Custom Dynamic UPI QR (IndusInd Current), PayGlocal Multi-Currency, Cash on Delivery (COD) |
| **Customer Support** | Headless Tawk.to Live Care widget with custom branded launcher |
| **Testing Suite** | Node.js built-in test runner (`node:test`, 155 unit tests) & Playwright (16 E2E suites) |

---

## 4. Local Development Setup

### Prerequisites
- Node.js `22.x` or `24.x LTS`
- npm `10.x` or `11.x`
- Git

### Quick Start
```bash
# 1. Clone the repository
git clone https://github.com/AbdurRahmanDotTop/infinicharm-web.git
cd infinicharm-web

# 2. Copy environment template
cp .env.example .env.local

# 3. Install dependencies
npm ci

# 4. Start local development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the storefront.

---

## 5. Verification & Quality Gates

The project enforces automated quality checks:

```bash
# 1. TypeScript Strict Typecheck (0 errors)
npm run typecheck

# 2. Business Logic, Pricing & Tax Unit Tests (155 tests across 29 suites)
npm test

# 3. Next.js Production Build (106 static & dynamic routes)
npm run build

# 4. Multi-Viewport Playwright E2E Suite (10 Viewports: 320px - 2560px)
npx playwright test
```

---

## 6. Security & Legal Compliance Disclosures

- **Digital Personal Data Protection (DPDP) Act 2023:** Clear purpose specification, explicit customer consent, and complete account deletion / data erasure rights under `/account/profile`.
- **Consumer Protection (E-Commerce) Rules 2020:** All prices inclusive of taxes; country of origin declared on every listing; Grievance Officer details published under `/policies/compliance`.
- **Legal Metrology (Packaged Commodities):** Net quantity, metric packaging attributes, and registered manufacturer disclosures declared.
- **FSSAI Food Safety Compliance:** Authorized food licensing and nutritional disclosures displayed across edible catalog items.

---

## 7. License

© 2026 InfiniCharm. Operating Brand: **TechilyFly India**. All rights reserved.

