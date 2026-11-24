# CLAUDE.md — آرت‌گشت

Read `PROJECT_HANDOFF.md` first; it is the single source of truth (architecture, rules, deploy, known issues). Keep it current when the code changes.

## Non-negotiables
- Version bump of exactly +0.001 for every app-code change, in all five places (`Header.tsx` APP_VERSION, `public/sw.js` CACHE_NAME, `server.ts` version ×2, `public/manifest.json` id, `index.html` `?v=`). Docs/CI-only changes do not bump.
- UI shows Tehran only; never delete other cities from data.
- Persian digits via `toPersianDigits()`; fonts Shabnam FD (fa) + Ubuntu (latin), self-hosted.
- No runtime external dependencies (fonts, CDNs, scripts). Must work on Iran's national intranet.
- Never native `<select>`; use `ClayDropdown`.
- Rules of Hooks: no hook after a conditional return.
- No `filter: drop-shadow` on animated/offset-path elements (caused the v1.163 white screen).
- Server data on the volume is the source of truth; never overwrite it from the bundled seed. Deletes are soft (`deleted: true`).
- Runtime `dependencies` are only what `server.ts`/scripts need at runtime (express, tsx). Everything for the frontend build goes in `devDependencies`.
- Talk to the user (Pedram) in Farsi.

## Workflow
- Never push to `main` directly: pushing `main` deploys to production (artgasht.com).
- Work on a branch → `npx tsc --noEmit` → `npm run build` → check the UI in a browser (screenshot, light + dark, mobile width) → open a PR. `ci.yml` re-runs typecheck + build + `scripts/smoke-test.mjs` (backend) + a production Docker image boot check on the PR.
- Pedram merges the PR = final approval and deploy. Then verify `https://artgasht.com/health` shows the new version.
- The data bot commits to `main` with `[skip ci]`; rebase on `main` before opening a PR.

## Documents go to Pedram's Google Drive

Every document you create for Pedram (plans, specs, reports, handoffs, decision records, sheets) is created in his Google Drive, account p.e.maleki@gmail.com, inside this project's folder under «AI product»: https://drive.google.com/drive/folders/1XmsTd7H_uXOP_VRjRtv5rNxsmMKLK9tZ
Create it as a Google Doc or Sheet there, not in My Drive root and not only as a local or repository file. Then add its link to this project's `docs` in ped-84/project-hub data/projects.json. If this chat has no Google Drive access, say so in one line instead of saving it somewhere else.
