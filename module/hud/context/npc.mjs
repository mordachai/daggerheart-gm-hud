// module/hud/context/npc.mjs - context for the NPC HUD (name, difficulty, features, belt, fear, conditions)

import { resolvePortrait } from "./identity.mjs";
import { collectFeatures, groupFeaturesByForm } from "./features.mjs";
import { enrichHudField } from "../../helpers/inline-rolls.mjs";
import { collectFear } from "./fear.mjs";
import { collectConditions } from "./conditions.mjs";
import { collectUtilityBelt } from "./utility-belt.mjs";

const EMPTY_NPC_CONTEXT = {
  npcName: "No Actor",
  portrait: "icons/svg/mystery-man.svg",
  difficulty: null,
  hasDifficulty: false,
  description: "",
  motives: "",
  notes: "",
  hasDetails: false,
  features: [],
  featureGroups: [],
  availableConditions: [],
  showGenericStatusSection: false
};

/** system.difficulty is nullable on NPCs - only a real number counts as "set". */
function readDifficulty(sys) {
  const raw = sys?.difficulty;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function buildNpcContext(app) {
  if (!app.actor) {
    return { ...EMPTY_NPC_CONTEXT, ...collectFear(), utilityBelt: { slots: [], slotCount: 0, canAddSlot: false } };
  }

  const actor = app.actor;
  const sys = actor.system ?? {};
  const { features } = await collectFeatures(app);
  const difficulty = readDifficulty(sys);
  const enrichOptions = { rollData: actor.getRollData?.() ?? {}, relativeTo: actor };
  const [description, motives, notes] = await Promise.all([
    enrichHudField(sys.description, enrichOptions),
    enrichHudField(sys.motives, enrichOptions),
    enrichHudField(sys.notes, enrichOptions)
  ]);

  return {
    npcName: actor.name ?? "Unnamed NPC",
    portrait: resolvePortrait(app),
    difficulty,
    hasDifficulty: difficulty !== null,
    description,
    motives,
    notes,
    hasDetails: !!(description || motives || notes),
    features,
    featureGroups: groupFeaturesByForm(features),
    ...collectUtilityBelt(app, features),
    ...collectFear(),
    ...collectConditions(app)
  };
}
