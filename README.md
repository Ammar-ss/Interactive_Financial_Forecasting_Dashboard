# Ammar_Predicts — Project Layout

I reorganized the repository into six top-level folders and consolidated ML utilities into a single canonical folder. The repo is arranged so the app continues to run while keeping a clearer structure.

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
  - netlify.toml — Netlify configuration (copied)
  - vite.config.server.ts — server build config (copied)
  - netlify_functions_api.ts — wrapper for the Netlify function handler

- extra_files/
  - AGENTS.md, components.json, shared_api.ts — copies and helpers.

Configuration notes:

- tsconfig.json: Path alias updated so `@/*` resolves to `./front_end/client/*`.
- vite.config.ts and vite.config.server.ts: Alias `@` updated to `./front_end/client` so Vite resolves imports to the new frontend copy.
- server/routes/stocks.ts now imports ML helpers from `../../AI_ML/models/ml`.

ai_ml consolidation and removal

- The original `ai_ml/models/ml.ts` implementation was consolidated into `AI_ML/models/ml.ts` and the server import paths were updated accordingly.
- The original `ai_ml/models/ml.ts` file was removed from the repository to avoid duplication. If you still have an `ai_ml/` directory (empty or otherwise) and want it removed, run the provided script locally or delete it manually.

Safe deletion script

A safe, interactive deletion script was added at `scripts/delete_ai_ml.sh`. Run locally to review and remove the old `ai_ml` folder:

bash scripts/delete_ai_ml.sh --confirm

(You will be prompted to type `DELETE` to perform an irreversible deletion.)

Archive of original files

I created an `archive_original/` directory in earlier steps (if present) that contains original top-level copies kept for recovery. If you prefer a permanent cleanup (removing `archive_original` or removing other originals), tell me and I'll prepare a safe deletion plan.

Next steps you might want:

- Permanently remove `archive_original/` after verifying everything works.
- Run a full project build (`pnpm build` / `npm run build`) locally to confirm configuration changes.
- Add CI checks to ensure the project builds after refactors.

If you'd like any wording adjusted or more technical details added to this README, tell me what to include and I'll update it.
