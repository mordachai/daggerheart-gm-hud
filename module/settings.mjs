// module/settings.mjs - Daggerheart GM HUD Settings

const MODULE_ID = "daggerheart-gm-hud";

export const SETTINGS = {
  theme: "theme",
  customFrame: "customFrame", 
  debug: "debug"
};

export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

export async function setSetting(key, value) {
  return game.settings.set(MODULE_ID, key, value);
}

export function registerGMHUDSettings() {
  
  // Theme Selector
  game.settings.register(MODULE_ID, SETTINGS.theme, {
    name: "GM HUD Theme",
    hint: "Choose the color theme for the GM HUD interface.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      "default": "Default",
      "shadowveil": "Shadowveil", 
      "ironclad": "Ironclad",
      "wildfire": "Wildfire",
      "frostbite": "Frostbite"
    },
    default: "default",
    onChange: (value) => {
      // Apply theme change immediately if HUD is open
      const hudElement = document.querySelector('.daggerheart-gm-hud');
      if (hudElement) {
        // Remove existing theme classes
        hudElement.classList.forEach(cls => {
          if (cls.startsWith('dgm-theme-')) {
            hudElement.classList.remove(cls);
          }
        });
        // Apply new theme
        hudElement.classList.add(`dgm-theme-${value}`);
      }
    }
  });

  // Custom Frame File Picker
  game.settings.register(MODULE_ID, SETTINGS.customFrame, {
    name: "Custom Ring Frame",
    hint: "Choose a custom ring frame image for the portrait and attack circles. Leave empty to use the default frame.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    filePicker: "image",
    onChange: (value) => {
      // Update CSS variable for ring frame
      const frameUrl = value.trim() 
        ? `url("${value}")`
        : `url("modules/${MODULE_ID}/assets/ui/dgm-hud-frame.webp")`;
      
      document.documentElement.style.setProperty('--dgm-ring-frame', frameUrl);
      
      if (getSetting(SETTINGS.debug)) {
        console.log(`[GM HUD] Ring frame updated:`, frameUrl);
      }
    }
  });

  // Debug Mode
  game.settings.register(MODULE_ID, SETTINGS.debug, {
    name: "Debug Mode",
    hint: "Enable debug console messages for the GM HUD module.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: (value) => {
      if (value) {
        console.log(`[GM HUD] Debug mode enabled`);
      }
    }
  });

  // Initialize custom frame on startup
  Hooks.once("ready", () => {
    const customFrame = getSetting(SETTINGS.customFrame);
    if (customFrame && customFrame.trim()) {
      const frameUrl = `url("${customFrame.trim()}")`;
      document.documentElement.style.setProperty('--dgm-ring-frame', frameUrl);
      
      if (getSetting(SETTINGS.debug)) {
        console.log(`[GM HUD] Custom ring frame loaded:`, frameUrl);
      }
    }
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
  
  debugLog(`Applied theme "${currentTheme}" to element`, element);
}