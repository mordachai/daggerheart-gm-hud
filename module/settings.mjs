// module/settings.mjs - Daggerheart GM HUD Settings

const MODULE_ID = "daggerheart-gm-hud";

export const SETTINGS = {
  theme: "theme",
  customFrame: "customFrame", 
  ringFrameScale: "ringFrameScale",
  disableRingFrames: "disableRingFrames",
  debug: "debug"
};

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
  
  if (getSetting(SETTINGS.debug)) {
    console.log(`[GM HUD] Ring frame scale updated to ${value}% (${newSize}px)`);
  }
}

function updateRingFrameVisibility() {
  const disabled = getSetting("disableRingFrames");
  
  console.log("[GM HUD Debug] updateRingFrameVisibility called");
  console.log("[GM HUD Debug] Ring frames disabled:", disabled);
  
  if (disabled) {
    // Hide all ring frames by adding a CSS class
    document.documentElement.classList.add('dgm-disable-rings');
    console.log("[GM HUD Debug] Added dgm-disable-rings class");
  } else {
    // Remove the disable class
    document.documentElement.classList.remove('dgm-disable-rings');
    console.log("[GM HUD Debug] Removed dgm-disable-rings class");
    
    // Handle custom frames normally
    const customFrame = getSetting(SETTINGS.customFrame);
    console.log("[GM HUD Debug] Custom frame setting value:", customFrame);
    
    if (customFrame && customFrame.trim()) {
      // Use custom frame - apply to all HUD instances
      const imagePath = customFrame.startsWith('/') ? customFrame : `/${customFrame}`;
      const frameUrl = `url("${imagePath}")`;
      console.log("[GM HUD Debug] Setting custom frame URL:", frameUrl);
      
      // Set on document root for global access
      document.documentElement.style.setProperty('--dgm-ring-frame', frameUrl);
      
      // Also set on any existing HUD instances to override theme
      const hudElements = document.querySelectorAll('.daggerheart-gm-hud');
      hudElements.forEach(hud => {
        hud.style.setProperty('--dgm-ring-frame', frameUrl);
        console.log("[GM HUD Debug] Applied custom frame to HUD element:", hud);
      });
      
      // Verify it was set
      const actualValue = document.documentElement.style.getPropertyValue('--dgm-ring-frame');
      console.log("[GM HUD Debug] Actual CSS property value:", actualValue);
    } else {
      // No custom frame - remove override and let theme CSS handle it
      console.log("[GM HUD Debug] No custom frame, removing CSS property overrides");
      document.documentElement.style.removeProperty('--dgm-ring-frame');
      
      // Remove from any existing HUD instances
      const hudElements = document.querySelectorAll('.daggerheart-gm-hud');
      hudElements.forEach(hud => {
        hud.style.removeProperty('--dgm-ring-frame');
        console.log("[GM HUD Debug] Removed custom frame from HUD element:", hud);
      });
    }
  }
  
  // Log current CSS custom properties
  const currentRingFrame = getComputedStyle(document.documentElement).getPropertyValue('--dgm-ring-frame');
  console.log("[GM HUD Debug] Final computed --dgm-ring-frame value:", currentRingFrame);
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
      // Apply theme logic here if needed
      debugLog(`Theme changed to: ${value}`);
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
      updateRingFrameVisibility();
      if (getSetting(SETTINGS.debug)) {
        console.log(`[GM HUD] Custom frame changed to:`, value || 'default');
      }
    }
  });

  // Ring Frame Scale
  game.settings.register(MODULE_ID, SETTINGS.ringFrameScale, {
    name: "Ring Frame Scale",
    hint: "Adjust the size of the ring frame overlay. 0 is default size, negative values make it smaller, positive values make it larger.",
    scope: "client",
    config: true,
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

  // Disable Ring Frames
  game.settings.register(MODULE_ID, "disableRingFrames", {
    name: "Disable Ring Frames",
    hint: "Hide all ring frame overlays on portraits (useful if your tokens already have frames).",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: (value) => {
      updateRingFrameVisibility();
      if (getSetting(SETTINGS.debug)) {
        console.log(`[GM HUD] Ring frames ${value ? 'disabled' : 'enabled'}`);
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

  // Initialize settings on ready
  Hooks.once("ready", () => {
    // Initialize ring frame visibility (handles both custom frames and disable setting)
    updateRingFrameVisibility();
    
    // Initialize ring frame scale
    const scale = getSetting(SETTINGS.ringFrameScale) || 0;
    updateRingFrameScale(scale);
    
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