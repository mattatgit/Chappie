# Project context

## What Chappie is

Chappie is a reusable interactive language-learning UI for ChatGPT. It began as two custom inline components developed through repeated use in one ChatGPT conversation:

1. an interactive reading component
2. an interactive review/test component

The original use case was Japanese, but Chappie is **not** intended to be a Japanese-learning engine. The reusable software should be language-agnostic enough to support English and potentially other languages later.

The model/LLM remains responsible for language pedagogy, content generation, vocabulary choice, review logic, and semantic feedback. Chappie is the interaction/rendering layer.

## Why the project exists

The original Japanese reading and review components worked very well in one ChatGPT conversation, but the same inline component capability was not consistently available in other ChatGPT chats or accounts. In particular, another user/chat could be told that no equivalent inline hover/click component was available, or could receive downloadable HTML instead of a genuinely inline interactive experience.

That created two problems:

- the useful interaction pattern was effectively tied to one chat environment
- the implementation risked being lost if that chat eventually ran out of useful context

Chappie was created to move the working implementation into source control and make it reusable across compatible ChatGPT conversations through an eventual plugin / MCP / ChatGPT app layer.

## Origin of the interaction design

The current reference components are not speculative mockups. They are derived from interaction patterns that were actually used successfully in ChatGPT.

### Reading component behaviour established through use

The successful reading experience had these characteristics:

- normal prose is visible by default
- pronunciation/reading help is hidden by default
- hovering an annotated word reveals its reading
- clicking or tapping an annotated word reveals reading + meaning in a small contextual tooltip near the word
- the tooltip must avoid clipping on narrow layouts
- only the selected word remains active
- clicking elsewhere dismisses the tooltip
- touch interaction must work naturally
- keyboard interaction should also work

The initial Japanese use case used furigana, but the broader Chappie concept is the same: each language may expose the most useful pronunciation, gloss, translation, definition, or explanation for an annotated span.

### Review component behaviour established through use

The successful review experience had these characteristics:

- retrieval comes before teaching
- closed-form questions may be locally graded
- free-text responses must not be exact-string graded
- partial knowledge must be preserved rather than falsely marked wrong
- free-text responses should be sent back to the LLM for semantic review
- semantic review should classify answers as Correct / Partly correct / Incorrect and explain what the learner knew, what was missing, and what to reinforce

## Core product intent

Chappie should provide reusable interaction primitives, not a fixed curriculum.

Examples of possible future uses:

- Japanese reading with hidden furigana and English glosses
- English reading for a Japanese learner with Japanese glosses
- vocabulary-intensive reading in other languages
- review/test sessions generated from a previous passage
- pronunciation/meaning assistance adapted to the language pair

The same UI should be usable with different learner profiles and levels.

## Separation of responsibilities

### The LLM should own

- target language and learner level
- passage topic and wording
- which spans are annotated
- readings/pronunciations
- meanings/translations/explanations
- question generation
- choice of previous weak points to recycle
- semantic grading of free-text responses
- discussion of answers with the learner

### Chappie should own

- rendering the passage and quiz
- hover/tap/focus interactions
- contextual help UI
- accessibility
- narrow/mobile layout behaviour
- local grading of clearly closed-form questions
- preserving raw free-text responses
- passing review answers back to the host/LLM where possible
- providing a copyable fallback answer block where automatic handoff is not possible

## Related repository

`mattatgit/japanese` is separate from Chappie.

- **Chappie** contains reusable application software and UI behaviour.
- **japanese** contains one learner's Japanese vocabulary, weak points, and session history.

Do not merge those responsibilities. Chappie should not depend on one learner's study data or on Japanese-specific persistent memory.

## Stage history

### Stage 1 — preservation/reference implementation

Completed first because the working implementation needed to survive outside chat context.

Stage 1 contains:

- `public/reading-widget.html`
- `public/review-widget.html`
- example structured data
- a detailed behaviour specification

The Stage 1 files are deliberately simple and dependency-free so another developer or ChatGPT session can inspect the working interaction model directly.

### Stage 2 — planned ChatGPT integration

The next stage is to wrap the preserved components in the smallest practical MCP / ChatGPT app/plugin layer so the UI can be invoked from compatible chats.

The goal is not to rewrite the widgets unnecessarily. The Stage 1 implementation is the reference behaviour; Stage 2 should mostly provide transport, lifecycle, host integration, and answer handoff.

## Distribution goal

The eventual experience should be simple for users:

- install/add Chappie to ChatGPT
- use it in a compatible conversation
- no per-user tunnels, local servers, or API-key setup for ordinary use

Development may require a hosted MCP endpoint or temporary tunnel, but that complexity should not become part of the normal end-user workflow.
