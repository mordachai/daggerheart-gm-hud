// module/apps/dgm-npc-hud.mjs - GM NPC HUD Application V2. Same wiring as the adversary HUD
// (theme, position, events, status menu, belt, drag); only the template and context differ.

import { DaggerheartGMHUD } from "./dgm-adversary-hud.mjs";
import { buildNpcContext } from "../hud/context/npc.mjs";

export class DaggerheartGMNpcHUD extends DaggerheartGMHUD {
  static PARTS = {
    body: { template: "modules/daggerheart-gm-hud/templates/hud-npc.hbs" }
  };

  async _prepareContext(_options) {
    return buildNpcContext(this);
  }
}
