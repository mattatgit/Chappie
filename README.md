# Chappie

Chappie is a reusable interactive reading and review UI for language learning in ChatGPT.

The project began as a pair of working inline components used for Japanese study in a ChatGPT conversation. Stage 1 preserves those components and their behaviour as standalone HTML/CSS/JavaScript reference implementations before they are wrapped in an MCP / ChatGPT plugin.

## Stage 1 goals

- Preserve the working reading interaction outside chat context.
- Preserve the working review/test interaction outside chat context.
- Define stable JSON-shaped data contracts for passages and quizzes.
- Document the behaviour carefully enough that a future MCP/plugin layer can render the same UI without re-inventing it.
- Keep the reference implementation dependency-free and easy to inspect.

Stage 1 deliberately does **not** yet include MCP server code, hosting, authentication, plugin manifests, or deployment.

## Reference components

### Interactive reading

`public/reading-widget.html`

- normal passage text by default
- hidden furigana on annotated Japanese words
- hover/focus reveals furigana
- click/tap reveals reading + English meaning in a contextual card near the selected word
- only one selected word at a time
- click elsewhere or press Escape to dismiss
- tooltip collision handling on narrow layouts
- keyboard and touch support
- light/dark compatible styling using CSS custom properties with fallbacks

The widget consumes structured passage data. See `docs/example-reading.json`.

### Interactive review

`public/review-widget.html`

- supports free text, textarea and multiple-choice questions
- closed-form questions may be locally graded
- free-text answers are **never** marked right/wrong by exact string matching
- free-text answers are labelled `要レビュー`
- submitted answers are collected into a review payload
- the widget dispatches a `chappie:review-submit` browser event so a future ChatGPT/MCP wrapper can hand the answers back to the model for semantic review

The widget consumes structured review data. See `docs/example-review.json`.

## Behaviour specification

The canonical behaviour is documented in:

- `docs/behaviour-spec.md`

That file captures the interaction and pedagogical rules developed through actual use, including generous furigana coverage and diagnostic review of partial knowledge.

## Repository layout

```text
Chappie/
├── README.md
├── docs/
│   ├── behaviour-spec.md
│   ├── example-reading.json
│   └── example-review.json
└── public/
    ├── reading-widget.html
    └── review-widget.html
```

## Local testing

The two HTML files are self-contained reference implementations. Open either file in a browser to see it with embedded example data.

Each file also exposes a small JavaScript API:

```js
window.ChappieReading.mount(rootElement, readingData)
window.ChappieReview.mount(rootElement, reviewData)
```

A future MCP/App SDK wrapper can supply structured data and reuse the same rendering logic.

## Next stage

Stage 2 will wrap these preserved components in the smallest practical MCP / ChatGPT app layer so the reading and review experiences can be invoked from compatible ChatGPT conversations rather than depending on one chat's inline rendering environment.
