/**
 * Core type definitions for Linkback
 *
 * Design principles:
 * - URLs are canonical identifiers (normalized)
 * - Titles are mutable metadata
 * - All links are strictly bidirectional
 */

/**
 * Represents a page in the link graph
 */
export interface Page {
  /** Normalized canonical URL (primary key) */
  url: string;
  /** Display title (mutable) */
  title: string;
  /** ISO 8601 timestamp of first link creation */
  createdAt: string;
  /** ISO 8601 timestamp of last modification */
  updatedAt: string;
}

/**
 * Represents a bidirectional link between two pages
 * Stored as a pair: if A→B exists, B→A must also exist
 */
export interface Link {
  /** Normalized source URL */
  sourceUrl: string;
  /** Normalized target URL */
  targetUrl: string;
  /** ISO 8601 timestamp of creation */
  createdAt: string;
}

/**
 * Per-page link metadata including user-defined ordering
 */
export interface PageLinks {
  /** Normalized URL (key) */
  url: string;
  /** Current page title */
  title: string;
  /** Array of normalized linked URLs */
  linkedUrls: string[];
  /** User-defined order for sidebar display (subset of linkedUrls) */
  linkOrder: string[];
  /** ISO 8601 timestamp of last update */
  updatedAt: string;
}

/**
 * Complete link graph stored locally
 */
export interface LinkGraph {
  /** Map of normalized URL to PageLinks */
  pages: Record<string, PageLinks>;
  /** Metadata about the graph */
  meta: {
    /** Total number of unique pages */
    pageCount: number;
    /** Total number of link pairs (A→B and B→A count as 1) */
    linkCount: number;
    /** ISO 8601 timestamp of last modification */
    updatedAt: string;
  };
}

/**
 * Pending sync operation for offline support
 */
export interface PendingSync {
  /** Unique operation ID */
  id: string;
  /** Operation type */
  type: 'create-link' | 'delete-link' | 'update-title';
  /** Operation payload */
  payload: {
    sourceUrl?: string;
    targetUrl?: string;
    url?: string;
    title?: string;
  };
  /** ISO 8601 timestamp of operation */
  createdAt: string;
  /** Number of retry attempts */
  retryCount: number;
}

/**
 * Storage schema version for migrations
 */
export interface StorageMeta {
  /** Current schema version */
  version: number;
  /** ISO 8601 timestamp of last migration */
  migratedAt: string;
}

/**
 * Message types for extension communication
 */
export type MessageType =
  | 'OPEN_JUMP_PALETTE'
  | 'OPEN_LINK_MODAL'
  | 'TOGGLE_SIDEBAR'
  | 'OPEN_INVENTORY'
  | 'CREATE_LINK'
  | 'DELETE_LINK'
  | 'GET_PAGE_LINKS'
  | 'UPDATE_TITLE'
  | 'REORDER_LINKS'
  | 'SYNC_STATUS';

/**
 * Base message structure for extension communication
 */
export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
}

/**
 * Response wrapper for async operations
 */
export interface Response<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Create link request payload
 */
export interface CreateLinkPayload {
  sourceUrl: string;
  sourceTitle: string;
  targetUrl: string;
  targetTitle: string;
}

/**
 * Delete link request payload
 */
export interface DeleteLinkPayload {
  sourceUrl: string;
  targetUrl: string;
}

/**
 * Reorder links request payload
 */
export interface ReorderLinksPayload {
  url: string;
  linkOrder: string[];
}

/**
 * Storage keys used by the extension
 */
export const STORAGE_KEYS = {
  LINK_GRAPH: 'linkback_graph',
  PENDING_SYNC: 'linkback_pending_sync',
  STORAGE_META: 'linkback_meta',
  USER_SETTINGS: 'linkback_settings',
} as const;

/**
 * Current storage schema version
 */
export const CURRENT_SCHEMA_VERSION = 1;
