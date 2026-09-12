// module/hud/context/resources.mjs - HP / Stress bars

export function collectResources(app) {
  const sys = app.actor.system ?? {};

  return {
    hp: {
      value: Number(sys.resources?.hitPoints?.value ?? 0),
      max: Number(sys.resources?.hitPoints?.max ?? 0)
    },
    stress: {
      value: Number(sys.resources?.stress?.value ?? 0),
      max: Number(sys.resources?.stress?.max ?? 0)
    }
  };
}
