// module/apps/dgm-adversary-hud.mjs - GM Adversary HUD Application V2

import { getSetting, SETTINGS, debugLog, applyThemeToElement } from "../settings.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Set panel open direction (adapted from player HUD)
 */
function setGMPanelOpenDirection(panel) {
  if (!panel) return;

  const wrap = panel.closest(".dgm-tabwrap") || panel.parentElement;
  const rect = wrap.getBoundingClientRect();

  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;

  const contentHeight = panel.scrollHeight || 320;
  const minRoom = 220;
  const need = Math.max(minRoom, Math.min(contentHeight, Math.min(window.innerHeight * 0.7, 500)));

  let dir;
  if (spaceBelow >= need) dir = "down";
  else if (spaceAbove >= need) dir = "up";
  else dir = (spaceBelow >= spaceAbove) ? "down" : "up";

  panel.setAttribute("data-open-dir", dir);
  
  const maxH = (dir === "down" ? Math.max(180, spaceBelow - 12) : Math.max(180, spaceAbove - 12));
  const maxHeight = Math.min(maxH, window.innerHeight * 0.7);
  
  panel.style.setProperty("--dgm-panel-maxh", `${maxHeight}px`);
  panel.style.setProperty("--dgm-panel-gap", "8px");
}

/**
 * Check if feature has actions (works with Foundry Collections)
 */
function featureHasActions(item) {
  const actions = item.system?.actions;
  if (!actions) return false;
  
  if (typeof actions.size === 'number') {
    return actions.size > 0;
  }
  
  if (typeof actions === 'object') {
    return Object.keys(actions).length > 0;
  }
  
  return false;
}

export class DaggerheartGMHUD extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "daggerheart-gm-hud",
    window: { title: "Daggerheart GM HUD", positioned: true, resizable: false },
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
    this._lastPosition = null;
  }

  async _executeFeature(item, actionPath = "use") {
    const Action = CONFIG?.DAGGERHEART?.Action ?? CONFIG?.DH?.Action;
    
    debugLog("Executing feature:", item.name, "with action path:", actionPath);
    
    try {
      if (typeof item.rollAction === "function") return await item.rollAction(actionPath);
      if (typeof item.use === "function") return await item.use({ action: actionPath });
      if (Action?.execute) return await Action.execute({ source: item, actionPath });
      
      // Fallback to opening item sheet
      item.sheet?.render(true, { focus: true });
    } catch (err) {
      console.error("[GM HUD] Feature execution failed", err);
      ui.notifications?.error("Feature execution failed (see console)");
    }
  }

  async _rollAttack() {
    const actor = this.actor;
    if (!actor) return;

    const attack = actor.system?.attack;
    if (!attack) {
      ui.notifications?.warn("No attack configured for this adversary");
      return;
    }

    debugLog("Rolling attack:", attack.name);

    try {
      const Action = CONFIG?.DAGGERHEART?.Action ?? CONFIG?.DH?.Action;
      
      if (typeof attack.rollAction === "function") {
        return await attack.rollAction("attack");
      }
      if (typeof attack.use === "function") {
        return await attack.use({ action: "attack" });
      }
      if (Action?.execute) {
        return await Action.execute({ source: attack, actionPath: "attack" });
      }
      
      // Fallback notification
      ui.notifications?.info("Open the actor sheet to use this attack");
    } catch (err) {
      console.error("[GM HUD] Attack roll failed", err);
      ui.notifications?.error("Attack roll failed (see console)");
    }
  }

  async _rollReaction() {
    const actor = this.actor;
    if (!actor) return;

    debugLog("Rolling reaction for:", actor.name);

    try {
      // Use the system's duality roll command
      ui.chat?.processMessage?.(`/dr reaction=true`);
    } catch (err) {
      console.error("[GM HUD] Reaction roll failed", err);
      ui.notifications?.error("Reaction roll failed (see console)");
    }
  }

  _bindDelegatedEvents() {
    const rootEl = this.element;
    if (!rootEl || this._delegatedBound) return;

    const stop = (ev) => { ev.preventDefault(); ev.stopPropagation(); };

    // Main click handler
    rootEl.addEventListener("click", async (ev) => {
      const actor = this.actor;
      if (!actor) return;

      // Features toggle
      const featuresToggle = ev.target.closest("[data-action='toggle-features']");
      if (featuresToggle) {
        stop(ev);
        const shell = rootEl.querySelector(".dgm-hud");
        const isOpen = shell?.getAttribute("data-open") === "features";
        const newState = isOpen ? "" : "features";
        shell?.setAttribute("data-open", newState);
        featuresToggle.setAttribute("aria-expanded", String(!isOpen));
        
        if (!isOpen) {
          // Panel is opening - set direction
          const panel = rootEl.querySelector(".dgm-panel--features");
          if (panel) {
            requestAnimationFrame(() => {
              setGMPanelOpenDirection(panel);
            });
          }
        }
        return;
      }

      // Attack roll
      const attackBtn = ev.target.closest("[data-action='roll-attack']");
      if (attackBtn) {
        stop(ev);
        await this._rollAttack();
        return;
      }

      // Reaction roll
      const reactionBtn = ev.target.closest("[data-action='roll-reaction']");
      if (reactionBtn) {
        stop(ev);
        await this._rollReaction();
        return;
      }

      // Feature execution
      const featureExec = ev.target.closest("[data-action='feature-exec']");
      if (featureExec) {
        stop(ev);
        const item = actor.items.get(featureExec.dataset.featureId);
        const actionPath = featureExec.dataset.actionPath || "use";
        if (item) await this._executeFeature(item, actionPath);
        return;
      }

      // Feature to chat
      const featureChat = ev.target.closest("[data-action='feature-to-chat']");
      if (featureChat) {
        stop(ev);
        const item = actor.items.get(featureChat.dataset.featureId);
        if (item) await this._sendFeatureToChat(item);
        return;
      }

    }, true);

    // Right-click for resource adjustments (HP/Stress)
    rootEl.addEventListener("contextmenu", async (ev) => {
      const actor = this.actor;
      if (!actor) return;

      const valueEl = ev.target.closest(".dgm-count .value");
      if (valueEl) {
        stop(ev);
        
        const bind = valueEl.dataset.bind;
        if (bind === "hp") {
          const max = Number(actor.system?.resources?.hitPoints?.max ?? 0);
          await this._adjustResource(actor, "system.resources.hitPoints.value", +1, { min: 0, max });
          return;
        }
        if (bind === "stress") {
          const max = Number(actor.system?.resources?.stress?.max ?? 0);
          await this._adjustResource(actor, "system.resources.stress.value", +1, { min: 0, max });
          return;
        }
      }
    }, true);

    // Left-click for resource adjustments (HP/Stress)
    rootEl.addEventListener("click", async (ev) => {
      const actor = this.actor;
      if (!actor) return;

      const valueEl = ev.target.closest(".dgm-count .value");
      if (valueEl) {
        stop(ev);
        
        const bind = valueEl.dataset.bind;
        if (bind === "hp") {
          const max = Number(actor.system?.resources?.hitPoints?.max ?? 0);
          await this._adjustResource(actor, "system.resources.hitPoints.value", -1, { min: 0, max });
          return;
        }
        if (bind === "stress") {
          const max = Number(actor.system?.resources?.stress?.max ?? 0);
          await this._adjustResource(actor, "system.resources.stress.value", -1, { min: 0, max });
          return;
        }
      }
    }, true);

    // Close features panel when clicking outside
    const onDocClick = (ev) => {
      if (!rootEl.contains(ev.target)) {
        const shell = rootEl.querySelector(".dgm-hud");
        shell?.setAttribute("data-open", "");
        const toggle = rootEl.querySelector("[data-action='toggle-features']");
        toggle?.setAttribute("aria-expanded", "false");
      }
    };
    document.addEventListener("pointerdown", onDocClick, { capture: true });

    // Close on ESC
    rootEl.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        const shell = rootEl.querySelector(".dgm-hud");
        shell?.setAttribute("data-open", "");
        const toggle = rootEl.querySelector("[data-action='toggle-features']");
        toggle?.setAttribute("aria-expanded", "false");
      }
    });

    this._delegatedBound = true;
  }

  async _adjustResource(actor, path, delta, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
    const current = Number(foundry.utils.getProperty(actor, path) ?? 0);
    const next = Math.min(max, Math.max(min, current + delta));
    if (next === current) return;
    
    const update = {};
    foundry.utils.setProperty(update, path, next);
    await actor.update(update);
    
    debugLog("Resource adjusted:", path, "from", current, "to", next);
  }

  async _sendFeatureToChat(item) {
    if (!item) return;
    
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    
    debugLog("Sending feature to chat:", item.name);
    
    try {
      if (typeof item.displayCard === "function") {
        await item.displayCard({ speaker });
        return;
      }
      
      if (typeof item.toChat === "function") {
        await item.toChat.call(item, { speaker });
        return;
      }
      
      // Fallback
      const content = `<h3>${foundry.utils.escapeHTML(item.name)}</h3>${item.system?.description ?? ""}`;
      await ChatMessage.create({ speaker, content });
    } catch (err) {
      console.error("[GM HUD] Send to chat failed", err);
      ui.notifications?.error("Failed to send to chat");
    }
  }

  async _prepareContext(_options) {
    const actor = this.actor ?? null;
    
    debugLog("Preparing context for actor:", actor?.name);

    // Fallbacks for missing actor
    if (!actor) {
      return {
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
        features: []
      };
    }

    const sys = actor.system ?? {};
    
    // Basic info
    const adversaryName = actor.name ?? "Unnamed Adversary";
    
    // Use token image if available, fallback to actor image
    let portrait = "icons/svg/mystery-man.svg";
    if (this.token?.texture?.src) {
      portrait = this.token.texture.src;
    } else if (actor.img && actor.img.trim()) {
      portrait = actor.img;
    } else if (actor.prototypeToken?.texture?.src) {
      portrait = actor.prototypeToken.texture.src;
    }
    const tier = Number(sys.tier ?? 1);
    const systemType = String(sys.type ?? "").toLowerCase();
    const difficulty = Number(sys.difficulty ?? 10);

    // Resources (note: adversaries use isReversed: true)
    const hp = {
      value: Number(sys.resources?.hitPoints?.value ?? 0),
      max: Number(sys.resources?.hitPoints?.max ?? 0)
    };
    
    const stress = {
      value: Number(sys.resources?.stress?.value ?? 0),
      max: Number(sys.resources?.stress?.max ?? 0)
    };

    // Primary attack
    let primaryAttack = null;
    if (sys.attack) {
      const att = sys.attack;
      primaryAttack = {
        id: att._id || "primary",
        name: att.name || "Attack",
        img: att.img || "icons/svg/sword.svg",
        bonus: Number(att.roll?.bonus ?? 0),
        range: att.range || "close",
        damage: this._formatDamage(att.damage),
        damageType: this._extractDamageTypes(att.damage)
      };
    }

    // Description and Motives & Tactics
    const motivesAndTactics = sys.motivesAndTactics || "";
    const description = sys.description || "";

    // Experiences
    const experiences = [];
    if (sys.experiences) {
      for (const [id, exp] of Object.entries(sys.experiences)) {
        experiences.push({
          id: id,
          name: exp.name || "Unnamed Experience",
          value: Number(exp.value ?? 0),
          description: exp.description || ""
        });
      }
    }

    // Damage Thresholds
    const thresholds = {
      major: Number(sys.damageThresholds?.major ?? 0),
      severe: Number(sys.damageThresholds?.severe ?? 0)
    };

    // Features
    const features = [];
    for (const item of (actor.items ?? [])) {
      if (item.type !== "feature") continue;

      const hasActions = featureHasActions(item);
      
      features.push({
        id: item.id,
        name: item.name || "Unnamed Feature",
        img: item.img || "icons/svg/aura.svg",
        description: item.system?.description || "",
        hasActions: hasActions,
        resourceInfo: this._getFeatureResourceInfo(item),
        actionPath: this._getFeatureActionPath(item)
      });
    }

    debugLog("Context prepared:", {
      adversaryName,
      tier,
      systemType,
      difficulty,
      featuresCount: features.length
    });

    return {
      adversaryName,
      portrait,
      tier,
      description,
      systemType,
      difficulty,
      hp,
      stress,
      primaryAttack,
      motivesAndTactics,
      experiences,
      thresholds,
      features
    };
  }

  _formatDamage(damageData) {
    if (!damageData?.parts?.length) return "—";
    
    const part = damageData.parts[0];
    const value = part.value;
    if (!value) return "—";
    
    const dice = value.dice || "d6";
    const multiplier = value.flatMultiplier || 1;
    const bonus = value.bonus || 0;
    
    let formula = multiplier > 1 ? `${multiplier}${dice}` : dice;
    if (bonus > 0) formula += `+${bonus}`;
    else if (bonus < 0) formula += `${bonus}`;
    
    return formula;
  }

  _extractDamageTypes(damageData) {
    if (!damageData?.parts?.length) return "";
    
    const types = damageData.parts[0].type || [];
    return Array.isArray(types) ? types.join(", ") : String(types);
  }

  _getFeatureResourceInfo(item) {
    const name = item.name || "";
    
    // Look for resource indicators in name like "Relentless (3)"
    const match = name.match(/\((\d+)\)$/);
    if (match) {
      return {
        current: Number(match[1]),
        isLimited: true
      };
    }
    
    return null;
  }

  _getFeatureActionPath(item) {
    const actions = item.system?.actions;
    if (!actions || typeof actions !== "object") return "use";
    
    // Get first action's system path
    const firstAction = Object.values(actions)[0];
    return firstAction?.systemPath || "use";
  }

  async _onRender() {
    const root = this.element;
    if (!root) return;

    debugLog("GM HUD rendering");

    // Apply theme
    applyThemeToElement(root);

    // Restore saved position if available
    await this._restorePosition();

    // Bind events
    this._bindDelegatedEvents();

    // Enable dragging by the core area
    this._enableDragging();

    debugLog("GM HUD render complete");
  }

  async _restorePosition() {
    const root = this.element;
    if (!root) return;

    try {
      const savedPos = await game.user.getFlag("daggerheart-gm-hud", "hudPosition");
      if (savedPos) {
        root.style.position = "absolute";
        root.style.left = `${Math.max(0, savedPos.left)}px`;
        root.style.top = `${Math.max(0, savedPos.top)}px`;
        debugLog("Restored HUD position:", savedPos);
      } else {
        // Default positioning (center-bottom)
        root.style.position = "absolute";
        root.style.bottom = "100px";
        root.style.left = "50%";
        root.style.transform = "translateX(-50%)";
      }
    } catch (err) {
      debugLog("Failed to restore position:", err);
    }
  }

  _enableDragging() {
    const root = this.element;
    const handle = root.querySelector(".dgm-core");
    if (!handle) return;

    let startX, startY, startLeft, startTop, isDragging = false;

    const onMove = (ev) => {
      if (!isDragging) return;
      
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      
      root.style.left = `${startLeft + dx}px`;
      root.style.top = `${startTop + dy}px`;
      root.style.bottom = "auto";
      root.style.transform = "none";
    };

    const onUp = async () => {
      if (!isDragging) return;
      isDragging = false;
      
      handle.style.cursor = "grab";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);

      // Save position
      try {
        const rect = root.getBoundingClientRect();
        const pos = {
          left: Math.max(0, Math.round(rect.left)),
          top: Math.max(0, Math.round(rect.top))
        };
        await game.user.setFlag("daggerheart-gm-hud", "hudPosition", pos);
        debugLog("Saved HUD position:", pos);
      } catch (err) {
        debugLog("Failed to save position:", err);
      }
    };

    const onDown = (ev) => {
      if (ev.button !== 0) return;
      
      // Don't drag if clicking on interactive elements
      if (ev.target.closest(".dgm-roll, .dgm-count .value")) return;
      
      ev.preventDefault();
      isDragging = true;
      
      handle.style.cursor = "grabbing";
      
      const rect = root.getBoundingClientRect();
      startX = ev.clientX;
      startY = ev.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

    handle.addEventListener("pointerdown", onDown);
    handle.style.cursor = "grab";
  }

  async close(opts) {
    debugLog("Closing GM HUD");
    return super.close(opts);
  }
}