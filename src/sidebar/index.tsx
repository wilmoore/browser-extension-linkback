/**
 * Context Sidebar for Linkback extension
 *
 * Persistent right-side panel showing related links
 * for the current page with Vim navigation and reordering.
 */

import { render } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { PageLinks } from '../shared/types';

interface LinkedPage {
  url: string;
  title: string;
}

function Sidebar() {
  const [linkedPages, setLinkedPages] = useState<LinkedPage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filter, setFilter] = useState('');
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [currentPageUrl, setCurrentPageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Fetch linked pages for current tab
  const fetchLinks = useCallback(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return;

      setCurrentPageUrl(tab.url);

      const response = await chrome.runtime.sendMessage({
        type: 'GET_PAGE_LINKS',
        payload: { url: tab.url },
      });

      if (response?.success && response.data?.linkedPages) {
        setLinkedPages(response.data.linkedPages);
      } else {
        setLinkedPages([]);
      }
    } catch (error) {
      console.error('[Linkback Sidebar] Failed to fetch links:', error);
      setLinkedPages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and tab change listener
  useEffect(() => {
    fetchLinks();

    // Listen for tab changes
    const handleTabChange = () => {
      setLoading(true);
      fetchLinks();
    };

    chrome.tabs.onActivated.addListener(handleTabChange);
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.url) {
        handleTabChange();
      }
    });

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabChange);
    };
  }, [fetchLinks]);

  // Filter pages
  const filteredPages = linkedPages.filter(
    (page) =>
      page.title.toLowerCase().includes(filter.toLowerCase()) ||
      page.url.toLowerCase().includes(filter.toLowerCase())
  );

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filteredPages.length) {
      setSelectedIndex(Math.max(0, filteredPages.length - 1));
    }
  }, [filteredPages.length, selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    let lastG = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Filter input handling
      if (e.key === '/') {
        e.preventDefault();
        const input = document.querySelector('.filter-input') as HTMLInputElement;
        input?.focus();
        return;
      }

      // Don't handle if typing in input
      if (document.activeElement?.tagName === 'INPUT') {
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement).blur();
          setFilter('');
        }
        return;
      }

      // Vim navigation
      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          if (isReorderMode && e.shiftKey) {
            // Move item down
            moveItem(selectedIndex, 1);
          } else {
            setSelectedIndex((i) => Math.min(i + 1, filteredPages.length - 1));
          }
          break;

        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          if (isReorderMode && e.shiftKey) {
            // Move item up
            moveItem(selectedIndex, -1);
          } else {
            setSelectedIndex((i) => Math.max(i - 1, 0));
          }
          break;

        case 'g':
          // Handle gg (double g)
          const now = Date.now();
          if (now - lastG < 300) {
            e.preventDefault();
            setSelectedIndex(0);
            lastG = 0;
          } else {
            lastG = now;
          }
          break;

        case 'G':
          e.preventDefault();
          setSelectedIndex(filteredPages.length - 1);
          break;

        case 'Enter':
          e.preventDefault();
          if (filteredPages[selectedIndex]) {
            openPage(filteredPages[selectedIndex].url);
          }
          break;

        case 'r':
          e.preventDefault();
          setIsReorderMode(!isReorderMode);
          break;

        case 'Escape':
          if (isReorderMode) {
            setIsReorderMode(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredPages, selectedIndex, isReorderMode]);

  // Open a page
  const openPage = (url: string) => {
    chrome.tabs.update({ url });
  };

  // Move an item in the order
  const moveItem = async (index: number, direction: number) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= filteredPages.length) return;

    const newOrder = [...linkedPages];
    const [item] = newOrder.splice(index, 1);
    newOrder.splice(newIndex, 0, item);

    setLinkedPages(newOrder);
    setSelectedIndex(newIndex);

    // Persist new order
    await chrome.runtime.sendMessage({
      type: 'REORDER_LINKS',
      payload: {
        url: currentPageUrl,
        linkOrder: newOrder.map((p) => p.url),
      },
    });
  };

  return (
    <div class="sidebar">
      <div class="header">
        <h1>Context Links</h1>
        {isReorderMode && <span class="mode-badge">REORDER</span>}
      </div>

      <div class="filter-container">
        <span class="filter-icon">/</span>
        <input
          type="text"
          class="filter-input"
          placeholder="filter..."
          value={filter}
          onInput={(e) => setFilter((e.target as HTMLInputElement).value)}
        />
      </div>

      <div class="links-list">
        {loading ? (
          <div class="empty">Loading...</div>
        ) : filteredPages.length === 0 ? (
          <div class="empty">
            {linkedPages.length === 0
              ? 'No linked pages. Press Cmd+Shift+L to link.'
              : 'No matches found.'}
          </div>
        ) : (
          filteredPages.map((page, i) => (
            <div
              key={page.url}
              class={`link-item ${i === selectedIndex ? 'selected' : ''}`}
              onClick={() => openPage(page.url)}
            >
              {isReorderMode && <span class="reorder-handle">⋮⋮</span>}
              <span class="link-title">{page.title}</span>
            </div>
          ))
        )}
      </div>

      <div class="footer">
        <span>j/k move</span>
        <span>Enter open</span>
        <span>r reorder</span>
      </div>

      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .sidebar {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #1a1a1a;
          color: #e5e5e5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
        }

        .header {
          padding: 16px;
          border-bottom: 1px solid #333;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .header h1 {
          font-size: 16px;
          font-weight: 500;
          flex: 1;
        }

        .mode-badge {
          background: #3b82f6;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
        }

        .filter-container {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          border-bottom: 1px solid #333;
        }

        .filter-icon {
          color: #666;
          margin-right: 8px;
          font-family: monospace;
        }

        .filter-input {
          flex: 1;
          background: transparent;
          border: none;
          color: #e5e5e5;
          font-size: 14px;
          outline: none;
        }

        .filter-input::placeholder {
          color: #666;
        }

        .links-list {
          flex: 1;
          overflow-y: auto;
        }

        .link-item {
          padding: 12px 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid #2a2a2a;
        }

        .link-item:hover {
          background: #2a2a2a;
        }

        .link-item.selected {
          background: #3b82f6;
        }

        .reorder-handle {
          color: #666;
          cursor: grab;
        }

        .link-title {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .empty {
          padding: 24px 16px;
          text-align: center;
          color: #666;
        }

        .footer {
          padding: 8px 16px;
          border-top: 1px solid #333;
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: #666;
        }
      `}</style>
    </div>
  );
}

// Mount the app
const container = document.getElementById('app');
if (container) {
  render(<Sidebar />, container);
}
