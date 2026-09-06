# Phase 2.8 acceptance

Phase 2.8 adds a deliberately small, device-local quick partial preset feature. A preset stores only range-independent operations for the existing partial style path; it never stores text or range offsets and is not embedded in project/template JSON.

## Storage

- IndexedDB database: `text-graphic-studio`
- Existing store: `projects`
- Independent key: `quick-partial-presets`
- Record kind: `text-graphic-studio-quick-partial-presets`
- Record schema: `1`
- Maximum presets: `8`

## Browser acceptance

`npm run test:browser:phase28` runs installed Google Chrome and covers the 30 requested acceptance items in 14 grouped checks. Evidence is written to `test-results/phase28/`.
