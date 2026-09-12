// module/apps/dgm-adversary-hud.mjs - GM Adversary HUD Application V2 (class shell only)

import { debugLog, applyThemeToElement } from "../settings.mjs";
import { buildContext } from "../hud/context/index.mjs";
import { attachHudEvents } from "../hud/events.mjs";
import { restorePosition, enableDragging } from "../hud/position.mjs";
import { updateAllRangeButtonStates } from "../hud/range-templates.mjs";
import { attachStatusMenu } from "../hud/status-menu.mjs";
import { attachBeltEvents } from "../hud/belt.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class DaggerheartGMHUD extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "daggerheart-gm-hud",
    window: { title: "Daggerheart GM HUD", positioned: false, resizable: false },
    position: { width: "auto", height: "auto" },
    classes: ["daggerheart-gm-hud", "app"]
  };

  static PARTS = {
    body: { template: "modules/daggerheart-gm-hud/templates/hud-adversary.hbs" }
  };

  constructor({ actor, token } = {}, options = {}) {
    super(options);
    this.actor = actor ?? null;
    this.token = token ?? null;
    this._isDragging = false;
  }

  async _prepareContext(_options) {
    return buildContext(this);
  }

  async _onRender() {
    const root = this.element;
    if (!root) return;

    debugLog("GM HUD rendering");

    applyThemeToElement(root);
    await restorePosition(this);
    attachHudEvents(this);
    attachStatusMenu(this);
    attachBeltEvents(this);
    enableDragging(this);
    updateAllRangeButtonStates(this);

    debugLog("GM HUD render complete");
  }

  async close(opts) {
    debugLog("Closing GM HUD");
    if (this._onResize) {
      window.removeEventListener("resize", this._onResize);
      this._onResize = null;
      this._resizeHandlerBound = false;
    }
    return super.close(opts);
  }
}
