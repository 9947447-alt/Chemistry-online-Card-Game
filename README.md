English | [简体中文](./README.zh-CN.md)

# Reaction Field / 反应域

**Reaction Field** is an experimental, same-screen card game for two local players, built with React and TypeScript and currently distributed as a public Web Playtest Alpha.

## Rulebooks

- [Rulebook I](https://1drv.ms/w/c/c8f765bca077d05c/IQARVQbFTILtQowJ0BLUq5V2AWHW1TuJcgOQwLIgWzi7qEo)
- [Rulebook II](https://1drv.ms/w/c/c8f765bca077d05c/IQDsTmoal5SMQLobZjRCmYqAASqI_D2UADagxAimsvxbDHU)

These rulebooks describe the intended game rules. The current build may contain unimplemented parts or implementation differences; in case of discrepancy, the behavior of the current game build takes precedence.

## Try the Web Playtest

- Play: [https://9947447-alt.github.io/Chemistry-online-Card-Game/](https://9947447-alt.github.io/Chemistry-online-Card-Game/)
- Current public milestone: **Reaction Field Alpha 2**
- Current published technical version: `0.13.0-alpha.3`
- Alpha 4 release-candidate version: `0.14.0-alpha.1`
- Rules version: `MVP0-P10`
- GitHub Release: [web-playtest-v0.13.0-alpha.3](https://github.com/9947447-alt/Chemistry-online-Card-Game/releases/tag/web-playtest-v0.13.0-alpha.3)

The Alpha 4 international playtest work described below has been merged into `main`. This candidate prepares `0.14.0-alpha.1`; the planned `web-playtest-v0.14.0-alpha.1` tag has not been created or deployed, and no real Pages acceptance check has run for it. Until that deployment completes, the public URL and Release above may still serve Alpha 2 / `0.13.0-alpha.3`.

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
- A fatal-session boundary: an unhandled initialization, restart, or engine error stops the old match and removes its `GameState`; recovery must start a new matching lineup or return to character selection.
- React ErrorBoundary handling, root-level React callbacks, and browser `error` / `unhandledrejection` fallback handling.

## Alpha Status

The current public release is Reaction Field Alpha 2, technical version `0.13.0-alpha.3`, rules version `MVP0-P10`, tag `web-playtest-v0.13.0-alpha.3`, peeled commit `0f50b2c8011ee108bc4b6ab3178ad4aa0acbe6cd`. Its Pages workflow, deployment, and limited public-page acceptance check completed successfully; this is not evidence of broad cross-browser compatibility.

The earlier `web-playtest-v0.13.0-alpha.2` tag remains unchanged at `57550f70856d5d5e27ac3fcb0fa508cd698d3be6`. Its Pages workflow failed because a production E2E assertion was pinned to an older commit, so alpha.2 was not deployed successfully. The alpha.1 and alpha.2 tags remain immutable. The published alpha.3 release did not add gameplay features or rules.

## International Playtest Status

Alpha 4 is implemented and merged into `main`. The current release candidate prepares `0.14.0-alpha.1`, but it is not released or deployed. It provides Simplified Chinese and English presentation layers without changing game state or rules.

- The display language is suggested from browser language preferences and can be switched in the page.
- The selection is held only for the current React page lifecycle. It is not persisted; after a refresh, the suggestion is evaluated again from the browser language.
- Ordinary formal game-log messages remain in Simplified Chinese in English mode. Some structured reaction presentation is localized, but the game must not be described as having a fully English game log.

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
