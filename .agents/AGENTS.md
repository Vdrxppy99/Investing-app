# Antigravity & Agent Guidelines for Investing App

## Project Overview
- **Path**: `/Users/isaacamsalu/Claude/Projects/Investing-app`
- **Type**: Personal Investment Web App (Vanilla HTML/CSS/JS static PWA, no build step, deployed on GitHub Pages).
- **Core Files**: `index.html`, `css/app.css`, `sw.js`, and vanilla JS modules in `js/`.

## Architecture & Code Standards
- **No Build Step**: Plain JS loaded in global scope via `index.html`. Load order matters:
  1. `boot.js`
  2. `seed.js`
  3. `core.js`
  4. `portfolio.js`, `api.js`, `explore.js`, `insights.js`, `sheets.js`, `news.js`
  5. `app.js`
- **Cache Invalidation & SW**: When modifying JS/CSS:
  - ALWAYS bump `CACHE_NAME` / version in `sw.js`.
  - Add any new CSS/JS file to `CORE` array in `sw.js`.
- **Security & Privacy**: AES-256-GCM encrypted state in `localStorage`. Keep personal data safe.

## Dual Assistant Synchronization Protocol (Antigravity <-> Claude)
To ensure seamless switching between AI assistants (Antigravity and Claude):
1. **Always Maintain `CLAUDE.md`**: Update `CLAUDE.md` whenever features, architectural decisions, or state changes occur.
2. **Log Changes**: Keep `CHANGELOG.md` updated with concise release/work logs.
3. **Git Commits**: Commit distinct features with clean commit messages so `git log` reflects full history.
