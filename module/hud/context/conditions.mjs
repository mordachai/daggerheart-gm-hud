// module/hud/context/conditions.mjs - available-conditions grid for the portrait context menu

import { listConditions } from "../../system/conditions.mjs";

export function collectConditions(app) {
  if (!app.actor) return { availableConditions: [], showGenericStatusSection: false };
  return listConditions(app.actor);
}
