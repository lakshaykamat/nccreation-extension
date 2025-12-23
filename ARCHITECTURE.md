# Extension Architecture & DOM Modifications

## Overview

This Chrome extension enhances a DataTables-based article management portal by adding custom columns, row highlighting, sorting, and notifications.

---

## DOM Modifications

### 1. Table Header Modifications

**Location:** `<thead>` of `#article_data` table

| Action | Description |
|--------|-------------|
| Add "DONE BY" column | Inserts new `<th>` after "Article ID" header |
| Replace header structure | Rebuilds entire header row with sortable columns |
| Add sort icons | Adds `<span class="DataTables_sort_icon">` to each header |

**Before:**
```html
<thead>
  <tr>
    <th>Client</th>
    <th>Journal</th>
    <th>Article ID</th>
    <th>SRC</th>
    ...
  </tr>
</thead>
```

**After:**
```html
<thead>
  <tr role="row" data-extension-header="true">
    <th class="ui-state-default" role="columnheader">
      <div class="DataTables_sort_wrapper">
        Client
        <span class="DataTables_sort_icon css_right ui-icon ui-icon-carat-2-n-s"></span>
      </div>
    </th>
    ...
    <th>Article ID</th>
    <th>DONE BY</th>  <!-- NEW COLUMN -->
    <th>SRC</th>
    ...
  </tr>
</thead>
```

---

### 2. Table Body Modifications

**Location:** `<tbody>` rows of `#article_data` table

| Action | Description |
|--------|-------------|
| Add "DONE BY" cell | Adds new `<td>` with assignee name to each row |
| Row background color | Sets `background-color` based on SRC value (DOCX/TEX) |
| Row highlighting | Adds highlight class for specific assignees (e.g., "Ruchi") |
| Row reordering | Moves all TEX rows to bottom of table |

**Cell Coloring:**
```css
/* DOCX rows */
background-color: #eeeeee !important;

/* TEX rows */
background-color: #e5e5e5 !important;

/* Highlighted rows (e.g., Ruchi) */
background-color: #e3f2fd !important;
```

**Row Attributes Added:**
```html
<tr class="highlight-row-0" data-highlighted="Ruchi" style="background-color: #e3f2fd !important;">
```

---

### 3. TEX Row Ordering

**Behavior:** All rows with `SRC = "TEX"` are moved to the bottom of the table.

**Trigger Points:**
- After initial page load
- After DataTables sort/filter/pagination
- After custom column sort

**DOM Operation:**
```javascript
// Uses DocumentFragment for performance
const fragment = document.createDocumentFragment();
nonTexRows.forEach(row => fragment.appendChild(row));
texRows.forEach(row => fragment.appendChild(row));
tbody.appendChild(fragment);
```

---

### 4. UI Elements Added

**Location:** Various locations in the page

| Element | Location | Purpose |
|---------|----------|---------|
| Copy Button | Near search box | Copy article IDs to clipboard |
| Toast notifications | Fixed position overlay | Show stats, errors, reminders |
| Loading indicator | DONE BY column header | Shows "(Loading...)" during API fetch |

---

## Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        PAGE LOAD                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 1. Wait for #article_data table to appear                        │
│ 2. Set page length to 500 entries                                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. Fetch API data from webhook                                   │
│    GET https://n8n-ex6e.onrender.com/webhook/last-five-days-files│
│    Returns: [{ "Article number": "ABC123", "Done by": "John" }]  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. Add DONE BY column to table header                            │
│ 5. Add DONE BY cell to each row (populated from API data)        │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 6. Replace table header with custom sortable version             │
│ 7. Setup DataTables event hooks                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 8. Apply table order:                                            │
│    a. Move TEX rows to bottom                                    │
│    b. Apply row highlighting (by assignee)                       │
│    c. Apply cell coloring (by SRC value)                         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 9. Check for past due files                                      │
│ 10. Display today's stats                                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── utils/
│   └── utils.js              # Pure utility functions (DOM, dates, arrays)
│
├── services/
│   ├── apiService.js         # API calls to webhook
│   └── notificationService.js # Chrome notifications
│
├── lib/
│   ├── headerBuilder.js      # Table header creation
│   └── sortManager.js        # Column sorting logic
│
├── managers/
│   ├── tableManager.js       # Main table manipulation
│   ├── filterManager.js      # Row filtering (TEX visibility)
│   ├── copyManager.js        # Copy article IDs feature
│   ├── statsManager.js       # Today's stats calculation
│   ├── pastDueManager.js     # Past due file detection
│   └── toastManager.js       # Toast notification display
│
└── ui/
    ├── content.js            # Main orchestrator (content script)
    └── popup.js              # Extension popup UI
```

---

## Module Dependencies

```
                    ┌─────────────────┐
                    │    utils.js     │
                    │  (Pure helpers) │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  apiService.js  │ │ sortManager.js  │ │ headerBuilder.js│
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ tableManager.js │
                    │ (Main business) │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ filterManager.js│ │ statsManager.js │ │ pastDueManager  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   content.js    │
                    │ (Orchestrator)  │
                    └─────────────────┘
```

---

## DataTables Integration

### Events Hooked

| Event | Handler | Purpose |
|-------|---------|---------|
| `draw.texsort` | `applyTableOrder()` | Re-order TEX rows after any table redraw |

### Sorting

- Default sort: DONE BY column, ascending
- TEX rows always stay at bottom regardless of sort
- Custom sort manager handles column clicks

---

## Key Functions

### `applyTableOrder()`
Main function that enforces table state:
1. Moves TEX rows to bottom
2. Applies row highlighting
3. Applies cell coloring

### `moveTexRowsToBottom()`
- Splits rows into TEX and non-TEX arrays
- Uses `isReordering` flag to prevent recursive calls
- Uses `DocumentFragment` for performance

### `highlightRows()`
- Checks DONE BY column value
- Applies background color based on `HIGHLIGHT_RULES`
- Calls `colorSrcCells()` afterward

### `colorSrcCells()`
- Checks SRC column value (DOCX/TEX)
- Colors all cells in the row accordingly

---

## Configuration

### Highlight Rules (tableManager.js)
```javascript
const HIGHLIGHT_RULES = {
  'Ruchi': '#e3f2fd',  // Light blue
  // Add more: 'Name': '#hexcolor'
};
```

### SRC Cell Colors (tableManager.js)
```javascript
const SRC_CELL_COLORS = {
  'DOCX': '#eeeeee',
  'TEX': '#e5e5e5',
};
```

### Header Configuration (headerBuilder.js)
```javascript
const HEADER_CONFIG = [
  { text: 'Client', widthPercent: '6%', widthPx: 61 },
  { text: 'DONE BY', widthPercent: null, widthPx: 100 },
  // ... more columns
];
```

