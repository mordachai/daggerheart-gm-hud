// module/apps/dgm-adversary-hud.mjs - GM Adversary HUD Application V2

import { getSetting, SETTINGS, debugLog, applyThemeToElement } from "../settings.mjs";
import { sendItemToChat } from "../helpers/chat-utils.mjs";
import { enrichItemDescription, toHudInlineButtons } from "../helpers/inline-rolls.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function setGMPanelOpenDirection(panel) {
  if (!panel) {
    debugLog("setGMPanelOpenDirection: No panel provided");
    return;
  }

  debugLog("setGMPanelOpenDirection called for panel:", panel);
  debugLog("Panel display style:", getComputedStyle(panel).display);
  debugLog("Panel visibility:", getComputedStyle(panel).visibility);

  // Get the ENTIRE HUD container bounds, not just the tabwrap
  const hudContainer = panel.closest(".dgm-container") || panel.closest(".dgm-hud") || panel.parentElement;
  
  if (!hudContainer) {
    debugLog("setGMPanelOpenDirection: No HUD container found");
    return;
  }
  
  const rect = hudContainer.getBoundingClientRect();
  debugLog("HUD container rect:", rect);

  // Calculate space from the HUD edges to viewport edges
  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;
  debugLog("Space calculations:", { spaceAbove, spaceBelow, viewportHeight: window.innerHeight });

  // Estimate needed height: content's natural height (improved)
  const contentHeight = panel.scrollHeight || 320;
  const minRoom = 220;     // prevent jitter
  const maxContentHeight = Math.min(window.innerHeight * 0.7, 500);
  const need = Math.max(minRoom, Math.min(contentHeight, maxContentHeight));
  
  debugLog("Height calculations:", { 
    contentHeight, 
    scrollHeight: panel.scrollHeight,
    offsetHeight: panel.offsetHeight,
    clientHeight: panel.clientHeight,
    need 
  });

  // Choose direction based on space outside the HUD
  let dir;
  if (spaceBelow >= need) dir = "down";
  else if (spaceAbove >= need) dir = "up";
  else dir = (spaceBelow >= spaceAbove) ? "down" : "up";

  debugLog("Direction logic:", { spaceBelow, spaceAbove, need, direction: dir });

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
  debugLog("Panel data-open-dir attribute:", panel.getAttribute("data-open-dir"));
  debugLog("Panel CSS custom properties:", {
    maxHeight: panel.style.getPropertyValue("--dgm-panel-maxh"),
    gap: panel.style.getPropertyValue("--dgm-panel-gap")
  });
}

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
    this._showFill = false;
  }
  
  static _filterState = "none";

  get showFill() {
    // Get from user flag, default to false
    return game.user.getFlag("daggerheart-gm-hud", "showFill") ?? false;
  }

  async setShowFill(value) {
    // Save to user flag
    await game.user.setFlag("daggerheart-gm-hud", "showFill", value);
    this._showFill = value; // Keep local copy for immediate access
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
      // Use the forum-suggested approach with localization
      const config = {
        event: { 
          preventDefault: () => {},
          stopPropagation: () => {},
          target: { dataset: {} }
        },
        title: `${game.i18n.localize("DAGGERHEART.GENERAL.reactionRoll")}: ${actor.name}`,
        headerTitle: game.i18n.localize("DAGGERHEART.GENERAL.reactionRoll"),
        roll: {
          type: 'trait'  // Changed from 'reaction' to 'trait'
        },
        actionType: 'reaction',  // Added this key property
        hasRoll: true,
        data: actor.getRollData()
      };

      // Call the actor's diceRoll method with the new config
      await actor.diceRoll(config);
      
      debugLog("Reaction roll completed successfully");
      
    } catch (err) {
      console.error("[GM HUD] Reaction roll failed", err);
      ui.notifications?.error("Reaction roll failed (see console)");
    }
  }

  async _rollDamage() {
    const actor = this.actor;
    if (!actor) return;

    const atk = actor.system?.attack;
    const parts = atk?.damage?.parts;
    if (!Array.isArray(parts) || parts.length === 0) return;

    // Build a Foundry formula like "4d12+15 + 2d6+1"
    const formula = parts
      .map(p => {
        const v = p?.value ?? {};
        const n   = Math.max(1, Number(v.flatMultiplier ?? 1));     // number of dice
        const die = normalizeDie(v.dice);                            // "d12" -> "d12"
        const bonus = numberish(v.bonus);
        const seg = `${n}${die}`;
        return bonus != null && bonus !== 0 ? `${seg}${bonus >= 0 ? "+" : ""}${bonus}` : seg;
      })
      .filter(Boolean)
      .join(" + ");
    if (!formula) return;

    const roll = await (new Roll(formula, actor.getRollData?.() ?? {})).evaluate({ async: true });
    if (game.dice3d?.isEnabled?.()) {
    // Show 3D dice using current roll mode, synced for all players
    const rollMode = game.settings.get("core", "rollMode");
    await game.dice3d.showForRoll(roll, game.user, true, rollMode);
  }
    const total = roll.total;

    // Build dice faces markup with system classes
    const diceFacesHTML = roll.dice.map(die => {
      const faceClass = `dice d${die.faces}`; // e.g. "dice d12"
      const faces = die.results.map(r => {
        return `
          <div class="roll-die">
            <div class="${faceClass}">${r.result}</div>
          </div>`;
      }).join("");
      return `<div class="roll-dice">${faces}</div>`;
    }).join("");

    // Compute modifier (sum of all flat bonuses across parts)
    const diceTotal = roll.dice.reduce((s, d) => s + (d.total ?? 0), 0);
    const mod = total - diceTotal;
    const modInlineHTML = mod
      ? `<span class="roll-mod-inline" style="font-family:'Cinzel',serif; font-size:20px; font-weight:700;">&nbsp;${mod > 0 ? "+" : "–"}&nbsp;${Math.abs(mod)}</span>`
      : "";

    const attackName = atk.name ?? "Attack";
    const headerLine = `${attackName}`;
    const img = atk.img || "icons/svg/sword.svg";

    // --- damage type derivation and FA icon mapping (local to _rollDamage) ---
    let dmgTypeKey = atk?.damageType;
    if (!dmgTypeKey) {
      const tset = atk?.damage?.parts?.[0]?.type;
      if (tset && tset.size) dmgTypeKey = [...tset][0]; // first from Set
    }
    dmgTypeKey = (dmgTypeKey ?? "").toString().toLowerCase();

    const dmgTypeIcon = ({
      physical: "fa-solid fa-hand-fist",
      magical : "fa-solid fa-wand-magic-sparkles",
    })[dmgTypeKey] || "";

    const dmgTypeName = dmgTypeKey
      ? game.i18n.localize(`DAGGERHEART.CONFIG.DamageType.${dmgTypeKey}.name`)
      : "";

    // --- SYSTEM-SHAPED HTML ---
    const content = `
    <div class="message-content">
      <div class="chat-roll">

        <div class="roll-part-header"><span>${headerLine}</span></div>

        <!-- Optional image banner like your card -->
        <div class="roll-part roll-section">
          <div class="roll-part-content">
            <img src="${img}" alt="${attackName}" style="width:100%;height:110px;object-fit:cover;display:block;margin:6px 0;"/>
          </div>
        </div>

        <div class="dice-roll" data-action="expandRoll">
          <div class="roll-part-header"><div><span>Formula</span></div></div>
          <div class="roll-part-content dice-result">
            <div class="dice-tooltip">
              <div class="wrapper">
                <div class="roll-dice-block">
                  <div class="dgm-dice-results" style="display:flex; justify-content:center; align-items:center;">${diceFacesHTML}${modInlineHTML}</div>
                </div>
              </div>
              <div class="roll-formula">${formula}</div>
            </div>
          </div>
        </div>

        <div class="roll-part-header"><div></div></div>

        <!-- Total result  -->
        <div class="roll-part roll-section">
          <div class="roll-part-content">
            <div class="roll-result-container">
              <span class="roll-result-value">${total}</span>
              <span class="roll-result-desc">
                ${dmgTypeIcon ? `<i class="${dmgTypeIcon}" style="margin:0 8px;" title="${dmgTypeName}"></i>` : ""}
              </span>
          </div>
        </div>

        <div class="roll-part-header"><div></div></div>
      </div>
    </div>`;


    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content
    });

    // --- helpers ---
    function normalizeDie(d) {
      const s = String(d ?? "").trim().toLowerCase().replace(/\s+/g, "");
      const m = s.match(/^d(\d+)$/) || s.match(/^\d*d(\d+)$/) || s.match(/(\d+)$/);
      return m ? `d${m[1]}` : "d6";
    }
    function numberish(v) {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
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

  const tok = this.token ?? canvas.tokens.controlled[0];
  if (!tok) return;

  await this._cleanupExistingTemplates(tok);

  const unitsPerSquare = canvas.scene.grid.distance ?? 5;
  const distanceUnits  = squares * unitsPerSquare;

  const center = tok.center ?? {
    x: (tok.document?.x ?? tok.x) + ((tok.document?.width ?? tok.w ?? 1) * canvas.grid.size) / 2,
    y: (tok.document?.y ?? tok.y) + ((tok.document?.height ?? tok.h ?? 1) * canvas.grid.size) / 2
  };

  const data = {
    t: "circle",
    x: center.x,
    y: center.y,
    distance: distanceUnits,
    direction: 0,
    angle: 0,
    width: 0,
    elevation: tok.document?.elevation ?? tok.elevation ?? 0,
    borderColor: "#FF6B35",
    fillColor: this.showFill ? game.user.color : "#00000000",
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
        createdAt: Date.now(),
        hudInstance: this.id || "default"
      }
    },
    author: game.user.id
  };

  const [doc] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [data]);
  
  return canvas.templates.get(doc?.id ?? "");
}

  async _cleanupExistingTemplates(token) {
    if (!canvas?.scene || !token) return;

    try {
      const tokenId = token.id ?? token.document?.id;
      const actorId = this.actor?.id;
      
      // Find templates created by this HUD for this token/actor
      const templatesToDelete = canvas.scene.templates.filter(template => {
        const flags = template.flags?.["daggerheart-gm-hud"];
        if (!flags) return false;
        
        // Match by token ID or actor ID
        return (flags.tokenId === tokenId) || (flags.actorId === actorId);
      });

      if (templatesToDelete.length > 0) {
        const templateIds = templatesToDelete.map(t => t.id);
        await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", templateIds);
      }
    } catch (err) {
      console.error("[GM HUD] Template cleanup failed:", err);
      ui.notifications?.error("Template cleanup failed (see console)");
    }
  }

  async _cleanupAllModuleTemplates() {
    if (!canvas?.scene) return;

    try {
      const templatesToDelete = canvas.scene.templates.filter(template => {
        return template.flags?.["daggerheart-gm-hud"];
      });

      if (templatesToDelete.length > 0) {
        const templateIds = templatesToDelete.map(t => t.id);
        await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", templateIds);
      }
    } catch (err) {
      console.error("[GM HUD] Full cleanup failed:", err);
      ui.notifications?.error("Template cleanup failed (see console)");
    }
  }

  _hasTemplateForRange(token, range) {
    if (!canvas?.scene || !token) return false;
    
    const tokenId = token.id ?? token.document?.id;
    return canvas.scene.templates.some(template => {
      const flags = template.flags?.["daggerheart-gm-hud"];
      return flags && flags.tokenId === tokenId && flags.range === range;
    });
  }

  async _cleanupRangeTemplate(token, range) {
    if (!canvas?.scene || !token) return;
    
    try {
      const tokenId = token.id ?? token.document?.id;
      const templatesToDelete = canvas.scene.templates.filter(template => {
        const flags = template.flags?.["daggerheart-gm-hud"];
        return flags && flags.tokenId === tokenId && flags.range === range;
      });

      if (templatesToDelete.length > 0) {
        const templateIds = templatesToDelete.map(t => t.id);
        await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", templateIds);
      }
    } catch (err) {
      console.error("[GM HUD] Range template cleanup failed:", err);
      ui.notifications?.error("Range template cleanup failed");
    }
  }

  _updateRangeButtonState(button, range) {
    const token = this.token ?? canvas.tokens.controlled[0];
    if (!token) return;
    
    const hasTemplate = this._hasTemplateForRange(token, range);
    const icon = button.querySelector('i');
    
    // ADD NULL CHECK HERE:
    if (!icon) return;
    
    if (hasTemplate) {
      // Template is active - show "remove" state
      icon.className = 'fa-solid fa-circle-xmark';
      button.classList.add('active');
    } else {
      // Template is inactive - show "create" state  
      icon.className = 'fa-solid fa-bullseye';
      button.classList.remove('active');
    }
  }

  static onUpdateToken(tokenDocument, changes) {
    // Only proceed if position changed
    if (!('x' in changes || 'y' in changes)) return;
    
    try {
      // Find templates for this token
      const tokenId = tokenDocument.id;
      const templatesToUpdate = canvas.scene.templates.filter(template => {
        const flags = template.flags?.["daggerheart-gm-hud"];
        return flags && flags.tokenId === tokenId;
      });

      if (templatesToUpdate.length === 0) return;

      // Calculate new center position
      const token = canvas.tokens.get(tokenId);
      if (!token) return;

      const newCenter = {
        x: (changes.x ?? token.x) + (token.w / 2),
        y: (changes.y ?? token.y) + (token.h / 2)
      };

      // Update template positions
      const updates = templatesToUpdate.map(template => ({
        _id: template.id,
        x: newCenter.x,
        y: newCenter.y
      }));

      canvas.scene.updateEmbeddedDocuments("MeasuredTemplate", updates);
    } catch (err) {
      console.error("[GM HUD] Token update failed:", err);
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

        // Feature filter buttons
        const filterBtn = ev.target.closest(".dgm-filter-btn");
        if (filterBtn) {
          stop(ev);
          const action = filterBtn.dataset.action;
          this._handleFeatureFilter(action);
          return;
        }

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
            const panel = rootEl.querySelector(".dgm-panel--features");
            if (panel) {
              requestAnimationFrame(() => {
                setGMPanelOpenDirection(panel);
                // Apply filter state after panel opens
                requestAnimationFrame(() => {
                  const savedFilter = game.user.getFlag("daggerheart-gm-hud", "featureFilter") || DaggerheartGMHUD._filterState;
                  if (savedFilter && savedFilter !== 'none') {
                    this._applyFeatureFilter(savedFilter);
                  }
                });
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

        // Feature to chat
        const featureChat = ev.target.closest("[data-action='feature-to-chat']");
        if (featureChat) {
          stop(ev);
          const item = actor.items.get(featureChat.dataset.featureId);
          if (item) await this._sendFeatureToChat(item);
          return;
        }

        // Range template toggle (left-click)
        const rangeDetails = ev.target.closest("[data-action='create-range-template']");
        if (rangeDetails) {
          stop(ev);
          const range = rangeDetails.dataset.range || rangeDetails.textContent?.trim();
          if (range) {
            const token = this.token ?? canvas.tokens.controlled[0];
            if (token && this._hasTemplateForRange(token, range)) {
              // Template exists - remove it
              await this._cleanupRangeTemplate(token, range);
            } else {
              // Template doesn't exist - create it
              await this._createRangeTemplate(range);
            }
            
            // Update icon state
            this._updateRangeButtonState(rangeDetails, range);
          }
          return;
        }

        // Template cleanup (individual)
        const cleanupBtn = ev.target.closest("[data-action='cleanup-templates']");
        if (cleanupBtn) {
          stop(ev);
          const token = this.token ?? canvas.tokens.controlled[0];
          if (token) {
            await this._cleanupExistingTemplates(token);
            this._updateAllRangeButtonStates();
            const shell = rootEl.querySelector(".dgm-hud");
            shell?.setAttribute("data-open", "");
          }
          return;
        }

        // Template cleanup (all module templates)
        const cleanupAllBtn = ev.target.closest("[data-action='cleanup-all-templates']");
        if (cleanupAllBtn) {
          stop(ev);
          await this._cleanupAllModuleTemplates();
          this._updateAllRangeButtonStates();
          const shell = rootEl.querySelector(".dgm-hud");
          shell?.setAttribute("data-open", "");
          return;
        }

        // Toggle fill color (add this case in your existing click handler)
        const toggleFill = ev.target.closest("[data-action='toggle-fill']");
        if (toggleFill) {
          stop(ev);
          const newValue = !this.showFill;
          await this.setShowFill(newValue);
          
          // Update existing templates
          const token = this.token ?? canvas.tokens.controlled[0];
          if (token) {
            const tokenId = token.id ?? token.document?.id;
            const templatesToUpdate = canvas.scene.templates.filter(template => {
              const flags = template.flags?.["daggerheart-gm-hud"];
              return flags && flags.tokenId === tokenId;
            });

            if (templatesToUpdate.length > 0) {
              const updates = templatesToUpdate.map(template => ({
                _id: template.id,
                fillColor: newValue ? game.user.color : "#00000000"
              }));
              
              canvas.scene.updateEmbeddedDocuments("MeasuredTemplate", updates);
            }
          }
          
          // Update button appearance
          toggleFill.classList.toggle('active', newValue);
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

      // Right-click handler
      rootEl.addEventListener("contextmenu", async (ev) => {
        const actor = this.actor;
        if (!actor) return;

        // Range panel toggle (right-click)
        const rangeDetails = ev.target.closest("[data-action='create-range-template']");
        if (rangeDetails) {
          stop(ev);
          const shell = rootEl.querySelector(".dgm-hud");
          const isOpen = shell?.getAttribute("data-open") === "range";
          const newState = isOpen ? "" : "range";
          shell?.setAttribute("data-open", newState);
          
          if (!isOpen) {
            const panel = rootEl.querySelector(".dgm-panel--range");
            if (panel) {
              requestAnimationFrame(() => {
                setGMPanelOpenDirection(panel);
              });
            }
          }
          return;
        }

        // Resource adjustments (HP/Stress) - right-click decreases
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

      // Second click handler for resource adjustments (HP/Stress) - left-click increases
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

        const portrait = ev.target.closest(".dgm-portrait, .dgm-core");
        if (portrait) {
          ev.preventDefault();
          ev.stopPropagation();
          
          debugLog("Double-click detected, opening actor sheet for:", actor.name);
          actor.sheet?.render(true, { focus: true });
          return;
        }
      }, true);

      // Close panels when clicking outside
      const onDocClick = (ev) => {
        if (!rootEl.contains(ev.target)) {
          const shell = rootEl.querySelector(".dgm-hud");
          shell?.setAttribute("data-open", "");
          const toggle = rootEl.querySelector("[data-action='toggle-features']");
          toggle?.setAttribute("aria-expanded", "false");
        }
      };
      document.addEventListener("pointerdown", onDocClick, { capture: true });

      // Close panels on ESC
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

      const rangeKey = sys.attack.range || "close";
      const rangeShort = game.i18n.localize(`DAGGERHEART.CONFIG.Range.${rangeKey}.short`);
      const rangeName = game.i18n.localize(`DAGGERHEART.CONFIG.Range.${rangeKey}.name`);

      primaryAttack = {
        id: sys.attack._id || "primary",
        name: sys.attack.name || "Attack",
        img: sys.attack.img || "icons/svg/sword.svg",
        bonus: Number(sys.attack.roll?.bonus ?? 0),
        range: rangeKey,
        rangeShort: rangeShort,
        rangeName: rangeName,
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
        
        const hasActions = featureHasActions(item);
        
        return {
          id: item.id,
          name: item.name || "Unnamed Feature",
          img: item.img || "icons/svg/aura.svg", 
          description: finalHTML,
          hasActions: hasActions,
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

    // Update range button states
    this._updateAllRangeButtonStates();

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

  _updateAllRangeButtonStates() {
    const rangeButtons = this.element.querySelectorAll('[data-action="create-range-template"]');
    rangeButtons.forEach(button => {
      const range = button.dataset.range;
      if (range && button.querySelector('i')) { // ADD ICON CHECK HERE
        this._updateRangeButtonState(button, range);
      }
    });
    
    // Update fill toggle button state
    const fillToggle = this.element.querySelector('[data-action="toggle-fill"]');
    if (fillToggle) {
      fillToggle.classList.toggle('active', this.showFill);
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
        // Restore filter state from user flags or static property
        const savedFilter = game.user.getFlag("daggerheart-gm-hud", "featureFilter") || DaggerheartGMHUD._filterState;
        if (savedFilter && savedFilter !== 'none') {
          DaggerheartGMHUD._filterState = savedFilter;
          this._applyFeatureFilter(savedFilter);
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

  _applyFeatureFilter(filterType = null) {
    const rootEl = this.element;
    if (!rootEl) return;

    // Use provided filter or current stored state
    const filter = filterType || DaggerheartGMHUD._filterState;
    
    const featureItems = rootEl.querySelectorAll('.dgm-acc-item');
    const filterButtons = rootEl.querySelectorAll('.dgm-filter-btn');

    // Update button states
    filterButtons.forEach(btn => {
      btn.classList.remove('active');
      const action = btn.dataset.action;
      if ((action === 'expand-all' && filter === 'all') ||
          (action === 'expand-actions' && filter === 'actions') ||
          (action === 'expand-passive' && filter === 'passive') ||
          (action === 'collapse-all' && filter === 'collapsed')) {
        btn.classList.add('active');
      }
    });

    // Apply filter to features
    featureItems.forEach(item => {
      const details = item.querySelector('details');
      if (!details) return;

      const hasActions = item.dataset.hasActions === 'true';

      switch (filter) {
        case 'all':
          details.open = true;
          break;
        case 'actions':
          details.open = hasActions;
          break;
        case 'passive':
          details.open = !hasActions;
          break;
        case 'collapsed':
          details.open = false;
          break;
        case 'none':
        default:
          // Don't change current state
          break;
      }
    });

    debugLog(`Applied feature filter: ${filter}`);
  }

  _handleFeatureFilter(action) {
    let filterType;
    
    switch (action) {
      case 'expand-all':
        filterType = 'all';
        break;
      case 'expand-actions':
        filterType = 'actions';
        break;
      case 'expand-passive':
        filterType = 'passive';
        break;
      case 'collapse-all':
        filterType = 'collapsed';
        break;
      default:
        return;
    }

    // Store the filter state globally
    DaggerheartGMHUD._filterState = filterType;
    
    // Apply the filter
    this._applyFeatureFilter(filterType);
    
    // Save to user settings for persistence across sessions
    game.user.setFlag("daggerheart-gm-hud", "featureFilter", filterType);
    
    debugLog(`Feature filter set to: ${filterType}`);
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