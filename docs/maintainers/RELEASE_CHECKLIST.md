# Release checklist

## Package

- Keep the manifest, npm package and release tag on the same version.
- Build and commit the generated frontend files with their source.
- Keep Marketplace/HACS metadata, translations, local assets, licence and third-party notices in the repository.
- Check README links and the installation, usage, settings and notification guides.
- Exclude local screenshots, validation reports, caches, node_modules and database files.

## Local checks

- `python -m unittest discover -s tests -v`
- `npm ci --ignore-scripts`
- `npm run build`
- `npm run test:curve`
- `npx playwright-core install chromium`
- `npm run test:browser`
- Run the browser lifecycle check with `MEMORY_ONLY=1 npm run test:browser` (PowerShell: set `$env:MEMORY_ONLY='1'` first).

The Python suite uses HA test doubles. The browser suite runs generated frontend code with a simulated Home Assistant API.

## Home Assistant and phone checks

- Install, restart, add the integration and confirm vehicle discovery.
- Add a dashboard card and verify settings updates from both editing surfaces.
- Check a real charging session, stop, restart recovery and the saved curve.
- Assign a location and receipt, then verify the saved cost and archive backup.
- Test notification delivery and a supported action on each target phone platform.
- Test Live charging start, update and end on supported iPhone and Android devices.

## Marketplace package checks

- Keep `hacs.json` at the repository root; Marketplace still uses this filename.
- Keep exactly one integration under `custom_components/`, including runtime assets, brand files and third-party licences.
- Check repository description, topics, enabled issues and the release tag before requesting catalog inclusion.

## Publish

- Review the final diff and choose the release commit.
- Push to `rmxs/deepal-S05-Companion`.
- Check the Tests, hassfest and HACS jobs on GitHub.
- Tag the reviewed version and publish its release notes.
- Install or update through Marketplace on HA 2026.11+ and HACS on earlier supported versions; verify the installed version.

Do not describe an unperformed device or Home Assistant check as passed.
