// module/hud/context/index.mjs - merges the collectors into _prepareContext's shape

import { debugLog } from "../../settings.mjs";
import { collectIdentity } from "./identity.mjs";
import { collectResources } from "./resources.mjs";
import { collectAttack } from "./attack.mjs";
import { collectFeatures } from "./features.mjs";
import { collectFear } from "./fear.mjs";
import { collectConditions } from "./conditions.mjs";
import { collectUtilityBelt } from "./utility-belt.mjs";

const EMPTY_CONTEXT = {
  adversaryName: "No Actor",
  portrait: "icons/svg/mystery-man.svg",
  tier: 0,
  systemType: "Unknown",
  difficulty: 0,
  hp: { value: 0, max: 0 },
  stress: { value: 0, max: 0 },
  primaryAttack: null,
  motivesAndTactics: "",
  experiences: [],
  features: [],
  fear: 0,
  maxFear: 0,
  availableConditions: [],
  showGenericStatusSection: false
};

export async function buildContext(app) {
  debugLog("Preparing context for actor:", app.actor?.name);

  if (!app.actor) return { ...EMPTY_CONTEXT, ...collectFear(), utilityBelt: { slots: [], slotCount: 0 } };

  const { features } = await collectFeatures(app);

  return {
    ...collectIdentity(app),
    ...collectResources(app),
    ...collectAttack(app),
    features,
    ...collectUtilityBelt(app, features),
    ...collectFear(),
    ...collectConditions(app)
  };
}
