# Stage 2 implementation status

Stage 2 is now underway on branch `stage-2-mcp-wrapper`.

## Implemented

- Minimal stateless Node MCP server at `server.js`.
- MCP Apps resources for reading and review views.
- `render_reading` tool with language-neutral annotation support while remaining backward-compatible with Stage 1 `reading` / `meaning` fields.
- `render_review` tool with the Stage 1 question types: `text`, `textarea`, and `multiple_choice`.
- MCP-aware reading component at `public/mcp-reading-widget.html` preserving the Stage 1 contextual hint / popover interaction.
- MCP-aware review component at `public/mcp-review-widget.html` preserving local closed-form grading and semantic-review treatment for free text.
- Review answer handoff through the open MCP Apps bridge:
  - `ui/update-model-context` for structured submission data
  - `ui/message` to continue the active conversation with a semantic-review request
- ChatGPT compatibility fallback through `window.openai.sendFollowUpMessage` when available.
- One-click formatted answer-copy fallback retained even when direct handoff works.
- CI smoke test for Node syntax plus server startup / health endpoint.

## Current architecture

```text
ChatGPT / compatible MCP Apps host
        │
        ├── render_reading({ reading })
        │        │
        │        └── ui://chappie/reading-v1.html
        │
        └── render_review({ review })
                 │
                 └── ui://chappie/review-v1.html
                          │
                          ├── local MC grading
                          ├── structured review payload
                          ├── ui/update-model-context
                          ├── ui/message
                          └── copy fallback
```

The Stage 1 files remain untouched as reference implementations.

## Local run

Requires Node 20+.

```bash
npm install
npm start
```

The MCP endpoint is:

```text
http://localhost:8787/mcp
```

The health endpoint is:

```text
http://localhost:8787/
```

## MCP Inspector

```bash
npm run inspect
```

Select Streamable HTTP and connect to `http://localhost:8787/mcp`.

Verify that the server exposes:

- `render_reading`
- `render_review`

and that both tools return structured content plus an MCP Apps UI resource.

## ChatGPT development test

For ChatGPT testing, expose the local server over HTTPS using a development tunnel or deploy the branch to a temporary HTTPS host. Add the resulting `<https-url>/mcp` endpoint as a developer plugin connection, then start a fresh conversation with Chappie enabled.

Test sequence:

1. Ask Chappie to render a short Japanese reading.
2. Confirm hidden pronunciation appears on hover/focus and pronunciation + meaning appear on click/tap.
3. Ask for a review containing both free-text and multiple-choice questions.
4. Submit answers.
5. Confirm multiple-choice questions grade locally.
6. Confirm free-text questions are marked for semantic review rather than exact-string graded.
7. Confirm submission posts a follow-up into the active conversation and the model reviews every response.
8. Confirm `Copy answers` works as a fallback.
9. Repeat with an English-learning reading using `annotation.translation` / `annotation.meaning` rather than Japanese furigana.
10. Repeat in a second ChatGPT account / fresh conversation to validate the original portability requirement.

## Still required before Stage 2 is complete

- Run the branch through MCP Inspector.
- Test the real iframe bridge in ChatGPT.
- Verify `ui/message` and `ui/update-model-context` behaviour with the production ChatGPT host, including any consent / UX constraints.
- Test touch behaviour on mobile.
- Test an English-learning example end-to-end.
- Test from a second account / conversation.
- Decide on the smallest stable HTTPS deployment for normal users.
- Add packaging / publication metadata only after the integration behaviour is verified.

## Deliberately deferred

These remain outside Stage 2 unless testing establishes a concrete need:

- user accounts
- persistent learner database
- spaced-repetition backend
- large SaaS architecture
- authentication
- Japanese-specific tutoring logic in the server
