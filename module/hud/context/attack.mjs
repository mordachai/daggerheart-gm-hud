// module/hud/context/attack.mjs - primary attack display shape (name, range, bonus, damage)

export function collectAttack(app) {
  const sys = app.actor.system ?? {};
  const atk = sys.attack;
  if (!atk) return { primaryAttack: null };

  const rangeKey = atk.range || "close";

  // Display-only: formula comes straight from the system's own getter, same as
  // the player HUD's weaponMeta() - never hand-computed from dice/bonus fields.
  let damage = "";
  try {
    damage = atk.getDamageFormula?.() ?? "";
  } catch (_) { damage = ""; }
  damage = String(damage).replace(/\s+/g, "");

  const types = Array.from(atk.damage?.main?.type ?? []);
  const damageIcons = types
    .map((t) => {
      const dc = CONFIG?.DH?.GENERAL?.damageTypes?.[t];
      return dc?.icon ? { icon: dc.icon, label: game.i18n.localize(dc.label) } : null;
    })
    .filter(Boolean);

  return {
    primaryAttack: {
      id: atk._id || "primary",
      name: atk.name || "Attack",
      img: atk.img || "icons/svg/sword.svg",
      bonus: Number(atk.roll?.bonus ?? 0),
      range: rangeKey,
      rangeShort: game.i18n.localize(`DAGGERHEART.CONFIG.Range.${rangeKey}.short`),
      rangeName: game.i18n.localize(`DAGGERHEART.CONFIG.Range.${rangeKey}.name`),
      damage,
      damageIcons
    }
  };
}
