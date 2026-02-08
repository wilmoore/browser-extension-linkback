# Item #1: Link Creation and Bidirectional Integrity

Epic E-001: Core linking functionality ensuring all links are strictly bidirectional.

## Requirements
- Creating or deleting a link updates both directions atomically
- URL normalization runs on write
- Titles are mutable metadata; URLs are canonical identifiers
- No one-way links supported

## Implementation Approach

### 1. Project Structure
```
src/
  background/      # Service worker
  content/         # Content scripts
  popup/           # Extension popup (if needed)
  sidebar/         # Context sidebar panel
  shared/          # Shared utilities and types
    types.ts       # TypeScript interfaces
    storage.ts     # Storage abstraction
    links.ts       # Core link operations
    url-utils.ts   # URL normalization
```

### 2. Core Data Model
```typescript
interface Link {
  sourceUrl: string;      // Normalized canonical URL
  targetUrl: string;      // Normalized canonical URL
  sourceTitle: string;    // Mutable display title
  targetTitle: string;    // Mutable display title
  createdAt: string;      // ISO timestamp
  updatedAt: string;      // ISO timestamp
}

interface PageLinks {
  url: string;            // Normalized URL (key)
  title: string;          // Current page title
  links: string[];        // Array of normalized linked URLs
  linkOrder: string[];    // User-defined order for sidebar
}
```

### 3. Bidirectional Invariant
All link operations must be atomic:
- `createLink(a, b)` creates both A→B and B→A
- `deleteLink(a, b)` removes both directions
- No API exists for one-way link creation

## Files to Create
1. manifest.json - Chrome extension manifest v3
2. src/shared/types.ts - Type definitions
3. src/shared/url-utils.ts - URL normalization
4. src/shared/storage.ts - Storage abstraction (local + sync)
5. src/shared/links.ts - Core bidirectional link operations
6. src/background/service-worker.ts - Background service worker
