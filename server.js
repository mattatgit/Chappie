import { createServer as createHttpServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { z } from "zod";

const READING_URI = "ui://chappie/reading-v1.html";
const REVIEW_URI = "ui://chappie/review-v1.html";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const readingHtml = readFileSync(path.join(rootDir, "public/mcp-reading-widget.html"), "utf8");
const reviewHtml = readFileSync(path.join(rootDir, "public/mcp-review-widget.html"), "utf8");

const annotationSchema = z.object({
  pronunciation: z.string().optional(),
  reading: z.string().optional(),
  translation: z.string().optional(),
  meaning: z.string().optional(),
}).optional();

const readingSegmentSchema = z.object({
  text: z.string(),
  reading: z.string().optional(),
  meaning: z.string().optional(),
  annotation: annotationSchema,
});

const readingSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  intro: z.string().optional(),
  paragraphs: z.array(z.array(readingSegmentSchema)),
});

const optionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

const questionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["text", "textarea", "multiple_choice"]),
  label: z.string().optional(),
  prompt: z.string(),
  options: z.array(optionSchema).optional(),
  answer: z.string().optional(),
  explanation: z.string().optional(),
  reviewHint: z.string().optional(),
});

const reviewSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  intro: z.string().optional(),
  questions: z.array(questionSchema),
});

function createChappieServer() {
  const server = new McpServer({ name: "chappie", version: "0.2.0" });

  registerAppResource(server, "chappie-reading", READING_URI, {}, async () => {
    console.log("[resource] chappie-reading");
    return {
      contents: [{
        uri: READING_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: readingHtml,
        _meta: {
          "openai/widgetDescription": "Interactive language reading with contextual hidden annotations.",
        },
      }],
    };
  });

  registerAppResource(server, "chappie-review", REVIEW_URI, {}, async () => {
    console.log("[resource] chappie-review");
    return {
      contents: [{
        uri: REVIEW_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: reviewHtml,
        _meta: {
          "openai/widgetDescription": "Interactive retrieval-practice review with semantic free-text handoff.",
        },
      }],
    };
  });

  registerAppTool(server, "render_reading", {
    title: "Render interactive reading",
    description: "Render a Chappie language-learning passage. Use structured segments; annotate only text that should reveal pronunciation/translation/meaning on interaction.",
    inputSchema: z.object({ reading: readingSchema }),
    outputSchema: z.object({ reading: readingSchema }),
    _meta: { ui: { resourceUri: READING_URI } },
  }, async ({ reading }) => {
    console.log("[tool] render_reading");
    return {
      content: [{ type: "text", text: `Interactive reading: ${reading.title || reading.id}` }],
      structuredContent: { reading },
    };
  });

  registerAppTool(server, "render_review", {
    title: "Render interactive review",
    description: "Render a Chappie retrieval-practice review. Multiple choice may be locally graded; free-text answers must be semantically reviewed by the model rather than exact-string graded.",
    inputSchema: z.object({ review: reviewSchema }),
    outputSchema: z.object({ review: reviewSchema }),
    _meta: { ui: { resourceUri: REVIEW_URI } },
  }, async ({ review }) => {
    console.log("[tool] render_review");
    return {
      content: [{ type: "text", text: `Interactive review: ${review.title || review.id}. Free-text answers should be discussed semantically after submission.` }],
      structuredContent: { review },
    };
  });

  return server;
}

const mcpHandler = createMcpHandler(createChappieServer);
const nodeHandler = toNodeHandler(mcpHandler, {
  onerror: (error) => console.error("MCP adapter error:", error),
});

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";
const MCP_PATH = "/mcp";

const httpServer = createHttpServer((req, res) => {
  const startedAt = Date.now();

  if (!req.url) return res.writeHead(400).end("Missing URL");
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  let finished = false;
  res.on("finish", () => {
    finished = true;
    console.log(`[http] ${req.method} ${url.pathname} -> ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  res.on("close", () => {
    if (!finished) {
      console.warn(`[http] ${req.method} ${url.pathname} -> connection closed after ${Date.now() - startedAt}ms`);
    }
  });

  if (url.pathname === MCP_PATH) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "content-type, mcp-session-id, mcp-protocol-version, mcp-method, mcp-name",
    );
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  }

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/") {
    return res
      .writeHead(200, { "content-type": "text/plain; charset=utf-8" })
      .end("Chappie MCP Apps server");
  }

  if (url.pathname === MCP_PATH && new Set(["POST", "GET", "DELETE"]).has(req.method)) {
    void nodeHandler(req, res);
    return;
  }

  res.writeHead(404).end("Not Found");
});

const shutdown = async () => {
  await mcpHandler.close().catch(() => {});
  httpServer.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

httpServer.listen(port, host, () => {
  console.log(`Chappie MCP server listening on http://${host}:${port}${MCP_PATH}`);
});
