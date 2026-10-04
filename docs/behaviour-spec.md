# Chappie behaviour specification

This document preserves the behaviour of the interactive Japanese reading and review components developed through repeated use in ChatGPT. It is the canonical Stage 1 reference for later MCP / ChatGPT integration.

## 1. Purpose

Chappie provides two reusable UI components:

1. **Interactive reading** — a Japanese passage with hidden furigana and contextual vocabulary help.
2. **Interactive review** — a retrieval-first quiz with safe local grading for closed-form questions and semantic review for free text.

The components should be content-driven. ChatGPT (or another model) supplies structured passage/question data; the component owns interaction, layout, accessibility, and grading behaviour.

The reference learner is an adult who previously reached roughly JLPT N2 / old 2級 level but is rusty. The UI itself should remain reusable for other learner profiles.

---

## 2. Interactive reading

### 2.1 Content shape

A reading contains:

- `title`
- optional `intro`
- 3–4 substantial Japanese paragraphs in normal use
- each paragraph is an ordered array of segments
- a segment always contains `text`
- an interactive segment additionally contains `reading` and `meaning`

Example segment:

```json
{
  "text": "固定資産税",
  "reading": "こていしさんぜい",
  "meaning": "fixed asset tax; property tax"
}
```

Plain kana, punctuation, particles, and deliberately unannotated words may be represented as plain `text` segments.

### 2.2 Furigana coverage

For the Japanese-learning use case, annotation should be **generous**.

Do not annotate only words judged difficult for an N2 learner. A rusty learner may know the word but fail to retrieve the reading quickly. Add hidden furigana to most kanji words and compounds whenever there is a reasonable chance the reading may not return immediately, including many common N3/N4 words.

It is acceptable to leave only very basic, unmistakable words unannotated.

Important: this is a content-generation rule, not a rendering rule. The widget renders whatever segments are annotated in its input.

### 2.3 Default appearance

- Show only normal Japanese text in the passage by default.
- Furigana is hidden by default.
- Do not permanently place readings in brackets, parentheses, footnotes, a vocabulary list, or a definition panel under the passage.
- The reading should feel like normal Japanese prose until the learner asks for help.

### 2.4 Hover and focus behaviour

For an annotated term:

- pointer hover reveals only that term's furigana
- keyboard focus may also reveal furigana
- leaving the term hides furigana again unless the term is selected

Furigana should appear above the word and should not permanently alter line height.

### 2.5 Click / tap behaviour

Clicking or tapping an annotated word selects it.

Selection must:

- reveal its furigana
- open a small contextual tooltip near the selected word
- show the reading
- show the English meaning for that exact word/compound
- deselect the previously selected word

Clicking the selected word again dismisses it.

Clicking elsewhere in the document dismisses the current selection.

Pressing Escape dismisses the current selection.

On touch devices, one tap must be enough to reveal the reading and meaning clearly.

### 2.6 Tooltip placement

The tooltip is contextual, not a fixed definition area.

Preferred placement:

1. below the selected term
2. above the term when there is insufficient room below

The tooltip must be clamped horizontally so it does not clip outside the reading card on narrow/mobile layouts.

Reposition it after layout changes such as window resize if a term remains selected.

### 2.7 Accessibility

Interactive terms should:

- be keyboard focusable
- expose button-like semantics
- activate with Enter or Space
- have a visible focus state

The tooltip should use `role="tooltip"`.

### 2.8 Safety / rendering

Passage content should be rendered as text, not injected as arbitrary HTML. Structured segments prevent model-supplied content from becoming executable markup.

---

## 3. Interactive review

### 3.1 Goal

The review is a retrieval exercise, not a teaching page shown before the learner answers.

Normal session size: roughly 6–10 questions.

Useful question types include:

- kanji → reading
- kana → kanji
- vocabulary meaning in context
- natural phrasing / register
- grammar meaning
- 1–2 reading-comprehension questions
- occasional productive use of prior weak points

### 3.2 Question types

Stage 1 supports:

- `text` — one-line free response
- `textarea` — longer free response
- `multiple_choice` — one answer from a set of options

Closed-form questions may include a local `answer` and post-submission `explanation`.

Free-response questions may include a `reviewHint` for the later semantic reviewer, but **must not contain an exact-string grading rule**.

### 3.3 Retrieval first

Before submission:

- do not reveal correct answers
- do not show teaching explanations that give away the answer
- do not pre-fill responses

The user should answer from memory first.

### 3.4 Closed-form grading

Multiple-choice and other unambiguous closed-form questions may be graded locally after submission.

After submission the widget may show:

- correct / incorrect
- the explanation supplied with the question

A closed-form subtotal is acceptable.

### 3.5 Free-text grading — critical rule

**Never grade free text by exact string matching.**

A learner may enter:

- partial knowledge
- an explanation rather than the expected short form
- mixed English and Japanese
- one correct kanji reading and one unknown component
- a correct answer plus extra incorrect material
- a natural paraphrase that differs from the expected wording

If the UI itself cannot genuinely assess meaning, it must label the answer:

`要レビュー`

or an equivalent `needs_review` status.

It must not show a misleading red X.

Free-text items should not be included in a numeric score unless they have subsequently been semantically reviewed.

### 3.6 Review submission payload

On submission, collect every response in a structured payload containing at least:

- review/session id
- question id
- prompt
- question type
- user's raw response
- local grading result for closed-form items
- `needs_review: true` for free-response items

The Stage 1 widget dispatches this as a browser `CustomEvent` named:

`chappie:review-submit`

A later MCP / ChatGPT wrapper should listen for this event and pass the payload back to the model for semantic review.

### 3.7 Semantic review style

When free-text responses reach the model, review **every answer**, not only mistakes.

Classify each answer as:

- **Correct**
- **Partly correct**
- **Incorrect**

For each answer:

1. state what the learner already knew or got right
2. give the correct answer
3. explain what was missing, confused, or mistaken
4. include relevant on/kun readings, kanji component patterns, nuance, register, or collocation when useful
5. give a short natural example when useful

Correct answers can receive brief confirmation. Partly correct and incorrect answers should receive more teaching detail.

A total score is optional and secondary to diagnosis.

---

## 4. Spaced repetition / weak points

The UI does not own long-term memory in Stage 1, but later generation logic should maintain a running weak-point set.

Suggested schedule after a miss or partial recall:

- first retest: about 2–4 days
- second retest: about 1 week
- later retest: about 2–4 weeks
- retire from active review only after repeated successful recall in varied contexts

Do not merely repeat the identical question. Vary recognition, production, sentence context, and related compounds.

A review should be primarily based on the previous reading, with a small number of older weak points deliberately recycled.

---

## 5. Visual behaviour

Both widgets should:

- fit naturally inside a ChatGPT-style inline card
- work at narrow/mobile widths
- avoid hard-coded light-only colours
- use CSS custom properties where the host provides them
- provide sensible standalone fallbacks for browser testing
- avoid decorative complexity; the content is primary

The reference implementation uses these host variables when present:

- `--viz-text`
- `--viz-muted`
- `--viz-border`
- `--viz-card`
- `--viz-panel`
- `--viz-accent`

---

## 6. Data ownership and future integration

Stage 1 separates **content** from **component behaviour**.

ChatGPT/model responsibilities:

- choose topic and level
- write the passage
- decide which terms receive furigana
- supply readings and meanings
- generate quiz questions
- decide which older weak points to recycle
- semantically review free text

Widget responsibilities:

- render passage/questions
- interaction and layout
- hidden furigana behaviour
- tooltip placement
- accessibility
- local grading of closed-form questions
- preserve raw free-text responses without false grading
- emit review payload

This division should remain intact when Chappie is wrapped as an MCP / ChatGPT app.

---

## 7. Stage 1 reference API

### Reading

```js
window.ChappieReading.mount(rootElement, readingData)
```

Expected top-level shape:

```json
{
  "id": "reading-id",
  "title": "Reading title",
  "intro": "Optional intro",
  "paragraphs": [
    [
      {"text": "北海道", "reading": "ほっかいどう", "meaning": "Hokkaido"},
      {"text": "では…"}
    ]
  ]
}
```

### Review

```js
window.ChappieReview.mount(rootElement, reviewData)
```

Expected top-level shape:

```json
{
  "id": "review-id",
  "title": "Review title",
  "intro": "Instructions",
  "questions": [
    {
      "id": "q1",
      "type": "text",
      "prompt": "破損の読み方は？"
    },
    {
      "id": "q2",
      "type": "multiple_choice",
      "prompt": "最も近い意味は？",
      "options": [
        {"value": "a", "label": "…"},
        {"value": "b", "label": "…"}
      ],
      "answer": "b",
      "explanation": "…"
    }
  ]
}
```

The example JSON files are the canonical concrete examples for Stage 1.
