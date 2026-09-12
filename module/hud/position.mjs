// module/hud/position.mjs - HUD window position: restore on render, drag to move

import { debugLog } from "../settings.mjs";
import { MODULE_ID, FLAGS } from "../constants.mjs";
import { setGMPanelOpenDirection, reapplyStoredFilter } from "./panels.mjs";

export async function restorePosition(app) {
  const root = app.element;
  if (!root) return;

  try {
    const savedPos = await game.user.getFlag(MODULE_ID, FLAGS.hudPosition);
    if (savedPos && savedPos.left !== undefined && savedPos.top !== undefined) {
      root.style.position = "fixed";
      root.style.left = `${Math.max(0, Math.min(savedPos.left, window.innerWidth - 200))}px`;
      root.style.top = `${Math.max(0, Math.min(savedPos.top, window.innerHeight - 200))}px`;
      root.style.bottom = "auto";
      root.style.transform = "none";
      debugLog("Restored HUD position:", savedPos);
    } else {
      root.style.position = "fixed";
      root.style.bottom = "100px";
      root.style.left = "50%";
      root.style.transform = "translateX(-50%)";
    }
  } catch (err) {
    debugLog("Failed to restore position:", err);
  }

  root.classList.toggle("dgm-position-locked", isPositionLocked());
}

/** Whether the GM has locked the HUD in place (drag-by-core disabled). */
export function isPositionLocked() {
  return !!game.user.getFlag(MODULE_ID, FLAGS.positionLocked);
}

/** Persist the lock state and reflect it immediately on the given HUD element. */
export async function setPositionLocked(appEl, locked) {
  await game.user.setFlag(MODULE_ID, FLAGS.positionLocked, !!locked);
  if (appEl) appEl.classList.toggle("dgm-position-locked", !!locked);
}

/** Elements inside the HUD container that must keep their own click/drag behavior. */
const INTERACTIVE_SELECTOR = [
  "[data-action]",
  ".dgm-count",
  ".dgm-belt-slot",
  ".dgm-belt-add",
  "button",
  "a",
  "input",
  "select",
  "textarea"
].join(", ");

export function enableDragging(app) {
  const root = app.element;
  if (!root) return;

  const handle = root.querySelector(".dgm-container");
  if (!handle) return;

  let startX, startY, startLeft, startTop, isDragging = false;

  if (!app._resizeHandlerBound) {
    app._onResize = () => {
      if (app._isDragging) return;

      const shell = root.querySelector(".dgm-hud");
      const isOpen = shell?.getAttribute("data-open") === "features";
      if (isOpen) {
        const panel = root.querySelector(".dgm-panel--features");
        if (panel) setGMPanelOpenDirection(panel);
      }
    };

    window.addEventListener("resize", app._onResize);
    app._resizeHandlerBound = true;
  }

  const onMove = (ev) => {
    if (!isDragging) return;

    app._isDragging = true;

    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;

    const newLeft = Math.max(0, Math.min(startLeft + dx, window.innerWidth - 200));
    const newTop = Math.max(0, Math.min(startTop + dy, window.innerHeight - 200));

    root.style.left = `${newLeft}px`;
    root.style.top = `${newTop}px`;
    root.style.bottom = "auto";
    root.style.transform = "none";
  };

  const onUp = async () => {
    if (!isDragging) return;
    isDragging = false;

    handle.style.cursor = "grab";
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);

    app._isDragging = false;

    try {
      const rect = root.getBoundingClientRect();
      const pos = {
        left: Math.round(rect.left),
        top: Math.round(rect.top)
      };
      await game.user.setFlag(MODULE_ID, FLAGS.hudPosition, pos);
      debugLog("Saved HUD position:", pos);
    } catch (err) {
      debugLog("Failed to save position:", err);
    }

    requestAnimationFrame(() => {
      const shell = root.querySelector(".dgm-hud");
      const isOpen = shell?.getAttribute("data-open") === "features";
      if (isOpen) {
        const panel = root.querySelector(".dgm-panel--features");
        if (panel) setGMPanelOpenDirection(panel);
      }

      reapplyStoredFilter(app);
    });
  };

  const onDown = (ev) => {
    if (ev.button !== 0) return;
    if (isPositionLocked()) return;
    if (ev.target.closest(INTERACTIVE_SELECTOR)) return;

    ev.preventDefault();
    isDragging = true;

    handle.style.cursor = "grabbing";

    const rect = root.getBoundingClientRect();
    startX = ev.clientX;
    startY = ev.clientY;
    startLeft = rect.left;
    startTop = rect.top;

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  handle.addEventListener("pointerdown", onDown);
  handle.style.cursor = isPositionLocked() ? "default" : "grab";
}
