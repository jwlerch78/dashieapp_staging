# Dashie Feature Roadmap

**Last Updated:** 2025-10-16
**Status:** Active Development

---

## Overview

This document tracks planned features and enhancements for the Dashie application. Features are organized by priority and estimated implementation effort.

---

## 🚀 High Priority Features

### 1. Multi-Page Dashboard Scrolling

**Status:** Planned
**Estimated Effort:** 4-6 days
**Target Release:** Post Phase 2 completion

#### Description

Enable vertical scrolling in the Dashboard to support multiple "pages" of widget grids stacked vertically. Users can navigate down from the bottom row to reveal additional widget pages below, and up from the top row to return to previous pages.

#### Use Cases

- **Organize widgets by category** - Main page for essential widgets, second page for secondary widgets
- **Support more than 5 widgets** - Currently limited to 2×3 grid (6 widgets max), multi-page allows 30+ widgets
- **Contextual dashboards** - Different pages for morning/evening, weekday/weekend, etc.
- **Development tools** - Test interfaces or debug widgets on separate pages

#### Architecture Approach

**Option Selected:** Page-Based System (discrete pages with transitions)

**Key Design Decisions:**

1. **Maximum Pages:** 5 pages (configurable via `config.js` - `MAX_DASHBOARD_PAGES`)
2. **Page Structure:** Each page is a self-contained 3×2 grid layout
3. **State Management:** Single `currentPage` variable in state-manager
4. **Lazy Loading:** Page 1 loads immediately, pages 2+ lazy-load on first navigation
5. **Transition Style:** Vertical slide animation (0.5s cubic-bezier easing)
6. **Widget Lifecycle:** Widgets unload when 2+ pages away to conserve memory

#### Technical Implementation

**Files Requiring Changes:**
- `js/modules/Dashboard/dashboard-widget-config.js` - Add page structure
- `js/modules/Dashboard/dashboard-state-manager.js` - Add `currentPage` state
- `js/modules/Dashboard/dashboard-navigation-manager.js` - Page transition logic
- `js/modules/Dashboard/dashboard-visual-effects.js` - Page animations
- `js/modules/Dashboard/dashboard-dom-builder.js` - Multi-page grid structure
- `css/modules/dashboard.css` - Page transition styles
- `config.js` - Add `MAX_DASHBOARD_PAGES` constant

**State Changes:**
```javascript
// dashboard-state-manager.js
static state = {
  currentPage: 1,                    // NEW: Current page number (1-5)
  gridPosition: { row: 1, col: 1 },  // Position within current page
  focusedWidget: null,
  menuOpen: false,
  selectedMenuItem: 0,
  isActive: false,
  isIdle: true
};
```

**Widget Configuration:**
```javascript
// dashboard-widget-config.js
export const widgetPages = [
  {
    page: 1,
    name: 'Main Dashboard',
    widgets: [
      { id: 'header', row: 1, col: 1, ... },
      { id: 'clock', row: 1, col: 2, ... },
      { id: 'main', row: 2, col: 1, rowSpan: 2, ... },
      { id: 'agenda', row: 2, col: 2, ... },
      { id: 'photos', row: 3, col: 2, ... }
    ]
  },
  {
    page: 2,
    name: 'Secondary Dashboard',
    widgets: [
      { id: 'weather', row: 1, col: 1, ... },
      { id: 'location', row: 1, col: 2, ... },
      { id: 'map', row: 2, col: 1, rowSpan: 2, ... },
      { id: 'camera', row: 2, col: 2, ... },
      { id: 'custom', row: 3, col: 2, ... }
    ]
  }
  // ... up to 5 pages
];
```

**Navigation Logic:**
```javascript
// dashboard-navigation-manager.js

// When user presses DOWN at bottom of page → go to next page (top row)
// When user presses UP at top of page → go to previous page (bottom row)

static handleDown() {
  const state = DashboardStateManager.getState();
  const widget = getWidgetAtPosition(state.gridPosition.row, state.gridPosition.col);
  const isAtBottomRow = (state.gridPosition.row + (widget.rowSpan || 1) - 1) === 3;

  if (isAtBottomRow) {
    const nextPage = state.currentPage + 1;
    const maxPages = widgetPages.length;

    if (nextPage <= maxPages && nextPage <= MAX_DASHBOARD_PAGES) {
      // Navigate to next page
      DashboardStateManager.setState({
        currentPage: nextPage,
        gridPosition: { row: 1, col: state.gridPosition.col }
      });
      this.transitionToPage(nextPage, 'down');
      return true;
    }
  }

  // Normal within-page navigation
  // ...
}
```

**Visual Implementation:**
```css
/* css/modules/dashboard.css */

.dashboard-grid-container {
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.dashboard-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  transform: translateY(calc((1 - var(--current-page, 1)) * 100vh));
  transition: transform 0.5s cubic-bezier(0.4, 0.0, 0.2, 1);
}

.dashboard-grid__page {
  height: 100vh;
  display: grid;
  grid-template-columns: 70% 30%;
  grid-template-rows: 10% 45% 45%;
  gap: 16px;
  padding: 16px;
}

/* Page indicators */
.dashboard-page-indicators {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 15;
}

.dashboard-page-indicator {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  margin: 8px 0;
  transition: background 0.3s ease, transform 0.3s ease;
}

.dashboard-page-indicator--active {
  background: var(--color-accent, #667eea);
  transform: scale(1.3);
}
```

#### Key Considerations & Decisions

**1. Widget Lifecycle:**
- **Decision:** Load page 1 immediately, lazy-load pages 2+ on first navigation
- **Memory Management:** Unload widgets when 2+ pages away
- **Rationale:** Balances performance (fast initial load) with memory efficiency

**2. Focus Behavior:**
- **Decision:** Auto-defocus widget when navigating to different page
- **Rationale:** Prevents confusion (focused widget no longer visible)

**3. Sidebar Menu:**
- **Decision:** Sidebar stays visible during page transitions, menu actions work across all pages
- **Rationale:** Consistent navigation, menu is global to all pages

**4. Timer System:**
- **Decision:** 20s selection timeout applies globally across all pages
- **Rationale:** User activity should reset timer regardless of page

**5. Page Persistence:**
- **Decision:** Remember last viewed page in localStorage
- **On return:** Restore to last page, or page 1 if invalid
- **Rationale:** Better UX - users don't always want to start on page 1

**6. Transition Animation:**
- **Decision:** Vertical slide with 0.5s cubic-bezier easing
- **During transition:** Disable input to prevent race conditions
- **Rationale:** Smooth UX, prevents navigation bugs

**7. Page Indicators:**
- **Decision:** Show small dots on right side (similar to mobile app onboarding)
- **Display:** Only show if more than 1 page configured
- **Rationale:** Visual feedback without cluttering interface

**8. Configuration:**
- **Decision:** Pages configured in `dashboard-widget-config.js` (not Settings UI initially)
- **Future:** Add Settings page to reorder/enable/disable pages
- **Rationale:** Start simple, add UI later if needed

#### Implementation Phases

**Phase 1: Core Multi-Page Support (2-3 days)**
- [ ] Update `config.js` with `MAX_DASHBOARD_PAGES = 5`
- [ ] Refactor `dashboard-widget-config.js` to page-based structure
- [ ] Add `currentPage` to `dashboard-state-manager.js`
- [ ] Update `dashboard-navigation-manager.js` with page transition logic
- [ ] Add page transition animation to `dashboard-visual-effects.js`
- [ ] Update `dashboard-dom-builder.js` to create multi-page grid structure
- [ ] Add CSS for page transitions
- [ ] Test: Navigate between pages with d-pad UP/DOWN

**Phase 2: Visual Polish (1-2 days)**
- [ ] Add page indicator UI (dots on right side)
- [ ] Smooth transition animations (prevent jank)
- [ ] Disable input during transitions
- [ ] Add page transition sound effects (optional)
- [ ] Test: Transitions smooth on Fire TV hardware

**Phase 3: Advanced Features (1-2 days, optional)**
- [ ] Lazy loading for pages 2+
- [ ] Widget unloading for off-screen pages
- [ ] Page persistence (localStorage)
- [ ] Settings UI to configure pages (enable/disable, reorder)
- [ ] Test: Memory usage with 5 pages of widgets

#### Testing Checklist

- [ ] Navigate down from bottom row → goes to page 2 top row
- [ ] Navigate up from top row → goes to page 1 bottom row
- [ ] Can't navigate past page 5 (or `MAX_DASHBOARD_PAGES`)
- [ ] Focused widget defocuses when changing pages
- [ ] Sidebar remains visible during transitions
- [ ] Timers work correctly across pages
- [ ] Page persistence works (return to last page)
- [ ] Page indicators show correct active page
- [ ] Smooth transitions on Fire TV hardware (no jank)
- [ ] Memory usage acceptable with 5 pages

#### Future Enhancements

- **Dynamic page count** - Auto-add pages as needed based on widget count
- **Page templates** - Pre-configured page layouts (Photo Focus, Calendar Focus, etc.)
- **Page scheduling** - Automatically switch pages based on time of day
- **Swipe gestures** - Horizontal swipe to change pages (mobile/tablet)
- **Page names** - Display page name during transition
- **Quick jump** - Hold ENTER on page indicator to jump to specific page

---

## 🎯 Medium Priority Features

### 2. Test UI Removal

**Status:** Planned
**Estimated Effort:** 1 day
**Target Release:** Phase 2 cleanup

#### Description

Remove the test UI interface that was used during Dashboard module development. The Dashboard module is now stable and the test UI is no longer needed.

#### Implementation

- [ ] Remove test UI widget from Dashboard
- [ ] Remove test UI HTML/CSS/JS files
- [ ] Remove test UI references from configuration
- [ ] Clean up any test-related debug code
- [ ] Update documentation to remove test UI mentions

**Note:** Consider archiving test UI code rather than deleting (may be useful for future debugging).

---

### 3. Widget Focus Menu Improvements

**Status:** Planned
**Estimated Effort:** 2-3 days

#### Description

Enhance the focus menu system with:
- **Customizable menu items per widget** - Widgets can define their own menu actions
- **Menu icons** - Visual icons for menu items
- **Menu animations** - Smooth slide-in/fade-in for menu
- **Menu persistence** - Remember last selected menu item per widget


---

### 5. Enhanced Idle State Animations

**Status:** Planned
**Estimated Effort:** 1-2 days

#### Description

Add subtle animations during idle state:
- **Widget breathing effect** - Very subtle scale pulse (1.0 → 1.01 → 1.0)
- **Ambient lighting** - Gentle color shifts on borders
- **Clock animation** - Smooth second hand movement
- **Photo transitions** - Ken Burns effect on photos during idle

**Constraint:** Must be performant on Fire TV (minimal GPU usage)

---

## 🔮 Low Priority / Future Features


### 7. Voice Control Integration

Control Dashboard with voice commands:
- "Show calendar"
- "Navigate to settings"
- "Focus on photos"
- Integration with Alexa (Fire TV native)

---

### 8. Gesture Control (Mobile/Tablet)

Advanced touch gestures:
- **Pinch to zoom** - Zoom focused widget
- **Two-finger swipe** - Quick page navigation
- **Long press** - Show context menu
- **Shake** - Reset to home page

---

## 📊 Feature Request Process

### How to Add Features

1. Create an issue in GitHub with `[FEATURE REQUEST]` tag
2. Describe the feature, use cases, and expected behavior
3. Team reviews and assigns priority (High/Medium/Low)
4. Feature added to this roadmap with status "Under Review"
5. If approved, status changes to "Planned" with estimated effort

### Feature Status Legend

- **Under Review** - Proposed, awaiting team decision
- **Planned** - Approved, not yet started
- **In Progress** - Active development
- **On Hold** - Development paused (technical/resource constraints)
- **Completed** - Implemented and released
- **Rejected** - Not aligned with product vision

---

## 🗓️ Release Timeline

### Q4 2025

- **October:** Complete Phase 2 Dashboard module ✅
- **November:** Multi-Page Dashboard Scrolling, Test UI removal
- **December:** Widget Focus Menu improvements, Idle animations

### Q1 2026

- **January-March:** Dashboard Themes, Settings enhancements
- **TBD:** Widget Marketplace (requires backend infrastructure planning)

---

## 📝 Notes

- **Priorities may change** based on user feedback and technical constraints
- **Effort estimates** are approximate and subject to change
- **Fire TV compatibility** is a hard requirement for all features
- **Performance** must not degrade on low-end devices

---

**Last Updated:** 2025-10-16
**Maintained By:** Development Team
**Review Cadence:** Monthly
