// module/hud/context/features.mjs - feature list with enriched, click-to-roll descriptions

import { enrichItemDescription, enrichHudField, toHudInlineButtons } from "../../helpers/inline-rolls.mjs";
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

/** Group order for NPC feature lists (matches the NPC sheet); anything else falls into "other". */
const FEATURE_GROUP_ORDER = ["passive", "action", "reaction"];

/** Split features into [{form, label, icon, features}] - passive / action / reaction / other, empty groups skipped. */
export function groupFeaturesByForm(features) {
  const buckets = new Map([...FEATURE_GROUP_ORDER, "other"].map(form => [form, []]));
  for (const feature of features) {
    const form = FEATURE_GROUP_ORDER.includes(feature.featureForm) ? feature.featureForm : "other";
    buckets.get(form).push(feature);
  }

  return [...buckets.entries()]
    .filter(([, list]) => list.length)
    .map(([form, list]) => ({
      form,
      label: form === "other"
        ? "Other"
        : game.i18n.localize(CONFIG.DH?.ITEM?.featureForm?.[form] ?? form),
      icon: form === "other" ? "fa-ellipsis" : FEATURE_FORM_ICONS[form],
      count: list.length,
      features: list
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

      // GM-only notes live in their own item field (system.gmNotes) - shown as a separate section.
      const gmNotes = await enrichHudField(item.system?.gmNotes, {
        rollData: item.getRollData?.() ?? item.actor?.getRollData?.() ?? {},
        relativeTo: item
      });

      const featureForm = item.system?.featureForm || "";
      const featureFormKey = featureForm ? CONFIG.DH?.ITEM?.featureForm?.[featureForm] : null;

      const actions = buildFeatureActions(item);

      return {
        id: item.id,
        name: item.name || "Unnamed Feature",
        img: item.img || "icons/svg/aura.svg",
        description: finalHTML,
        gmNotes,
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
