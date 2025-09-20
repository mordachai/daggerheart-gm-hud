// module/apps/dgm-adversary-hud.mjs - GM Adversary HUD Application V2

import { getSetting, SETTINGS, debugLog, applyThemeToElement } from "../settings.mjs";
import { sendItemToChat } from "../helpers/chat-utils.mjs";
import { enrichItemDescription, toHudInlineButtons } from "../helpers/inline-rolls.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Set panel open direction (adapted from player HUD)
 */
function setGMPanelOpenDirection(panel) {
  if (!panel) return;

  // Get the ENTIRE HUD container bounds, not just the tabwrap
  const hudContainer = panel.closest(".dgm-container") || panel.closest(".dgm-hud") || panel.parentElement;
  const rect = hudContainer.getBoundingClientRect();

  // Calculate space from the HUD edges to viewport edges
  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;

  // Estimate needed height: content's natural height (improved)
  const contentHeight = panel.scrollHeight || 320;
  const minRoom = 220;     // prevent jitter
  const maxContentHeight = Math.min(window.innerHeight * 0.7, 500);
  const need = Math.max(minRoom, Math.min(contentHeight, maxContentHeight));

  // Choose direction based on space outside the HUD
  let dir;
  if (spaceBelow >= need) dir = "down";
  else if (spaceAbove >= need) dir = "up";
  else dir = (spaceBelow >= spaceAbove) ? "down" : "up";

  // Apply direction and max height
  panel.setAttribute("data-open-dir", dir);
  
  // Calculate max height with proper margins from viewport edges
  const margin = 12;
  const maxH = (dir === "down" ? 
    Math.max(180, spaceBelow - margin) : 
    Math.max(180, spaceAbove - margin)
  );
  const finalMaxHeight = Math.min(maxH, maxContentHeight);
  
  panel.style.setProperty("--dgm-panel-maxh", `${finalMaxHeight}px`);
  panel.style.setProperty("--dgm-panel-gap", "8px");

  debugLog(`Panel direction set to "${dir}", max height: ${finalMaxHeight}px (space above: ${spaceAbove}, below: ${spaceBelow})`);
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
    window: { title: "Daggerheart GM HUD", positioned: false, resizable: false }, // Set to false
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
    this._isDragging = false;
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

  async _rollDamage() {
    const actor = this.actor;
    if (!actor) return;

    const attackData = actor.system?.attack;
    if (!attackData?.damage) {
      ui.notifications?.warn("No damage configured for this attack");
      return;
    }

    debugLog("Opening damage dialog for:", attackData.name);

    try {
      // Use the Daggerheart system's DamageDialog
      const DamageDialog = CONFIG.DAGGERHEART.dialogs.DamageDialog;
      
      if (DamageDialog) {
        // Create and render the damage dialog
        const dialog = new DamageDialog({
          damage: attackData.damage,
          actor: actor,
          title: `${attackData.name} - Damage Roll`
        });
        
        await dialog.render(true);
      } else {
        // Fallback if dialog not available
        ui.notifications?.warn("Damage dialog not available");
      }
      
    } catch (err) {
      console.error("[GM HUD] Damage dialog failed", err);
      ui.notifications?.error("Damage dialog failed (see console)");
    }
  }

  async _createRangeTemplate(range) {
    if (!canvas?.ready || !canvas.scene) return;

    const squaresByRange = {
      melee: 1,       // skipped
      veryclose: 3,
      close: 6,
      far: 12,
      veryfar: 13     // skipped
    };

    const r = String(range ?? "").toLowerCase().trim();
    const squares = squaresByRange[r];
    if (!squares || r === "melee" || r === "veryfar") return;

    // choose a source token (this.token preferred; else first controlled)
    const tok = this.token ?? canvas.tokens.controlled[0];
    if (!tok) return;

    // scene grid metadata
    const unitsPerSquare = canvas.scene.grid.distance ?? 5;   // e.g., 5 ft per square
    const distanceUnits  = squares * unitsPerSquare;          // convert squares -> scene units

    // center position in scene pixels
    const center = tok.center ?? {
      x: (tok.document?.x ?? tok.x) + ((tok.document?.width ?? tok.w ?? 1) * canvas.grid.size) / 2,
      y: (tok.document?.y ?? tok.y) + ((tok.document?.height ?? tok.h ?? 1) * canvas.grid.size) / 2
    };

    const data = {
      t: "circle",
      x: center.x,
      y: center.y,
      distance: distanceUnits,           // <-- scene distance units
      direction: 0,
      angle: 0,
      width: 0,
      elevation: tok.document?.elevation ?? tok.elevation ?? 0,
      borderColor: "#FF6B35",
      fillColor: game.user.color,        // keep solid 6-digit hex
      texture: "",
      hidden: false,
      flags: {
        "daggerheart-gm-hud": {
          range,
          squares,
          unitsPerSquare,
          distanceUnits,
          actorId: this.actor?.id,
          tokenId: tok.id ?? tok.document?.id,
          createdAt: Date.now()
        }
      },
      author: game.user.id               // v13 field name
    };

    const [doc] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [data]);
    return canvas.templates.get(doc?.id ?? "");
  }

  _buildDamageFormula(damageValue) {
    const dice = damageValue.dice || "d6";
    const multiplier = damageValue.flatMultiplier || 1;
    const bonus = damageValue.bonus || 0;
    
    let formula = multiplier > 1 ? `${multiplier}${dice}` : dice;
    if (bonus > 0) formula += `+${bonus}`;
    else if (bonus < 0) formula += `${bonus}`;
    
    return formula;
  }

  async _rollReaction() {
      const actor = this.actor;
      if (!actor) return;

      debugLog("Rolling reaction for:", actor.name);

      try {
          // Find the actor's sheet
          const sheet = actor.sheet;
          if (sheet && sheet.rendered) {
              // Try to trigger the same method the button uses
              const fakeEvent = new Event('click');
              await sheet.constructor.reactionRoll.call(sheet, fakeEvent);
          } else {
              // Fallback to direct method call with event simulation
              const fakeEvent = { 
                  preventDefault: () => {},
                  stopPropagation: () => {},
                  target: { dataset: {} }
              };
              
              const config = {
                  event: fakeEvent, // Adding the event parameter
                  title: `Reaction Roll: ${actor.name}`,
                  headerTitle: 'Adversary Reaction Roll',
                  roll: {
                      type: 'reaction'
                  },
                  type: 'trait',
                  hasRoll: true,
                  data: actor.getRollData()
              };

              await actor.diceRoll(config);
          }
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

      // Features toggle - UPDATED with panel direction calculation
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

      // Damage roll
      const damageBtn = ev.target.closest("[data-action='roll-damage']");
      if (damageBtn) {
        stop(ev);
        await this._rollDamage();
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

      // Range template creation
      const rangeDetails = ev.target.closest("[data-action='create-range-template']");
      if (rangeDetails) {
        stop(ev);
        const range = rangeDetails.dataset.range || rangeDetails.textContent?.trim();
        if (range) await this._createRangeTemplate(range);
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

      // Inline roll buttons
      const inlineRoll = ev.target.closest("[data-action='inline-roll']");
      if (inlineRoll) {
        stop(ev);
        const formula = inlineRoll.dataset.formula;
        if (formula) {
          const roll = new Roll(formula, actor.getRollData());
          roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
        }
        return;
      }

      // Inline duality roll buttons  
      const inlineDuality = ev.target.closest("[data-action='inline-duality']");
      if (inlineDuality) {
        stop(ev);
        const params = inlineDuality.dataset.params;
        if (params) {
          ui.chat?.processMessage?.(`/dr ${params}`);
        }
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

    // Double-click to open actor sheet
    rootEl.addEventListener("dblclick", async (ev) => {
      const actor = this.actor;
      if (!actor) return;

      // Check if double-click was on the portrait or core area
      const portrait = ev.target.closest(".dgm-portrait, .dgm-core");
      if (portrait) {
        ev.preventDefault();
        ev.stopPropagation();
        
        debugLog("Double-click detected, opening actor sheet for:", actor.name);
        actor.sheet?.render(true, { focus: true });
        return;
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
    
    debugLog("Sending feature to chat:", item.name);
    
    try {
      await sendItemToChat(item, this.actor);
    } catch (err) {
      console.error("[GM HUD] Send to chat failed", err);
      ui.notifications?.error("Failed to send to chat");
    }
  }

  async _prepareContext(_options) {
    const actor = this.actor ?? null;
    
    debugLog("Preparing context for actor:", actor?.name);

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
    
    // Portrait priority: token -> actor -> prototype -> default
    let portrait = "icons/svg/mystery-man.svg";
    if (this.token?.texture?.src) portrait = this.token.texture.src;
    else if (actor.img?.trim()) portrait = actor.img;
    else if (actor.prototypeToken?.texture?.src) portrait = actor.prototypeToken.texture.src;

    const tier = Number(sys.tier ?? 1);
    const difficulty = Number(sys.difficulty ?? 10);
    const systemTypeRaw = String(sys.type ?? "").toLowerCase();
    const systemType = {
      raw: systemTypeRaw,
      label: systemTypeRaw ? game.i18n.localize(`DAGGERHEART.CONFIG.AdversaryType.${systemTypeRaw}.label`) : "",
      description: systemTypeRaw ? game.i18n.localize(`DAGGERHEART.CONFIG.AdversaryType.${systemTypeRaw}.description`) : ""
    };

    // Resources
    const hp = {
      value: Number(sys.resources?.hitPoints?.value ?? 0),
      max: Number(sys.resources?.hitPoints?.max ?? 0)
    };
    
    const stress = {
      value: Number(sys.resources?.stress?.value ?? 0),
      max: Number(sys.resources?.stress?.max ?? 0)
    };

    // Primary attack - with damage type detection
    let primaryAttack = null;
    if (sys.attack) {
      // Extract damage type from the first damage part
      let damageType = null;
      let damageTypeIcon = null;
      
      if (sys.attack.damage?.parts?.length > 0) {
        const firstPart = sys.attack.damage.parts[0];
        if (firstPart.type && firstPart.type.size > 0) {
          // Extract first value from Set
          damageType = [...firstPart.type][0].toLowerCase();
          
          // Map damage types to icons
          switch(damageType) {
            case 'physical':
              damageTypeIcon = 'fa-solid fa-hand-fist';
              break;
            case 'magical':
            case 'magic':
              damageTypeIcon = 'fa-solid fa-wand-magic-sparkles';
              break;
            default:
              damageTypeIcon = null;
          }
        }
      }

      primaryAttack = {
        id: sys.attack._id || "primary",
        name: sys.attack.name || "Attack",
        img: sys.attack.img || "icons/svg/sword.svg",
        bonus: Number(sys.attack.roll?.bonus ?? 0),
        range: sys.attack.range || "close",
        damage: sys.attack.damage,
        damageType: damageType,
        damageTypeIcon: damageTypeIcon,
        damageTypeName: damageType ? game.i18n.localize(`DAGGERHEART.CONFIG.DamageType.${damageType.toLowerCase()}.name`) : ""

      };
    }

    // Text content
    const motivesAndTactics = sys.motivesAndTactics || "";
    const description = sys.description || "";

    // Experiences
    const experiences = Object.entries(sys.experiences || {}).map(([id, exp]) => ({
      id,
      name: exp.name || "Unnamed Experience",
      value: Number(exp.value ?? 0),
      description: exp.description || ""
    }));

    // Damage Thresholds
    const thresholds = {
      major: Number(sys.damageThresholds?.major ?? 0),
      severe: Number(sys.damageThresholds?.severe ?? 0)
    };

    // Features section:
    const featureItems = actor.items.filter(item => item.type === "feature");
    const features = await Promise.all(
      featureItems.map(async (item) => {
        // Step 1: Enrich with Foundry (handles @UUID, @Template, etc.)
        const enrichedHTML = await enrichItemDescription(item);
        
        // Step 2: Convert inline rolls to clickable buttons
        const finalHTML = toHudInlineButtons(enrichedHTML, { enableDuality: true });
        
        // FIX: Add hasActions boolean to context
        const hasActions = featureHasActions(item);
        
        return {
          id: item.id,
          name: item.name || "Unnamed Feature",
          img: item.img || "icons/svg/aura.svg", 
          description: finalHTML,
          hasActions: hasActions, // FIX: Add this boolean
          system: item.system,
          _item: item
        };
      })
    );

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
      if (savedPos && savedPos.left !== undefined && savedPos.top !== undefined) {
        root.style.position = "fixed"; // Use fixed instead of absolute
        root.style.left = `${Math.max(0, Math.min(savedPos.left, window.innerWidth - 200))}px`;
        root.style.top = `${Math.max(0, Math.min(savedPos.top, window.innerHeight - 200))}px`;
        root.style.bottom = "auto";
        root.style.transform = "none";
        debugLog("Restored HUD position:", savedPos);
      } else {
        // Default positioning (center-bottom)
        root.style.position = "fixed";
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

    // Add window resize handler for panel repositioning
    if (!this._resizeHandlerBound) {
      this._onResize = () => {
        if (this._isDragging) return;

        // If features panel is open, recompute direction
        const shell = root.querySelector(".dgm-hud");
        const isOpen = shell?.getAttribute("data-open") === "features";
        if (isOpen) {
          const panel = root.querySelector(".dgm-panel--features");
          if (panel) {
            setGMPanelOpenDirection(panel);
          }
        }
      };

      window.addEventListener("resize", this._onResize);
      this._resizeHandlerBound = true;
    }

    const onMove = (ev) => {
      if (!isDragging) return;
      
      this._isDragging = true; // FIX: Set to true during drag
      
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      
      const newLeft = Math.max(0, Math.min(startLeft + dx, window.innerWidth - 200));
      const newTop = Math.max(0, Math.min(startTop + dy, window.innerHeight - 200));
      
      root.style.left = `${newLeft}px`;
      root.style.top = `${newTop}px`;
      root.style.bottom = "auto";
      root.style.transform = "none";
      
    };

    const onUp = async () => {
      if (!isDragging) return;
      isDragging = false;
      
      handle.style.cursor = "grab";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);

      this._isDragging = false; // FIX: Set to false after drag ends

      // Save position
      try {
        const rect = root.getBoundingClientRect();
        const pos = {
          left: Math.round(rect.left),
          top: Math.round(rect.top)
        };
        await game.user.setFlag("daggerheart-gm-hud", "hudPosition", pos);
        debugLog("Saved HUD position:", pos);
      } catch (err) {
        debugLog("Failed to save position:", err);
      }

      // FIX: Recompute panel direction AFTER drag ends
      requestAnimationFrame(() => {
        const shell = root.querySelector(".dgm-hud");
        const isOpen = shell?.getAttribute("data-open") === "features";
        if (isOpen) {
          const panel = root.querySelector(".dgm-panel--features");
          if (panel) {
            setGMPanelOpenDirection(panel);
          }
        }
      });
    };

    const onDown = (ev) => {
      if (ev.button !== 0) return;
      
      // Don't drag if clicking on interactive elements
      if (ev.target.closest(".dgm-roll, .dgm-count .value, .dgm-features-toggle")) return;
      
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
    if (this._onResize) {
      window.removeEventListener("resize", this._onResize);
      this._onResize = null;
      this._resizeHandlerBound = false;
    }
    return super.close(opts);
  }
}