import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { PageLinks } from '../shared/types';

import './styles.css';

type InventoryStats = {
  totalPages: number;
  totalLinks: number;
  averageLinksPerPage: number;
  mostLinkedPages: Array<{ url: string; title: string; linkCount: number }>;
};

type InventorySnapshot = {
  pages: PageLinks[];
  stats: InventoryStats;
  pendingCount: number;
  isOnline: boolean;
};

type SortMode = 'linked' | 'recent' | 'alpha';

const SORT_LABELS: Record<SortMode, string> = {
  linked: 'Most Linked',
  recent: 'Recent',
  alpha: 'A → Z',
};

const SORT_ORDER: SortMode[] = ['linked', 'recent', 'alpha'];

const getHostname = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const InventoryApp = () => {
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('linked');
  const [renameValue, setRenameValue] = useState('');
  const [mergeValue, setMergeValue] = useState('');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [savingTitle, setSavingTitle] = useState(false);
  const [merging, setMerging] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const pageMap = useMemo(() => {
    const map = new Map<string, PageLinks>();
    snapshot?.pages.forEach((page) => map.set(page.url, page));
    return map;
  }, [snapshot]);

  const pages = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.pages.map((page) => ({
      ...page,
      linkCount: page.linkedUrls.length,
    }));
  }, [snapshot]);

  const filteredPages = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    const base = trimmed
      ? pages.filter(
          (page) =>
            page.title.toLowerCase().includes(trimmed) ||
            page.url.toLowerCase().includes(trimmed)
        )
      : pages;

    const sorted = [...base];
    switch (sort) {
      case 'recent':
        sorted.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        break;
      case 'alpha':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'linked':
      default:
        sorted.sort((a, b) => b.linkCount - a.linkCount || a.title.localeCompare(b.title));
        break;
    }
    return sorted;
  }, [pages, search, sort]);

  const selectedPage = useMemo(() => {
    if (!selectedUrl) return null;
    return pageMap.get(selectedUrl) ?? null;
  }, [pageMap, selectedUrl]);

  const linkedPages = useMemo(() => {
    if (!selectedPage) return [];
    return selectedPage.linkedUrls.map((url) => {
      const linked = pageMap.get(url);
      return {
        url,
        title: linked?.title ?? url,
        linkCount: linked?.linkedUrls.length ?? 0,
      };
    });
  }, [selectedPage, pageMap]);

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3200);
  };

  const loadSnapshot = async () => {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_INVENTORY_SNAPSHOT' });
      if (response?.success) {
        setSnapshot(response.data as InventorySnapshot);
      } else {
        showToast('Failed to fetch inventory', 'error');
      }
    } catch (error) {
      console.error('[Inventory] Failed to load snapshot', error);
      showToast('Failed to load inventory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshot();
  }, []);

  useEffect(() => {
    if (!snapshot) {
      setSelectedUrl(null);
      setRenameValue('');
      return;
    }

    const found = snapshot.pages.find((page) => page.url === selectedUrl);
    if (found) {
      setRenameValue(found.title);
      return;
    }

    if (snapshot.pages.length > 0) {
      setSelectedUrl(snapshot.pages[0].url);
      setRenameValue(snapshot.pages[0].title);
    } else {
      setSelectedUrl(null);
      setRenameValue('');
    }
  }, [snapshot, selectedUrl]);

  const handleRename = async () => {
    if (!selectedPage) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === selectedPage.title) {
      return;
    }

    setSavingTitle(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_TITLE',
        payload: { url: selectedPage.url, title: trimmed },
      });

      if (response?.success) {
        showToast('Title updated');
        await loadSnapshot();
      } else {
        showToast('Failed to update title', 'error');
      }
    } catch (error) {
      console.error('[Inventory] Failed to update title', error);
      showToast('Failed to update title', 'error');
    } finally {
      setSavingTitle(false);
    }
  };

  const handleRemoveLink = async (targetUrl: string) => {
    if (!selectedPage) return;
    if (!window.confirm('Remove this relationship for both pages?')) return;
    setRemoving(targetUrl);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DELETE_LINK',
        payload: {
          sourceUrl: selectedPage.url,
          targetUrl,
        },
      });

      if (response?.success) {
        showToast('Relationship removed');
        await loadSnapshot();
      } else {
        showToast('Failed to remove relationship', 'error');
      }
    } catch (error) {
      console.error('[Inventory] Failed to remove link', error);
      showToast('Failed to remove relationship', 'error');
    } finally {
      setRemoving(null);
    }
  };

  const handleMerge = async () => {
    if (!selectedPage || !mergeValue.trim()) return;
    if (mergeValue.trim() === selectedPage.url) {
      showToast('Choose a different page to merge', 'error');
      return;
    }

    const confirmed = window.confirm(
      'Merge the selected duplicate into this page? This cannot be undone.'
    );
    if (!confirmed) {
      return;
    }

    setMerging(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'MERGE_PAGES',
        payload: {
          primaryUrl: selectedPage.url,
          duplicateUrl: mergeValue.trim(),
        },
      });

      if (response?.success) {
        const mergedCount = response.data?.mergedLinks ?? 0;
        showToast(mergedCount > 0 ? `Merged ${mergedCount} links` : 'Pages merged');
        setMergeValue('');
        await loadSnapshot();
      } else {
        showToast(response?.error || 'Merge failed', 'error');
      }
    } catch (error) {
      console.error('[Inventory] Failed to merge pages', error);
      showToast('Failed to merge pages', 'error');
    } finally {
      setMerging(false);
    }
  };

  const selectedStats = snapshot?.stats;

  return (
    <div class="inventory-shell">
      <aside class="inventory-panel inventory-panel__list">
        <header class="panel-header">
          <div>
            <p class="eyebrow">Inventory</p>
            <h1>Link Graph</h1>
          </div>
          <button class="ghost" onClick={loadSnapshot} aria-label="Refresh inventory">
            ↻ Refresh
          </button>
        </header>

        <section class="stats">
          <div>
            <span class="stat-value">{selectedStats?.totalPages ?? 0}</span>
            <span class="stat-label">Pages</span>
          </div>
          <div>
            <span class="stat-value">{selectedStats?.totalLinks ?? 0}</span>
            <span class="stat-label">Link pairs</span>
          </div>
          <div>
            <span class="stat-value">
              {(selectedStats?.averageLinksPerPage ?? 0).toFixed(1)}
            </span>
            <span class="stat-label">Avg links/page</span>
          </div>
        </section>

        <div class="status-row">
          <span class={`status-chip ${snapshot?.isOnline ? 'online' : 'offline'}`}>
            {snapshot?.isOnline ? 'Online' : 'Offline'}
          </span>
          <span class={`status-chip ${snapshot && snapshot.pendingCount > 0 ? 'pending' : ''}`}>
            {snapshot?.pendingCount ?? 0} pending
          </span>
        </div>

        <div class="search-bar">
          <span>/</span>
          <input
            type="search"
            placeholder="Search titles or URLs"
            value={search}
            aria-label="Search titles or URLs"
            onInput={(event) => setSearch((event.target as HTMLInputElement).value)}
          />
        </div>

        <div class="sort-row">
          {SORT_ORDER.map((mode) => (
            <button
              key={mode}
              class={mode === sort ? 'pill pill--active' : 'pill'}
              onClick={() => setSort(mode)}
            >
              {SORT_LABELS[mode]}
            </button>
          ))}
        </div>

        <div class="page-list">
          {loading ? (
            <div class="empty">Loading inventory…</div>
          ) : filteredPages.length === 0 ? (
            <div class="empty">No matches. Adjust your search.</div>
          ) : (
            filteredPages.map((page) => (
              <button
                key={page.url}
                class={`page-card ${selectedUrl === page.url ? 'selected' : ''}`}
                onClick={() => setSelectedUrl(page.url)}
              >
                <div class="page-card__title">{page.title}</div>
                <div class="page-card__meta">
                  <span>{page.linkCount} links</span>
                  <span>{getHostname(page.url)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section class="inventory-panel inventory-panel__detail">
        {!selectedPage ? (
          <div class="empty detail-empty">Select a page to inspect its relationships.</div>
        ) : (
          <div class="detail-stack">
            <header class="detail-header">
              <div>
                <p class="eyebrow">Selected Page</p>
                <h2>{selectedPage.title}</h2>
                <a href={selectedPage.url} target="_blank" rel="noreferrer">
                  {selectedPage.url}
                </a>
              </div>
              <div class="tag">{selectedPage.linkedUrls.length} relationships</div>
            </header>

            <section class="card">
              <div class="card-header">
                <h3>Rename title</h3>
                <span class="hint">Cmd/Ctrl + Enter to save</span>
              </div>
              <div class="form-row">
                <input
                  type="text"
                  value={renameValue}
                  aria-label="Rename page title"
                  onInput={(event) => setRenameValue((event.target as HTMLInputElement).value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      handleRename();
                    }
                  }}
                />
                <button class="primary" onClick={handleRename} disabled={savingTitle}>
                  {savingTitle ? 'Saving…' : 'Save'}
                </button>
              </div>
            </section>

            <section class="card">
              <div class="card-header">
                <h3>Relationships</h3>
                <span class="hint">Select to open in a new tab</span>
              </div>
              {linkedPages.length === 0 ? (
                <div class="empty">No linked pages yet.</div>
              ) : (
                <ul class="link-list">
                  {linkedPages.map((link) => (
                    <li key={link.url}>
                      <button
                        class="link-chip"
                        onClick={() => window.open(link.url, '_blank', 'noopener')}
                      >
                        <span>
                          <strong>{link.title}</strong>
                          <small>{getHostname(link.url)}</small>
                        </span>
                        <span class="count">{link.linkCount} links</span>
                      </button>
                      <button
                        class="danger"
                        onClick={() => handleRemoveLink(link.url)}
                        disabled={removing === link.url}
                      >
                        {removing === link.url ? 'Removing…' : 'Remove'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section class="card">
              <div class="card-header">
                <h3>Merge duplicates</h3>
                <span class="hint">Keep this page, merge another into it</span>
              </div>
              <div class="form-row">
                <input
                  type="url"
                  list="merge-options"
                  placeholder="Paste or choose a duplicate URL"
                  value={mergeValue}
                  aria-label="Duplicate URL to merge"
                  onInput={(event) => setMergeValue((event.target as HTMLInputElement).value)}
                />
                <datalist id="merge-options">
                  {pages
                    .filter((page) => page.url !== selectedPage.url)
                    .map((page) => (
                      <option key={page.url} value={page.url} label={page.title} />
                    ))}
                </datalist>
                <button class="secondary" onClick={handleMerge} disabled={merging}>
                  {merging ? 'Merging…' : 'Merge into selection'}
                </button>
              </div>
            </section>

            {selectedStats?.mostLinkedPages?.length ? (
              <section class="card">
                <div class="card-header">
                  <h3>Most linked pages</h3>
                </div>
                <ul class="top-links">
                  {selectedStats.mostLinkedPages.slice(0, 5).map((entry) => (
                    <li key={entry.url}>
                      <span>
                        <strong>{entry.title}</strong>
                        <small>{getHostname(entry.url)}</small>
                      </span>
                      <span class="count">{entry.linkCount}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </section>

      {toast && (
        <div class={`toast ${toast.tone === 'error' ? 'toast--error' : ''}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

const mount = () => {
  const container = document.getElementById('app');
  if (container) {
    render(<InventoryApp />, container);
  }
};

mount();
