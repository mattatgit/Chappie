# Architectural and product decisions

This file records decisions already made so future work does not repeatedly reopen them without a strong reason.

## D1. Chappie is a language-learning interaction layer, not a Japanese-learning engine

**Decision:** Chappie must remain reusable for English and potentially other languages.

Japanese is the first and best-developed use case, but Japanese-specific behaviour such as furigana is one language-specific rendering strategy, not the product boundary.

Implications:

- data contracts should avoid assuming all pronunciation help is furigana
- the host/model decides the language pair and what kind of annotation is useful
- UI naming and APIs should stay as language-neutral as practical
- Japanese-specific examples are acceptable in docs/tests, but core architecture should not require Japanese

## D2. Preserve the existing working component as the reference implementation

**Decision:** Do not redesign the reading/review UI from scratch merely because Chappie is being packaged as an app/plugin.

The Stage 1 HTML/CSS/JS components are based on behaviour already proven useful in a real ChatGPT learning workflow. Stage 2 should wrap and adapt them rather than replacing them unnecessarily.

An OpenAI/App SDK example may be used for transport/scaffolding, but not as the source of the interaction design.

## D3. Separate content generation from component behaviour

**Decision:** The LLM supplies structured content; Chappie owns interaction and presentation.

The LLM decides:

- passage text
- learner level
- annotations
- readings/pronunciations
- meanings/glosses
- quiz questions
- spaced-repetition choices
- semantic review

Chappie decides:

- rendering
- hover/tap/focus behaviour
- tooltip/popover layout
- accessibility
- local closed-form grading
- raw-answer preservation
- host handoff events/actions

This boundary should remain explicit.

## D4. Free-text answers are never exact-string graded

**Decision:** Chappie must not mark open responses right/wrong using literal string equality when meaning may vary.

Reason: learners often supply partial knowledge, explanatory text, mixed languages, correct paraphrases, or correct components alongside mistakes.

If genuine semantic grading is unavailable locally, Chappie must mark the response as `needs_review` / `要レビュー` and defer evaluation to the LLM.

## D5. LLM review/discussion is a first-class part of the test flow

**Decision:** A completed review should return the learner's answers to the active LLM/chat session for discussion whenever the host platform permits it.

This is not optional polish; it is part of the intended learning loop.

Priority order:

1. **Automatic handoff:** on submit, the component passes a structured answer payload back into the current ChatGPT/LLM conversation so the model can review and discuss every answer.
2. **Host-supported explicit action:** if automatic message injection is not permitted, provide a clear action such as “Send answers for review” that invokes the host bridge/tool with the structured payload.
3. **Copy fallback:** if no host handoff is possible, show a clean formatted answer block with a one-click Copy button so the learner can paste it into chat manually.

The current Stage 1 browser event `chappie:review-submit` exists specifically to support the future bridge.

The formatted fallback should be easy for an LLM to parse, for example:

```text
Chappie review answers
Session: review-2026-10-03

Q1: ゆきおきば
Q2: 敷地
Q3: ししょう — disruption
...
```

Do not force users to manually reconstruct answers question by question.

## D6. Closed-form local grading is useful, but secondary to discussion

**Decision:** Multiple-choice and similarly unambiguous questions may be graded immediately in the component.

However, the primary learning value remains the LLM's diagnostic discussion, particularly for productive/free-response items.

A numerical total score is optional and should not dominate the experience.

## D7. Retrieval comes before teaching

**Decision:** Review/test components should not expose answers or teaching material before submission.

Hints that reveal the answer, permanent vocab lists, or answer explanations shown in advance undermine the retrieval practice goal.

## D8. Contextual assistance belongs near the selected text

**Decision:** Reading help should appear contextually near the selected word/phrase rather than in a permanent glossary or definition panel at the bottom.

This was a specific improvement developed through use and is part of the reference experience.

## D9. Annotation is generous for rusty learners, but model-controlled

**Decision:** In the original Japanese use case, most kanji compounds receive hidden furigana, including many common N3/N4 words, because recognition may remain while reading recall is rusty.

This is a content-generation policy supplied by the model/profile, not a hard-coded widget heuristic.

Equivalent policies for other languages may differ.

## D10. Long-term learner memory does not belong inside the Stage 1 widgets

**Decision:** The widget itself should not become a persistent learner database.

Weak points and spaced-repetition history may later live in:

- the host application's memory/data layer
- a dedicated service
- another repository/source
- structured state supplied by ChatGPT

The component should accept the generated review content and return responses.

## D11. Keep personal study data separate from reusable software

**Decision:** `mattatgit/japanese` remains personal learning data. `mattatgit/Chappie` remains application code/specification.

Do not couple a general Chappie install to the personal Japanese repository.

## D12. End users should not configure tunnels or developer credentials

**Decision:** The final installed experience should not require normal users to set up tunnels, ports, local MCP servers, or API keys merely to use the component.

Temporary tunnelling is acceptable during development. Production should use a stable hosted integration or equivalent supported distribution route.

## D13. Prefer the smallest practical Stage 2 architecture

**Decision:** Start with a thin integration layer around the existing components, not a large backend or SaaS platform.

Initial Chappie can be effectively stateless apart from the data supplied by the conversation. Add persistence only when a concrete product requirement justifies it.

## D14. Automatic answer handoff must degrade gracefully

**Decision:** Host restrictions must never make the review unusable.

The review component should detect or be told what host capabilities exist and progressively enhance:

- automatic submit to LLM when allowed
- explicit “send for review” action when required
- formatted click-to-copy block as universal fallback

The fallback should remain available even if automatic handoff exists, because copying answers can be useful for debugging or moving them between sessions.
