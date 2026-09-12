// module/hud/status-menu.mjs
// Portrait right-click context menu (toggle conditions / lock position / theme
// selector), the condition grid, and the hover tooltip.

import { debugLog, getSetting, setSetting, SETTINGS, THEMES, adjacentTheme, applyThemeToElement } from "../settings.mjs";
import { isActive, toggle } from "../system/conditions.mjs";
import { isPositionLocked, setPositionLocked } from "./position.mjs";
import { closeAllPanels } from "./panels.mjs";

const stop = (ev) => { ev.preventDefault(); ev.stopPropagation(); };

/** Reflect the current theme on the context menu's carousel label. */
function syncThemeMenuItem(app) {
  const label = app.element?.querySelector("#dgm-context-theme .dgm-theme-label");
  if (!label) return;
  const theme = getSetting(SETTINGS.theme) || "default";
  label.textContent = `Theme: ${THEMES[theme] || THEMES.default}`;
}

/** Reflect the current lock state on the context menu's toggle-lock item. */
function syncLockMenuItem(app) {
  const item = app.element?.querySelector("#dgm-context-lock");
  if (!item) return;
  const locked = isPositionLocked();
  item.querySelector("i")?.setAttribute("class", locked ? "fas fa-lock" : "fas fa-lock-open");
  const label = item.querySelector("span");
  if (label) label.textContent = locked ? "Unlock Position" : "Lock Position";
}

/** Position + show the portrait context menu. */
export function showContextMenu(app) {
  hideStatusGrid(app);
  syncLockMenuItem(app);
  syncThemeMenuItem(app);

  if (!app.element) return;

  const menu = app.element.querySelector("#dgm-context-menu");
  const portrait = app.element.querySelector(".dgm-portrait");
  const core = app.element.querySelector(".dgm-core");
  if (!menu || !portrait || !core) return;

  // Show off-screen first to measure.
  menu.style.left = "-9999px";
  menu.style.top = "-9999px";
  menu.classList.add("show");
  menu.offsetHeight; // reflow

  const menuRect = menu.getBoundingClientRect();
  const coreRect = core.getBoundingClientRect();
  const portraitRect = portrait.getBoundingClientRect();

  const portraitCenterX = portraitRect.left - coreRect.left + (portraitRect.width / 2);
  const portraitCenterY = portraitRect.top - coreRect.top + (portraitRect.height / 2);

  let menuX = portraitCenterX - (menuRect.width / 2);
  let menuY = portraitCenterY + (portraitRect.height / 2) + 10;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const menuViewportX = coreRect.left + menuX;
  const menuViewportY = coreRect.top + menuY;

  if (menuViewportX + menuRect.width > viewportWidth) {
    menuX = viewportWidth - coreRect.left - menuRect.width - 10;
  }
  if (menuViewportX < 10) {
    menuX = 10 - coreRect.left;
  }

  if (menuViewportY + menuRect.height > viewportHeight - 10) {
    // Try positioning above the portrait instead.
    menuY = portraitCenterY - (portraitRect.height / 2) - menuRect.height - 10;
    if (coreRect.top + menuY < 10) menuY = 10 - coreRect.top;
  }

  if (menu.parentElement !== core) core.appendChild(menu);

  menu.style.position = "absolute";
  menu.style.left = `${menuX}px`;
  menu.style.top = `${menuY}px`;

  app._portraitCenter = { x: portraitCenterX, y: portraitCenterY, coreElement: core };
}

/** Position + show the condition grid. */
export function showStatusGrid(app) {
  if (!app.element) return;

  const grid = app.element.querySelector("#dgm-status-grid");
  const core = app.element.querySelector(".dgm-core");
  if (!grid || !core) return;

  grid.style.position = "absolute";
  grid.style.left = "-9999px";
  grid.style.top = "-9999px";
  grid.classList.add("show");
  grid.offsetHeight; // reflow

  const statusIcons = grid.querySelectorAll(".dgm-status-icon");
  statusIcons.forEach((icon) => {
    const conditionId = icon.dataset.conditionId;
    if (conditionId) icon.classList.toggle("active", isActive(app.actor, conditionId));
  });

  const gridRect = grid.getBoundingClientRect();
  const coreRect = core.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const anchorX = app._portraitCenter?.x ?? 0;
  const anchorY = app._portraitCenter?.y ?? 0;

  let adjustedX = anchorX - (gridRect.width / 2);
  let adjustedY = anchorY + 80;

  const gridViewportX = coreRect.left + adjustedX;
  const gridViewportY = coreRect.top + adjustedY;

  if (gridViewportX + gridRect.width > viewportWidth) {
    adjustedX = viewportWidth - coreRect.left - gridRect.width - 10;
  }
  if (gridViewportX < 10) {
    adjustedX = 10 - coreRect.left;
  }

  if (gridViewportY + gridRect.height > viewportHeight) {
    adjustedY = anchorY - gridRect.height - 80;
    if (coreRect.top + adjustedY < 10) adjustedY = 10 - coreRect.top;
  }

  if (grid.parentElement !== core) core.appendChild(grid);

  grid.style.left = `${adjustedX}px`;
  grid.style.top = `${adjustedY}px`;
}

export function hideContextMenu(app) {
  const menu = app.element?.querySelector("#dgm-context-menu");
  if (menu) menu.classList.remove("show");
}

export function hideStatusGrid(app) {
  const grid = app.element?.querySelector("#dgm-status-grid");
  if (grid) grid.classList.remove("show");
}

const TOOLTIP_VARIANTS = ["dgm-tooltip--belt"];

/** Cancel a pending scheduleHideTooltip() without touching the tooltip's current visibility. */
export function cancelTooltipHide(app) {
  if (app._tooltipHideTimer) {
    clearTimeout(app._tooltipHideTimer);
    app._tooltipHideTimer = null;
  }
}

export function hideTooltip(app) {
  cancelTooltipHide(app);
  const tooltip = app.element?.querySelector("#dgm-tooltip");
  if (tooltip) tooltip.classList.remove("show");
}

/** Hide after a short delay, cancellable via cancelTooltipHide() - lets the pointer travel from
 *  the trigger element into the tooltip itself (e.g. to click a button inside it) without it
 *  disappearing mid-transit. */
export function scheduleHideTooltip(app, delay = 150) {
  cancelTooltipHide(app);
  app._tooltipHideTimer = setTimeout(() => {
    app._tooltipHideTimer = null;
    const tooltip = app.element?.querySelector("#dgm-tooltip");
    if (tooltip) tooltip.classList.remove("show");
  }, delay);
}

const TOOLTIP_GAP = 10;

export function showTooltip(app, targetEl, content, { wrap = false, variant = null, html = false } = {}) {
  const tooltip = app.element?.querySelector("#dgm-tooltip");
  if (!tooltip || !content || !targetEl) return;
  cancelTooltipHide(app);
  if (html) tooltip.innerHTML = content; else tooltip.textContent = content;
  tooltip.classList.toggle("dgm-tooltip--wrap", wrap);
  tooltip.classList.remove(...TOOLTIP_VARIANTS);
  if (variant) tooltip.classList.add(`dgm-tooltip--${variant}`);
  tooltip.classList.add("show");

  // Coordinates are viewport-relative, but the tooltip is positioned relative to its
  // offsetParent (the nearest positioned ancestor) - convert, or it renders far off wherever
  // the HUD happens to be on screen.
  const anchorRect = (tooltip.offsetParent ?? app.element).getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();

  const left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
  const above = targetRect.top - tooltipRect.height - TOOLTIP_GAP;
  const flipped = above < 0;
  const top = flipped ? targetRect.bottom + TOOLTIP_GAP : above;

  tooltip.classList.toggle("dgm-tooltip--below", flipped);
  tooltip.style.left = `${left - anchorRect.left}px`;
  tooltip.style.top = `${top - anchorRect.top}px`;
}

/** Wire portrait context menu + condition grid + tooltip listeners. Guarded once per app. */
export function attachStatusMenu(app) {
  const rootEl = app.element;
  if (!rootEl || app._statusMenuBound) return;

  rootEl.addEventListener("contextmenu", (ev) => {
    const portrait = ev.target.closest(".dgm-portrait, .dgm-portrait-img");
    if (!portrait) return;
    stop(ev);
    closeAllPanels(rootEl);
    showContextMenu(app);
  }, true);

  rootEl.addEventListener("click", async (ev) => {
    const contextItem = ev.target.closest(".dgm-context-item");
    if (!contextItem) return;
    stop(ev);
    const action = contextItem.dataset.action;

    if (action === "theme-prev" || action === "theme-next") {
      const current = getSetting(SETTINGS.theme) || "default";
      const next = adjacentTheme(current, action === "theme-next" ? 1 : -1);
      await setSetting(SETTINGS.theme, next);
      applyThemeToElement(rootEl);
      syncThemeMenuItem(app);
      return; // keep the menu open for further browsing
    }

    if (action === "apply-status") {
      showStatusGrid(app);
      return;
    }

    if (action === "toggle-lock") {
      const locked = !isPositionLocked();
      await setPositionLocked(rootEl, locked);
      const core = rootEl.querySelector(".dgm-core");
      if (core) core.style.cursor = locked ? "default" : "grab";
      hideContextMenu(app);
      return;
    }

    hideContextMenu(app);
  }, true);

  rootEl.addEventListener("click", async (ev) => {
    const statusIcon = ev.target.closest(".dgm-status-icon");
    if (!statusIcon) return;
    stop(ev);
    const conditionId = statusIcon.dataset.conditionId;
    const next = !isActive(app.actor, conditionId);
    await toggle(app.actor, conditionId, next);
    statusIcon.classList.toggle("active", next);
  }, true);

  rootEl.addEventListener("mouseover", (ev) => {
    const statusIcon = ev.target.closest(".dgm-status-icon");
    if (statusIcon) showTooltip(app, statusIcon, statusIcon.dataset.conditionName);
  });

  rootEl.addEventListener("mouseout", (ev) => {
    if (ev.target.closest(".dgm-status-icon")) hideTooltip(app);
  });

  document.addEventListener("click", (ev) => {
    const clicked = ev.target;
    const statusIcon = clicked.closest(".dgm-status-icon");
    const contextMenu = clicked.closest("#dgm-context-menu, .dgm-context-menu");
    const statusGrid = clicked.closest("#dgm-status-grid, .dgm-status-grid");
    if (!statusIcon && !contextMenu && !statusGrid) {
      hideContextMenu(app);
      hideStatusGrid(app);
    }
  }, { capture: true });

  // Auto-close the context menu when the mouse leaves it, so it doesn't linger
  // until an unrelated click happens elsewhere. A short delay keeps it open
  // while the user browses across the menu's items (e.g. theme prev/next).
  const contextMenuEl = rootEl.querySelector("#dgm-context-menu");
  if (contextMenuEl) {
    let closeTimer = null;
    contextMenuEl.addEventListener("mouseleave", () => {
      closeTimer = setTimeout(() => hideContextMenu(app), 400);
    });
    contextMenuEl.addEventListener("mouseenter", () => {
      if (closeTimer) clearTimeout(closeTimer);
    });
  }

  rootEl.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      hideContextMenu(app);
      hideStatusGrid(app);
    }
  });

  app._statusMenuBound = true;
  debugLog("Status menu attached");
}
