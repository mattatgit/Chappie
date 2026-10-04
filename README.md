# Chappie

Chappie is a reusable interactive reading and review UI for language learning in ChatGPT and other compatible MCP Apps hosts.

The project began as a pair of working inline components used for Japanese study in a ChatGPT conversation. Stage 1 preserves those components as standalone reference implementations. Stage 2 wraps the same interaction model in the smallest practical MCP Apps integration so it can be invoked from fresh conversations and other accounts rather than depending on one chat's private rendering environment.

## Stage 1 reference components

### Interactive reading

`public/reading-widget.html`

- normal passage text by default
- hidden furigana / pronunciation assistance on annotated terms
- hover/focus reveals the primary hint
- click/tap reveals pronunciation/translation plus meaning near the selected text
- keyboard, touch, light/dark, and narrow-layout support

The Stage 1 widget consumes structured passage data. See `docs/example-reading.json`.

### Interactive review

`public/review-widget.html`

- free text, textarea, and multiple-choice questions
- closed-form questions may be locally graded
- free-text answers are never exact-string graded
- free-text answers are marked for semantic review
- submission emits a structured browser event for host integration

The Stage 1 widget consumes structured review data. See `docs/example-review.json`.

## Stage 2 MCP Apps integration

Current implementation is on `stage-2-mcp-wrapper`.

The Stage 2 server exposes two model-callable tools:

- `render_reading({ reading })`
- `render_review({ review })`

Each tool is linked to an MCP Apps UI resource through `_meta.ui.resourceUri`.

Stage 2 views live at:

- `public/mcp-reading-widget.html`
- `public/mcp-review-widget.html`

The review view uses the open MCP Apps bridge to:

1. keep closed-form grading local
2. preserve raw free-text answers without literal-string grading
3. place the structured review payload into model-visible context
4. send a follow-up message into the active conversation for semantic review
5. retain a formatted one-click copy fallback

The architecture remains deliberately stateless. The LLM supplies pedagogical content; Chappie supplies interaction and transport.

See `docs/stage-2-status.md` for current implementation and test status.

## Language-neutral data

Stage 2 accepts the original Japanese-friendly fields while also supporting a more neutral annotation object:

```json
{
  "text": "reluctant",
  "annotation": {
    "translation": "気が進まない",
    "meaning": "unwilling or hesitant to do something"
  }
}
```

For Japanese, existing Stage 1 input remains valid:

```json
{
  "text": "固定資産税",
  "reading": "こていしさんぜい",
  "meaning": "fixed asset tax; property tax"
}
```

## Local development

Requires Node 22.19+.

```bash
npm install
npm start
```

The server exposes:

```text
http://localhost:8787/mcp
```

Health check:

```text
http://localhost:8787/
```

Run MCP Inspector with:

```bash
npm run inspect
```

## Deploy for ChatGPT testing

The Stage 2 branch includes a Render Blueprint (`render.yaml`) for a small public HTTPS deployment.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/mattatgit/Chappie/tree/stage-2-mcp-wrapper)

After deployment, use the service's HTTPS URL plus `/mcp` as the MCP endpoint in ChatGPT developer mode, for example:

```text
https://<your-service>.onrender.com/mcp
```

The root URL (`/`) is the deployment health check.

## Repository layout

```text
Chappie/
├── .github/workflows/ci.yml
├── README.md
├── package.json
├── render.yaml
├── server.js
├── scripts/
│   └── mcp-smoke.mjs
├── docs/
│   ├── behaviour-spec.md
│   ├── decisions.md
│   ├── example-reading.json
│   ├── example-review.json
│   ├── project-context.md
│   ├── stage-2-plan.md
│   └── stage-2-status.md
└── public/
    ├── reading-widget.html
    ├── review-widget.html
    ├── mcp-reading-widget.html
    └── mcp-review-widget.html
```

## Product and architectural rules

The canonical behaviour and decisions are documented in:

- `docs/behaviour-spec.md`
- `docs/decisions.md`

Important constraints include:

- Chappie is a language-learning interaction layer, not a Japanese-learning engine.
- Stage 1 remains the reference interaction design.
- Free-text responses are semantically reviewed by the LLM, never exact-string graded.
- Retrieval comes before teaching in review mode.
- Long-term learner memory and persistence remain outside the widget layer unless a later requirement justifies them.
- Ordinary users should eventually install/add Chappie without configuring tunnels or developer credentials.
