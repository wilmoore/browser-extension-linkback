import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome.storage.local
const mockStorage: Record<string, unknown> = {};

vi.mock('./storage', () => ({
  getLinkGraph: vi.fn(async () => mockStorage.linkback_graph || {
    pages: {},
    meta: { pageCount: 0, linkCount: 0, updatedAt: new Date().toISOString() },
  }),
  saveLinkGraph: vi.fn(async (graph) => {
    mockStorage.linkback_graph = graph;
  }),
  addPendingSync: vi.fn(async () => {}),
}));

import {
  createLink,
  deleteLink,
  getLinksForPage,
  getLinkedPages,
  linkExists,
} from './links';
import { getLinkGraph, saveLinkGraph } from './storage';

describe('createLink', () => {
  beforeEach(() => {
    // Reset mock storage
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.clearAllMocks();
  });

  it('creates bidirectional links', async () => {
    const result = await createLink({
      sourceUrl: 'https://example.com/a',
      sourceTitle: 'Page A',
      targetUrl: 'https://example.com/b',
      targetTitle: 'Page B',
    });

    expect(result).toBe(true);
    expect(saveLinkGraph).toHaveBeenCalled();

    // Verify both directions were created
    const graph = (saveLinkGraph as any).mock.calls[0][0];
    expect(graph.pages['https://example.com/a'].linkedUrls).toContain('https://example.com/b');
    expect(graph.pages['https://example.com/b'].linkedUrls).toContain('https://example.com/a');
  });

  it('prevents self-links', async () => {
    const result = await createLink({
      sourceUrl: 'https://example.com/a',
      sourceTitle: 'Page A',
      targetUrl: 'https://example.com/a',
      targetTitle: 'Page A',
    });

    expect(result).toBe(false);
    expect(saveLinkGraph).not.toHaveBeenCalled();
  });

  it('deduplicates existing links', async () => {
    // Create initial link
    await createLink({
      sourceUrl: 'https://example.com/a',
      sourceTitle: 'Page A',
      targetUrl: 'https://example.com/b',
      targetTitle: 'Page B',
    });

    // Clear mock to track second call
    vi.clearAllMocks();

    // Try to create duplicate
    const result = await createLink({
      sourceUrl: 'https://example.com/a',
      sourceTitle: 'Page A',
      targetUrl: 'https://example.com/b',
      targetTitle: 'Page B',
    });

    expect(result).toBe(false);
  });

  it('normalizes URLs before storing', async () => {
    await createLink({
      sourceUrl: 'https://EXAMPLE.COM/a?utm_source=test',
      sourceTitle: 'Page A',
      targetUrl: 'https://example.com/b/',
      targetTitle: 'Page B',
    });

    const graph = (saveLinkGraph as any).mock.calls[0][0];

    // Should have normalized URLs as keys
    expect(graph.pages['https://example.com/a']).toBeDefined();
    expect(graph.pages['https://example.com/b']).toBeDefined();
  });
});

describe('deleteLink', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.clearAllMocks();
  });

  it('removes links in both directions', async () => {
    // Create link first
    await createLink({
      sourceUrl: 'https://example.com/a',
      sourceTitle: 'Page A',
      targetUrl: 'https://example.com/b',
      targetTitle: 'Page B',
    });

    vi.clearAllMocks();

    // Delete the link
    const result = await deleteLink({
      sourceUrl: 'https://example.com/a',
      targetUrl: 'https://example.com/b',
    });

    expect(result).toBe(true);
    expect(saveLinkGraph).toHaveBeenCalled();

    // Verify both directions were removed
    const graph = (saveLinkGraph as any).mock.calls[0][0];

    // Pages should be cleaned up (orphans removed)
    expect(graph.pages['https://example.com/a']).toBeUndefined();
    expect(graph.pages['https://example.com/b']).toBeUndefined();
  });

  it('returns false for non-existent links', async () => {
    const result = await deleteLink({
      sourceUrl: 'https://example.com/a',
      targetUrl: 'https://example.com/b',
    });

    expect(result).toBe(false);
  });
});

describe('linkExists', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.clearAllMocks();
  });

  it('returns true for existing links', async () => {
    await createLink({
      sourceUrl: 'https://example.com/a',
      sourceTitle: 'Page A',
      targetUrl: 'https://example.com/b',
      targetTitle: 'Page B',
    });

    const exists = await linkExists('https://example.com/a', 'https://example.com/b');
    expect(exists).toBe(true);

    // Should work in both directions
    const existsReverse = await linkExists('https://example.com/b', 'https://example.com/a');
    expect(existsReverse).toBe(true);
  });

  it('returns false for non-existent links', async () => {
    const exists = await linkExists('https://example.com/a', 'https://example.com/b');
    expect(exists).toBe(false);
  });
});

describe('getLinkedPages', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.clearAllMocks();
  });

  it('returns linked pages with metadata', async () => {
    await createLink({
      sourceUrl: 'https://example.com/a',
      sourceTitle: 'Page A',
      targetUrl: 'https://example.com/b',
      targetTitle: 'Page B',
    });

    await createLink({
      sourceUrl: 'https://example.com/a',
      sourceTitle: 'Page A',
      targetUrl: 'https://example.com/c',
      targetTitle: 'Page C',
    });

    const linkedPages = await getLinkedPages('https://example.com/a');

    expect(linkedPages).toHaveLength(2);
    expect(linkedPages.map((p) => p.url)).toContain('https://example.com/b');
    expect(linkedPages.map((p) => p.url)).toContain('https://example.com/c');
  });

  it('returns empty array for unlinked pages', async () => {
    const linkedPages = await getLinkedPages('https://example.com/x');
    expect(linkedPages).toEqual([]);
  });
});
