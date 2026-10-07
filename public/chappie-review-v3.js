const app = document.getElementById("app");
let rpcId = 0;
const pending = new Map();
let bridgeReady = false;
let mountedReviewId = null;

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
  if (output?.review) mount(output.review);
}, { passive: true });

function renderFromResult(result) {
  const data = result?.structuredContent?.review;
  if (data) mount(data);
}

function hydrateFromOpenAI() {
  const data = window.openai?.toolOutput?.review;
  if (data) mount(data);
}

function reportHeight() {
  requestAnimationFrame(() => {
    window.openai?.notifyIntrinsicHeight?.({ height: document.documentElement.scrollHeight });
  });
}

function responseFor(item) {
  if (item.question.type === "multiple_choice") {
    const checked = item.control.querySelector('input[type="radio"]:checked');
    if (!checked) return { raw: "", value: "" };
    const option = (item.question.options || []).find((o) => o.value === checked.value);
    return { raw: option?.label || checked.value, value: checked.value };
  }
  const raw = item.control.value;
  return { raw, value: raw.trim() };
}

function formatted(payload) {
  const lines = ["Chappie review answers", `Session: ${payload.reviewId}`, ""];
  payload.responses.forEach((response, index) => {
    lines.push(`Q${index + 1} — ${response.prompt}`);
    lines.push(response.response || "[unanswered]");
    if (response.localStatus) lines.push(`Local status: ${response.localStatus}`);
    lines.push("");
  });
  return lines.join("\n");
}

function expectedAnswer(question) {
  if (!question?.answer) return "";
  if (question.type !== "multiple_choice") return question.answer;
  const option = (question.options || []).find((item) => item.value === question.answer);
  return option?.label || question.answer;
}

function buildReviewPrompt(payload) {
  const review = payload.reviewDefinition || {};
  const lines = [
    "Review this language-learning retrieval exercise in detail.",
    "",
    "Review rules:",
    "- Review every answer semantically; never exact-string grade free-text answers.",
    "- Classify every answer explicitly as Correct, Partly correct, or Incorrect.",
    "- Use Partly correct when the learner demonstrates meaningful knowledge but misses, confuses, or incorrectly states part of the answer. Do not force genuinely partial answers into a binary correct/incorrect judgment.",
    "- For each answer, identify what the learner already knew before explaining what was missing or mistaken.",
    "- Give the corrected or fuller answer where useful, and explain why.",
    "- Add useful context or one natural example when it helps learning rather than merely marking.",
    "- For language questions, include relevant pronunciation/reading, meaning, nuance, grammar, collocation, kanji information, or a natural example sentence when useful.",
    "- Keep fully correct answers relatively concise, but still give useful reinforcement. Give more detail for Partly correct and Incorrect answers.",
    "- Treat scores as secondary. End with a short summary of patterns, strengths, and the most useful things to revisit.",
    "- Respect a definitive local multiple-choice status unless the supplied review definition itself is inconsistent.",
    "",
  ];

  if (review.title) lines.push(`Review: ${review.title}`, "");
  if (review.sourceContext) {
    lines.push("Source context:", review.sourceContext, "");
  }
  if (Array.isArray(review.learningGoals) && review.learningGoals.length) {
    lines.push("Learning goals:");
    review.learningGoals.forEach((goal) => lines.push(`- ${goal}`));
    lines.push("");
  }

  const questions = Array.isArray(review.questions) ? review.questions : [];
  payload.responses.forEach((response, index) => {
    const question = questions[index] || {};
    lines.push(`Q${index + 1} — ${response.prompt}`);
    lines.push(`Learner answer: ${response.response || "[unanswered]"}`);
    if (response.localStatus) lines.push(`Local status: ${response.localStatus}`);
    const expected = expectedAnswer(question);
    if (expected) lines.push(`Reference answer: ${expected}`);
    if (question.explanation) lines.push(`Reference explanation: ${question.explanation}`);
    if (question.reviewHint) lines.push(`Review hint: ${question.reviewHint}`);
    lines.push("");
  });

  lines.push("Return the review directly to the learner. Do not merely repeat the answer key or local statuses.");
  return lines.join("\n");
}

async function copyText(text) {
  if (window.openai?.setClipboard) {
    try {
      await window.openai.setClipboard({ text });
      return true;
    } catch {}
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.append(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  return ok;
}

async function sendForReview(payload, statusEl) {
  const prompt = buildReviewPrompt(payload);
  const context = {
    reviewSubmission: payload,
    semanticReviewRules: [
      "Classify every answer as Correct, Partly correct, or Incorrect",
      "Review free-text responses semantically rather than by exact wording",
      "State what the learner already knew before describing gaps",
      "Give corrected answers, explanations, context, and useful examples",
      "For language questions add reading/pronunciation, nuance, grammar, collocation, kanji information, or examples when useful",
      "Keep correct-answer feedback concise and give more detail for partial/incorrect answers",
      "Treat scores as secondary and end with patterns and priorities to revisit",
    ],
  };

  try {
    if (bridgeReady) {
      try {
        await request("ui/update-model-context", { structuredContent: context });
      } catch (error) {
        console.warn("Model-context update unavailable", error);
      }
      await request("ui/message", {
        role: "user",
        content: [{ type: "text", text: prompt }],
      });
      statusEl.textContent = "Answers sent to the conversation for review.";
      return;
    }
  } catch (error) {
    console.error("Unable to send answers through MCP Apps bridge", error);
  }

  if (window.openai?.sendFollowUpMessage) {
    try {
      await window.openai.sendFollowUpMessage({ prompt });
      statusEl.textContent = "Answers sent to the conversation for review.";
      return;
    } catch (error) {
      console.error("ChatGPT compatibility handoff failed", error);
    }
  }

  statusEl.textContent = "Automatic handoff is unavailable here. Use Copy answers below.";
}

function mount(data) {
  if (!data || !Array.isArray(data.questions)) return;
  if (mountedReviewId === data.id && app.querySelector(".review")) return;
  mountedReviewId = data.id || "review";

  app.className = "";
  app.replaceChildren();

  const shell = document.createElement("section");
  shell.className = "review";
  const card = document.createElement("div");
  card.className = "card";

  if (data.title) {
    const h = document.createElement("h2");
    h.textContent = data.title;
    card.append(h);
  }
  if (data.intro) {
    const intro = document.createElement("p");
    intro.className = "intro";
    intro.textContent = data.intro;
    card.append(intro);
  }

  const form = document.createElement("form");
  const rendered = [];

  (data.questions || []).forEach((question, index) => {
    const section = document.createElement("section");
    section.className = "question";
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `Q${index + 1}${question.label ? ` · ${question.label}` : ""}`;
    const prompt = document.createElement("div");
    prompt.className = "prompt";
    prompt.textContent = question.prompt || "";
    section.append(meta, prompt);

    let control;
    if (question.type === "multiple_choice") {
      control = document.createElement("div");
      (question.options || []).forEach((option) => {
        const label = document.createElement("label");
        label.className = "choice";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `ch-${data.id}-${question.id}`;
        radio.value = option.value;
        const span = document.createElement("span");
        span.textContent = option.label;
        label.append(radio, span);
        control.append(label);
      });
    } else if (question.type === "textarea") {
      control = document.createElement("textarea");
      control.className = "textarea";
      control.autocomplete = "off";
    } else {
      control = document.createElement("input");
      control.className = "input";
      control.type = "text";
      control.autocomplete = "off";
    }

    const feedback = document.createElement("div");
    feedback.className = "feedback";
    feedback.hidden = true;
    section.append(control, feedback);
    form.append(section);
    rendered.push({ question, control, feedback });
  });

  const actions = document.createElement("div");
  actions.className = "actions";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "button primary";
  submit.textContent = "Check and send for review";
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "button";
  reset.textContent = "Reset";
  actions.append(submit, reset);
  form.append(actions);

  const summary = document.createElement("div");
  summary.className = "summary";
  summary.hidden = true;
  const answers = document.createElement("div");
  answers.className = "answers";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "button";
  copy.textContent = "Copy answers";
  const status = document.createElement("div");
  status.className = "status";
  summary.append(answers, document.createElement("br"), copy, status);
  form.append(summary);

  card.append(form);
  shell.append(card);
  app.append(shell);
  reportHeight();

  let last = null;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    let correct = 0;
    let total = 0;
    const responses = [];

    rendered.forEach((item) => {
      const q = item.question;
      const r = responseFor(item);
      item.feedback.hidden = false;
      item.feedback.className = "feedback";

      if (q.type === "multiple_choice") {
        total++;
        if (!r.value) {
          item.feedback.classList.add("muted");
          item.feedback.textContent = "Unanswered";
          responses.push({ questionId: q.id, type: q.type, prompt: q.prompt, response: "", value: "", localStatus: "unanswered", needsReview: false });
        } else {
          const ok = r.value === q.answer;
          if (ok) correct++;
          item.feedback.classList.add(ok ? "good" : "bad");
          item.feedback.textContent = `${ok ? "Correct." : "Incorrect."}${q.explanation ? ` ${q.explanation}` : ""}`;
          responses.push({ questionId: q.id, type: q.type, prompt: q.prompt, response: r.raw, value: r.value, localStatus: ok ? "correct" : "incorrect", needsReview: false });
        }
      } else {
        const answered = Boolean(r.value);
        item.feedback.classList.add("muted");
        item.feedback.textContent = answered ? "Needs semantic review — not exact-string graded." : "Unanswered";
        responses.push({ questionId: q.id, type: q.type, prompt: q.prompt, response: r.raw, localStatus: answered ? "needs_review" : "unanswered", needsReview: answered, reviewHint: q.reviewHint || "" });
      }
    });

    last = {
      reviewId: data.id,
      title: data.title || "",
      submittedAt: new Date().toISOString(),
      closedForm: { correct, total },
      reviewDefinition: data,
      responses,
    };

    answers.textContent = `Multiple choice: ${correct} / ${total}\n\n${formatted(last)}`;
    summary.hidden = false;
    status.textContent = "Sending answers to the conversation…";
    reportHeight();
    await sendForReview(last, status);
    submit.disabled = false;
  });

  copy.addEventListener("click", async () => {
    if (!last) return;
    const ok = await copyText(formatted(last));
    status.textContent = ok ? "Copied answers." : "Copy failed; select the answer block manually.";
  });

  reset.addEventListener("click", () => {
    form.reset();
    rendered.forEach(({ feedback }) => {
      feedback.hidden = true;
      feedback.textContent = "";
    });
    summary.hidden = true;
    last = null;
    status.textContent = "";
    reportHeight();
  });
}

hydrateFromOpenAI();
setTimeout(hydrateFromOpenAI, 0);
setTimeout(hydrateFromOpenAI, 250);
setTimeout(hydrateFromOpenAI, 1000);

(async () => {
  try {
    await request("ui/initialize", {
      appInfo: { name: "chappie-review", version: "0.2.0" },
      appCapabilities: { availableDisplayModes: ["inline"] },
      protocolVersion: "2026-01-26",
    });
    bridgeReady = true;
    notify("ui/notifications/initialized", {});
    hydrateFromOpenAI();
  } catch (error) {
    console.error("Chappie review bridge initialization failed", error);
    hydrateFromOpenAI();
    if (!mountedReviewId) app.textContent = "Unable to initialize the Chappie review component.";
  }
})();
