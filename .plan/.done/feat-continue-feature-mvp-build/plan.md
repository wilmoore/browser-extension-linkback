## Context

- doc/decisions is empty, so no ADRs constrain this work. Rely on PRD/spec-001 and backlog.
- Open backlog items 5 & 11-14 (Epic E-005) cover the missing Global Inventory surface (S-004). Manifest already wires a shortcut + `inventory.html`, but that file and UI do not exist.

## Requirements

1. Ship `inventory.html` + a Preact-driven UI that lists all stored pages so users can browse/search/sort.
2. Allow renaming a page title and persist it via the background messaging/storage layer.
3. Let users remove a relationship symmetrically from the inventory surface.
4. Provide a duplicate merge workflow that consolidates two normalized URLs (updates all linked pages + queues pending sync).
5. Surface graph stats + sync status so users see overall state when auditing.

## Implementation Notes

1. **Build outputs**: add `inventory/index` to `vite.config.ts` inputs, create `inventory.html`, and update `npm run build:static` to copy it alongside manifest/sidebar assets.
2. **Shared types**: extend `MessageType`, add payload/interface definitions for inventory snapshot + merge requests, and widen `PendingSync.type` to include `"merge-pages"`.
3. **Link operations**: implement `mergePages` (normalize URLs, add/replace relationships, dedupe `linkOrder`, drop duplicate page, queue sync op). Add helper(s) + Vitest coverage.
4. **Background worker**: add handlers for `GET_INVENTORY_SNAPSHOT`, `MERGE_PAGES`, and expose `getAllPages()` + stats/pending counts to the UI. Reuse existing delete/update handlers for other actions.
5. **Inventory UI**: create `src/inventory/index.tsx` with purposeful styling (keyboard-friendly, dual-pane layout, merge controls) + state management (filters, sorts, rename, remove, merge). Use chrome messaging + shared types.
6. **UX polish**: meaningful font stack + CSS variables, highlight selected page, show sync badge, confirm destructive actions, and toast/alert on success/failure to aid auditing.
7. **Verification**: run `npm run test:run` + `npm run build` (ensuring new artifact is copied) and `npm run lint` if configured.

## TODOs

- [x] Update build artifacts + manifest glue for `inventory.html` entry point.
- [x] Extend shared types/storage utilities + add `mergePages` with tests.
- [x] Update background service worker messaging for inventory snapshot + merge support.
- [x] Implement the Preact-based Inventory UI with search/sort/rename/remove/merge interactions.
- [x] Style the screen to meet Linkback’s keyboard-first aesthetic with high-contrast dark theme.
- [x] Exercise lint/tests/build to ensure the new surface works end-to-end.

## Related ADRs

- [001. Global Inventory Surface](../../doc/decisions/001-global-inventory-surface.md)
