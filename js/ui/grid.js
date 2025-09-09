// js/ui/grid.js - Widget Grid & Sidebar Rendering with Theme Support

import { state, elements, widgets, sidebarMapping, setFocus } from '../core/state.js';

// ---------------------
// WIDGET CREATION
// ---------------------

function createWidgetIframe(widget) {
  const iframe = document.createElement("iframe");
  iframe.src = widget.url || "about:blank";
  iframe.className = "widget-iframe"; // Use CSS class instead of inline styles
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  
  // Prevent iframe from stealing focus when sidebar is expanded
  iframe.addEventListener("focus", (e) => {
    if (elements.sidebar.classList.contains("expanded")) {
      console.log("⚠️ Iframe tried to steal focus while sidebar expanded, preventing");
      e.preventDefault();
      iframe.blur();
    }
  });
  
  // Add load event listener and apply theme when widget loads
  iframe.addEventListener("load", () => {
    console.log(`Widget iframe loaded: ${widget.id}`);
    
    // Apply current theme to newly loaded widget
    import('../core/theme.js').then(({ applyThemeToWidget }) => {
      applyThemeToWidget(iframe);
    }).catch(() => {
      console.log('Theme system not available for widget theming');
    });
  });
  
  // Add error handling
  iframe.addEventListener("error", () => {
    console.warn(`Widget iframe failed to load: ${widget.id}`);
  });
  
  return iframe;
}

function createFallbackWidget(widget) {
  const fallback = document.createElement("div");
  fallback.style.cssText = `
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #444;
    color: #999;
    font-size: 14px;
    text-align: center;
    padding: 20px;
    box-sizing: border-box;
    flex-direction: column;
  `;
  fallback.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 10px;">${widget.label}</div>
    <div>Widget not available</div>
    <div style="font-size: 12px; margin-top: 10px; color: #777;">URL: ${widget.url || 'No URL'}</div>
  `;
  return fallback;
}

// ---------------------
// GRID RENDERING
// ---------------------

export function renderGrid() {
  elements.grid.innerHTML = "";
  
  widgets.forEach(w => {
    const div = document.createElement("div");
    div.classList.add("widget");
    div.dataset.row = w.row;
    div.dataset.col = w.col;
    div.style.gridRow = `${w.row} / span ${w.rowSpan}`;
    div.style.gridColumn = `${w.col} / span ${w.colSpan}`;
    div.style.position = "relative"; // For overlay positioning

    // Create click overlay that sits on top of iframe
    const clickOverlay = document.createElement("div");
    clickOverlay.className = "widget-click-overlay";
    clickOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10;
      pointer-events: none;
      background: transparent;
    `;

    // Function to enable/disable click overlay based on sidebar state
    const updateOverlay = () => {
      const sidebarExpanded = elements.sidebar.classList.contains("expanded");
      clickOverlay.style.pointerEvents = sidebarExpanded ? "auto" : "none";
      console.log(`Overlay for ${w.id}: ${sidebarExpanded ? "enabled" : "disabled"}`);
    };

    // Click handler on overlay (intercepts clicks when sidebar is expanded)
    clickOverlay.addEventListener("click", (e) => {
      console.log("🖱️ Widget overlay clicked:", w.id);
      e.preventDefault();
      e.stopPropagation();
      
      // Close sidebar if expanded
      if (elements.sidebar.classList.contains("expanded")) {
        console.log("✅ Closing sidebar from widget overlay click");
        elements.sidebar.classList.remove("expanded");
        
        // Return focus to this specific widget
        if (state.focus.type === "menu") {
          import('../core/navigation.js').then(({ updateFocus }) => {
            setFocus({ type: "grid", row: w.row, col: w.col });
            updateFocus();
          });
        }
      }
      
      // Update overlay state after sidebar change
      setTimeout(updateOverlay, 10);
    });

    // Monitor sidebar state changes with MutationObserver
    const observer = new MutationObserver(() => updateOverlay());
    observer.observe(elements.sidebar, { attributes: true, attributeFilter: ['class'] });

    // Create iframe or fallback for widget content
    if (w.url) {
      const iframe = createWidgetIframe(w);
      div.appendChild(iframe);
    } else {
      const fallback = createFallbackWidget(w);
      div.appendChild(fallback);
    }

    // Add overlay on top of content
    div.appendChild(clickOverlay);
    
    // Set initial overlay state
    updateOverlay();

    elements.grid.appendChild(div);
  });
}

// ---------------------
// SIDEBAR RENDERING
// ---------------------

export function renderSidebar() {
  elements.sidebar.innerHTML = ""; // clear previous

  // Add Dashie logo (only visible when expanded)
  const logo = document.createElement("img");
  logo.classList.add("dashie-logo");
  logo.alt = "Dashie";
  
  // Set logo source based on current theme immediately
  import('../core/theme.js').then(({ getCurrentTheme }) => {
    const currentTheme = getCurrentTheme();
    const logoSrc = currentTheme === 'light' 
      ? 'icons/Dashie_Full_Logo_Black_Transparent.png'
      : 'icons/Dashie_Full_Logo_White_Transparent.png';
    logo.src = logoSrc;
    console.log(`🖼️ Logo set for ${currentTheme} theme:`, logoSrc);
  }).catch(() => {
    // Fallback if theme system isn't loaded yet
    logo.src = 'icons/Dashie_Full_Logo_White_Transparent.png';
    console.log('🖼️ Logo set to default (white)');
  });
  
  elements.sidebar.appendChild(logo);

  // Separate main and system items
  const mainItems = sidebarOptions.filter(item => item.type === "main");
  const systemItems = sidebarOptions.filter(item => item.type === "system");

  // Create main items (content selection)
  mainItems.forEach((item, index) => {
    const div = createMenuItem(item, "main", index);
    elements.sidebar.appendChild(div);
  });

  // Add separator
  const separator = document.createElement("div");
  separator.classList.add("menu-separator");
  elements.sidebar.appendChild(separator);

  // Create system functions container (2x2 grid)
  const systemContainer = document.createElement("div");
  systemContainer.classList.add("system-functions");

  systemItems.forEach((item, index) => {
    const div = createMenuItem(item, "system", index + mainItems.length);
    systemContainer.appendChild(div);
  });

  elements.sidebar.appendChild(systemContainer);
}

// ---------------------
// MENU ITEM CREATION
// ---------------------

export function createMenuItem(item, type, globalIndex) {
  const div = document.createElement("div");
  div.classList.add("menu-item", type);
  div.dataset.menu = item.id;
  div.dataset.globalIndex = globalIndex; // for focus navigation

  // Highlight active main widget
  if (["calendar","map","camera"].includes(item.id) && item.id === state.currentMain) {
    div.classList.add("active");
  }

  // Icon - using CSS class instead of inline styles
  const img = document.createElement("img");
  img.src = item.iconSrc;
  img.classList.add("menu-icon"); // CSS handles objectFit and filter
  div.appendChild(img);

  // Label text (hidden by default, shown when expanded)
  const label = document.createElement("span");
  label.classList.add("menu-label");
  label.textContent = item.label || "";
  div.appendChild(label);

  // Add event listeners - RESTORED hover functionality
  addMenuItemEventListeners(div, type, globalIndex);

  return div;
}

// ---------------------
// EVENT LISTENERS (HOVER RESTORED)
// ---------------------

function addMenuItemEventListeners(div, type, globalIndex) {
  // RESTORED: Mouse hover events for nice UX
  div.addEventListener("mouseover", () => {
    console.log("Mouse hover on menu item:", div.dataset.menu, {
      isAsleep: state.isAsleep,
      confirmDialog: !!state.confirmDialog,
      selectedCell: !!state.selectedCell
    });
    
    if (state.confirmDialog || state.isAsleep || state.selectedCell) return; // Don't respond when widget is focused
    setFocus({ type: "menu", index: globalIndex });
    elements.sidebar.classList.add("expanded");
    
    // Import updateFocus and call it
    import('../core/navigation.js').then(({ updateFocus }) => updateFocus());
  });

  div.addEventListener("mouseout", () => {
    if (state.confirmDialog || state.isAsleep || state.selectedCell) return;
    if (state.focus.type !== "menu") elements.sidebar.classList.remove("expanded");
  });

  // Click events
  div.addEventListener("click", () => {
    console.log("Menu item clicked:", { 
      item: div.dataset.menu, 
      isAsleep: state.isAsleep, 
      confirmDialog: !!state.confirmDialog,
      selectedCell: !!state.selectedCell 
    });
    
    if (state.confirmDialog || state.isAsleep) return;
    
    // Don't allow menu clicks when widget is focused
    if (state.selectedCell) {
      console.log("⚠️ Menu item clicked while widget focused - ignoring");
      return;
    }
    
    setFocus({ type: "menu", index: globalIndex });
    
    // Import navigation functions
    import('../core/navigation.js').then(({ updateFocus, handleEnter }) => {
      // For system items, expand the menu first
      if (type === "system") {
        elements.sidebar.classList.add("expanded");
        updateFocus();
        // Small delay to show expansion, then execute
        setTimeout(() => handleEnter(), 150);
      } else {
        handleEnter();
      }
    });
  });
}
