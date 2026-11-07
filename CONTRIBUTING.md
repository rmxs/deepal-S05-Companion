# Contributing

## Set up

1. Install Python 3.12+ and Node.js 22+.
2. Run `python -m pip install -r requirements-test.txt`.
3. Run `npm ci --ignore-scripts`.
4. Run `npx playwright-core install chromium`.

## Edit and check

1. Edit card and Energy source files in `source/`.
2. Edit dashboard modules and styles in `custom_components/deepal_companion/frontend/`.
3. Run `npm run build`.
4. Run `python -m unittest discover -s tests -v`.
5. Run `npm run test:curve` and `npm run test:browser`.
6. Commit source and generated frontend files together.

Browser tests use Edge on Windows when available, otherwise Playwright Chromium. Backend and browser tests use simulated HA APIs; real-device checks are listed in the [release checklist](docs/maintainers/RELEASE_CHECKLIST.md).

## Documentation

When preparing a commit, update the relevant guides and changelog for the changes included in that commit. Keep user documentation in English, use the interface's actual menu labels, and describe available behaviour with practical steps. Keep development details in this file or the maintainer guide.

## Releases

Use the separate `rmxs/deepal-S05-Companion` repository. Follow the [release checklist](docs/maintainers/RELEASE_CHECKLIST.md) before publishing.
