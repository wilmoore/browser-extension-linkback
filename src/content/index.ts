/**
 * Content script for Linkback extension
 *
 * Handles:
 * - Rendering UI overlays (Jump Palette, Link Modal)
 * - Capturing page metadata
 * - Keyboard event routing
 */

import { Message } from '../shared/types';

/**
 * Current page metadata
 */
function getPageMetadata(): { url: string; title: string } {
  return {
    url: window.location.href,
    title: document.title || window.location.hostname,
  };
}

/**
 * Handle messages from background script
 */
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  console.log('[Linkback Content] Message received:', message.type);

  switch (message.type) {
    case 'OPEN_JUMP_PALETTE':
      openJumpPalette();
      sendResponse({ success: true });
      break;

    case 'OPEN_LINK_MODAL':
      openLinkModal();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true;
});

/**
 * Open the Jump Palette overlay
 */
function openJumpPalette(): void {
  // Check if already open
  if (document.getElementById('linkback-jump-palette')) {
    closeJumpPalette();
    return;
  }

  const container = createOverlayContainer('linkback-jump-palette');
  document.body.appendChild(container);

  // Request current page links from background
  const { url } = getPageMetadata();
  chrome.runtime.sendMessage(
    { type: 'GET_PAGE_LINKS', payload: { url } },
    (response) => {
      if (response?.success) {
        renderJumpPalette(container, response.data.linkedPages || []);
      }
    }
  );
}

/**
 * Close the Jump Palette
 */
function closeJumpPalette(): void {
  const container = document.getElementById('linkback-jump-palette');
  if (container) {
    container.remove();
  }
}

/**
 * Render the Jump Palette UI
 */
function renderJumpPalette(container: HTMLElement, linkedPages: Array<{ url: string; title: string }>): void {
  const shadow = container.shadowRoot!;
  const root = shadow.getElementById('root')!;

  root.innerHTML = `
    <div class="palette">
      <div class="search-container">
        <span class="search-icon">></span>
        <input
          type="text"
          class="search-input"
          placeholder="jump to..."
          autofocus
        />
      </div>
      <div class="results">
        ${linkedPages.length === 0
          ? '<div class="empty">No linked pages. Press Cmd+Shift+L to link.</div>'
          : linkedPages.map((page, i) => `
              <div class="result ${i === 0 ? 'selected' : ''}" data-url="${escapeHtml(page.url)}">
                <span class="title">${escapeHtml(page.title)}</span>
              </div>
            `).join('')
        }
      </div>
      <div class="footer">
        <span>j/k move</span>
        <span>Enter open</span>
        <span>Esc close</span>
      </div>
    </div>
  `;

  // Set up event handlers
  const input = shadow.querySelector('.search-input') as HTMLInputElement;
  const results = shadow.querySelectorAll('.result');
  let selectedIndex = 0;

  // Filter results on input
  input.addEventListener('input', () => {
    const query = input.value.toLowerCase();
    results.forEach((el) => {
      const title = el.querySelector('.title')?.textContent?.toLowerCase() || '';
      const url = (el as HTMLElement).dataset.url?.toLowerCase() || '';
      const matches = title.includes(query) || url.includes(query);
      (el as HTMLElement).style.display = matches ? '' : 'none';
    });

    // Reset selection to first visible
    const visible = Array.from(results).filter((el) => (el as HTMLElement).style.display !== 'none');
    results.forEach((el) => el.classList.remove('selected'));
    if (visible.length > 0) {
      visible[0].classList.add('selected');
      selectedIndex = Array.from(results).indexOf(visible[0]);
    }
  });

  // Keyboard navigation
  shadow.addEventListener('keydown', (e: Event) => {
    const event = e as KeyboardEvent;
    const visible = Array.from(results).filter((el) => (el as HTMLElement).style.display !== 'none');

    if (event.key === 'Escape') {
      closeJumpPalette();
      return;
    }

    if (event.key === 'Enter') {
      const selected = shadow.querySelector('.result.selected') as HTMLElement;
      if (selected?.dataset.url) {
        window.location.href = selected.dataset.url;
      }
      return;
    }

    // Vim navigation
    if (event.key === 'j' || (event.key === 'ArrowDown')) {
      event.preventDefault();
      const currentVisible = visible.findIndex((el) => el.classList.contains('selected'));
      if (currentVisible < visible.length - 1) {
        visible[currentVisible]?.classList.remove('selected');
        visible[currentVisible + 1]?.classList.add('selected');
      }
      return;
    }

    if (event.key === 'k' || (event.key === 'ArrowUp')) {
      event.preventDefault();
      const currentVisible = visible.findIndex((el) => el.classList.contains('selected'));
      if (currentVisible > 0) {
        visible[currentVisible]?.classList.remove('selected');
        visible[currentVisible - 1]?.classList.add('selected');
      }
      return;
    }

    // gg - go to top
    if (event.key === 'g') {
      // Handle gg (double g)
      const now = Date.now();
      if ((shadow as any).__lastG && now - (shadow as any).__lastG < 300) {
        event.preventDefault();
        visible.forEach((el) => el.classList.remove('selected'));
        if (visible.length > 0) {
          visible[0].classList.add('selected');
        }
        (shadow as any).__lastG = 0;
      } else {
        (shadow as any).__lastG = now;
      }
      return;
    }

    // G - go to bottom
    if (event.key === 'G') {
      event.preventDefault();
      visible.forEach((el) => el.classList.remove('selected'));
      if (visible.length > 0) {
        visible[visible.length - 1].classList.add('selected');
      }
      return;
    }
  });

  // Click to navigate
  results.forEach((el) => {
    el.addEventListener('click', () => {
      const url = (el as HTMLElement).dataset.url;
      if (url) {
        window.location.href = url;
      }
    });
  });

  // Focus input
  input.focus();
}

/**
 * Open the Link Modal
 */
function openLinkModal(): void {
  // Check if already open
  if (document.getElementById('linkback-link-modal')) {
    closeLinkModal();
    return;
  }

  const container = createOverlayContainer('linkback-link-modal');
  document.body.appendChild(container);

  renderLinkModal(container);
}

/**
 * Close the Link Modal
 */
function closeLinkModal(): void {
  const container = document.getElementById('linkback-link-modal');
  if (container) {
    container.remove();
  }
}

/**
 * Render the Link Modal UI
 */
function renderLinkModal(container: HTMLElement): void {
  const shadow = container.shadowRoot!;
  const root = shadow.getElementById('root')!;
  const { url: currentUrl, title: currentTitle } = getPageMetadata();

  root.innerHTML = `
    <div class="modal">
      <div class="header">Link this page to...</div>
      <div class="form">
        <label>
          <span>Target URL</span>
          <input type="url" class="url-input" placeholder="https://..." />
        </label>
        <label>
          <span>Title (optional)</span>
          <input type="text" class="title-input" placeholder="Page title" />
        </label>
      </div>
      <div class="footer">
        <button class="cancel-btn">Cancel</button>
        <button class="save-btn">Save Link</button>
      </div>
    </div>
  `;

  const urlInput = shadow.querySelector('.url-input') as HTMLInputElement;
  const titleInput = shadow.querySelector('.title-input') as HTMLInputElement;
  const saveBtn = shadow.querySelector('.save-btn') as HTMLButtonElement;
  const cancelBtn = shadow.querySelector('.cancel-btn') as HTMLButtonElement;

  // Try to get URL from clipboard
  navigator.clipboard.readText().then((text) => {
    if (text && isValidUrl(text)) {
      urlInput.value = text;
      // Try to fetch title
      fetchPageTitle(text).then((title) => {
        if (title && !titleInput.value) {
          titleInput.value = title;
        }
      });
    }
  }).catch(() => {
    // Clipboard access denied, that's fine
  });

  // Event handlers
  cancelBtn.addEventListener('click', closeLinkModal);

  saveBtn.addEventListener('click', async () => {
    const targetUrl = urlInput.value.trim();
    const targetTitle = titleInput.value.trim() || titleFromUrl(targetUrl);

    if (!targetUrl || !isValidUrl(targetUrl)) {
      urlInput.classList.add('error');
      return;
    }

    // Create the bidirectional link
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_LINK',
      payload: {
        sourceUrl: currentUrl,
        sourceTitle: currentTitle,
        targetUrl,
        targetTitle,
      },
    });

    if (response?.success) {
      closeLinkModal();
      showToast(response.data.created ? 'Link created!' : 'Link already exists');
    } else {
      showToast('Failed to create link');
    }
  });

  // Keyboard shortcuts
  shadow.addEventListener('keydown', (e: Event) => {
    const event = e as KeyboardEvent;
    if (event.key === 'Escape') {
      closeLinkModal();
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      saveBtn.click();
    }
  });

  urlInput.focus();
}

/**
 * Create an overlay container with shadow DOM
 */
function createOverlayContainer(id: string): HTMLElement {
  const container = document.createElement('div');
  container.id = id;
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2147483647;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 20vh;
    background: rgba(0, 0, 0, 0.5);
  `;

  const shadow = container.attachShadow({ mode: 'open' });

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .palette, .modal {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      width: 500px;
      max-width: 90vw;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #e5e5e5;
    }

    .search-container {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #333;
    }

    .search-icon {
      color: #666;
      margin-right: 8px;
      font-family: monospace;
    }

    .search-input {
      flex: 1;
      background: transparent;
      border: none;
      color: #e5e5e5;
      font-size: 16px;
      outline: none;
    }

    .search-input::placeholder {
      color: #666;
    }

    .results {
      max-height: 300px;
      overflow-y: auto;
    }

    .result {
      padding: 10px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
    }

    .result:hover, .result.selected {
      background: #2a2a2a;
    }

    .result.selected {
      background: #3b82f6;
    }

    .result .title {
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

    /* Modal styles */
    .modal .header {
      padding: 16px;
      border-bottom: 1px solid #333;
      font-weight: 500;
    }

    .modal .form {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .modal label {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .modal label span {
      font-size: 12px;
      color: #999;
    }

    .modal input {
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 4px;
      padding: 8px 12px;
      color: #e5e5e5;
      font-size: 14px;
      outline: none;
    }

    .modal input:focus {
      border-color: #3b82f6;
    }

    .modal input.error {
      border-color: #ef4444;
    }

    .modal .footer {
      justify-content: flex-end;
      gap: 8px;
    }

    .modal button {
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      border: none;
    }

    .cancel-btn {
      background: #333;
      color: #e5e5e5;
    }

    .cancel-btn:hover {
      background: #444;
    }

    .save-btn {
      background: #3b82f6;
      color: white;
    }

    .save-btn:hover {
      background: #2563eb;
    }
  `;

  const root = document.createElement('div');
  root.id = 'root';

  shadow.appendChild(style);
  shadow.appendChild(root);

  // Close on background click
  container.addEventListener('click', (e) => {
    if (e.target === container) {
      container.remove();
    }
  });

  return container;
}

/**
 * Show a toast notification
 */
function showToast(message: string): void {
  const existing = document.getElementById('linkback-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'linkback-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: #1a1a1a;
    color: #e5e5e5;
    padding: 12px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 2147483647;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2000);
}

/**
 * Utility functions
 */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    return hostname;
  } catch {
    return url;
  }
}

async function fetchPageTitle(url: string): Promise<string | null> {
  // Note: This will often fail due to CORS, but worth trying
  try {
    const response = await fetch(url, { mode: 'no-cors' });
    // Can't read response with no-cors, so this won't work
    // In a real implementation, we'd use the background script
    return null;
  } catch {
    return null;
  }
}

// Log initialization
console.log('[Linkback] Content script loaded');
