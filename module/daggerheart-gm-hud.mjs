// module/daggerheart-gm-hud.mjs - Main Daggerheart GM HUD Module

import { registerGMHUDSettings, getSetting, SETTINGS, NPC_SETTING_HOOK, debugLog, getCurrentTheme } from "./settings.mjs";
import { DaggerheartGMHUD } from "./apps/dgm-adversary-hud.mjs";
import { DaggerheartGMNpcHUD } from "./apps/dgm-npc-hud.mjs";
import { registerDHUDHelpers } from "./helpers/handlebars-helpers.mjs";
import { TEMPLATE_PATHS, HUD_KIND_IDS } from "./constants.mjs";

// Global HUD instance
let _gmHudApp = null;

/**
 * HUD kinds, keyed by Daggerheart actor type.
 * `App` is the application class rendered for that actor type.
 * `enabled` (optional) gates the kind, e.g. behind a client setting.
 */
const HUD_KINDS = {
  [HUD_KIND_IDS.adversary]: { App: DaggerheartGMHUD },
  [HUD_KIND_IDS.npc]: { App: DaggerheartGMNpcHUD, enabled: () => getSetting(SETTINGS.showForNpcs) }
};

/**
 * Resolve the HUD kind for a token, or null when the token gets no HUD
 */
function getHudKind(token) {
  const actor = token?.actor;
  if (!actor || game.system?.id !== "daggerheart") return null;

  const kind = HUD_KINDS[actor.type];
  if (!kind) return null;
  if (kind.enabled && !kind.enabled()) return null;
  return kind;
}

/**
 * Get the currently controlled token that qualifies for a HUD (GM only)
 */
function getControlledHudToken() {
  if (!game.user.isGM) return null;

  const controlledTokens = canvas.tokens?.controlled || [];
  const hudTokens = controlledTokens.filter((t) => getHudKind(t));

  // Return the last selected eligible token (as per requirements)
  return hudTokens.length > 0 ? hudTokens[hudTokens.length - 1] : null;
}

/**
 * Create or update the GM HUD for the given token
 */
function createOrUpdateGMHUD(token = null) {
  // Only for GMs
  if (!game.user.isGM) return;

  debugLog("createOrUpdateGMHUD called with token:", token?.name);

  // Close existing HUD if any
  if (_gmHudApp) {
    debugLog("Closing existing GM HUD");
    _gmHudApp.close({ force: true });
    _gmHudApp = null;
  }

  // Only create HUD if the token maps to a HUD kind
  const kind = token ? getHudKind(token) : null;
  if (!kind) {
    debugLog("No eligible token, not creating HUD");
    return;
  }

  debugLog("Creating GM HUD for:", token.actor.name, `(${token.actor.type})`);

  try {
    // Create the actual HUD application instance
    _gmHudApp = new kind.App({
      actor: token.actor,
      token: token.document || token
    });
    _gmHudApp.render(true);
    
    debugLog("GM HUD created successfully");
  } catch (error) {
    console.error("[GM HUD] Failed to create HUD:", error);
    ui.notifications?.error("Failed to create GM HUD (see console)");
  }
}

/**
 * Initialize the module
 */
Hooks.once("init", () => {
  debugLog("Initializing Daggerheart GM HUD module");
  
  // Register settings
  registerGMHUDSettings();
  registerDHUDHelpers();

  
  debugLog("GM HUD module initialized");
});

/**
 * Load templates and finalize setup
 */
Hooks.once("ready", async () => {
  debugLog("GM HUD module ready hook");
  
  try {
    // Load Handlebars templates
    await foundry.applications.handlebars.loadTemplates(TEMPLATE_PATHS);
    debugLog("Templates loaded successfully");
    
    // Apply initial theme to document if needed
    const theme = getCurrentTheme();
    debugLog("Initial theme:", theme);
    
  } catch (error) {
    console.error("[GM HUD] Error during ready hook:", error);
  }
});

/**
 * Handle token control changes
 */
Hooks.on("controlToken", (token, controlled) => {
  // Only handle for GMs
  if (!game.user.isGM) return;
  
  debugLog("controlToken hook - Token:", token.actor?.name, "Controlled:", controlled);
  
  if (controlled && getHudKind(token)) {
    // GM selected a token that gets a HUD
    debugLog("GM selected HUD token:", token.actor.name);
    createOrUpdateGMHUD(token);
  } else if (!controlled) {
    // Token was deselected - check if we still have other eligible tokens selected
    const remainingToken = getControlledHudToken();
    if (remainingToken && remainingToken.id !== token.id) {
      // Switch to another selected token
      debugLog("Switching to another selected token:", remainingToken.actor.name);
      createOrUpdateGMHUD(remainingToken);
    } else if (!remainingToken) {
      // No more eligible tokens selected - close HUD
      debugLog("No more eligible tokens selected, closing HUD");
      createOrUpdateGMHUD(null);
    }
  }
});

/**
 * Handle token deletion
 */
Hooks.on("deleteToken", (scene, tokenDoc) => {
  // Only handle for GMs
  if (!game.user.isGM) return;
  
  debugLog("deleteToken hook - Token deleted:", tokenDoc.name);
  
  // If the deleted token was being displayed in our HUD, close it
  if (_gmHudApp && _gmHudApp.token?.id === tokenDoc.id) {
    debugLog("Deleted token was displayed in GM HUD, closing");
    createOrUpdateGMHUD(null);
  }
});

/**
 * Handle scene changes
 */
Hooks.on("canvasReady", () => {
  // Only handle for GMs
  if (!game.user.isGM) return;
  
  debugLog("Canvas ready - checking for selected tokens");

  // Check if we have any eligible tokens selected on the new scene
  const hudToken = getControlledHudToken();
  if (hudToken) {
    debugLog("Found selected token on canvas ready:", hudToken.actor.name);
    createOrUpdateGMHUD(hudToken);
  } else {
    // Nothing eligible selected - close HUD
    createOrUpdateGMHUD(null);
  }
});

/**
 * Handle actor updates that might affect the displayed HUD
 */
// In the updateActor hook:
Hooks.on("updateActor", async (actor, changes) => {  // Add async here
  if (!game.user.isGM || !_gmHudApp) return;
  
  if (_gmHudApp.actor?.id === actor.id) {
    debugLog("Displayed actor updated, refreshing HUD:", actor.name, changes);
    const currentToken = getControlledHudToken();
    if (currentToken && currentToken.actor.id === actor.id) {
      createOrUpdateGMHUD(currentToken);
    }
  }
});

/**
 * Handle active effect changes that might affect the displayed HUD
 */
Hooks.on("createActiveEffect", (effect) => {
  if (!game.user.isGM || !_gmHudApp) return;
  
  if (_gmHudApp.actor?.id === effect.parent?.id) {
    debugLog("Active effect added to displayed actor, refreshing HUD");
    const currentToken = getControlledHudToken();
    if (currentToken) {
      createOrUpdateGMHUD(currentToken);
    }
  }
});

Hooks.on("deleteActiveEffect", (effect) => {
  if (!game.user.isGM || !_gmHudApp) return;

  if (_gmHudApp.actor?.id === effect.parent?.id) {
    debugLog("Active effect removed from displayed actor, refreshing HUD");
    const currentToken = getControlledHudToken();
    if (currentToken) {
      createOrUpdateGMHUD(currentToken);
    }
  }
});

/**
 * Keep the Fear display in sync when it changes from elsewhere (e.g. the system's own Fear Tracker).
 */
Hooks.on("updateSetting", (setting) => {
  if (!game.user.isGM || !_gmHudApp) return;

  if (setting.key === `${CONFIG.DH.id}.${CONFIG.DH.SETTINGS.gameSettings.Resources.Fear}`) {
    _gmHudApp.render();
  }
});

/**
 * Setting toggled: drop a stale NPC HUD, or open one for an already-selected NPC token.
 */
Hooks.on(NPC_SETTING_HOOK, () => {
  if (!game.user.isGM) return;
  createOrUpdateGMHUD(getControlledHudToken());
});

/**
 * Export for potential external use
 */
export const DaggerheartGMHUDModule = {
  createOrUpdateGMHUD,
  getHudKind,
  getControlledHudToken,
  get currentHUD() { return _gmHudApp; }
};

// Make available globally for debugging (only when ready)
Hooks.once("ready", () => {
  if (getSetting(SETTINGS.debug)) {
    window.DaggerheartGMHUD = DaggerheartGMHUDModule;
  }
});