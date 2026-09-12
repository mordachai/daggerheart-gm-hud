// module/helpers/inline-rolls.mjs
export async function enrichItemDescription(item) {
  const raw = item.system?.description ?? "";
  const rollData = item.getRollData?.() ?? item.actor?.getRollData?.() ?? {};

  // Use the new Foundry v13 namespaced TextEditor
  const TextEditorImpl = foundry.applications.ux.TextEditor.implementation;
  
  // Foundry will parse [[/r ...]] and resolve @UUID, etc.
  // GM-only HUD: always reveal secret blocks, no reveal-toggle needed here.
  const html = await TextEditorImpl.enrichHTML(raw, {
    async: true,
    rollData,
    relativeTo: item,
    secrets: true,
    documents: true,
    links: true,
    rolls: true
  });

  return html;
}

function pickDieIcon(formula = "") {
  const m = /d(4|6|8|10|12|20)\b/i.exec(formula);
  const faces = m?.[1];
  const map = {
    "4":"fa-solid fa-dice-d4","6":"fa-solid fa-dice-d6","8":"fa-solid fa-dice-d8",
    "10":"fa-solid fa-dice-d10","12":"fa-solid fa-dice-d12","20":"fa-solid fa-dice-d20"
  };
  return faces ? map[faces] : "fa-solid fa-dice-d6";
}

export function toHudInlineButtons(enrichedHTML, { enableDuality = true } = {}) {
  const root = document.createElement("div");
  root.innerHTML = enrichedHTML;

  // TextEditor always wraps secret blocks in a <secret-block> that injects a live "Reveal" button
  // via its own connectedCallback (see client/applications/elements/secret-block.mjs). That button
  // dispatches a "change" event meant for a document-editing sheet to persist - useless and confusing
  // in a read-only GM HUD. Unwrap it so the (already GM-revealed) content just shows plainly.
  for (const wrapper of root.querySelectorAll("secret-block")) {
    const section = wrapper.querySelector(":scope > .secret") ?? wrapper;
    wrapper.replaceWith(...section.childNodes);
  }

  // [[/r ...]] buttons
  for (const a of root.querySelectorAll("a.inline-roll")) {
    const formula = a.dataset.formula?.trim() || a.textContent.trim();
    const btn = document.createElement("span");
    btn.className = "dhud-inline-roll";
    btn.setAttribute("role", "button");
    btn.setAttribute("tabindex", "0");
    btn.dataset.action = "inline-roll";
    btn.dataset.formula = formula;
    btn.innerHTML = `<i class="${pickDieIcon(formula)}"></i> ${foundry.utils.escapeHTML(formula)}`;
    a.replaceWith(btn);
  }

  // [[/dr ...]] buttons (system chat command)
  if (enableDuality) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      const s = n.nodeValue;
      const m = s?.match(/\[\[\/dr\s+([^\]]+)\]\]/i);
      if (!m) continue;

      const before = s.slice(0, m.index);
      const params = m[1].trim();
      const after = s.slice(m.index + m[0].length);

      const wrap = document.createElement("span");
      if (before) wrap.append(document.createTextNode(before));

      const btn = document.createElement("span");
      btn.className = "dhud-inline-dr";
      btn.setAttribute("role", "button");
      btn.setAttribute("tabindex", "0");
      btn.dataset.action = "inline-duality";
      btn.dataset.params = params;
      btn.innerHTML = `<i class="fa-solid fa-dice-d12"></i> /dr ${foundry.utils.escapeHTML(params)}`;

      wrap.append(btn);
      if (after) wrap.append(document.createTextNode(after));
      n.replaceWith(wrap);
    }
  }

  return root.innerHTML;
}
