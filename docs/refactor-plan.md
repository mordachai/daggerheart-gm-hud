# Daggerheart GM HUD — Refactor Plan

Goal: split the 1,243-line [`module/apps/dgm-adversary-hud.mjs`](../module/apps/dgm-adversary-hud.mjs)
into small single-purpose modules, delete dead system-API calls, and route rolls/chat through the real
Daggerheart 2.9.2 API (see [daggerheart-system-api.md](daggerheart-system-api.md)) instead of hand-rolled
reimplementations.

Companion docs already in this repo: [daggerheart-system-api.md](daggerheart-system-api.md),
[daggerheart-active-effect-paths.md](daggerheart-active-effect-paths.md) — pulled from the sister
player-facing module (`daggerheart-hud`) audit of the same system version. **They document
`DhCharacter`/player-facing surfaces; adversaries diverge (no traits, no `rollTrait`, own
`#reactionRoll` implementation) — verify against `D:\FoundrySystems\daggerheart` source directly
for anything adversary-specific instead of assuming the player doc's shape carries over.**

## Status: steps 1–5, 7, 9 done (2026-09-12)

Executed directly (findings #1–4, #7–9). Step 6 (`_rollReaction`) turned out to already match the
system's real `#reactionRoll` config verbatim — corrected in the findings table below, only the
event-threading part of it was fixed. Step 8 (inline `[[/dr ...]]` button) deliberately **not**
touched — no adversary feature was found that actually embeds `/dr`, and guessing at a direct-call
replacement without a live world to test against risks trading a working (if indirect) round-trip
for a silently broken one. Left as a follow-up; test in a live world first.

`dgm-adversary-hud.mjs`: 1243 → 67 lines. Split into `system/` (actor.mjs, attack.mjs, items.mjs),
`hud/` (events.mjs, panels.mjs, position.mjs, range-templates.mjs), `hud/context/` (identity,
resources, attack, features, index). Also deleted `helpers/chat-utils.mjs` (broken fallback chain)
and `helpers/i18n.mjs` (dead — never imported anywhere).

**Not yet done / needs a live-world pass:** verify shift/alt/ctrl-click on attack now skips the
config dialog (finding #2); confirm the damage button (now firing the same real `rollAttack` as the
attack icon, per finding #4) produces the expected system chat card; step 8 above.

---

## 0. Guiding rules

1. **One module = one concern.** No file over ~250 lines. Free functions take `app` explicitly; the
   class keeps only Foundry lifecycle (`_prepareContext`, `_onRender`, `close`).
2. **Never re-implement a system behaviour.** Rolls, damage math, chat cards — go through the API
   (`action.use(event)`, `item.toChat(item.uuid)`). If the API can't do it, add a thin wrapper in
   `module/system/` and document why (e.g. adversaries have no traits, so reaction rolls can't use
   `actor.rollTrait`).
3. **One slice per commit.** Reload the world (F5) and smoke-test after each step below.
4. **Behaviour-preserving first, bug-fixes second.** Steps 1–3 must not change what the user sees
   (pure moves/dead-code deletion). Steps 4+ change behaviour and each names the expected difference.
5. No build step; CSS is generated elsewhere — do not touch `styles/`.

---

## 1. Findings (audit against daggerheart-system-api.md)

| # | Where | Problem | Real fix |
|---|---|---|---|
| 1 | `_executeFeature`, `_rollAttack` | Dead first branches: `item.rollAction()`, `attack.rollAction()`, `Action.execute()`, `CONFIG.DAGGERHEART.Action` — none exist in 2.9.2. They silently fall through to the next branch, which happens to be a real method (`item.use`, `attack.use`), so behaviour survives by accident. | Delete the dead branches. |
| 2 | `_executeFeature`, `_rollAttack` | Neither receives the real click event — `_bindDelegatedEvents` calls `this._rollAttack()` / passes `item` only, so both methods fake a config object (`{action: actionPath}`) instead of a `PointerEvent`. Since `action.use(event, configOptions)` reads `event.shiftKey/altKey/ctrlKey` to skip the config dialog, the GM can never shift-click to fast-roll. | Thread the real `ev` through: `this._rollAttack(ev)` → `attack.use(ev)`; `this._executeFeature(item, ev)` → `item.use(ev)`. |
| 3 | `helpers/chat-utils.mjs` `sendItemToChat` | Tries `item.displayCard()` (doesn't exist), then `item.toChat.call(item, {speaker})` (wrong arg shape — `toChat` takes a uuid, not an options object). Only reaches a correct call by luck if both throw synchronously into the core-fallback branch. | Replace with `item.toChat(item.uuid)` (see API doc §5). Delete `chat-utils.mjs`. |
| 4 | `_rollDamage` | Hand-built the dice formula from `attack.damage.parts` and posted a fully custom chat card from scratch — dice faces markup, damage-type icon, everything. Bypassed `system.bonuses.damage.<type>` active-effect bonuses and every other system roll behavior (crit, group-attack, weapon features). **Resolved by deletion, not patching**: no rolls or chat cards should ever be built by the HUD. | Deleted entirely. The system has no standalone "damage only" entry point (`attack.use(event)` always rolls to-hit and damage together), so the damage button now calls the exact same `rollAttack(actor, event)` as the attack icon — one real system action, one real system chat card. |
| 5 | `_rollReaction` | ~~Suspected wrong `roll.type`~~ **Not a bug.** Checked against the system's own source (`applications/sheets/actors/adversary.mjs` `#reactionRoll`, `D:\FoundrySystems\daggerheart`) — `roll: { type: 'trait' }` + `actionType: 'reaction'` is byte-for-byte what the real adversary sheet does. Only real issue: it fakes a `PointerEvent`-shaped object instead of receiving the click event. | Thread the real `ev` through (same as finding #2); drop the redundant `data: actor.getRollData()` (already set internally by `actor.diceRoll`). |
| 6 | Inline `[[/dr ...]]` buttons (`data-action="inline-duality"`) | Calls `ui.chat.processMessage("/dr ...")` — posts chat text that itself enriches into a clickable button; two indirection hops instead of one. Same anti-pattern flagged in the API doc §3. | Replace with a direct roll call once the equivalent of `enrichedDualityRoll` is confirmed reachable for adversaries (likely not applicable — adversaries use D20Roll, not DualityRoll — so this may just become `actor.diceRoll(...)` built directly instead of round-tripping through chat). |
| 7 | `setGMPanelOpenDirection` | ~40 lines, over half of it `debugLog` calls dumping computed styles/rects on every open. | Trim to the load-bearing calculation; drop the diagnostic dumps. |
| 8 | `settings.mjs` `updateRingFrameScale` / `updateRingFrameVisibility` | Raw `console.log` calls not gated by the `debug` setting (inconsistent with `debugLog` used elsewhere in the same file). | Route through `debugLog`. |
| 9 | `featureHasActions` | Reimplements what `item.system.metadata.hasActions` (or `item.system.actionsList.length`) already gives for free. | Use the system field directly. |

None of these are "silently broken" in the dramatic sense the player-HUD audit found (most fall through
to a real method by accident) — but #2 (no shift-click), #3 (chat card), #4 (damage bonuses), and #5
(reaction roll config) are real correctness gaps worth fixing while the file is open for restructuring.

---

## 2. Target module layout

```
module/
  daggerheart-gm-hud.mjs        entry: hooks + HUD lifecycle owner (trim debug noise)
  constants.mjs                 NEW — MODULE_ID, template paths, flag keys
  settings.mjs                  unchanged except #8 above

  system/                       NEW — the only place that knows Daggerheart internals
    items.mjs                   sendToChat(item), featureHasActions(item) via metadata
    actor.mjs                   rollReaction(actor, event) — verified config shape (finding #5)
    attack.mjs                  rollAttack(actor, event) — only real entry point (finding #4)

  apps/
    dgm-adversary-hud.mjs       the ApplicationV2 class SHELL only (~200 lines)

  hud/                          NEW — presentation/interaction, no system knowledge
    position.mjs                _restorePosition, _enableDragging, position flag save/restore
    panels.mjs                  setGMPanelOpenDirection (trimmed), toggle-features/-range, filter apply/handle
    events.mjs                  attachHudEvents(app) — the data-action dispatch table, passes real `ev` through
    range-templates.mjs         _createRangeTemplate, cleanup* variants, _hasTemplateForRange,
                                 _updateRangeButtonState(s), toggle-fill

  hud/context/                  NEW — _prepareContext split into collectors
    index.mjs                   buildContext(app) → merges collectors, same shape as today
    identity.mjs                name, portrait, tier, systemType, difficulty
    resources.mjs               hp, stress, thresholds
    attack.mjs                  primaryAttack shape (damage type/icon derivation)
    features.mjs                feature list + description enrichment + hasActions

  helpers/
    handlebars-helpers.mjs      unchanged
    i18n.mjs                    unchanged
    inline-rolls.mjs            keep enrichItemDescription/toHudInlineButtons; fix per finding #6
    chat-utils.mjs               DELETE — replaced by system/items.mjs sendToChat
```

`buildContext` must return **byte-identical** output to today's `_prepareContext` at the end of step 3.

---

## 3. Deletions

| Target | Why | When |
|---|---|---|
| `module/helpers/chat-utils.mjs` | Broken fallback chain (finding #3); replaced by a 1-line `sendToChat` in `system/items.mjs`. | Step 4 |
| Dead branches in `_executeFeature` / `_rollAttack` (`rollAction`, `Action.execute`, `CONFIG.DAGGERHEART.Action`) | Never exist in 2.9.2 (finding #1). | Step 1 |
| Diagnostic `debugLog` dump block in `setGMPanelOpenDirection` | Noise, not load-bearing (finding #7). | Step 2 |

---

## 4. Execution order (slices)

Each slice is a commit. "Verify" = reload world (F5), select an adversary token, exercise the named
surface.

### Step 1 — dead-code deletion (no behaviour change)
- Remove `rollAction`/`Action.execute`/`CONFIG.DAGGERHEART.Action` branches from `_executeFeature` and
  `_rollAttack`; keep only the real `item.use(event)` / `attack.use(event)` calls plus the sheet-render
  fallback.
- Delete `featureHasActions` local reimplementation; use `item.system.metadata.hasActions`.
- Verify: HUD loads, feature icons still show clickable state correctly, attack button still rolls.

### Step 2 — extract pure utilities (no behaviour change)
- `module/constants.mjs` ← `MODULE_ID`, `TEMPLATE_PATHS` from the entry file.
- `hud/position.mjs` ← `_restorePosition`, `_enableDragging`.
- `hud/panels.mjs` ← `setGMPanelOpenDirection` (trimmed per finding #7), the features/range
  toggle-panel blocks from `_bindDelegatedEvents`, `_applyFeatureFilter`, `_handleFeatureFilter`.
- `hud/range-templates.mjs` ← `_createRangeTemplate`, `_cleanupExistingTemplates`,
  `_cleanupAllModuleTemplates`, `_hasTemplateForRange`, `_cleanupRangeTemplate`,
  `_updateRangeButtonState`, `_updateAllRangeButtonStates`.
- Verify: drag, panel open/close both directions, filter buttons, range template create/cleanup/toggle-fill.

### Step 3 — split `_prepareContext` (no behaviour change)
- `hud/context/*.mjs` collectors, each a pure `function collectX(app) → object`.
- `hud/context/index.mjs` `buildContext(app)` spreads them into today's exact shape.
- Verify: diff rendered DOM before/after on a fully-loaded adversary (attack, thresholds, features,
  experiences). Must be identical.

### Step 4 — chat through the API *(behaviour change: correctness)*
- `system/items.mjs`: `sendToChat(item)` → `item.toChat(item.uuid)`. Delete `helpers/chat-utils.mjs`.
- Expected visible change: "send to chat" produces the system's real ability card instead of whatever
  the broken fallback chain produced.
- Verify: send-to-chat for a feature with and without actions.

### Step 5 — thread real events through rolls *(behaviour change: correctness)*
- `hud/events.mjs`: pass `ev` into `_rollAttack(ev)` / `_executeFeature(item, ev)` instead of calling
  with no event.
- `system/attack.mjs`: `rollAttack(actor, event)` → `actor.system.attack.use(event)`.
- Expected visible change: shift/alt/ctrl-click on the attack icon now skips/modifies the roll
  configuration dialog like it does everywhere else in the system.
- Verify: plain click, shift-click, alt-click, ctrl-click on the attack icon.

### Step 6 — reaction roll config *(behaviour change: bug fix, needs live verification)*
- Confirm correct `roll.type` for a traitless D20 reaction roll by reading `D20Roll.applyBaseBonus`
  bonus-key lookups (`system.bonuses.roll.<type>`) — likely `type: 'reaction'` not `type: 'trait'`.
- `system/actor.mjs`: `rollReaction(actor, event)`.
- Verify: roll a reaction, confirm no console errors and a sane D20 result; if the adversary has a
  `system.bonuses.roll.reaction` bonus active, confirm it applies.

### Step 7 — damage roll: delete the hand-rolled path *(behaviour change, done)*

- Confirmed no damage-only entry point exists separate from the attack action
  (`baseAction.mjs`: `evaluate: this.hasRoll`, roll+damage are one workflow).
- Deleted `rollDamage` and its formula/chat-card-building helpers from `system/attack.mjs` entirely.
  All rolls and chat cards must come from the system, not be assembled in the HUD.
- The separate `roll-damage` button is gone (template + handler both removed) — it had become a
  redundant duplicate of the attack icon once it was routed through the same real action, so it
  was deleted rather than kept as a second button doing the same thing. `hud/context/attack.mjs`
  no longer computes `damage`/`damageType`/`damageTypeIcon`/`damageTypeName` since nothing renders
  them anymore; the now-orphaned `formatDamage`/`extractDamageTypes` Handlebars helpers were
  deleted too.
- Verify: attack icon still rolls correctly; no leftover damage chip in the attack row.

### Step 8 — inline `/dr` button *(behaviour change: correctness, lower priority)*
- Replace the `ui.chat.processMessage("/dr ...")` round-trip per finding #6, once the right direct-call
  shape for a traitless D20 roll is confirmed (depends on step 6's findings).
- Verify: an inline duality-style roll embedded in a feature description still produces a correct roll.

### Step 9 — settings cleanup + docs
- Route `updateRingFrameScale`/`updateRingFrameVisibility` console noise through `debugLog` (finding #8).
- Update this plan's findings table with ✅/⬜ status.

---

## 5. Risk register

| Area | Risk | Mitigation |
|---|---|---|
| Damage-only entry point (step 7) | System may not expose damage-without-roll cleanly; forcing it could double-post chat cards or skip cost/uses consumption paths that should fire. | If no clean call exists, keep the hand-rolled path — just fix the bonus math — rather than force-fit the workflow API. |
| Reaction roll type (step 6) | Wrong `roll.type` may silently apply the wrong bonus category rather than crash — easy to ship unnoticed. | Test with a bonus Active Effect present on both `system.bonuses.roll.reaction` and `.trait` to see which one the roll picks up. |
| Range template regions | `_createRangeTemplate`/cleanup logic is intricate (flag-based ownership per token/actor) and untouched by this plan except a file move — verify region create/cleanup still scopes correctly per token after the move. | Step 2 is a pure move; re-run the full range-template test matrix (create, individual cleanup, cleanup-all, fill toggle) right after. |
| Shift-click behavior change (step 5) | GMs used to plain-click-only may be surprised when shift-click now skips the config dialog. | Call out in release notes as an intentional, system-consistent addition. |

---

## 6. Definition of done

- `dgm-adversary-hud.mjs` ≤ ~200 lines, contains only the class shell.
- No file references `rollAction`, `Action.execute`, `CONFIG.DAGGERHEART.Action`.
- `helpers/chat-utils.mjs` deleted.
- Attack/feature rolls receive the real click event; shift/alt/ctrl-click work as elsewhere in the system.
- Damage rolls reflect active-effect damage bonuses.
- Reaction roll config verified correct against `D20Roll` bonus lookup, not guessed.
- Every step verified in a running world.
