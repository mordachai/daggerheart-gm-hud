// module/hud/range-templates.mjs - range visualization delegated to the Daggerheart: Distances module API
// (window.DHDistances) instead of drawing our own rings/highlights.

const DHD_MODULE_ID = "daggerheart-distances";

function getDistancesAPI() {
  const mod = game.modules.get(DHD_MODULE_ID);
  if (!mod?.active) return null;
  return window.DHDistances ?? null;
}

function warnMissing() {
  ui.notifications?.warn("Daggerheart: Distances module is not active — range visualization unavailable.");
}

function resolvePlaceable(token) {
  if (!token) return null;
  const id = token.id ?? token.document?.id ?? token._id;
  return canvas.tokens?.get(id) ?? null;
}

export function createRangeTemplate(app, _range) {
  const api = getDistancesAPI();
  if (!api) return warnMissing();

  const tok = resolvePlaceable(app.token) ?? canvas.tokens.controlled[0];
  if (!tok) return;

  if (!api.hasRings(tok.id)) api.createRings(tok, { pinned: true });
}

export function hasTemplateForRange(token, _range) {
  const api = getDistancesAPI();
  const tok = resolvePlaceable(token);
  if (!api || !tok) return false;

  return api.hasRings(tok.id);
}

export function cleanupRangeTemplate(token, _range) {
  const api = getDistancesAPI();
  const tok = resolvePlaceable(token);
  if (!api || !tok) return;

  api.removeRings(tok.id);
}

export function updateRangeButtonState(button, range, token) {
  if (!token) return;

  const hasTemplate = hasTemplateForRange(token, range);
  const icon = button.querySelector("i");
  if (!icon) return;

  icon.className = hasTemplate ? "fa-solid fa-circle-xmark" : "fa-solid fa-bullseye";
  button.classList.toggle("active", hasTemplate);
}

export function updateAllRangeButtonStates(app) {
  const token = app.token ?? canvas.tokens.controlled[0];

  app.element.querySelectorAll('[data-action="create-range-template"]').forEach(button => {
    const range = button.dataset.range;
    if (range && button.querySelector("i")) updateRangeButtonState(button, range, token);
  });
}
