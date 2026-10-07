import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

const endpoint = process.env.CHAPPIE_MCP_URL ?? "http://127.0.0.1:8787/mcp";

function withTimeout(promise, label, ms = 15_000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const client = new Client(
  { name: "chappie-smoke", version: "0.2.0" },
  { versionNegotiation: { mode: "auto" } },
);
const transport = new StreamableHTTPClientTransport(new URL(endpoint));

try {
  await withTimeout(client.connect(transport), "MCP connect");

  const { tools } = await withTimeout(client.listTools(), "tools/list");
  const names = new Set(tools.map((tool) => tool.name));
  for (const required of ["render_reading", "render_review"]) {
    if (!names.has(required)) throw new Error(`Missing MCP tool: ${required}`);
  }

  const reading = {
    id: "ci-reading",
    title: "冬の朝",
    intro: "Chappie MCP smoke test",
    paragraphs: [[
      { text: "北海道", reading: "ほっかいどう", meaning: "Hokkaido" },
      { text: "の冬は" },
      { text: "寒い", reading: "さむい", meaning: "cold" },
      { text: "です。" },
    ]],
  };

  const result = await withTimeout(
    client.callTool({
      name: "render_reading",
      arguments: { reading },
    }),
    "tools/call render_reading",
  );

  if (result.isError) throw new Error("render_reading returned isError=true");
  if (result.structuredContent?.reading?.id !== reading.id) {
    throw new Error("render_reading returned unexpected structuredContent");
  }

  console.log(`MCP smoke test passed (${client.getProtocolEra() ?? "unknown era"}).`);
} finally {
  await transport.terminateSession().catch(() => {});
  await client.close().catch(() => {});
}
