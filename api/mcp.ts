import "dotenv/config";
import { server } from "../src/server.js";

// Vercel Serverless Function Handler
export default async function handler(req: any, res: any) {
  // CORS Headers so Claude/Cursor can hit this endpoint securely
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const url = new URL(req.url || "", `${protocol}://${host}`);

    // Delegate to Mastra's SSE server handler
    await server.startSSE({
      url,
      ssePath: "/api/mcp",
      messagePath: "/api/mcp", // Same endpoint, different HTTP method (POST for messages)
      req,
      res,
    });
  } catch (err: any) {
    console.error("Vercel MCP Error:", err);
    res.status(500).send("Internal Server Error");
  }
}
