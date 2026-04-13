/**
 * Storage abstraction layer
 *
 * Design principles:
 * - Local cache drives UI responsiveness
 * - Cloud storage is the sync source of truth (Supabase - future)
 * - Offline operations are queued for later sync
 */

import {
  LinkGraph,
  PageLinks,
  PendingSync,
  StorageMeta,
  STORAGE_KEYS,
  CURRENT_SCHEMA_VERSION,
} from './types';

/**
 * Initialize empty link graph
 */
function createEmptyGraph(): LinkGraph {
  return {
    pages: {},
    meta: {
      pageCount: 0,
      linkCount: 0,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Get the link graph from local storage
 */
export async function getLinkGraph(): Promise<LinkGraph> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.LINK_GRAPH);
    const graph = result[STORAGE_KEYS.LINK_GRAPH] as LinkGraph | undefined;

    if (!graph) {
      return createEmptyGraph();
    }

    return graph;
  } catch (error) {
    console.error('[Linkback] Failed to get link graph:', error);
    return createEmptyGraph();
  }
}

/**
 * Save the link graph to local storage
 */
export async function saveLinkGraph(graph: LinkGraph): Promise<void> {
  try {
    // Update metadata
    graph.meta.pageCount = Object.keys(graph.pages).length;
    graph.meta.linkCount = countUniqueLinks(graph);
    graph.meta.updatedAt = new Date().toISOString();

    await chrome.storage.local.set({
      [STORAGE_KEYS.LINK_GRAPH]: graph,
    });
  } catch (error) {
    console.error('[Linkback] Failed to save link graph:', error);
    throw error;
  }
}

/**
 * Count unique link pairs (A→B and B→A count as 1)
 */
function countUniqueLinks(graph: LinkGraph): number {
  const seen = new Set<string>();
  let count = 0;

  for (const pageLinks of Object.values(graph.pages)) {
    for (const linkedUrl of pageLinks.linkedUrls) {
      // Create canonical pair key (sorted URLs)
      const pair = [pageLinks.url, linkedUrl].sort().join('|');
      if (!seen.has(pair)) {
        seen.add(pair);
        count++;
      }
    }
  }

  return count;
}

/**
 * Get links for a specific page
 */
export async function getPageLinks(url: string): Promise<PageLinks | null> {
  const graph = await getLinkGraph();
  return graph.pages[url] || null;
}

/**
 * Get all pages in the graph
 */
export async function getAllPages(): Promise<PageLinks[]> {
  const graph = await getLinkGraph();
  return Object.values(graph.pages);
}

/**
 * Add a pending sync operation
 */
export async function addPendingSync(operation: Omit<PendingSync, 'id' | 'createdAt' | 'retryCount'>): Promise<void> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.PENDING_SYNC);
    const pending = (result[STORAGE_KEYS.PENDING_SYNC] as PendingSync[]) || [];

    const newOp: PendingSync = {
      ...operation,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    pending.push(newOp);

    await chrome.storage.local.set({
      [STORAGE_KEYS.PENDING_SYNC]: pending,
    });
  } catch (error) {
    console.error('[Linkback] Failed to add pending sync:', error);
  }
}

/**
 * Get all pending sync operations
 */
export async function getPendingSync(): Promise<PendingSync[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.PENDING_SYNC);
    return (result[STORAGE_KEYS.PENDING_SYNC] as PendingSync[]) || [];
  } catch (error) {
    console.error('[Linkback] Failed to get pending sync:', error);
    return [];
  }
}

/**
 * Remove a pending sync operation by ID
 */
export async function removePendingSync(id: string): Promise<void> {
  try {
    const pending = await getPendingSync();
    const filtered = pending.filter((op) => op.id !== id);

    await chrome.storage.local.set({
      [STORAGE_KEYS.PENDING_SYNC]: filtered,
    });
  } catch (error) {
    console.error('[Linkback] Failed to remove pending sync:', error);
  }
}

/**
 * Clear all pending sync operations
 */
export async function clearPendingSync(): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.PENDING_SYNC]: [],
    });
  } catch (error) {
    console.error('[Linkback] Failed to clear pending sync:', error);
  }
}

/**
 * Get storage metadata
 */
export async function getStorageMeta(): Promise<StorageMeta> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.STORAGE_META);
    const meta = result[STORAGE_KEYS.STORAGE_META] as StorageMeta | undefined;

    if (!meta) {
      return {
        version: CURRENT_SCHEMA_VERSION,
        migratedAt: new Date().toISOString(),
      };
    }

    return meta;
  } catch (error) {
    console.error('[Linkback] Failed to get storage meta:', error);
    return {
      version: CURRENT_SCHEMA_VERSION,
      migratedAt: new Date().toISOString(),
    };
  }
}

/**
 * Save storage metadata
 */
export async function saveStorageMeta(meta: StorageMeta): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.STORAGE_META]: meta,
    });
  } catch (error) {
    console.error('[Linkback] Failed to save storage meta:', error);
  }
}

/**
 * Run storage migrations if needed
 */
export async function runMigrations(): Promise<void> {
  const meta = await getStorageMeta();

  if (meta.version < CURRENT_SCHEMA_VERSION) {
    // Future migrations would go here
    // Each migration should be idempotent

    meta.version = CURRENT_SCHEMA_VERSION;
    meta.migratedAt = new Date().toISOString();
    await saveStorageMeta(meta);
  }
}

/**
 * Clear all extension storage (for debugging/reset)
 */
export async function clearAllStorage(): Promise<void> {
  await chrome.storage.local.clear();
}

/**
 * Get storage usage statistics
 */
export async function getStorageStats(): Promise<{
  bytesInUse: number;
  quota: number;
  percentUsed: number;
}> {
  const bytesInUse = await chrome.storage.local.getBytesInUse();
  const quota = chrome.storage.local.QUOTA_BYTES;

  return {
    bytesInUse,
    quota,
    percentUsed: (bytesInUse / quota) * 100,
  };
}
