English | [简体中文](./README.zh-CN.md)

# Reaction Field / 反应域

**Reaction Field** is an open-source chemistry-themed local two-player card game with tactical reactions and emergent strategy, built with React and TypeScript and currently distributed as a public Web Playtest Alpha.

## Core Rulebook — Extended Tabletop Reference

- [Core Rulebook](https://1drv.ms/w/c/c8f765bca077d05c/IQARVQbFTILtQowJ0BLUq5V2AWHW1TuJcgOQwLIgWzi7qEo)

The external Core Rulebook is an extended tabletop reference, not the authoritative rules for the current Web Playtest. The current Web Playtest follows the applicable rule-freeze documents in this repository, the implemented behavior, and in-game feedback. The linked OneDrive content has not been independently revalidated for this release.

## Try the Web Playtest

- Play: [https://9947447-alt.github.io/reaction-field/](https://9947447-alt.github.io/reaction-field/)
- Current public milestone: **Reaction Field Alpha 6**
- Current published technical version: `0.16.0-alpha.2`
- Current public tag: `web-playtest-v0.16.0-alpha.2`
- Rules version: `MVP0-P10`
- GitHub Release: [Reaction Field Alpha 6 — v0.16.0-alpha.2](https://github.com/9947447-alt/reaction-field/releases/tag/web-playtest-v0.16.0-alpha.2)
- Repository: [https://github.com/9947447-alt/reaction-field](https://github.com/9947447-alt/reaction-field)

The current public release is Reaction Field Alpha 6 (`0.16.0-alpha.2`) with rules version `MVP0-P10` and public tag `web-playtest-v0.16.0-alpha.2`. The live playtest URL is served from `https://9947447-alt.github.io/reaction-field/` following the repository rename and Phase 17 release deployment.

## What Is Reaction Field?

Reaction Field is a local, same-screen two-player game with open hands, public deck counts, public status, and a full game log. It has no online multiplayer, accounts, rooms, saves, telemetry, or remote error reporting. Refreshing the page discards the current match and returns to the default character selection.

This is an alpha playtest, not a stable release.

## Core Gameplay

- Choose from 7 released characters across 49 ordered two-player lineups; mirror matchups are allowed. The Laboratory Teacher and Chemical Plant CEO are selected by default.
- Play through setup, preparation, cycles, turns, actions, responses, status handling, deck reshuffles, elimination, and victory resolution.
- Use linked card play and `tableReference`, active DIY actions, character skills, the shared damage pipeline, and the currently implemented part of experiment counterattacks.
- Trigger three structured successful reaction events: acid-base neutralization, acid-carbonate reaction, and alkaline absorption of SO2. Virtual H2O and CO2 do not create card instances.

## Current Features

- A 68-card ordinary physical card pool. `event_lab_fire` has zero ordinary `CardInstance` entries at initialization.
- Public hands, deck counts, status, and the complete game log for both players.
- Accessible in-page confirmation dialogs for restarting or returning to character selection during a match; after `gameOver`, these actions run directly.
- One shared About & Help view from character selection, play, and `gameOver`, covering version, capabilities, controls, safety, and deferred scope.
- Character selection, lineup summary, and the start button appear before detailed guidance; the current goal remains visible while detailed guidance can be collapsed, hidden, and restored.
- A bilingual, display-only three-step first-game example is collapsed by default.
- Newly appended structured successful reactions can show a non-modal notice for about 2000 ms. It reads only `GameLogEntry.reaction`, reuses the formal public reaction view, and does not replay historical reactions on first mount.
- About and `gameOver` provide ordinary static links to the public GitHub repository. Microsoft Forms remains a separate user-clicked static link with the same privacy boundary.
- A fatal-session boundary: an unhandled initialization, restart, or engine error stops the old match and removes its `GameState`; recovery must start a new matching lineup or return to character selection.
- React ErrorBoundary handling, root-level React callbacks, and browser `error` / `unhandledrejection` fallback handling.

## Alpha Status

The current public release is Reaction Field Alpha 6, technical version `0.16.0-alpha.2`, rules version `MVP0-P10`, and tag `web-playtest-v0.16.0-alpha.2`. Its public Pages build is served from the live URL; this is not evidence of broad cross-browser compatibility.

The earlier `web-playtest-v0.13.0-alpha.2` tag remains unchanged at `57550f70856d5d5e27ac3fcb0fa508cd698d3be6`. Its Pages workflow failed because a production E2E assertion was pinned to an older commit, so alpha.2 was not deployed successfully. Historical tags remain immutable.

## International Playtest and Bilingual Game Log Status

The international presentation layer provides Simplified Chinese and English modes without changing game state or rules.

- The display language is suggested from browser language preferences and can be switched in the page.
- The selection is held only for the current React page lifecycle. It is not persisted; after a refresh, the suggestion is evaluated again from the browser language.
- Ordinary engine-generated game logs now support Simplified Chinese and English through typed structured events and one authoritative payload.
- Card play, responses, reactions, DIY virtual attacks, status handling, notices, and character-related flows support localized rendering.
- English alkaline damage is displayed as `alkaline` while the internal rule identifier remains `base`.
- Production Reaction and DIY UI paths have formal E2E coverage.
- The production JavaScript bundle was reduced to pass the frozen Node 24 size gate with reliable headroom.

## Alpha 6 / Phase 16 & Phase 17 Release Status

Phase 16 full bilingual game log and Phase 17 repository identity migration are implemented and published as Reaction Field Alpha 6 (`0.16.0-alpha.2`) under tag `web-playtest-v0.16.0-alpha.2`. Alpha 6 provides bilingual structured logs, localized damage and status rendering, migrated repository and Pages identity under `9947447-alt/reaction-field`, and production test coverage. Alpha 6 is an alpha playtest; it does not include online multiplayer, accounts, persistence, complete mobile compatibility, or an iOS Firefox fix.

## Feedback

[Open Microsoft Forms feedback in a new tab](https://forms.cloud.microsoft/r/QG8PACUnsa).

The feedback entry is an ordinary external link opened only by an explicit user click. The game does not contact Microsoft Forms before that click and does not automatically pass `GameState`, hands, logs, characters, browser information, error diagnostics, or language preference to the form. After the link is opened, Microsoft Forms handles the content entered there. This project does not claim that the form is anonymous, requires no sign-in, or collects no identity information.

## Running Locally

The pinned toolchain is Node.js `24.18.0` from `.node-version` and pnpm `11.9.0` from `package.json#packageManager`. Only Playwright Chromium is installed for E2E coverage.

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm run dev
```

Build and preview the production output:

```bash
pnpm run build
pnpm run preview
```

## Testing

Run the regular and fixed-seed Vitest suites:

```bash
pnpm run test:run
pnpm run test:shuffle
```

Run the isolated production-mode fixture build and Chromium E2E suite:

```bash
pnpm run test:e2e
```

Test the real `src/main.tsx` / `dist/index.html` playtest paths at both the site root and the GitHub Pages subpath:

```bash
pnpm run test:e2e:production
```

Run production isolation and bundle-size gates:

```bash
pnpm run check:production
pnpm run check:size
```

Audit production dependencies:

```bash
pnpm audit --prod
```

`pnpm audit --prod` sends public dependency names and versions to the npm advisory API. It was run and recorded during Phase 11, but it is not a required main CI gate so an external advisory-service outage does not block builds.

## Development Notes

The project uses React, TypeScript, Vite, Vitest, and Playwright. The formal game action reducer is `src/game/engine/reducer.ts`; presentation code must not bypass the reducer or the established session boundary.

The fatal page exposes only a locally copyable diagnostic with the application name, application version, rules version, short commit or `dev/unknown`, a stable error code, and a non-sensitive environment summary. It excludes raw error messages, stacks, `GameState`, hands, logs, and user state, and it is not uploaded automatically.

Release and rollback constraints are documented in [`docs/PHASE12_REACTION_FIELD_WEB_PLAYTEST_FREEZE.md`](docs/PHASE12_REACTION_FIELD_WEB_PLAYTEST_FREEZE.md). Rules remain frozen by [`docs/MVP0_RULE_FREEZE.md`](docs/MVP0_RULE_FREEZE.md), [`docs/PHASE8_CHARACTER_RULE_FREEZE.md`](docs/PHASE8_CHARACTER_RULE_FREEZE.md), [`docs/PHASE9_DEBUG_UI_RULE_FREEZE.md`](docs/PHASE9_DEBUG_UI_RULE_FREEZE.md), and [`docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md`](docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md). See [`docs/MVP_PLAN.md`](docs/MVP_PLAN.md) for the phase overview.

## Roadmap

Real metal cards and experiment-counterattack metal options, equations, precipitation, response DIY, multiplayer, networking, accounts, saves, and replays are deferred. Tauri, Electron, PWA, service workers, native installers, signing, notarization, and automatic updates are not implemented and are outside the current phase.

## Known Limitations

- This is a same-screen two-player playtest with public hands and no persistence. Refreshing loses the current match.
- In Firefox on iOS 27 beta, opening some modals such as Help or restart confirmation may enter `ROOT_RUNTIME_FAILED`. A previous `requestAnimationFrame` focus experiment did not resolve the issue and was not merged into the stable branch. The issue remains unresolved.
- Safari and tested Edge paths have existing device/browser test records only; they are not a general compatibility guarantee for all versions.
- The current public build is hosted on GitHub Pages. Local development and verification do not deploy it.

## License

Source code is licensed under [Apache-2.0](LICENSE), with attribution in [NOTICE](NOTICE). Third-party dependencies and assets remain subject to their respective licenses.

## Brand Assets

Files under `public/brand/**` are not included in the Apache-2.0 source-code license. Their use is governed by the existing [Reaction Field brand asset guidance](docs/REACTION_FIELD_BRAND_ASSETS.md), including the restrictions against implying official status, approval, or endorsement.

## Credits

Copyright 2026 Nulledge and Reaction Field contributors. See [NOTICE](NOTICE) for attribution.
