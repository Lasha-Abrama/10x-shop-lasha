# 10X Shop

10X Shop is a graduation e-commerce project. It currently contains a frontend design system, a responsive shared storefront layout, a static home-page preview, and a NestJS health endpoint. Product names and prices are illustrative; search and shopping are not available yet.

## Stack and structure

- `frontend/`: Vite, React 19, strict TypeScript, Tailwind CSS v4, and React Router.
- `backend/`: NestJS and strict TypeScript.
- npm workspaces manage both apps with one root `package-lock.json`.
- `PLAN.md` lists milestones; `REPORT.md` is a progress report template.

PostgreSQL, Prisma, authentication, Stripe, AI, and product features are not configured.

The storefront uses Tailwind v4 theme tokens in `frontend/src/styles.css`, shared Header/Footer/Layout components, and typed presentation data in `frontend/src/pages/HomePage.tsx`. Fonts and photos are served locally; no external requests are needed to render the preview. DM Sans and Libre Caslon Display are from Google Fonts, with licenses in `frontend/public/fonts/`. Preview photos are from Unsplash: [living room](https://images.unsplash.com/photo-1600210492486-724fe5c67fb0), [ceramics](https://images.unsplash.com/photo-1610701596007-11502861dcfa), [bag](https://images.unsplash.com/photo-1544816155-12df9643f363), and [candle](https://images.unsplash.com/photo-1603006905003-be475563bc59).

## Local setup

Install Node.js 24 or newer and npm 11 or newer. From the repository root:

```sh
npm ci
npm run dev
```

- Frontend: http://localhost:5173
- Backend health: http://localhost:3000/health, returning `{"status":"ok"}`

No environment files or external services are needed. Ports 5173 and 3000 must be available. Press Ctrl+C to stop both apps.

If port 3000 is in use, choose another backend port, for example `PORT=3001 npm run dev` on macOS/Linux. The backend reads `PORT` from the shell; it does not load `.env` files.

## Commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start both apps with file watching |
| `npm run dev:frontend` | Start only Vite |
| `npm run dev:backend` | Start only NestJS |
| `npm run typecheck` | Typecheck both apps |
| `npm run build` | Typecheck and build both apps |
| `npm run preview --workspace frontend` | Preview the frontend build locally |
| `npm start --workspace backend` | Run the compiled backend |

Builds are written to `frontend/dist/` and `backend/dist/`. Build before running the preview or compiled backend. For frontend production hosting, serve `frontend/dist/` and configure an SPA fallback to `index.html` for browser routing.

Use `npm install` when intentionally changing dependencies and commit the updated lockfile with those changes. Keep secrets and `.env` files out of version control.
