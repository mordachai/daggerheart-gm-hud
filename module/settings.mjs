// module/settings.mjs - Daggerheart GM HUD Settings (GM-Only Fix)

const MODULE_ID = "daggerheart-gm-hud";

// Export the SETTINGS constant
export const SETTINGS = {
  theme: "theme",
  customFrame: "customFrame",
  ringFrameScale: "ringFrameScale",
  disableRingFrames: "disableRingFrames",
  wideFeaturesPanel: "wideFeaturesPanel",
  debug: "debug"
};

// Theme id -> display label. Keep in sync with styles/dgm-themes.css (.dgm-theme-<id>).
export const THEMES = {
  default: "Default",
  shadowveil: "Shadowveil",
  ironclad: "Ironclad",
  wildfire: "Wildfire",
  frostbite: "Frostbite"
};

const THEME_KEYS = Object.keys(THEMES);

/** Next/previous theme id from `theme`, wrapping infinitely both ways. */
export function adjacentTheme(theme, dir) {
  const i = THEME_KEYS.indexOf(theme);
  const n = THEME_KEYS.length;
  return THEME_KEYS[(((i < 0 ? 0 : i) + (dir < 0 ? -1 : 1)) % n + n) % n];
}

export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

export async function setSetting(key, value) {
  return game.settings.set(MODULE_ID, key, value);
}

// Move this function outside and make it available
function updateRingFrameScale(value) {
  // Match the CSS default of 84px for the new layout
  const baseSize = 100;
  const scaleFactor = 1 + (value / 100);
  const newSize = Math.round(baseSize * scaleFactor);
  
  document.documentElement.style.setProperty('--dgm-ring-scale', `${newSize}px`);

  debugLog(`Ring frame scale updated to ${value}% (${newSize}px)`);
}

function updateWideFeaturesPanel() {
  const wide = getSetting(SETTINGS.wideFeaturesPanel);
  document.documentElement.classList.toggle('dgm-wide-features', !!wide);
  debugLog(`Wide features panel ${wide ? 'enabled' : 'disabled'}`);
}

function updateRingFrameVisibility() {
  const disabled = getSetting("disableRingFrames");

  debugLog("updateRingFrameVisibility called, disabled:", disabled);

  if (disabled) {
    document.documentElement.classList.add('dgm-disable-rings');
  } else {
    document.documentElement.classList.remove('dgm-disable-rings');

    const customFrame = getSetting(SETTINGS.customFrame);

    if (customFrame && customFrame.trim()) {
      const imagePath = customFrame.startsWith('/') ? customFrame : `/${customFrame}`;
      const frameUrl = `url("${imagePath}")`;

      document.documentElement.style.setProperty('--dgm-ring-frame', frameUrl);

      const hudElements = document.querySelectorAll('.daggerheart-gm-hud');
      hudElements.forEach(hud => hud.style.setProperty('--dgm-ring-frame', frameUrl));

      debugLog("Applied custom frame:", frameUrl);
    } else {
      document.documentElement.style.removeProperty('--dgm-ring-frame');

      const hudElements = document.querySelectorAll('.daggerheart-gm-hud');
      hudElements.forEach(hud => hud.style.removeProperty('--dgm-ring-frame'));

      debugLog("No custom frame, removed CSS property overrides");
    }
  }
}

export function registerGMHUDSettings() {
  
  // Theme Selector - CLIENT SCOPED (each user can choose their own theme)
  game.settings.register(MODULE_ID, SETTINGS.theme, {
    name: "GM HUD Theme",
    hint: "Choose the color theme for the GM HUD interface.",
    scope: "world",
    config: true, // Always show, we'll filter in the settings menu render hook
    type: String,
    choices: THEMES,
    default: "default",
    onChange: (value) => {
      // Apply theme logic here if needed
      debugLog(`Theme changed to: ${value}`);
    }
  });

  // Custom Frame File Picker - WORLD SCOPED with GM restriction
  game.settings.register(MODULE_ID, SETTINGS.customFrame, {
    name: "Custom Ring Frame",
    hint: "Choose a custom ring frame image for the portrait and attack circles. Leave empty to use the default frame.",
    scope: "world",
    config: true, // Always show, we'll filter in the settings menu render hook
    restricted: true, // Only GMs can modify this setting
    type: String,
    default: "",
    filePicker: "image",
    onChange: (value) => {
      updateRingFrameVisibility();
      debugLog(`Custom frame changed to:`, value || 'default');
    }
  });

  // Ring Frame Scale - CLIENT SCOPED (each user can adjust their own scale)
  game.settings.register(MODULE_ID, SETTINGS.ringFrameScale, {
    name: "Ring Frame Scale",
    hint: "Adjust the size of the ring frame overlay. 0 is default size, negative values make it smaller, positive values make it larger.",
    scope: "world",
    config: true, // Always show, we'll filter in the settings menu render hook
    type: Number,
    range: {
      min: -30,
      max: 30,
      step: 1
    },
    default: 0,
    onChange: (value) => {
      updateRingFrameScale(value);
    }
  });

  // Disable Ring Frames - CLIENT SCOPED (each user can choose)
  game.settings.register(MODULE_ID, "disableRingFrames", {
    name: "Disable Ring Frames",
    hint: "Hide all ring frame overlays on portraits (useful if your tokens already have frames).",
    scope: "world",
    config: true, // Always show, we'll filter in the settings menu render hook
    type: Boolean,
    default: false,
    onChange: (value) => {
      updateRingFrameVisibility();
      debugLog(`Ring frames ${value ? 'disabled' : 'enabled'}`);
    }
  });

  // Wide Features Panel - CLIENT SCOPED (each user can choose)
  game.settings.register(MODULE_ID, SETTINGS.wideFeaturesPanel, {
    name: "Wide Features Panel",
    hint: "Make the features panel occupy two columns so more info is visible at once.",
    scope: "world",
    config: true, // Always show, we'll filter in the settings menu render hook
    type: Boolean,
    default: true,
    onChange: (value) => {
      updateWideFeaturesPanel();
      debugLog(`Wide features panel ${value ? 'enabled' : 'disabled'}`);
    }
  });

  // Debug Mode - CLIENT SCOPED (each user can enable their own debug)
  game.settings.register(MODULE_ID, SETTINGS.debug, {
    name: "Debug Mode",
    hint: "Enable debug console messages for the GM HUD module.",
    scope: "world",
    config: true, // Always show, we'll filter in the settings menu render hook
    type: Boolean,
    default: false,
    onChange: (value) => {
      if (value) debugLog(`Debug mode enabled`);
    }
  });

  // Initialize settings on ready
  Hooks.once("ready", () => {
    // Only initialize if user is GM
    if (!game.user?.isGM) return;
    
    // Initialize ring frame visibility (handles both custom frames and disable setting)
    updateRingFrameVisibility();
    
    // Initialize ring frame scale
    const scale = getSetting(SETTINGS.ringFrameScale) || 0;
    updateRingFrameScale(scale);

    // Initialize wide features panel
    updateWideFeaturesPanel();

    // Hook into the settings form to add live slider updates
    Hooks.on("renderSettingsConfig", (app, html) => {
      // Convert html to jQuery object if it isn't already (Foundry v13 compatibility)
      const $html = html instanceof jQuery ? html : $(html);
      
      const slider = $html.find(`input[name="${MODULE_ID}.${SETTINGS.ringFrameScale}"]`);
      if (slider.length) {
        debugLog("Ring frame scale slider found, adding live updates");
        
        // Add live input event listener
        slider.on('input', function() {
          const value = parseInt(this.value);
          updateRingFrameScale(value);
        });
      } else {
        debugLog("Ring frame scale slider not found");
      }
    });
  });

  // Hide GM HUD settings from non-GM users
  Hooks.on("renderSettingsConfig", (app, html) => {
    // Only hide settings if user is not GM
    if (game.user?.isGM) return;
    
    // Convert html to jQuery object if it isn't already
    const $html = html instanceof jQuery ? html : $(html);
    
    // Hide all GM HUD settings for non-GM users
    const gmHudSettings = [
      `${MODULE_ID}.${SETTINGS.theme}`,
      `${MODULE_ID}.${SETTINGS.customFrame}`,
      `${MODULE_ID}.${SETTINGS.ringFrameScale}`,
      `${MODULE_ID}.disableRingFrames`,
      `${MODULE_ID}.${SETTINGS.wideFeaturesPanel}`,
      `${MODULE_ID}.${SETTINGS.debug}`
    ];
    
    gmHudSettings.forEach(settingName => {
      const settingElement = $html.find(`[name="${settingName}"]`).closest('.form-group');
      if (settingElement.length) {
        settingElement.hide();
        debugLog(`Hidden setting from player: ${settingName}`);
      }
    });
  });
}

// Debug helper function - safe to call before settings are registered
export function debugLog(message, ...args) {
  try {
    if (getSetting(SETTINGS.debug)) {
      console.log(`[GM HUD Debug]`, message, ...args);
    }
  } catch (err) {
    // Settings not registered yet - fail silently
    // This can happen during module initialization
  }
}

// Theme helper function
export function getCurrentTheme() {
  return getSetting(SETTINGS.theme) || "default";
}

// Apply theme to element
export function applyThemeToElement(element) {
  if (!element) return;
  
  const currentTheme = getCurrentTheme();
  
  // Remove existing theme classes
  element.classList.forEach(cls => {
    if (cls.startsWith('dgm-theme-')) {
      element.classList.remove(cls);
    }
  });
  
  // Apply current theme
  element.classList.add(`dgm-theme-${currentTheme}`);
  
  // Check if we have a custom frame that should override the theme
  try {
    const customFrame = getSetting(SETTINGS.customFrame);
    if (customFrame && customFrame.trim() && !getSetting("disableRingFrames")) {
      const imagePath = customFrame.startsWith('/') ? customFrame : `/${customFrame}`;
      const frameUrl = `url("${imagePath}")`;
      element.style.setProperty('--dgm-ring-frame', frameUrl);
      debugLog(`Applied custom frame "${customFrame}" to themed element`);
    }
  } catch (err) {
    // Settings might not be ready yet
    debugLog("Could not apply custom frame - settings not ready");
  }
  
  debugLog(`Applied theme "${currentTheme}" to element`, element);
}