# Ammar_Predicts — Project Layout

This repository was reorganized to keep a clear, canonical layout for frontend, backend, ML utilities and auxiliary files. The README documents the current structure and recent cleanup actions.

Top-level folders:

- front_end/
  - client/ — Frontend React app (pages, components, styles). This is the primary frontend code referenced by the `@/*` alias.
    - pages/Index.tsx — Main application page (predictor UI).
    - components/ui/ — UI components library (button, input, card, etc.).
    - context/DatasetContext.tsx — Dataset selection context.
    - global.css — Tailwind theme and CSS.

- back_end/
  - server/ — Express server API handlers.
    - index.ts — createServer() and route registrations.
    - routes/stocks.ts — historical fetch + training endpoints (trainAndPredict, getHistorical), CSV upload handlers.
    - routes/demo.ts — demo endpoint.

- AI_ML/
  - models/ml.ts — ML utility functions (movingAverage, exponentialMA, linear regression, metrics). This file is the canonical implementation used by the server.

- database/
  - README.md — placeholder and recommendations for persistent DB integration (Neon / Supabase / Prisma).

- server_management/
  - Helpers and server-build configuration (e.g. vite.config.server.ts). Remove or update provider-specific config as needed.

- extra_files/
  - AGENTS.md, components.json, shared_api.ts — miscellaneous copies and helpers.

Configuration notes:

- tsconfig.json: Path alias updated so `@/*` resolves to `./front_end/client/*`.
- vite.config.ts and vite.config.server.ts: Alias `@` updated to `./front_end/client` so Vite resolves imports to the new frontend copy.
- server/routes/stocks.ts imports ML helpers from `../../AI_ML/models/ml`.

Netlify removal (recent cleanup)

- The `netlify/` directory (serverless functions and related files) was removed locally as part of a cleanup you performed.
- If you want the repository to reflect this removal, consider deleting or updating the following files in the repo if still present:
  - `netlify.toml` (root)
  - `server_management/netlify.toml`
  - any `netlify/` directory entries

Why keep copies / archive

- An `archive_original/` directory (if present) contains original top-level copies kept for recovery. Only permanently remove it after confirming the app builds and runs.

Recommended next steps (local actions):

1. Run a full build and test locally to ensure everything still works:
   - pnpm install
   - pnpm build
2. If the app works and you want to permanently remove Netlify config from the repo, delete `netlify.toml` and `server_management/netlify.toml` and commit the change.
3. Add CI checks (optional) to ensure refactors don't break builds.

If you want, I can remove netlify-related config files from the repository and update imports/README. Confirm and I'll make the edits here (note: deletions executed by me are subject to the environment's ACLs; if any destructive action is blocked I will provide a safe script you can run locally).
