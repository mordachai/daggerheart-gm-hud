// module/hud/panels.mjs - features/range panel open-direction, toggling and filtering

import { debugLog } from "../settings.mjs";
import { MODULE_ID, FLAGS } from "../constants.mjs";

/** Session-shared last-used feature filter (mirrors the pre-refactor class static). */
let sharedFilterState = "none";

export function setGMPanelOpenDirection(panel) {
  if (!panel) return;

  const hudContainer = panel.closest(".dgm-container") || panel.closest(".dgm-hud") || panel.parentElement;
  if (!hudContainer) return;

  const rect = hudContainer.getBoundingClientRect();
  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;

  const contentHeight = panel.scrollHeight || 320;
  const minRoom = 220; // prevent jitter
  const maxContentHeight = Math.min(window.innerHeight * 0.5, 820);
  const need = Math.max(minRoom, Math.min(contentHeight, maxContentHeight));

  const dir = spaceBelow >= need ? "down" : spaceAbove >= need ? "up" : (spaceBelow >= spaceAbove ? "down" : "up");
  panel.setAttribute("data-open-dir", dir);

  const margin = 12;
  const maxH = dir === "down" ? Math.max(180, spaceBelow - margin) : Math.max(180, spaceAbove - margin);
  const finalMaxHeight = Math.min(maxH, maxContentHeight);

  panel.style.setProperty("--dgm-panel-maxh", `${finalMaxHeight}px`);
  panel.style.setProperty("--dgm-panel-gap", "20px");
}

function getStoredFilter() {
  return game.user.getFlag(MODULE_ID, FLAGS.featureFilter) || sharedFilterState;
}

export function applyFeatureFilter(app, filterType = null) {
  const rootEl = app.element;
  if (!rootEl) return;

  const filter = filterType || getStoredFilter();

  const featureItems = rootEl.querySelectorAll(".dgm-acc-item");
  const filterButtons = rootEl.querySelectorAll(".dgm-filter-btn");

  filterButtons.forEach(btn => {
    btn.classList.remove("active");
    const action = btn.dataset.action;
    if ((action === "expand-all" && filter === "all") ||
        (action === "expand-actions" && filter === "actions") ||
        (action === "expand-passive" && filter === "passive") ||
        (action === "collapse-all" && filter === "collapsed")) {
      btn.classList.add("active");
    }
  });

  featureItems.forEach(item => {
    const details = item.querySelector("details");
    if (!details) return;

    const hasActions = item.dataset.hasActions === "true";

    switch (filter) {
      case "all": details.open = true; break;
      case "actions": details.open = hasActions; break;
      case "passive": details.open = !hasActions; break;
      case "collapsed": details.open = false; break;
      case "none":
      default: break; // don't change current state
    }
  });

  debugLog(`Applied feature filter: ${filter}`);
}

export function handleFeatureFilter(app, action) {
  const filterType = {
    "expand-all": "all",
    "expand-actions": "actions",
    "expand-passive": "passive",
    "collapse-all": "collapsed"
  }[action];
  if (!filterType) return;

  sharedFilterState = filterType;
  applyFeatureFilter(app, filterType);
  game.user.setFlag(MODULE_ID, FLAGS.featureFilter, filterType);

  debugLog(`Feature filter set to: ${filterType}`);
}

/** Reapply whatever filter is currently stored, e.g. after a panel reopen or a drag ends. */
export function reapplyStoredFilter(app) {
  const filter = getStoredFilter();
  if (filter && filter !== "none") applyFeatureFilter(app, filter);
}

/** Name of the panel currently open ("features", "details", ...) or "" when none. */
export function getOpenPanelName(rootEl) {
  return rootEl?.querySelector(".dgm-hud")?.getAttribute("data-open") || "";
}

/** Recompute open-direction / max-height of the currently open panel (resize, drag end). */
export function repositionOpenPanel(rootEl) {
  const name = getOpenPanelName(rootEl);
  if (!name) return;
  const panel = rootEl.querySelector(`.dgm-panel[data-panel="${name}"]`);
  if (panel) setGMPanelOpenDirection(panel);
}

function syncToggleState(rootEl, openName) {
  rootEl.querySelectorAll("[data-action='toggle-panel']").forEach((toggle) => {
    toggle.setAttribute("aria-expanded", String(toggle.dataset.panel === openName));
  });
}

/** Open the named panel (closing any other), or close it if it is already the open one. */
export function togglePanel(app, name) {
  const rootEl = app.element;
  if (!rootEl) return;

  const shell = rootEl.querySelector(".dgm-hud");
  const isOpen = getOpenPanelName(rootEl) === name;
  const openName = isOpen ? "" : name;
  shell?.setAttribute("data-open", openName);
  syncToggleState(rootEl, openName);

  if (!isOpen) {
    const panel = rootEl.querySelector(`.dgm-panel[data-panel="${name}"]`);
    if (panel) {
      requestAnimationFrame(() => {
        setGMPanelOpenDirection(panel);
        requestAnimationFrame(() => reapplyStoredFilter(app));
      });
    }
  }
}

export function toggleFeaturesPanel(app) {
  togglePanel(app, "features");
}

export function closeAllPanels(rootEl) {
  const shell = rootEl.querySelector(".dgm-hud");
  shell?.setAttribute("data-open", "");
  syncToggleState(rootEl, "");
}
