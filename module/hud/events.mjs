// module/hud/events.mjs - delegated DOM event dispatch for the GM HUD

import { debugLog } from "../settings.mjs";
import { sendToChat } from "../system/items.mjs";
import { rollAttack } from "../system/attack.mjs";
import { rollReaction, adjustResource } from "../system/actor.mjs";
import { adjustFear } from "../system/fear.mjs";
import {
  toggleFeaturesPanel,
  closeAllPanels,
  applyFeatureFilter,
  handleFeatureFilter
} from "./panels.mjs";
import {
  createRangeTemplate,
  cleanupRangeTemplate,
  hasTemplateForRange,
  updateRangeButtonState
} from "./range-templates.mjs";

export function attachHudEvents(app) {
  const rootEl = app.element;
  if (!rootEl || app._delegatedBound) return;

  const stop = (ev) => { ev.preventDefault(); ev.stopPropagation(); };

  rootEl.addEventListener("click", async (ev) => {
    const actor = app.actor;
    if (!actor) return;

    const filterBtn = ev.target.closest(".dgm-filter-btn");
    if (filterBtn) {
      stop(ev);
      handleFeatureFilter(app, filterBtn.dataset.action);
      return;
    }

    const featuresToggle = ev.target.closest("[data-action='toggle-features']");
    if (featuresToggle) {
      stop(ev);
      toggleFeaturesPanel(app);
      return;
    }

    const attackBtn = ev.target.closest("[data-action='roll-attack']");
    if (attackBtn) {
      stop(ev);
      await rollAttack(actor, ev);
      return;
    }

const reactionBtn = ev.target.closest("[data-action='roll-reaction']");
    if (reactionBtn) {
      stop(ev);
      await rollReaction(actor, ev);
      return;
    }

    const fearBtn = ev.target.closest("[data-action='fear-adjust']");
    if (fearBtn) {
      stop(ev);
      await adjustFear(-1);
      app.render();
      return;
    }

    const featureExec = ev.target.closest("[data-action='feature-exec']");
    if (featureExec) {
      stop(ev);
      const item = actor.items.get(featureExec.dataset.featureId);
      if (item) {
        try {
          await item.use(ev);
        } catch (err) {
          console.error("[GM HUD] Feature execution failed", err);
          ui.notifications?.error("Feature execution failed (see console)");
        }
      }
      return;
    }

    const featureActionBtn = ev.target.closest("[data-action='feature-action-use']");
    if (featureActionBtn) {
      stop(ev);
      const item = actor.items.get(featureActionBtn.dataset.featureId);
      const action = item?.system?.actions?.get(featureActionBtn.dataset.actionId);
      if (action) {
        try {
          await action.use(ev);
        } catch (err) {
          console.error("[GM HUD] Feature action failed", err);
          ui.notifications?.error("Feature action failed (see console)");
        }
      }
      return;
    }

    const featureChat = ev.target.closest("[data-action='feature-to-chat']");
    if (featureChat) {
      stop(ev);
      const item = actor.items.get(featureChat.dataset.featureId);
      if (item) {
        try {
          await sendToChat(item);
        } catch (err) {
          console.error("[GM HUD] Send to chat failed", err);
          ui.notifications?.error("Failed to send to chat");
        }
      }
      return;
    }

    const rangeDetails = ev.target.closest("[data-action='create-range-template']");
    if (rangeDetails) {
      stop(ev);
      const range = rangeDetails.dataset.range || rangeDetails.textContent?.trim();
      if (range) {
        const token = app.token ?? canvas.tokens.controlled[0];
        if (token && hasTemplateForRange(token, range)) {
          await cleanupRangeTemplate(token, range);
        } else {
          await createRangeTemplate(app, range);
        }
        updateRangeButtonState(rangeDetails, range, token);
      }
      return;
    }

    const inlineRoll = ev.target.closest("[data-action='inline-roll']");
    if (inlineRoll) {
      stop(ev);
      const formula = inlineRoll.dataset.formula;
      if (formula) {
        const roll = new Roll(formula, actor.getRollData());
        roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
      }
      return;
    }

    const inlineDuality = ev.target.closest("[data-action='inline-duality']");
    if (inlineDuality) {
      stop(ev);
      const params = inlineDuality.dataset.params;
      if (params) ui.chat?.processMessage?.(`/dr ${params}`);
      return;
    }
  }, true);

  rootEl.addEventListener("contextmenu", async (ev) => {
    const fearBtn = ev.target.closest("[data-action='fear-adjust']");
    if (fearBtn) {
      stop(ev);
      await adjustFear(+1);
      app.render();
      return;
    }

    const actor = app.actor;
    if (!actor) return;

    const valueEl = ev.target.closest(".dgm-count .value");
    if (valueEl) {
      stop(ev);
      const bind = valueEl.dataset.bind;
      if (bind === "hp") {
        const max = Number(actor.system?.resources?.hitPoints?.max ?? 0);
        await adjustResource(actor, "system.resources.hitPoints.value", -1, { min: 0, max });
        return;
      }
      if (bind === "stress") {
        const max = Number(actor.system?.resources?.stress?.max ?? 0);
        await adjustResource(actor, "system.resources.stress.value", -1, { min: 0, max });
        return;
      }
    }
  }, true);

  rootEl.addEventListener("click", async (ev) => {
    const actor = app.actor;
    if (!actor) return;

    const valueEl = ev.target.closest(".dgm-count .value");
    if (valueEl) {
      stop(ev);
      const bind = valueEl.dataset.bind;
      if (bind === "hp") {
        const max = Number(actor.system?.resources?.hitPoints?.max ?? 0);
        await adjustResource(actor, "system.resources.hitPoints.value", +1, { min: 0, max });
        return;
      }
      if (bind === "stress") {
        const max = Number(actor.system?.resources?.stress?.max ?? 0);
        await adjustResource(actor, "system.resources.stress.value", +1, { min: 0, max });
        return;
      }
    }
  }, true);

  rootEl.addEventListener("dblclick", (ev) => {
    const actor = app.actor;
    if (!actor) return;

    const portrait = ev.target.closest(".dgm-portrait, .dgm-core");
    if (portrait) {
      stop(ev);
      debugLog("Double-click detected, opening actor sheet for:", actor.name);
      actor.sheet?.render(true, { focus: true });
    }
  }, true);

  const onDocClick = (ev) => {
    if (!rootEl.contains(ev.target)) closeAllPanels(rootEl);
  };
  document.addEventListener("pointerdown", onDocClick, { capture: true });

  rootEl.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closeAllPanels(rootEl);
  });

  app._delegatedBound = true;
}
