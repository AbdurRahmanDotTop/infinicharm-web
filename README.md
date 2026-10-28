# InfiniCharm — Phase 1 Web Foundation

A beginner-friendly Astro + TypeScript storefront prototype for InfiniCharm, a planned Techily Fly multi-vendor marketplace. This project is intentionally a static site in Phase 1 and is designed for deployment on Cloudflare Pages.

> **Important:** Products and prices are fictional. The seller and admin dashboards are public UI previews, not secure dashboards. There is no real authentication, database, checkout, order creation, inventory, or payment processing. Do not enter real customer or business data.

## 1. Technology choices

- **Astro + TypeScript:** content-focused, statically generated website with typed product data.
- **Cloudflare Pages:** hosts the generated `dist/` static site.
- **Cloudinary:** provides product image delivery after you upload the image to your own Cloudinary account. A local SVG placeholder is used until configured.
- **Plain browser JavaScript:** powers catalogue filters and a demonstration cart. No UI framework is necessary yet.

We do not install the Cloudflare adapter in this phase. Astro's static build does not need a server adapter. When the project needs server-side functions, we will choose and test that deployment architecture separately.

## 2. Prerequisites

1. Install the current **Node.js 24 LTS** from https://nodejs.org/en/download . The current Astro documentation requires Node 22.23.4 or higher; Node 24 LTS is the simplest current choice.
2. Install Visual Studio Code from https://code.visualstudio.com/ .
3. Install Git from https://git-scm.com/downloads .
4. Create GitHub and Cloudflare accounts only when you are ready for remote backup/deployment. Do not enable paid services or enter payment details if a service asks you to upgrade.

## 3. Open and run on Windows

1. Extract this ZIP into a folder such as `C:\Projects\infinicharm-web-phase1`.
2. Open that folder in Visual Studio Code using **File → Open Folder**. Select the folder containing `package.json`.
3. Open a terminal using **Terminal → New Terminal**.
4. Check Node and npm versions:

```powershell
node --version
npm --version
```

Node should be `v24.x` (or at least `v22.23.4`). If you see an older version, install Node 24 LTS and fully restart VS Code.

5. Install project dependencies:

```powershell
npm install
```

6. Start the local development server:

```powershell
npm run dev
```

7. Open the local URL printed in the terminal, usually `http://localhost:4321/`. Keep the terminal open while you work. Press `Ctrl+C` to stop the server.

## 4. Check and build the project

Run these commands from the folder containing `package.json`:

```powershell
npm run check
npm run build
npm run preview
```

- `npm run check` checks Astro and TypeScript issues.
- `npm run build` checks the project and creates the production website in `dist/`.
- `npm run preview` previews the generated production build locally.

A successful build is evidence that the code compiles; it is not proof of production readiness. Also open and manually test the routes and behaviors listed in `docs/PHASE-1-ACCEPTANCE.md`.

## 5. Cloudinary images (optional in the first local run)

Cloudinary's current Free plan advertises no credit card required and 25 monthly credits. Limits can change, so check the current plan before relying on it.

1. Create a free account at https://cloudinary.com/ .
2. In the Cloudinary Console, copy your **Cloud name**. A cloud name is public configuration, not a password.
3. Copy `.env.example` to `.env` in this project root. In PowerShell:

```powershell
Copy-Item .env.example .env
```

4. Edit `.env` and set your actual cloud name:

```dotenv
PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
```

5. Upload a test image in Cloudinary's Media Library. Copy the asset's actual **Public ID** from its details.
6. Open `src/data/products.ts` and add `imagePublicId: 'your_actual_public_id'` to the product object you want to show it. Use the public ID displayed by Cloudinary; do not assume the folder name and public ID are always identical.
7. Restart the dev server if needed, then reload the product page. If the cloud name or image ID is missing, the local placeholder image remains in place.

The `PUBLIC_` prefix means a value is allowed to be included in browser-side output. Put only the Cloudinary cloud name there. **Never** put the Cloudinary API secret, database password, Supabase service-role key, or another private credential into a `PUBLIC_` variable.

Phase 1 intentionally has no image-upload form. A publicly callable unsigned upload preset can be abused; for seller uploads we will design stricter access controls and a suitable signed/server-mediated upload flow after the backend exists.

## 6. Save the code with Git

Create a new **private** repository on GitHub, then in this terminal run (replace the URL with your own repository URL):

```powershell
git init
git add .
git commit -m "feat: create InfiniCharm web foundation"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/infinicharm-web.git
git push -u origin main
```

If Git asks you to configure your name and email, use your chosen Git identity. Check `git status` before committing. `.env` is excluded from Git by `.gitignore`; still review staged files before each commit.

## 7. Deploy to Cloudflare Pages

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Choose to create a Pages application and connect the private GitHub repository.
3. Use these settings for this static Astro site:
   - Production branch: `main`
   - Build command: `npm run build`
   - Build output directory: `dist`
4. If the build environment needs an explicit Node version, set the build environment variable `NODE_VERSION` to `24`, or ensure the environment respects the included `.nvmrc`.
5. Deploy, then open the generated `*.pages.dev` URL and check all routes.
6. Add `PUBLIC_CLOUDINARY_CLOUD_NAME` under the Cloudflare Pages project's environment variables when you are ready for your own Cloudinary images, then trigger a new deployment. It is public image-delivery configuration, not a secret.
7. Connect `www.infinicharm.com` as a custom domain only after the Pages deployment works. Follow Cloudflare's domain setup prompts and do not purchase or enable a paid add-on. Domain registration/renewal is separate from free hosting.

Cloudflare's dashboard names may change; use the current Pages documentation: https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/ .

## 8. Pages included

- `/` — home page
- `/shop/` — catalogue with browser-side search and category filtering
- `/product/aura-everyday-tote/` and other product URLs — statically generated detail pages
- `/cart/` — browser-only demonstration cart; checkout is deliberately disabled
- `/seller/` — seller dashboard UI preview only
- `/admin/` — admin dashboard UI preview only
- `/about/` — project phases and principles
- `404` — not-found page

## 9. Data and security boundaries

- Product records are currently in `src/data/products.ts`. Do not treat this file as live catalogue storage.
- The demo cart stores only product slugs and quantities in this browser's `localStorage`; it stores no names, addresses, passwords, or payment details.
- Client-side cart prices are for display only. When backend checkout is built, the trusted backend must reload product prices and inventory, validate the cart, and calculate authoritative totals.
- The admin and seller preview routes are public. Do not add real customer records to them. Phase 2 must add authentication plus database/server-side authorization. Hiding a link in the UI is not access control.
- Never commit `.env`, API secrets, access tokens, private keys, or service-role credentials.

## 10. Phase 1 acceptance checklist

See [`docs/PHASE-1-ACCEPTANCE.md`](docs/PHASE-1-ACCEPTANCE.md). Mark an item complete only after you have actually tested it.
