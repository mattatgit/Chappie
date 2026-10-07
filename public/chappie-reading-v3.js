const app = document.getElementById("app");
let mountedReadingId = null;
let rpcId = 0;
const pending = new Map();

const request = (method, params) => new Promise((resolve, reject) => {
  const id = ++rpcId;
  pending.set(id, { resolve, reject });
  window.parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
});

const notify = (method, params) => {
  window.parent.postMessage({ jsonrpc: "2.0", method, params }, "*");
};

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  const message = event.data;
  if (!message || message.jsonrpc !== "2.0") return;

  if (message.id !== undefined && pending.has(message.id)) {
    const p = pending.get(message.id);
    pending.delete(message.id);
    message.error ? p.reject(message.error) : p.resolve(message.result);
    return;
  }

  if (message.method === "ui/notifications/tool-result") {
    renderFromResult(message.params);
  }
}, { passive: true });

window.addEventListener("openai:set_globals", (event) => {
  const output = event?.detail?.globals?.toolOutput;
  if (output?.reading) mount(output.reading);
}, { passive: true });

function normalize(segment) {
  const a = segment?.annotation || {};
  return {
    text: segment?.text || "",
    primary: segment?.reading || a.pronunciation || a.reading || a.translation || "",
    meaning: segment?.meaning || a.meaning || a.translation || "",
  };
}

function renderFromResult(result) {
  const data = result?.structuredContent?.reading;
  if (data) mount(data);
}

function hydrateFromOpenAI() {
  const data = window.openai?.toolOutput?.reading;
  if (data) mount(data);
}

function reportHeight() {
  requestAnimationFrame(() => {
    window.openai?.notifyIntrinsicHeight?.({ height: document.documentElement.scrollHeight });
  });
}

function makeTerm(segment) {
  const n = normalize(segment);
  const term = document.createElement("span");
  term.className = "term";
  term.tabIndex = 0;
  term.setAttribute("role", "button");
  term.dataset.primary = n.primary;
  term.dataset.meaning = n.meaning;
  term.append(document.createTextNode(n.text));

  const hint = document.createElement("span");
  hint.className = "hint";
  hint.textContent = n.primary;
  hint.setAttribute("aria-hidden", "true");
  term.append(hint);
  return term;
}

function mount(data) {
  if (!data || !Array.isArray(data.paragraphs)) return;
  if (mountedReadingId === data.id && app.querySelector(".reading")) return;
  mountedReadingId = data.id || "reading";

  app.className = "";
  app.replaceChildren();

  const shell = document.createElement("section");
  shell.className = "reading";

  if (data.intro) {
    const intro = document.createElement("p");
    intro.className = "intro";
    intro.textContent = data.intro;
    shell.append(intro);
  }

  const card = document.createElement("div");
  card.className = "card";

  if (data.title) {
    const title = document.createElement("h2");
    title.textContent = data.title;
    card.append(title);
  }

  for (const paragraph of data.paragraphs || []) {
    const p = document.createElement("p");
    p.className = "paragraph";
    for (const segment of paragraph || []) {
      const n = normalize(segment);
      if (n.primary || n.meaning) p.append(makeTerm(segment));
      else p.append(document.createTextNode(n.text));
    }
    card.append(p);
  }

  const tip = document.createElement("div");
  tip.className = "tip";
  tip.hidden = true;
  tip.setAttribute("role", "tooltip");
  const primary = document.createElement("div");
  primary.className = "tip-primary";
  const meaning = document.createElement("div");
  tip.append(primary, meaning);
  card.append(tip);
  shell.append(card);
  app.append(shell);

  let active = null;
  const hide = () => {
    if (active) active.classList.remove("is-selected");
    active = null;
    tip.hidden = true;
  };

  const position = () => {
    if (!active || tip.hidden) return;
    const c = card.getBoundingClientRect();
    const t = active.getBoundingClientRect();
    let left = t.left - c.left + t.width / 2 - tip.offsetWidth / 2;
    left = Math.max(8, Math.min(left, card.clientWidth - tip.offsetWidth - 8));
    let top = t.bottom - c.top + 8;
    if (top + tip.offsetHeight > card.clientHeight - 8) {
      top = t.top - c.top - tip.offsetHeight - 8;
    }
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  };

  const show = (term) => {
    if (active && active !== term) active.classList.remove("is-selected");
    active = term;
    term.classList.add("is-selected");
    primary.textContent = term.dataset.primary || "";
    meaning.textContent = term.dataset.meaning || "";
    tip.hidden = false;
    requestAnimationFrame(position);
  };

  card.querySelectorAll(".term").forEach((term) => {
    term.addEventListener("click", () => active === term ? hide() : show(term));
    term.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        active === term ? hide() : show(term);
      } else if (event.key === "Escape") {
        hide();
        term.blur();
      }
    });
  });

  document.onclick = (event) => {
    if (event.target instanceof Element && !event.target.closest(".term") && !event.target.closest(".tip")) hide();
  };
  window.onresize = () => requestAnimationFrame(position);
  reportHeight();
}

hydrateFromOpenAI();
setTimeout(hydrateFromOpenAI, 0);
setTimeout(hydrateFromOpenAI, 250);
setTimeout(hydrateFromOpenAI, 1000);

(async () => {
  try {
    await request("ui/initialize", {
      appInfo: { name: "chappie-reading", version: "0.2.0" },
      appCapabilities: { availableDisplayModes: ["inline"] },
      protocolVersion: "2026-01-26",
    });
    notify("ui/notifications/initialized", {});
    hydrateFromOpenAI();
  } catch (error) {
    console.error("Chappie reading bridge initialization failed", error);
    hydrateFromOpenAI();
    if (!mountedReadingId) app.textContent = "Unable to initialize the Chappie reading component.";
  }
})();
