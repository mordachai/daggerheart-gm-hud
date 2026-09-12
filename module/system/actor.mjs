// module/system/actor.mjs - actor-level rolls and resource updates

import { debugLog } from "../settings.mjs";

/**
 * Adversary reaction roll. Config mirrors the system's own adversary sheet implementation
 * verbatim (applications/sheets/actors/adversary.mjs #reactionRoll) - adversaries have no
 * traits, so this is a bare D20 roll tagged actionType 'reaction', not a rollTrait() call.
 */
export async function rollReaction(actor, event) {
  if (!actor) return;

  debugLog("Rolling reaction for:", actor.name);

  try {
    const config = {
      event,
      title: `${game.i18n.localize("DAGGERHEART.GENERAL.reactionRoll")}: ${actor.name}`,
      headerTitle: game.i18n.localize("DAGGERHEART.GENERAL.reactionRoll"),
      roll: { type: "trait" },
      actionType: "reaction",
      hasRoll: true
    };

    await actor.diceRoll(config);
    debugLog("Reaction roll completed successfully");
  } catch (err) {
    console.error("[GM HUD] Reaction roll failed", err);
    ui.notifications?.error("Reaction roll failed (see console)");
  }
}

/** Clamp-adjust a numeric actor field by delta, writing only when the value actually changes. */
export async function adjustResource(actor, path, delta, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const current = Number(foundry.utils.getProperty(actor, path) ?? 0);
  const next = Math.min(max, Math.max(min, current + delta));
  if (next === current) return;

  const update = {};
  foundry.utils.setProperty(update, path, next);
  await actor.update(update);

  debugLog("Resource adjusted:", path, "from", current, "to", next);
}
