// module/hud/context/utility-belt.mjs - quick-access feature slots (drag/drop rearrangeable, growable)

import { MODULE_ID, FLAGS } from "../../constants.mjs";

/** Enriched description HTML -> plain text, for the hover balloon (no interactive roll buttons there). */
function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html ?? "";
  return div.textContent?.trim() ?? "";
}

export function collectUtilityBelt(app, features) {
  const featureById = new Map(features.map(f => [f.id, f]));

  const stored = app.actor.getFlag(MODULE_ID, FLAGS.utilityBelt);
  const ids = Array.isArray(stored) ? stored.slice() : features.map(f => f.id);

  const slots = ids.map((id, index) => {
    const feature = id ? featureById.get(id) : null;
    return {
      index,
      id: feature ? feature.id : null,
      name: feature?.name ?? "",
      img: feature?.img ?? null,
      description: feature ? stripHtml(feature.description) : "",
      hasActions: feature?.hasActions ?? false,
      featureFormIcon: feature?.featureFormIcon ?? "",
      _item: feature?._item ?? null
    };
  });

  return { utilityBelt: { slots, slotCount: ids.length, canAddSlot: ids.length < features.length } };
}

/** Persist the current slot -> feature id list (null for empty slots); array length IS the slot count. */
export async function saveUtilityBelt(app, ids) {
  await app.actor.setFlag(MODULE_ID, FLAGS.utilityBelt, ids);
}
