import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const READING_URI = "ui://chappie/reading-v1.html";
const REVIEW_URI = "ui://chappie/review-v1.html";

const readingHtml = readFileSync("public/mcp-reading-widget.html", "utf8");
const reviewHtml = readFileSync("public/mcp-review-widget.html", "utf8");

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

  registerAppResource(server, "chappie-reading", READING_URI, {}, async () => ({
    contents: [{
      uri: READING_URI,
      mimeType: RESOURCE_MIME_TYPE,
      text: readingHtml,
      _meta: {
        "openai/widgetDescription": "Interactive language reading with contextual hidden annotations.",
      },
    }],
  }));

  registerAppResource(server, "chappie-review", REVIEW_URI, {}, async () => ({
    contents: [{
      uri: REVIEW_URI,
      mimeType: RESOURCE_MIME_TYPE,
      text: reviewHtml,
      _meta: {
        "openai/widgetDescription": "Interactive retrieval-practice review with semantic free-text handoff.",
      },
    }],
  }));

  registerAppTool(server, "render_reading", {
    title: "Render interactive reading",
    description: "Render a Chappie language-learning passage. Use structured segments; annotate only text that should reveal pronunciation/translation/meaning on interaction.",
    inputSchema: { reading: readingSchema },
    outputSchema: { reading: readingSchema },
    _meta: { ui: { resourceUri: READING_URI } },
  }, async ({ reading }) => ({
    content: [{ type: "text", text: `Interactive reading: ${reading.title || reading.id}` }],
    structuredContent: { reading },
  }));

  registerAppTool(server, "render_review", {
    title: "Render interactive review",
    description: "Render a Chappie retrieval-practice review. Multiple choice may be locally graded; free-text answers must be semantically reviewed by the model rather than exact-string graded.",
    inputSchema: { review: reviewSchema },
    outputSchema: { review: reviewSchema },
    _meta: { ui: { resourceUri: REVIEW_URI } },
  }, async ({ review }) => ({
    content: [{ type: "text", text: `Interactive review: ${review.title || review.id}. Free-text answers should be discussed semantically after submission.` }],
    structuredContent: { review },
  }));

  return server;
}

const port = Number(process.env.PORT ?? 8787);
const MCP_PATH = "/mcp";

const httpServer = createServer(async (req, res) => {
  if (!req.url) return res.writeHead(400).end("Missing URL");
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/") {
    return res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end("Chappie MCP Apps server");
  }

  if (url.pathname === MCP_PATH && new Set(["POST", "GET", "DELETE"]).has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const server = createChappieServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`Chappie MCP server listening on http://localhost:${port}${MCP_PATH}`);
});
