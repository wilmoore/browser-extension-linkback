# PRD: Bidirectional Backlinks for the Browser (Keyboard-First)

## 1. Product Thesis

Knowledge work spans many browser surfaces: inboxes, AI chats, documents, research tabs. Browsers treat pages as isolated resources, but humans think in relationships.

This product is a browser extension that allows users to create, navigate, and maintain **bidirectional links between any URLs**, forming a persistent personal relationship graph. It prioritizes speed, keyboard fluency, and minimal ceremony while supporting multiple cognitive styles for navigation.

Core invariant: if page A links to page B, page B must link to page A, automatically and atomically.

---

## 2. Core Design Principles

* Keyboard-first, mouse-optional
* Vim-native navigation
* Zero ceremony, minimal surfaces
* Relationships over hierarchy
* Fast by default, local-first UX
* Privacy-respecting, minimal permissions
* One graph, multiple views

---

## 3. Personas

### P-001 Knowledge Worker

* Heavy browser user across inboxes, AI tools, docs
* Values speed and flow
* Uses keyboard shortcuts extensively

### P-002 Researcher / Writer

* Manages many interrelated sources
* Needs fast recall and spatial context
* Dislikes manual cross-referencing

### P-003 Sales / Ops Professional

* Works across LinkedIn, CRM, proposals
* Needs context preservation
* Often mouse-driven, but keyboard-aware

---

## 4. Input Scenarios

* User wants to link the current page to another page they just copied or visited.
* User wants to quickly jump to a related page while staying in flow.
* User wants to visually sanity-check related pages.
* User wants to audit, rename, merge, or clean stored links.
* User is offline but still wants linking and navigation to work.

---

## 5. User Journeys

* J-001 Link current page to another page
* J-002 Jump to a related page via command palette
* J-003 Navigate related pages via sidebar
* J-004 Review and clean the global link graph
* J-005 Work offline and sync later

---

## 6. UX Surface Inventory

| Screen | Name             | Purpose                       |
| ------ | ---------------- | ----------------------------- |
| S-001  | Jump Palette     | Fast, typed navigation        |
| S-002  | Link Modal       | Create bidirectional links    |
| S-003  | Context Sidebar  | Persistent related links view |
| S-004  | Global Inventory | Graph audit and cleanup       |
| S-005  | Options          | Shortcut configuration        |

---

## 7. Behavior and Editing Model

* All links are strictly bidirectional.
* Creating or deleting a link updates both directions atomically.
* No one-way links are supported.
* URL normalization runs on write.
* Titles are mutable metadata; URLs are canonical identifiers.
* Local cache drives UI responsiveness.
* Cloud storage is the sync source of truth.

---

## 8. Constraints and Anti-Features

### Constraints

* Browser extension, web-first
* Cloud sync via Supabase
* Local cache via extension storage or IndexedDB
* Keyboard-first interaction required

### Anti-Features

* No folders
* No tags
* No primary dashboards
* No graph visualization in MVP
* No native apps
* No third-party analytics scripts

---

## 9. Success and Failure Criteria

### Success

* Link creation in under 3 seconds.
* Jump Palette opens in under 1 second.
* Sidebar provides immediate visual context.
* User reports reduced screenshotting or manual note shuttling.

### Failure

* UI blocks on network latency.
* Frequent shortcut conflicts with no escape hatch.
* Duplicate URLs proliferate without remediation.

---

## 10. North Star Metric

Weekly active users who create at least one link and perform at least one jump.

---

## 11. Epics

* E-001 [MUST] Link Creation and Bidirectional Integrity
* E-002 [MUST] Jump Palette Navigation
* E-003 [MUST] Context Sidebar Navigation and Reordering
* E-004 [MUST] Local Cache and Offline Support
* E-005 [SHOULD] Global Inventory and Cleanup Tools
* E-006 [WONT] Visual Graph Rendering

---

## 12. User Stories with Acceptance Criteria

### E-001 Link Creation and Bidirectional Integrity

* US-001 [MUST] As a user, I can link the current page to another page via a keyboard shortcut.
  Given I am on a page
  When I press Cmd/Ctrl + Shift + L
  Then a modal opens allowing me to confirm the target URL and title

* US-002 [MUST] As a user, saving a link creates two symmetric relationships.
  Given page A and page B
  When I save a link
  Then both A → B and B → A exist

* US-003 [MUST] As a user, duplicate links are automatically de-duped.
  Given a relationship already exists
  When I attempt to recreate it
  Then no duplicate is stored

---

### E-002 Jump Palette Navigation

* US-004 [MUST] As a user, I can open a jump palette to navigate links.
  Given I am on a page
  When I press Cmd/Ctrl + Shift + K
  Then the Jump Palette opens instantly

* US-005 [MUST] As a user, I can navigate the palette using Vim keys.
  Given the palette is open
  When I press j or k
  Then selection moves accordingly

* US-006 [MUST] As a user, I can use modifier Vim navigation.
  Given the palette is open
  When I press Cmd/Ctrl + j k h l
  Then selection moves down, up, first, or last respectively

---

### E-003 Context Sidebar Navigation and Reordering

* US-007 [MUST] As a user, I can open a persistent sidebar of related links.
  Given I am on a page
  When I press Cmd/Ctrl + Shift + \
  Then a right-side sidebar opens showing related links

* US-008 [MUST] As a user, I can reorder related links using the keyboard.
  Given the sidebar is open
  When I enter reorder mode and move items
  Then the new order is persisted per page

---

### E-004 Local Cache and Offline Support

* US-009 [MUST] As a user, I can jump and link while offline.
  Given I am offline
  When I open the palette or sidebar
  Then cached data is available

* US-010 [MUST] As a user, offline changes sync on reconnect.
  Given pending local changes
  When connectivity is restored
  Then changes are synced to the cloud

---

### E-005 Global Inventory and Cleanup Tools

* US-011 [SHOULD] As a user, I can browse all stored pages.
* US-012 [SHOULD] As a user, I can remove relationships symmetrically.
* US-013 [SHOULD] As a user, I can rename page titles.
* US-014 [SHOULD] As a user, I can merge normalized duplicates.

---

## 13. Traceability Map

| Story  | Epic  | Journey | Screen | Priority |
| ------ | ----- | ------- | ------ | -------- |
| US-001 | E-001 | J-001   | S-002  | MUST     |
| US-004 | E-002 | J-002   | S-001  | MUST     |
| US-007 | E-003 | J-003   | S-003  | MUST     |
| US-009 | E-004 | J-005   | S-001  | MUST     |
| US-011 | E-005 | J-004   | S-004  | SHOULD   |

---

## 14. Lo-fi UI Mockups (ASCII)

### S-001 Jump Palette

```
+----------------------------------+
| > jump to...                      |
|----------------------------------|
|  ChatGPT convo: Outreach Draft   |
|  LinkedIn thread: Bob Smith       |
|  Proposal v2 – Google Docs        |
|                                  |
| j/k move  Cmd+j/k/h/l  Enter open |
+----------------------------------+
```

---

### S-003 Context Sidebar

```
+--------------------------------------------------+
| Context Links                                    |
|--------------------------------------------------|
| / filter...                                      |
|--------------------------------------------------|
| > [ChatGPT convo: Outreach Draft]                |
|--------------------------------------------------|
|   [LinkedIn thread: Bob Smith]                   |
|--------------------------------------------------|
|   [Proposal v2 – Google Docs]                    |
|--------------------------------------------------|
| j/k move  Enter open  r reorder                  |
+--------------------------------------------------+
```

---

## 15. Decision Log

| ID    | Question                          | Winner               | Confidence |
| ----- | --------------------------------- | -------------------- | ---------- |
| D-001 | Bidirectional only vs one-way     | Bidirectional only   | 0.95       |
| D-002 | Jump Palette + Sidebar vs one     | Both                 | 0.92       |
| D-003 | Keyboard-first with mouse support | Yes                  | 0.90       |
| D-004 | Vim-native navigation             | Yes                  | 0.94       |
| D-005 | Configurable shortcuts            | Required             | 0.98       |
| D-006 | Jump Palette shortcut             | Cmd/Ctrl + Shift + K | 0.94       |
| D-007 | Sidebar shortcut                  | Cmd/Ctrl + Shift + \ | 0.96       |
| D-008 | Inventory shortcut                | Cmd/Ctrl + Shift + Y | 0.91       |

---

## 16. Assumptions

* MVP timebox: 2 to 4 weeks
* Platform: browser extension only
* Budget posture: lean
* Compliance: minimal for MVP
* Data: user-generated URLs only
* No native apps or enterprise features in MVP

---

> **This PRD is complete.**
> Copy this Markdown into Word, Google Docs, Notion, or directly into a coding model.
