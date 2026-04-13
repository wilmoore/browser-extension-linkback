# 001. Global Inventory Surface

Date: 2026-03-05

## Status

Accepted

## Context

The MVP backlog (Epic E-005) requires a Global Inventory screen (S-004) so users can audit every stored page, rename titles, remove broken relationships, and merge duplicates. The manifest already referenced `inventory.html`, but no implementation existed, and background/storage APIs lacked a holistic snapshot or a merge primitive.

## Decision

Implement `inventory.html` as a dedicated Vite/Preact entry point backed by new background message types:

1. `GET_INVENTORY_SNAPSHOT` aggregates `getAllPages`, pending sync counts, and link stats so the UI can render quickly without bespoke queries.
2. `MERGE_PAGES` folds duplicate URLs into a canonical target by updating every neighbor, deduping `linkOrder`, removing orphans, and queueing a `merge-pages` pending sync operation for Supabase.
3. The UI renders a dual-pane experience (list + detail) with rename, symmetric relationship removal, merge confirmation, and sync/online indicators, using shared types and Chrome messaging exclusively.

## Consequences

Positive:

- Provides a complete audit/cleanup workflow required for the MVP without touching production endpoints.
- Consolidates inventory data reads into one background handler, improving performance and reducing Chrome storage churn.
- Establishes a canonical merge operation and pending-sync event so future sync implementations can replay merges reliably.

Negative:

- The service worker now exposes more commands, increasing maintenance overhead and test surface.
- Pending-sync queue still lacks transactional locking, so concurrent `merge-pages` could interleave until we implement storage-level mutexes.

## Alternatives Considered

- **Build inventory with ad-hoc content script overlays** – rejected because inventory needs chrome:// URL access and doesn’t map to a specific tab.
- **Manipulate per-page data directly from the UI** – rejected to keep data invariants centralized in `src/shared/links.ts` and reuse queueing.

## Related

- Planning: `.plan/.done/feat-continue-feature-mvp-build/plan.md`
