// module/hud/belt.mjs - utility belt: click-to-exec, right-click clear/remove, drag/drop rearrange, + to grow

import { debugLog } from "../settings.mjs";
import { saveUtilityBelt } from "./context/utility-belt.mjs";
import { toggleFeaturesPanel } from "./panels.mjs";
import { featureHasActions } from "../system/items.mjs";
import { buildFeatureActions, getFeatureFearCost } from "./context/features.mjs";
import { showTooltip, hideTooltip, scheduleHideTooltip, cancelTooltipHide } from "./status-menu.mjs";

function readSlotIds(rootEl) {
  const slotEls = [...rootEl.querySelectorAll(".dgm-belt-slot")]
    .sort((a, b) => Number(a.dataset.slotIndex) - Number(b.dataset.slotIndex));
  return slotEls.map(el => el.dataset.featureId || null);
}

function parseDragPayload(ev) {
  try {
    const raw = ev.dataTransfer.getData("text/plain");
    return raw ? JSON.parse(raw) : null;
  } catch (_err) {
    return null;
  }
}

function closestDropZone(ev) {
  return ev.target.closest(".dgm-belt-slot, .dgm-belt-add");
}

/** Name + description + (if any) action buttons - same buttons/handler as the features accordion. */
function buildBeltTooltipHTML(app, slot) {
  const esc = foundry.utils.escapeHTML;
  const name = slot.dataset.name || "";
  const description = slot.dataset.description || "";
  const featureId = slot.dataset.featureId;

  const item = app.actor?.items.get(featureId);
  const actions = item ? buildFeatureActions(item) : [];
  const fearCost = item ? getFeatureFearCost(item) : 0;
  const fearCostHTML = fearCost > 0
    ? `<span class="dgm-tooltip-fear-cost"><i class="fa-solid fa-skull"></i>${fearCost}</span>`
    : "";

  let html = `<div class="dgm-tooltip-title"><span>${esc(name)}</span>${fearCostHTML}</div>`;
  if (description) html += `<div class="dgm-tooltip-desc">${esc(description)}</div>`;
  if (actions.length) {
    html += `<div class="dgm-feature-actions dgm-tooltip-actions">`;
    for (const action of actions) {
      html += `<button type="button" class="dgm-feature-action-btn"
                       data-action="feature-action-use"
                       data-feature-id="${featureId}"
                       data-action-id="${action.id}">
                 <i class="fa-solid ${action.icon}"></i><span>${esc(action.name)}</span>
               </button>`;
    }
    html += `</div>`;
  }
  return html;
}

/** Re-render the HUD and restore the features panel's open state (a fresh render always closes it). */
async function commitBelt(app, ids) {
  const rootEl = app.element;
  const shell = rootEl?.querySelector(".dgm-hud");
  const wasFeaturesOpen = shell?.getAttribute("data-open") === "features";

  await saveUtilityBelt(app, ids);
  await app.render();

  if (wasFeaturesOpen) toggleFeaturesPanel(app);
}

export function attachBeltEvents(app) {
  const rootEl = app.element;
  if (!rootEl || app._beltBound) return;

  const stop = (ev) => { ev.preventDefault(); ev.stopPropagation(); };

  rootEl.addEventListener("click", async (ev) => {
    const addBtn = ev.target.closest(".dgm-belt-add");
    if (addBtn) {
      stop(ev);
      const ids = readSlotIds(rootEl);
      ids.push(null);
      await commitBelt(app, ids);
      return;
    }

    const slot = ev.target.closest(".dgm-belt-slot.filled");
    if (!slot) return;
    stop(ev);

    const actor = app.actor;
    const item = actor?.items.get(slot.dataset.featureId);
    if (!item) return;

    if (featureHasActions(item)) {
      try {
        await item.use(ev);
      } catch (err) {
        console.error("[GM HUD] Utility belt feature execution failed", err);
        ui.notifications?.error("Feature execution failed (see console)");
      }
    }
  }, true);

  rootEl.addEventListener("contextmenu", async (ev) => {
    const slot = ev.target.closest(".dgm-belt-slot");
    if (!slot) return;
    stop(ev);
    hideTooltip(app);

    const ids = readSlotIds(rootEl);
    const index = Number(slot.dataset.slotIndex);
    ids.splice(index, 1);

    await commitBelt(app, ids);
  }, true);

  rootEl.addEventListener("mouseover", (ev) => {
    const slot = ev.target.closest(".dgm-belt-slot.filled");
    if (slot) {
      showTooltip(app, slot, buildBeltTooltipHTML(app, slot), { wrap: true, variant: "belt", html: true });
      return;
    }
    // Pointer moved into the bubble itself (e.g. to click an action button) - keep it open.
    if (ev.target.closest("#dgm-tooltip.dgm-tooltip--belt")) cancelTooltipHide(app);
  });

  rootEl.addEventListener("mouseout", (ev) => {
    const leavingSlot = ev.target.closest(".dgm-belt-slot.filled");
    const leavingTooltip = ev.target.closest("#dgm-tooltip.dgm-tooltip--belt");
    if (!leavingSlot && !leavingTooltip) return;

    const to = ev.relatedTarget;
    if (to?.closest?.(".dgm-belt-slot.filled") || to?.closest?.("#dgm-tooltip.dgm-tooltip--belt")) return;
    scheduleHideTooltip(app);
  });

  rootEl.addEventListener("dragstart", (ev) => {
    const slot = ev.target.closest(".dgm-belt-slot.filled");
    if (slot) {
      const payload = { source: "dgm-belt", index: Number(slot.dataset.slotIndex) };
      ev.dataTransfer.setData("text/plain", JSON.stringify(payload));
      ev.dataTransfer.effectAllowed = "move";
      slot.classList.add("dgm-belt-dragging");
      return;
    }

    const featureItem = ev.target.closest(".dgm-acc-item[data-feature-id]");
    if (featureItem) {
      const payload = { source: "dgm-feature", featureId: featureItem.dataset.featureId };
      ev.dataTransfer.setData("text/plain", JSON.stringify(payload));
      ev.dataTransfer.effectAllowed = "copy";
    }
  });

  rootEl.addEventListener("dragend", (ev) => {
    ev.target.closest(".dgm-belt-slot")?.classList.remove("dgm-belt-dragging");
  });

  rootEl.addEventListener("dragover", (ev) => {
    const zone = closestDropZone(ev);
    if (!zone) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = zone.classList.contains("filled") ? "move" : "copy";
  });

  rootEl.addEventListener("dragenter", (ev) => {
    closestDropZone(ev)?.classList.add("dgm-belt-dragover");
  });

  rootEl.addEventListener("dragleave", (ev) => {
    const zone = closestDropZone(ev);
    if (zone && !zone.contains(ev.relatedTarget)) zone.classList.remove("dgm-belt-dragover");
  });

  rootEl.addEventListener("drop", async (ev) => {
    const zone = closestDropZone(ev);
    if (!zone) return;
    stop(ev);
    zone.classList.remove("dgm-belt-dragover");

    const isAdd = zone.classList.contains("dgm-belt-add");
    const targetIndex = isAdd ? null : Number(zone.dataset.slotIndex);
    const payload = parseDragPayload(ev);
    if (!payload) return;

    const ids = readSlotIds(rootEl);

    if (payload.source === "dgm-belt") {
      if (isAdd) {
        const [moved] = ids.splice(payload.index, 1);
        ids.push(moved);
      } else {
        if (payload.index === targetIndex) return;
        [ids[payload.index], ids[targetIndex]] = [ids[targetIndex], ids[payload.index]];
      }
      await commitBelt(app, ids);
      return;
    }

    if (payload.source === "dgm-feature") {
      if (!app.actor.items.get(payload.featureId)) return;
      if (isAdd) ids.push(payload.featureId);
      else ids[targetIndex] = payload.featureId;
      await commitBelt(app, ids);
      return;
    }

    if (payload.type === "Item" && payload.uuid) {
      const item = await fromUuid(payload.uuid);
      if (!item || item.type !== "feature" || item.parent?.id !== app.actor.id) {
        ui.notifications?.warn("Only this adversary's features can be placed in the utility belt");
        return;
      }
      if (isAdd) ids.push(item.id);
      else ids[targetIndex] = item.id;
      await commitBelt(app, ids);
    }
  });

  app._beltBound = true;
  debugLog("Utility belt events attached");
}
