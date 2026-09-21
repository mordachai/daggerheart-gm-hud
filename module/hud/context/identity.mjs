// module/hud/context/identity.mjs - name, portrait, tier, type, difficulty, thresholds

export function isMassiveDamageEnabled() {
  return !!game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.variantRules)
    ?.massiveDamage?.enabled;
}

function buildThresholds(sys) {
  const major = Number(sys.damageThresholds?.major ?? 0);
  const severe = Number(sys.damageThresholds?.severe ?? 0);
  const massiveEnabled = isMassiveDamageEnabled();
  return {
    major,
    severe,
    massive: massiveEnabled ? severe * 2 : null
  };
}

/** Token art first, then actor art, then the prototype token, then a placeholder. */
export function resolvePortrait(app) {
  const actor = app.actor;
  if (app.token?.texture?.src) return app.token.texture.src;
  if (actor?.img?.trim()) return actor.img;
  if (actor?.prototypeToken?.texture?.src) return actor.prototypeToken.texture.src;
  return "icons/svg/mystery-man.svg";
}

export function collectIdentity(app) {
  const actor = app.actor;
  const sys = actor.system ?? {};

  const portrait = resolvePortrait(app);

  const systemTypeRaw = String(sys.type ?? "").toLowerCase();
  const systemType = {
    raw: systemTypeRaw,
    label: systemTypeRaw ? game.i18n.localize(`DAGGERHEART.CONFIG.AdversaryType.${systemTypeRaw}.label`) : "",
    description: systemTypeRaw ? game.i18n.localize(`DAGGERHEART.CONFIG.AdversaryType.${systemTypeRaw}.description`) : ""
  };

  const sizeRaw = String(sys.size ?? "").toLowerCase();
  const sizeConfig = CONFIG.DH?.ACTOR?.tokenSize?.[sizeRaw];
  const size = {
    raw: sizeRaw,
    label: sizeConfig?.label ? game.i18n.localize(sizeConfig.label) : ""
  };

  return {
    adversaryName: actor.name ?? "Unnamed Adversary",
    portrait,
    tier: Number(sys.tier ?? 1),
    difficulty: Number(sys.difficulty ?? 10),
    systemType,
    size,
    description: sys.description || "",
    motivesAndTactics: sys.motivesAndTactics || "",
    thresholds: buildThresholds(sys),
    experiences: Object.entries(sys.experiences || {}).map(([id, exp]) => ({
      id,
      name: exp.name || "Unnamed Experience",
      value: Number(exp.value ?? 0),
      description: exp.description || ""
    }))
  };
}
