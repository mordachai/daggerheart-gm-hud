// module/hud/context/fear.mjs - world Fear resource display (not actor-scoped)

import { getFear, getMaxFear } from "../../system/fear.mjs";

export function collectFear() {
  return { fear: getFear(), maxFear: getMaxFear() };
}
