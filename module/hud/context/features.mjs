// module/hud/context/features.mjs - feature list with enriched, click-to-roll descriptions

import { enrichItemDescription, toHudInlineButtons } from "../../helpers/inline-rolls.mjs";
import { featureHasActions } from "../../system/items.mjs";

/** Icon per system.featureForm (passive/action/reaction/evolution) - the system defines no icon of its own. */
const FEATURE_FORM_ICONS = {
  passive: "fa-book",
  action: "fa-bolt",
  reaction: "fa-reply",
  evolution: "fa-dna"
};

/** Same icon the sheet's own action buttons use (CONFIG.DH.ACTIONS.actionTypes[type].icon - a few types
 *  give a function instead of a string, e.g. "grouped" picks fa-dice vs fa-table-list off the action). */
function resolveActionIcon(action) {
  const cfg = CONFIG.DH?.ACTIONS?.actionTypes?.[action.type];
  const icon = typeof cfg?.icon === "function" ? cfg.icon(action) : cfg?.icon;
  return icon || "fa-bolt";
}

/** Total Fear cost across a feature's actions (0 if none of them spend Fear). */
export function getFeatureFearCost(item) {
  const actions = item?.system?.actionsList ?? [];
  let total = 0;
  for (const action of actions) {
    for (const cost of action.cost ?? []) {
      if (cost.key === "fear") total += Number(cost.value) || 0;
    }
  }
  return total;
}

/** {id, name, icon} per usable action on a feature item - shared by the accordion and the belt tooltip. */
export function buildFeatureActions(item) {
  return (item?.system?.actionsList ?? [])
    .filter(action => action.id)
    .map(action => ({
      id: action.id,
      name: action.name || game.i18n.localize(`DAGGERHEART.ACTIONS.TYPES.${action.type}.name`),
      icon: resolveActionIcon(action)
    }));
}

export async function collectFeatures(app) {
  const featureItems = app.actor.items
    .filter(item => item.type === "feature")
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  const features = await Promise.all(
    featureItems.map(async (item) => {
      const enrichedHTML = await enrichItemDescription(item);
      const finalHTML = toHudInlineButtons(enrichedHTML, { enableDuality: true });

      const featureForm = item.system?.featureForm || "";
      const featureFormKey = featureForm ? CONFIG.DH?.ITEM?.featureForm?.[featureForm] : null;

      const actions = buildFeatureActions(item);

      return {
        id: item.id,
        name: item.name || "Unnamed Feature",
        img: item.img || "icons/svg/aura.svg",
        description: finalHTML,
        hasActions: featureHasActions(item),
        featureForm,
        featureFormLabel: featureFormKey ? game.i18n.localize(featureFormKey) : "",
        featureFormIcon: FEATURE_FORM_ICONS[featureForm] || "",
        actions,
        system: item.system,
        _item: item
      };
    })
  );

  return { features };
}
