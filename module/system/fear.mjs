// module/system/fear.mjs - the world Fear resource, same setting the system's own Fear Tracker reads/writes

export function getFear() {
  return game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear);
}

export function getMaxFear() {
  return game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Homebrew).maxFear;
}

/** Adjust world Fear by delta, clamped to [0, maxFear] - mirrors the clamp the system applies on its own socket path. */
export async function adjustFear(delta) {
  const max = getMaxFear();
  const next = Math.max(0, Math.min(max, getFear() + delta));
  return game.settings.set(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear, next);
}
