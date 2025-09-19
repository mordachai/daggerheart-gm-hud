// module/daggerheart-gm-hud.mjs - Main Daggerheart GM HUD Module

import { registerGMHUDSettings, getSetting, SETTINGS, debugLog, getCurrentTheme, applyThemeToElement } from "./settings.mjs";
import { DaggerheartGMHUD } from "./apps/dgm-adversary-hud.mjs";
import { registerDHUDHelpers } from "./helpers/handlebars-helpers.mjs";


const MODULE_ID = "daggerheart-gm-hud";

// Template paths
const TEMPLATE_PATHS = [
  `modules/${MODULE_ID}/templates/hud-adversary.hbs`
];

// Global HUD instance
let _gmHudApp = null;

/**
 * Check if a token/actor is a valid Daggerheart adversary
 */
function isValidAdversary(token) {
  const actor = token?.actor;
  if (!actor || game.system?.id !== "daggerheart") return false;
  
  // Check if it's an adversary type actor
  return actor.type === "adversary";
}

/**
 * Get the currently controlled adversary token for GM
 */
function getControlledAdversaryToken() {
  if (!game.user.isGM) return null;
  
  const controlledTokens = canvas.tokens?.controlled || [];
  const adversaryTokens = controlledTokens.filter(isValidAdversary);
  
  // Return the last selected adversary token (as per requirements)
  return adversaryTokens.length > 0 ? adversaryTokens[adversaryTokens.length - 1] : null;
}

/**
 * Create or update the GM HUD for the given adversary token
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
  
  // Only create HUD if we have a valid adversary token
  if (!token || !isValidAdversary(token)) {
    debugLog("No valid adversary token, not creating HUD");
    return;
  }
  
  debugLog("Creating GM HUD for adversary:", token.actor.name);
  
  try {
    // Create the actual HUD application instance
    _gmHudApp = new DaggerheartGMHUD({ 
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
  
  if (controlled && isValidAdversary(token)) {
    // GM selected an adversary token
    debugLog("GM selected adversary token:", token.actor.name);
    createOrUpdateGMHUD(token);
  } else if (!controlled) {
    // Token was deselected - check if we still have other adversary tokens selected
    const remainingAdversary = getControlledAdversaryToken();
    if (remainingAdversary && remainingAdversary.id !== token.id) {
      // Switch to another selected adversary
      debugLog("Switching to another selected adversary:", remainingAdversary.actor.name);
      createOrUpdateGMHUD(remainingAdversary);
    } else if (!remainingAdversary) {
      // No more adversaries selected - close HUD
      debugLog("No more adversaries selected, closing HUD");
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
  
  // Check if we have any adversary tokens selected on the new scene
  const adversaryToken = getControlledAdversaryToken();
  if (adversaryToken) {
    debugLog("Found selected adversary on canvas ready:", adversaryToken.actor.name);
    createOrUpdateGMHUD(adversaryToken);
  } else {
    // No adversaries selected - close HUD
    createOrUpdateGMHUD(null);
  }
});

/**
 * Handle actor updates that might affect the displayed HUD
 */
Hooks.on("updateActor", (actor, changes) => {
  // Only handle for GMs and if we have a HUD open
  if (!game.user.isGM || !_gmHudApp) return;
  
  // Check if this update affects the currently displayed actor
  if (_gmHudApp.actor?.id === actor.id) {
    debugLog("Displayed actor updated, refreshing HUD:", actor.name, changes);
    
    // TODO: Implement HUD refresh logic
    // For now, just recreate the HUD
    const currentToken = getControlledAdversaryToken();
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
    const currentToken = getControlledAdversaryToken();
    if (currentToken) {
      createOrUpdateGMHUD(currentToken);
    }
  }
});

Hooks.on("deleteActiveEffect", (effect) => {
  if (!game.user.isGM || !_gmHudApp) return;
  
  if (_gmHudApp.actor?.id === effect.parent?.id) {
    debugLog("Active effect removed from displayed actor, refreshing HUD");
    const currentToken = getControlledAdversaryToken();
    if (currentToken) {
      createOrUpdateGMHUD(currentToken);
    }
  }
});

/**
 * Export for potential external use
 */
export const DaggerheartGMHUDModule = {
  createOrUpdateGMHUD,
  isValidAdversary,
  getControlledAdversaryToken,
  get currentHUD() { return _gmHudApp; }
};

// Make available globally for debugging (only when ready)
Hooks.once("ready", () => {
  if (getSetting(SETTINGS.debug)) {
    window.DaggerheartGMHUD = DaggerheartGMHUDModule;
  }
});