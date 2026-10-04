# Stage 2 plan — ChatGPT / MCP integration

## Goal

Turn the preserved Stage 1 reading and review components into a reusable ChatGPT app/plugin that can be invoked from compatible chat sessions without depending on one conversation's private inline-rendering environment.

The Stage 1 widgets remain the reference behaviour. Stage 2 should provide the thinnest practical host integration around them.

## Non-goals

Stage 2 is **not** intended to build:

- a Japanese-only tutoring engine
- a large SaaS backend
- a user-account system unless later required
- a persistent spaced-repetition database unless later required
- a replacement UI unrelated to the working Stage 1 components

## Product scope

At minimum, Chappie should support:

- Japanese reading/review
- English reading/review
- architecture that can extend to other languages

The LLM supplies language-specific pedagogical content. Chappie supplies reusable interaction.

## Proposed integration shape

Conceptually:

```text
ChatGPT / LLM
    │
    │ structured reading or review data
    ▼
Chappie MCP / App layer
    │
    ├── render_reading(...)
    │      └── Chappie reading component
    │
    └── render_review(...)
           └── Chappie review component
                  │
                  └── answer payload back to active chat
```

Exact tool names may change to fit the current OpenAI Apps SDK conventions, but the separation should remain.

## 1. Reading integration

The reading tool/resource should receive structured content equivalent to the Stage 1 reading contract:

```json
{
  "id": "reading-id",
  "title": "...",
  "intro": "...",
  "paragraphs": [
    [
      {"text": "..."},
      {"text": "...", "reading": "...", "meaning": "..."}
    ]
  ]
}
```

For languages where `reading` is not the best concept, Stage 2 may evolve the contract toward a more neutral field such as `pronunciation` or `assist`, while maintaining backward compatibility with the Japanese reference examples.

The host should render the existing contextual-assistance behaviour rather than asking the model to generate HTML each time.

## 2. Review integration

The review tool/resource should receive structured question data equivalent to the Stage 1 review contract.

Question types initially remain small and explicit:

- `text`
- `textarea`
- `multiple_choice`

More types should only be added when there is a real learning need.

## 3. Answer handoff — high priority

A completed review should naturally continue into LLM discussion.

### Preferred path: automatic return to the active conversation

On submission, Chappie should pass a structured payload back to the current ChatGPT/LLM session and trigger or enable a semantic review turn.

Payload should include at least:

```json
{
  "session_id": "review-id",
  "answers": [
    {
      "question_id": "q1",
      "prompt": "...",
      "type": "text",
      "response": "...",
      "needs_review": true
    },
    {
      "question_id": "q2",
      "prompt": "...",
      "type": "multiple_choice",
      "response": "b",
      "local_result": "correct",
      "needs_review": false
    }
  ]
}
```

The LLM should then review the session according to the semantic-review rules in `behaviour-spec.md`.

### Important implementation question

Early in Stage 2, verify exactly what the current ChatGPT App SDK/MCP bridge allows an embedded component to do:

- Can it directly submit structured data into the active conversation?
- Does it require a user-triggered host action/tool invocation?
- Can a component request that ChatGPT continue with a model turn?
- What user-consent or UI rules apply?

Do not assume browser `postMessage` or a generic DOM event is sufficient. Use the officially supported host bridge.

### Second-best path: explicit host action

If silent/automatic conversational submission is not permitted, the review should expose a clear button such as:

`Send answers for review`

The user should not need to copy text manually. Clicking the action should pass the structured review payload through the supported host bridge and continue the chat workflow.

### Universal fallback: formatted click-to-copy block

If host handoff is unavailable, the component must provide a well-formatted answer block and one-click Copy button.

Example:

```text
Chappie review answers
Session: review-2026-10-03

Q1 — 雪置き場の読み方
ゆきおきば

Q2 — 「しきち」を漢字で
敷地

Q3 — 支障の読み方と意味
ししょう — disruption
```

Requirements:

- preserve raw user responses exactly
- include question numbers/ids and preferably prompts
- easy for an LLM to parse
- copy with one action
- show clear copied/success feedback
- remain available for debugging even when automatic handoff is enabled

## 4. Host capability layer

Avoid baking ChatGPT-specific transport into the core rendering functions where possible.

A useful Stage 2 separation may be:

```text
core widget
   │ emits review payload
   ▼
host adapter
   ├── ChatGPT Apps SDK adapter
   └── standalone browser fallback
```

This keeps the widgets testable outside ChatGPT and makes future embedding elsewhere possible.

The existing `chappie:review-submit` event is a Stage 1 browser-level seam, not necessarily the final ChatGPT transport API.

## 5. Language-neutral evolution

Before freezing the Stage 2 schema, review Japanese-specific naming.

Potential evolution:

```json
{
  "text": "固定資産税",
  "annotation": {
    "pronunciation": "こていしさんぜい",
    "meaning": "fixed asset tax; property tax"
  }
}
```

For English learning, an annotation might instead contain:

```json
{
  "text": "reluctant",
  "annotation": {
    "translation": "気が進まない",
    "meaning": "unwilling or hesitant to do something"
  }
}
```

The rendering layer should be able to show the language-appropriate primary hint without assuming ruby/furigana is always appropriate.

Do not over-generalise the schema prematurely. Keep Stage 2 small while ensuring Japanese is not hard-coded into the architecture.

## 6. Semantic review contract

When review answers arrive back in the LLM conversation, the app/skill instructions should request the established review style:

- review every answer
- classify `Correct`, `Partly correct`, or `Incorrect`
- state what the learner already knew
- give the correct answer
- explain gaps or confusion
- include useful pronunciation/reading patterns, collocation, grammar, register, components, or examples where relevant
- keep correct-answer feedback short
- give more detail for partial/incorrect answers
- treat total score as secondary

This behaviour belongs in the app/skill instructions rather than JavaScript heuristics.

## 7. Skills/instructions layer

The eventual plugin/app should include concise instructions telling the model when and how to use Chappie.

Examples:

- use the interactive reading component when a user asks for a Chappie-style language reading
- use the review component for retrieval practice
- supply structured data rather than hand-written HTML
- do not replace the interactive UI with footnotes, permanent glosses, or ordinary Markdown when the component is available
- send free-text answers to semantic review

Language-specific learner-profile instructions should remain conversation/user configuration rather than hard-coded global Chappie rules.

## 8. Hosting and distribution

Development may use a temporary tunnel if required by the platform.

Production objective:

- one stable hosted integration
- users install/add Chappie
- no local setup for ordinary users
- no developer API keys/tunnels required by learners

Because the first version can be stateless, hosting requirements should be modest.

## 9. Suggested Stage 2 implementation sequence

1. **Check current official Apps SDK/MCP documentation** before choosing scaffolding, especially component-to-chat handoff capabilities.
2. Create the minimal MCP/App SDK project around the existing repo.
3. Serve/render `reading-widget` through one app tool/resource using structured input.
4. Serve/render `review-widget` through one app tool/resource using structured input.
5. Implement the supported ChatGPT host bridge for review submission.
6. If automatic conversational handoff is restricted, implement explicit `Send answers for review`.
7. Implement the formatted click-to-copy fallback regardless.
8. Test in one ChatGPT account/new conversation.
9. Test in a second account/conversation to verify that Chappie solves the original portability problem.
10. Test at least one English-learning example to confirm the architecture is not Japanese-only.
11. Only after those tests, decide whether additional persistence, auth, or distribution work is needed.

## 10. Definition of success for Stage 2

Stage 2 is successful when a fresh compatible ChatGPT conversation can:

1. invoke Chappie without having access to the original development chat
2. render the same quality interactive reading UI
3. render the same quality review UI
4. collect the learner's answers without false free-text grading
5. return those answers to the LLM for natural review/discussion with no manual copy/paste in the preferred path
6. provide a one-click formatted copy fallback if direct handoff is unavailable
7. work for at least Japanese and English examples

At that point Chappie has achieved its original purpose: the useful interaction design is portable, reusable, and no longer dependent on one chat's context or private rendering capability.
