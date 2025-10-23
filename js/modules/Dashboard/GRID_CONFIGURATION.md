# Grid Configuration System

**Version:** 1.0
**Last Updated:** 2025-01-23

## Overview

The Dashboard grid configuration system provides a flexible way to define multi-page layouts with custom grid sizes, widget positioning, and dynamic CSS grid templates. This system supports multiple pages with different grid configurations, widget spanning, and intelligent auto-layout.

---

## Architecture

### Key Files

| File | Purpose |
|------|---------|
| `config/page-config.js` | Page definitions with widget layouts |
| `ui/dom-builder.js` | Creates DOM elements with inline grid positioning |
| `ui/ui-renderer.js` | Applies CSS grid templates from page config |
| `navigation/page-manager.js` | Handles page switching |

### Data Flow

```
page-config.js
    ↓ (defines pages and layouts)
ui-renderer.js
    ↓ (creates DOM structure)
dom-builder.js
    ↓ (applies inline grid positioning)
Browser
    ↓ (renders with CSS grid)
Final Layout
```

---

## Page Configuration Format

### Basic Structure

Each page in `pageConfigs` follows this format:

```javascript
{
  id: 'page1',              // Unique page identifier
  label: 'Page 1',          // Display name
  gridRows: 3,              // Number of rows
  gridCols: 2,              // Number of columns
  layout: {                 // Optional: Custom grid template
    columns: '70% 30%',     // CSS grid-template-columns
    rows: '10% 45% 45%'     // CSS grid-template-rows
  },
  widgets: [...],           // Widget configurations
  showPageNav: true,        // Show page navigation controls
  devOnly: false            // Only show in developer mode
}
```

### Widget Configuration

Each widget in the `widgets` array:

```javascript
{
  id: 'main',               // Unique widget ID (becomes iframe id: 'widget-main')
  row: 2,                   // Starting row (1-indexed)
  col: 1,                   // Starting column (1-indexed)
  rowSpan: 2,               // Number of rows to span (default: 1)
  colSpan: 1,               // Number of columns to span (default: 1)
  label: 'Calendar',        // Display label
  path: 'js/widgets/calendar/calendar.html',  // Widget HTML path
  noCenter: false,          // Disable centering when focused
  focusScale: 1.05,         // Scale factor when focused
  selectable: true          // Can be selected via D-pad navigation
}
```

---

## Grid Layout Mechanism

### 1. CSS Grid Template (Optional Custom Layout)

When a page defines a `layout` object, the system applies custom CSS grid templates:

**Example: Page 1 (70/30 Split)**

```javascript
layout: {
  columns: '70% 30%',      // Calendar column takes 70%, right column 30%
  rows: '10% 45% 45%'      // Header smaller (10%), calendar/agenda larger (45% each)
}
```

**Applied CSS:**
```css
.dashboard-grid {
  grid-template-columns: 70% 30%;
  grid-template-rows: 10% 45% 45%;
}
```

### 2. Auto-Generated Layout (Fallback)

If no `layout` is specified, the system uses equal distribution:

**Default for 3x2 grid:**
```css
.dashboard-grid {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(3, 1fr);
}
```

### 3. Inline Grid Positioning

Each widget cell receives inline styles for positioning:

**Example: Calendar widget spanning rows 2-3:**
```javascript
{
  id: 'main',
  row: 2,
  col: 1,
  rowSpan: 2,  // Spans 2 rows
  colSpan: 1
}
```

**Generated inline styles:**
```html
<div class="dashboard-grid__cell" style="grid-column: 1 / span 1; grid-row: 2 / span 2;">
  <iframe id="widget-main" src="js/widgets/calendar/calendar.html"></iframe>
</div>
```

**CSS Grid Placement:**
- `grid-column: 1 / span 1` → Column 1, span 1 column
- `grid-row: 2 / span 2` → Row 2, span 2 rows

---

## Working Example: Page 1 (3x2 Grid)

### Configuration

```javascript
'page1': {
  id: 'page1',
  label: 'Page 1',
  gridRows: 3,
  gridCols: 2,
  layout: {
    columns: '70% 30%',
    rows: '10% 45% 45%'
  },
  widgets: [
    {
      id: 'header',
      row: 1, col: 1,
      rowSpan: 1, colSpan: 1,
      label: 'Header',
      path: 'js/widgets/header/header.html'
    },
    {
      id: 'clock',
      row: 1, col: 2,
      rowSpan: 1, colSpan: 1,
      label: 'Clock',
      path: 'js/widgets/clock/clock.html'
    },
    {
      id: 'main',
      row: 2, col: 1,
      rowSpan: 2, colSpan: 1,  // SPANS 2 ROWS
      label: 'Calendar',
      path: 'js/widgets/calendar/calendar.html'
    },
    {
      id: 'agenda',
      row: 2, col: 2,
      rowSpan: 1, colSpan: 1,
      label: 'Agenda',
      path: 'js/widgets/agenda/agenda.html'
    },
    {
      id: 'photos',
      row: 3, col: 2,
      rowSpan: 1, colSpan: 1,
      label: 'Photos',
      path: 'js/widgets/photos/photos.html'
    }
  ]
}
```

### Visual Layout

```
┌──────────────────────────────────┬──────────────┐
│ Header (70%)                     │ Clock (30%)  │  Row 1 (10%)
├──────────────────────────────────┼──────────────┤
│                                  │              │
│  Calendar (70%)                  │ Agenda (30%) │  Row 2 (45%)
│  [Spans rows 2-3]                │              │
│                                  ├──────────────┤
│                                  │              │
│                                  │ Photos (30%) │  Row 3 (45%)
└──────────────────────────────────┴──────────────┘
    Column 1 (70%)                   Column 2 (30%)
```

### Generated DOM

```html
<div class="dashboard-grid" style="grid-template-columns: 70% 30%; grid-template-rows: 10% 45% 45%;">

  <!-- Row 1, Col 1 -->
  <div class="dashboard-grid__cell" style="grid-column: 1 / span 1; grid-row: 1 / span 1;">
    <iframe id="widget-header" src="js/widgets/header/header.html"></iframe>
  </div>

  <!-- Row 1, Col 2 -->
  <div class="dashboard-grid__cell" style="grid-column: 2 / span 1; grid-row: 1 / span 1;">
    <iframe id="widget-clock" src="js/widgets/clock/clock.html"></iframe>
  </div>

  <!-- Row 2, Col 1 (spans 2 rows) -->
  <div class="dashboard-grid__cell" style="grid-column: 1 / span 1; grid-row: 2 / span 2;">
    <iframe id="widget-main" src="js/widgets/calendar/calendar.html"></iframe>
  </div>

  <!-- Row 2, Col 2 -->
  <div class="dashboard-grid__cell" style="grid-column: 2 / span 1; grid-row: 2 / span 1;">
    <iframe id="widget-agenda" src="js/widgets/agenda/agenda.html"></iframe>
  </div>

  <!-- Row 3, Col 2 -->
  <div class="dashboard-grid__cell" style="grid-column: 2 / span 1; grid-row: 3 / span 1;">
    <iframe id="widget-photos" src="js/widgets/photos/photos.html"></iframe>
  </div>

</div>
```

---

## Multi-Page Navigation

### Page Order

Pages are navigated sequentially based on `pageOrder` array:

```javascript
export const pageOrder = ['page1', 'page2'];
```

### Navigation Helpers

```javascript
// Get next page
const nextPage = getNextPage('page1');  // Returns: 'page2'

// Get previous page
const prevPage = getPreviousPage('page2');  // Returns: 'page1'

// Get page number (1-indexed)
const pageNum = getPageNumber('page1');  // Returns: 1
```

### Page Switching

When switching pages via `PageManager.switchPage(pageId)`:

1. Clear existing grid content
2. Load new page config
3. Apply new grid template (if custom layout defined)
4. Create new widget iframes with inline positioning
5. Register widgets with `WidgetDataManager`
6. Load widget data
7. Update page navigation visibility

---

## Advanced Configurations

### Full-Page Widget (1x1 Grid)

**Use case:** Single widget fills entire grid

```javascript
'page2': {
  id: 'page2',
  label: 'Voice Assistant',
  gridRows: 1,
  gridCols: 1,
  widgets: [
    {
      id: 'voice',
      row: 1, col: 1,
      rowSpan: 1, colSpan: 1,
      label: 'Voice Assistant',
      path: 'js/widgets/voice/voice-widget.html'
    }
  ]
}
```

**Result:** Widget takes 100% of grid area

### Complex Multi-Column Layout (4x3 Grid)

**Use case:** Many small widgets

```javascript
'page3': {
  id: 'page3',
  label: 'Dashboard',
  gridRows: 4,
  gridCols: 3,
  layout: {
    columns: '1fr 1fr 1fr',     // Equal columns
    rows: '1fr 1fr 1fr 1fr'     // Equal rows
  },
  widgets: [
    { id: 'widget1', row: 1, col: 1 },
    { id: 'widget2', row: 1, col: 2 },
    { id: 'widget3', row: 1, col: 3 },
    { id: 'widget4', row: 2, col: 1, colSpan: 2 },  // Spans 2 columns
    { id: 'widget5', row: 2, col: 3 },
    // ... etc
  ]
}
```

### Custom Proportions (2x2 with Asymmetry)

```javascript
'page4': {
  id: 'page4',
  label: 'Media',
  gridRows: 2,
  gridCols: 2,
  layout: {
    columns: '2fr 1fr',   // Left column 2x wider than right
    rows: '60% 40%'       // Top row larger than bottom
  },
  widgets: [
    { id: 'video', row: 1, col: 1, rowSpan: 2 },  // Spans both rows
    { id: 'controls', row: 1, col: 2 },
    { id: 'playlist', row: 2, col: 2 }
  ]
}
```

---

## CSS Grid Properties Reference

### grid-template-columns

Defines column sizes. Options:

```css
/* Fixed widths */
grid-template-columns: 200px 300px;

/* Percentages */
grid-template-columns: 70% 30%;

/* Fractional units (relative) */
grid-template-columns: 2fr 1fr;

/* Repeat notation */
grid-template-columns: repeat(3, 1fr);

/* Mixed */
grid-template-columns: 100px 1fr 2fr;
```

### grid-template-rows

Defines row sizes. Same syntax as columns.

### grid-column / grid-row (Inline Positioning)

Applied to individual cells:

```css
/* Start at column 1, span 2 columns */
grid-column: 1 / span 2;

/* Start at row 2, span 3 rows */
grid-row: 2 / span 3;

/* Alternative: Explicit end position */
grid-column: 1 / 3;  /* Columns 1-2 */
grid-row: 2 / 5;     /* Rows 2-4 */
```

---

## Implementation Details

### ui-renderer.js: applyGridTemplate()

```javascript
static applyGridTemplate(gridElement) {
  const currentPage = getCurrentPage();
  const pageConfig = getPageConfig(currentPage);

  if (!pageConfig) {
    logger.warn('No page config found', { currentPage });
    return;
  }

  // Apply custom layout if defined
  if (pageConfig.layout) {
    if (pageConfig.layout.columns) {
      gridElement.style.gridTemplateColumns = pageConfig.layout.columns;
    }
    if (pageConfig.layout.rows) {
      gridElement.style.gridTemplateRows = pageConfig.layout.rows;
    }
    logger.debug('Applied custom grid template', {
      page: currentPage,
      columns: pageConfig.layout.columns,
      rows: pageConfig.layout.rows
    });
  } else {
    // Clear inline styles to use CSS defaults
    gridElement.style.gridTemplateColumns = '';
    gridElement.style.gridTemplateRows = '';
    logger.debug('Using default grid template', { page: currentPage });
  }
}
```

### dom-builder.js: createGridCell()

```javascript
static createGridCell(widget) {
  const cell = document.createElement('div');
  cell.className = 'dashboard-grid__cell';
  cell.dataset.widgetId = widget.id;

  // Apply grid positioning via inline styles
  const col = widget.col || 1;
  const row = widget.row || 1;
  const colSpan = widget.colSpan || 1;
  const rowSpan = widget.rowSpan || 1;

  cell.style.gridColumn = `${col} / span ${colSpan}`;
  cell.style.gridRow = `${row} / span ${rowSpan}`;

  // Create iframe if path provided
  if (widget.path) {
    const iframe = this.createWidgetIframe(widget);
    cell.appendChild(iframe);
  }

  return cell;
}
```

---

## Best Practices

### 1. Use Semantic Widget IDs

```javascript
// Good
id: 'main-calendar'
id: 'sidebar-weather'
id: 'header-clock'

// Avoid
id: 'widget1'
id: 'thing'
```

### 2. Document Custom Layouts

Add comments explaining why custom layouts are used:

```javascript
layout: {
  columns: '70% 30%',  // Calendar needs more space for month view
  rows: '10% 45% 45%'  // Header compact, content areas equal
}
```

### 3. Test Widget Spanning

When using `rowSpan` or `colSpan`, verify:
- Widget doesn't overlap other widgets
- Navigation skips correctly (see span detection in `navigation-manager.js`)
- Focus/scale animations don't cause overflow

### 4. Maintain Consistent Grid Sizes

For easier navigation logic, consider using consistent row/column counts across pages where possible.

---

## Troubleshooting

### Widgets Overlapping

**Problem:** Two widgets occupy the same grid cells

**Solution:** Check that `row`, `col`, `rowSpan`, and `colSpan` don't create conflicts.

**Example conflict:**
```javascript
{ id: 'widget1', row: 1, col: 1, rowSpan: 2 },  // Occupies rows 1-2
{ id: 'widget2', row: 2, col: 1, rowSpan: 1 }   // CONFLICT: Also at row 2, col 1
```

### Custom Layout Not Applying

**Problem:** Grid uses default layout instead of custom

**Solution:** Verify:
1. `layout` object exists in page config
2. `columns` and `rows` use valid CSS grid syntax
3. Check browser console for warnings

### Widget Not Loading After Page Switch

**Problem:** Widget iframe shows blank/error

**Solution:**
1. Verify widget `path` is correct relative to project root
2. Check widget registers with `WidgetDataManager`
3. Ensure widget sends `widget-ready` message

---

## Related Documentation

- **Widget Development:** `js/widgets/WIDGETS_README.md`
- **Page Navigation:** `js/modules/Dashboard/navigation/README.md` (if exists)
- **Widget Communication:** `js/core/widget-messenger.js`
- **Architecture:** `.reference/ARCHITECTURE.md`

---

## Future Enhancements

Potential improvements to the grid system:

1. **Responsive Layouts:** Different grid configs for mobile/tablet/desktop
2. **Grid Gaps:** Configurable spacing between widgets
3. **Min/Max Constraints:** Grid tracks with min/max sizes
4. **Named Grid Areas:** Use CSS grid-template-areas for semantic layouts
5. **Dynamic Widget Loading:** Load widgets on-demand vs. upfront
6. **Grid Presets:** Common layout templates (dashboard, media, etc.)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-23 | Initial documentation |
