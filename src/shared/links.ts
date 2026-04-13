/**
 * Core bidirectional link operations
 *
 * INVARIANT: All links are strictly bidirectional.
 * If A→B exists, B→A must also exist.
 * Creating or deleting a link updates both directions atomically.
 */

import {
  PageLinks,
  CreateLinkPayload,
  DeleteLinkPayload,
  ReorderLinksPayload,
  MergePagesPayload,
} from './types';
import { getLinkGraph, saveLinkGraph, addPendingSync } from './storage';
import { normalizeUrl } from './url-utils';

/**
 * Create a bidirectional link between two pages
 * This is an atomic operation that creates both A→B and B→A
 *
 * @returns true if link was created, false if it already existed
 */
export async function createLink(payload: CreateLinkPayload): Promise<boolean> {
  const sourceUrl = normalizeUrl(payload.sourceUrl);
  const targetUrl = normalizeUrl(payload.targetUrl);

  // Don't allow self-links
  if (sourceUrl === targetUrl) {
    console.warn('[Linkback] Cannot create self-link');
    return false;
  }

  const graph = await getLinkGraph();
  const now = new Date().toISOString();

  // Ensure source page exists
  if (!graph.pages[sourceUrl]) {
    graph.pages[sourceUrl] = {
      url: sourceUrl,
      title: payload.sourceTitle,
      linkedUrls: [],
      linkOrder: [],
      updatedAt: now,
    };
  }

  // Ensure target page exists
  if (!graph.pages[targetUrl]) {
    graph.pages[targetUrl] = {
      url: targetUrl,
      title: payload.targetTitle,
      linkedUrls: [],
      linkOrder: [],
      updatedAt: now,
    };
  }

  const sourcePage = graph.pages[sourceUrl];
  const targetPage = graph.pages[targetUrl];

  // Check if link already exists (deduplication)
  if (sourcePage.linkedUrls.includes(targetUrl)) {
    console.log('[Linkback] Link already exists');
    return false;
  }

  // Create bidirectional link atomically
  sourcePage.linkedUrls.push(targetUrl);
  sourcePage.linkOrder.push(targetUrl);
  sourcePage.updatedAt = now;

  targetPage.linkedUrls.push(sourceUrl);
  targetPage.linkOrder.push(sourceUrl);
  targetPage.updatedAt = now;

  // Update titles if provided and different
  if (payload.sourceTitle && sourcePage.title !== payload.sourceTitle) {
    sourcePage.title = payload.sourceTitle;
  }
  if (payload.targetTitle && targetPage.title !== payload.targetTitle) {
    targetPage.title = payload.targetTitle;
  }

  await saveLinkGraph(graph);

  // Queue for cloud sync
  await addPendingSync({
    type: 'create-link',
    payload: {
      sourceUrl,
      targetUrl,
    },
  });

  console.log('[Linkback] Created bidirectional link:', sourceUrl, '↔', targetUrl);
  return true;
}

/**
 * Delete a bidirectional link between two pages
 * This is an atomic operation that removes both A→B and B→A
 *
 * @returns true if link was deleted, false if it didn't exist
 */
export async function deleteLink(payload: DeleteLinkPayload): Promise<boolean> {
  const sourceUrl = normalizeUrl(payload.sourceUrl);
  const targetUrl = normalizeUrl(payload.targetUrl);

  const graph = await getLinkGraph();
  const now = new Date().toISOString();

  const sourcePage = graph.pages[sourceUrl];
  const targetPage = graph.pages[targetUrl];

  // Check if link exists
  if (!sourcePage || !sourcePage.linkedUrls.includes(targetUrl)) {
    console.log('[Linkback] Link does not exist');
    return false;
  }

  // Remove bidirectional link atomically
  sourcePage.linkedUrls = sourcePage.linkedUrls.filter((url) => url !== targetUrl);
  sourcePage.linkOrder = sourcePage.linkOrder.filter((url) => url !== targetUrl);
  sourcePage.updatedAt = now;

  if (targetPage) {
    targetPage.linkedUrls = targetPage.linkedUrls.filter((url) => url !== sourceUrl);
    targetPage.linkOrder = targetPage.linkOrder.filter((url) => url !== sourceUrl);
    targetPage.updatedAt = now;
  }

  // Clean up orphan pages (pages with no links)
  if (sourcePage.linkedUrls.length === 0) {
    delete graph.pages[sourceUrl];
  }
  if (targetPage && targetPage.linkedUrls.length === 0) {
    delete graph.pages[targetUrl];
  }

  await saveLinkGraph(graph);

  // Queue for cloud sync
  await addPendingSync({
    type: 'delete-link',
    payload: {
      sourceUrl,
      targetUrl,
    },
  });

  console.log('[Linkback] Deleted bidirectional link:', sourceUrl, '↔', targetUrl);
  return true;
}

/**
 * Get all links for a page
 */
export async function getLinksForPage(url: string): Promise<PageLinks | null> {
  const normalizedUrl = normalizeUrl(url);
  const graph = await getLinkGraph();
  return graph.pages[normalizedUrl] || null;
}

/**
 * Get linked pages with their metadata
 */
export async function getLinkedPages(url: string): Promise<PageLinks[]> {
  const normalizedUrl = normalizeUrl(url);
  const graph = await getLinkGraph();
  const page = graph.pages[normalizedUrl];

  if (!page) {
    return [];
  }

  // Get pages in user-defined order, falling back to linkedUrls order
  const orderedUrls = page.linkOrder.length > 0 ? page.linkOrder : page.linkedUrls;

  const linkedPages: PageLinks[] = [];
  for (const linkedUrl of orderedUrls) {
    const linkedPage = graph.pages[linkedUrl];
    if (linkedPage) {
      linkedPages.push(linkedPage);
    }
  }

  return linkedPages;
}

/**
 * Update the title for a page
 */
export async function updatePageTitle(url: string, title: string): Promise<void> {
  const normalizedUrl = normalizeUrl(url);
  const graph = await getLinkGraph();
  const page = graph.pages[normalizedUrl];

  if (page) {
    page.title = title;
    page.updatedAt = new Date().toISOString();
    await saveLinkGraph(graph);

    // Queue for cloud sync
    await addPendingSync({
      type: 'update-title',
      payload: {
        url: normalizedUrl,
        title,
      },
    });
  }
}

/**
 * Reorder links for a page (user-defined order for sidebar)
 */
export async function reorderLinks(payload: ReorderLinksPayload): Promise<void> {
  const normalizedUrl = normalizeUrl(payload.url);
  const graph = await getLinkGraph();
  const page = graph.pages[normalizedUrl];

  if (page) {
    // Validate that all URLs in the new order exist in linkedUrls
    const validOrder = payload.linkOrder.filter((url) =>
      page.linkedUrls.includes(normalizeUrl(url))
    );

    page.linkOrder = validOrder;
    page.updatedAt = new Date().toISOString();
    await saveLinkGraph(graph);
  }
}

/**
 * Search pages by title or URL
 */
export async function searchPages(query: string): Promise<PageLinks[]> {
  const graph = await getLinkGraph();
  const lowerQuery = query.toLowerCase();

  return Object.values(graph.pages).filter(
    (page) =>
      page.title.toLowerCase().includes(lowerQuery) ||
      page.url.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get pages with no links (orphans)
 * Note: In a strictly bidirectional system, orphans shouldn't exist
 * This is mainly for cleanup/debugging
 */
export async function getOrphanPages(): Promise<PageLinks[]> {
  const graph = await getLinkGraph();
  return Object.values(graph.pages).filter((page) => page.linkedUrls.length === 0);
}

/**
 * Get statistics about the link graph
 */
export async function getLinkStats(): Promise<{
  totalPages: number;
  totalLinks: number;
  averageLinksPerPage: number;
  mostLinkedPages: Array<{ url: string; title: string; linkCount: number }>;
}> {
  const graph = await getLinkGraph();
  const pages = Object.values(graph.pages);

  const totalPages = pages.length;
  const totalLinks = graph.meta.linkCount;
  const averageLinksPerPage = totalPages > 0 ? totalLinks / totalPages : 0;

  const mostLinkedPages = pages
    .map((page) => ({
      url: page.url,
      title: page.title,
      linkCount: page.linkedUrls.length,
    }))
    .sort((a, b) => b.linkCount - a.linkCount)
    .slice(0, 10);

  return {
    totalPages,
    totalLinks,
    averageLinksPerPage,
    mostLinkedPages,
  };
}

/**
 * Check if a link exists between two pages
 */
export async function linkExists(sourceUrl: string, targetUrl: string): Promise<boolean> {
  const normalizedSource = normalizeUrl(sourceUrl);
  const normalizedTarget = normalizeUrl(targetUrl);

  const graph = await getLinkGraph();
  const page = graph.pages[normalizedSource];

  return page?.linkedUrls.includes(normalizedTarget) ?? false;
}

/**
 * Merge duplicate pages by folding all relationships into the primary URL
 */
export async function mergePages(payload: MergePagesPayload): Promise<{
  mergedLinks: number;
}> {
  const primaryUrl = normalizeUrl(payload.primaryUrl);
  const duplicateUrl = normalizeUrl(payload.duplicateUrl);

  if (primaryUrl === duplicateUrl) {
    throw new Error('Cannot merge a page into itself');
  }

  const graph = await getLinkGraph();
  const primaryPage = graph.pages[primaryUrl];
  const duplicatePage = graph.pages[duplicateUrl];

  if (!primaryPage) {
    throw new Error('Primary page not found');
  }
  if (!duplicatePage) {
    throw new Error('Duplicate page not found');
  }

  const now = new Date().toISOString();
  let mergedLinks = 0;

  for (const neighborUrl of duplicatePage.linkedUrls) {
    if (neighborUrl === primaryUrl) {
      continue;
    }

    const neighbor = graph.pages[neighborUrl];
    if (!neighbor) {
      continue;
    }

    const primaryAlreadyLinked = primaryPage.linkedUrls.includes(neighborUrl);
    if (!primaryAlreadyLinked) {
      primaryPage.linkedUrls.push(neighborUrl);
      if (!primaryPage.linkOrder.includes(neighborUrl)) {
        primaryPage.linkOrder.push(neighborUrl);
      }
      mergedLinks++;
    }

    neighbor.linkedUrls = replaceAndDedupe(neighbor.linkedUrls, duplicateUrl, primaryUrl);
    neighbor.linkOrder = replaceAndDedupe(neighbor.linkOrder, duplicateUrl, primaryUrl);
    neighbor.updatedAt = now;
  }

  primaryPage.linkedUrls = dedupeList(
    primaryPage.linkedUrls.filter((url) => url !== duplicateUrl)
  );
  primaryPage.linkOrder = dedupeList(
    primaryPage.linkOrder.filter((url) => url !== duplicateUrl)
  );
  primaryPage.updatedAt = now;

  delete graph.pages[duplicateUrl];

  await saveLinkGraph(graph);

  await addPendingSync({
    type: 'merge-pages',
    payload: {
      sourceUrl: duplicateUrl,
      targetUrl: primaryUrl,
      primaryUrl,
      duplicateUrl,
    },
  });

  console.log('[Linkback] Merged pages:', duplicateUrl, '→', primaryUrl);

  return { mergedLinks };
}

function dedupeList(urls: string[]): string[] {
  return Array.from(new Set(urls));
}

function replaceAndDedupe(list: string[], target: string, replacement: string): string[] {
  const next: string[] = [];
  for (const url of list) {
    if (url === target) {
      if (!next.includes(replacement)) {
        next.push(replacement);
      }
    } else if (!next.includes(url)) {
      next.push(url);
    }
  }
  return next;
}
