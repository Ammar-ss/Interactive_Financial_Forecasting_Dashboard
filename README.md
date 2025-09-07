# Ammar_Predicts — Project Layout

I reorganized the repository into six top-level folders to match your request. Files were copied (not moved) so the app keeps working while providing the new, clearer layout.

Top-level folders (copies):

- front_end/
  - client/  — Complete frontend React app (pages, components, styles). This is the primary frontend copy used when resolving the `@/*` alias.
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
  - models/ml.ts — ML utility functions (movingAverage, exponentialMA, linear regression, metrics).

- database/
  - README.md — placeholder and recommendations for persistent DB integration (Neon / Supabase / Prisma).

- server_management/
  - netlify.toml — Netlify configuration (copied)
  - vite.config.server.ts — server build config (copied)
  - netlify_functions_api.ts — wrapper for the Netlify function handler

- extra_files/
  - AGENTS.md, components.json, shared_api.ts — copies and helpers.

Notes about configuration changes made so app resolves the new front_end copy:

- tsconfig.json: Path alias updated so `@/*` resolves to `./front_end/client/*`.
- vite.config.ts and vite.config.server.ts: Alias `@` updated to `./front_end/client` so Vite resolves imports to the new frontend copy.

Why I copied instead of moving
- Copying is safer: it preserves the original files and build configuration while providing a clean, separate folder layout you requested. If you prefer a full move (delete originals and update all imports), I can perform that in a follow-up.

Next steps I recommend
- If you want a single canonical location, I can fully move files and update imports throughout the repo (careful operation).
- Add a persistent DB (Neon/Supabase) for uploaded datasets — I can scaffold Prisma or a Supabase client.
- Add CI checks to ensure the project builds after moves.

If you'd like me to proceed with physically moving (not copying) and updating every import to point to the new locations, confirm and I'll perform the full move and run the necessary edits.
