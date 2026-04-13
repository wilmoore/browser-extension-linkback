/**
 * Background service worker for Linkback extension
 *
 * Handles:
 * - Keyboard command routing
 * - Message passing between components
 * - Storage initialization
 * - Offline sync queue processing
 */

import {
  Message,
  Response,
  CreateLinkPayload,
  DeleteLinkPayload,
  ReorderLinksPayload,
  MergePagesPayload,
} from '../shared/types';
import { runMigrations, getPendingSync, getAllPages } from '../shared/storage';
import {
  createLink,
  deleteLink,
  getLinksForPage,
  getLinkedPages,
  updatePageTitle,
  reorderLinks,
  getLinkStats,
  mergePages,
} from '../shared/links';
import { normalizeUrl } from '../shared/url-utils';

/**
 * Initialize extension on install
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Linkback] Extension installed');
  await runMigrations();
});

/**
 * Initialize extension on startup
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Linkback] Extension started');
  await runMigrations();
  await processPendingSync();
});

/**
 * Handle keyboard commands
 */
chrome.commands.onCommand.addListener(async (command) => {
  console.log('[Linkback] Command received:', command);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url) {
    console.warn('[Linkback] No active tab');
    return;
  }

  // Skip chrome:// and other internal pages
  if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
    console.warn('[Linkback] Cannot run on internal pages');
    return;
  }

  switch (command) {
    case 'open-jump-palette':
      await sendToTab(tab.id, { type: 'OPEN_JUMP_PALETTE' });
      break;

    case 'open-link-modal':
      await sendToTab(tab.id, { type: 'OPEN_LINK_MODAL' });
      break;

    case 'toggle-sidebar':
      await chrome.sidePanel.open({ tabId: tab.id });
      break;

    case 'open-inventory':
      // Open inventory in a new tab
      await chrome.tabs.create({
        url: chrome.runtime.getURL('inventory.html'),
      });
      break;
  }
});

/**
 * Handle messages from content scripts and other components
 */
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('[Linkback] Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    });

  // Return true to indicate async response
  return true;
});

/**
 * Process incoming messages
 */
async function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender
): Promise<Response> {
  console.log('[Linkback] Message received:', message.type);

  switch (message.type) {
    case 'CREATE_LINK': {
      const payload = message.payload as CreateLinkPayload;
      const created = await createLink(payload);
      return { success: true, data: { created } };
    }

    case 'DELETE_LINK': {
      const payload = message.payload as DeleteLinkPayload;
      const deleted = await deleteLink(payload);
      return { success: true, data: { deleted } };
    }

    case 'GET_PAGE_LINKS': {
      const { url } = message.payload as { url: string };
      const normalizedUrl = normalizeUrl(url);
      const pageLinks = await getLinksForPage(normalizedUrl);
      const linkedPages = await getLinkedPages(normalizedUrl);
      return { success: true, data: { pageLinks, linkedPages } };
    }

    case 'UPDATE_TITLE': {
      const { url, title } = message.payload as { url: string; title: string };
      await updatePageTitle(url, title);
      return { success: true };
    }

    case 'REORDER_LINKS': {
      const payload = message.payload as ReorderLinksPayload;
      await reorderLinks(payload);
      return { success: true };
    }

    case 'SYNC_STATUS': {
      const pending = await getPendingSync();
      const stats = await getLinkStats();
      return {
        success: true,
        data: {
          pendingCount: pending.length,
          isOnline: navigator.onLine,
          stats,
        },
      };
    }

    case 'GET_INVENTORY_SNAPSHOT': {
      const [pages, pending, stats] = await Promise.all([
        getAllPages(),
        getPendingSync(),
        getLinkStats(),
      ]);

      return {
        success: true,
        data: {
          pages,
          stats,
          pendingCount: pending.length,
          isOnline: navigator.onLine,
        },
      };
    }

    case 'MERGE_PAGES': {
      const payload = message.payload as MergePagesPayload;
      const result = await mergePages(payload);
      return { success: true, data: result };
    }

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

/**
 * Send a message to a content script
 */
async function sendToTab(tabId: number, message: Message): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.error('[Linkback] Failed to send message to tab:', error);
  }
}

/**
 * Process pending sync operations
 * Called on startup and when coming back online
 */
async function processPendingSync(): Promise<void> {
  if (!navigator.onLine) {
    console.log('[Linkback] Offline, skipping sync');
    return;
  }

  const pending = await getPendingSync();

  if (pending.length === 0) {
    console.log('[Linkback] No pending sync operations');
    return;
  }

  console.log(`[Linkback] Processing ${pending.length} pending sync operations`);

  // TODO: Implement Supabase sync
  // For now, just log that we would sync
  for (const op of pending) {
    console.log('[Linkback] Would sync:', op.type, op.payload);
  }
}

/**
 * Listen for online/offline events
 */
self.addEventListener('online', () => {
  console.log('[Linkback] Back online, processing pending sync');
  processPendingSync();
});

self.addEventListener('offline', () => {
  console.log('[Linkback] Went offline');
});

/**
 * Handle side panel behavior
 */
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[Linkback] Failed to set panel behavior:', error));
