// module/system/attack.mjs - the adversary's built-in attack, routed entirely through the real action API

import { debugLog } from "../settings.mjs";

/**
 * Fire the adversary's built-in attack through the real action API. This is the only
 * system-sanctioned entry point for this action - there is no separate "damage only" call,
 * so both the attack and damage buttons in the HUD call this same function. The roll, damage,
 * bonuses and chat card all come from the system's own action workflow, not from the HUD.
 */
export async function rollAttack(actor, event) {
  const attack = actor?.system?.attack;
  if (!attack) {
    ui.notifications?.warn("No attack configured for this adversary");
    return;
  }

  debugLog("Rolling attack:", attack.name);

  try {
    return await attack.use(event);
  } catch (err) {
    console.error("[GM HUD] Attack roll failed", err);
    ui.notifications?.error("Attack roll failed (see console)");
  }
}
