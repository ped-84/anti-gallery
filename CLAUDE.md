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
- Talk to the user (Pedram) in Farsi.

## Workflow
- Never push to `main` directly: pushing `main` deploys to production (artgasht.com).
- Work on a branch → `npx tsc --noEmit` → `npm run build` → check the UI in a browser (screenshot, light + dark, mobile width) → open a PR. `ci.yml` re-runs typecheck + build + `scripts/smoke-test.mjs` (backend) on the PR.
- Pedram merges the PR = final approval and deploy. Then verify `https://artgasht.com/health` shows the new version.
- The data bot commits to `main` with `[skip ci]`; rebase on `main` before opening a PR.
