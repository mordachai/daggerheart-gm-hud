// module/constants.mjs - single source of module-wide identifiers

export const MODULE_ID = "daggerheart-gm-hud";

export const TEMPLATE_PATHS = [
  `modules/${MODULE_ID}/templates/hud-adversary.hbs`,
  `modules/${MODULE_ID}/templates/hud-npc.hbs`,
  `modules/${MODULE_ID}/templates/partials/feature-row.hbs`,
  `modules/${MODULE_ID}/templates/partials/gm-notes.hbs`
];

/** HUD kinds, keyed by Daggerheart actor type. */
export const HUD_KIND_IDS = {
  adversary: "adversary",
  npc: "npc"
};

export const FLAGS = {
  hudPosition: "hudPosition",
  featureFilter: "featureFilter",
  positionLocked: "positionLocked",
  utilityBelt: "utilityBelt"
};
