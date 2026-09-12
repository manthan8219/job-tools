import "dotenv/config";
import { server } from "./server.js";
import { resumeRepository } from "./resume/repositories/resumeRepository.js";
import { userProfileService } from "./user-profile/services/userProfileService.js";
import { logger } from "./utils/index.js";
import http from "node:http";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function main() {
  logger.info("Starting up MCP server and checking databases...");
  
  // Programmatically create Atlas Search Indexes
  await resumeRepository.setupIndexes();
  
  // Initialize Postgres tables for user profile (job applications)
  await userProfileService.init();

  // Create an HTTP Server for SSE
  const httpServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "", `http://localhost:${PORT}`);
      
      // Provide a visible endpoint for browsers
      if (url.pathname === "/" || url.pathname === "/tools") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          server: "job-applier-mcp",
          status: "online",
          message: "This is an MCP (Model Context Protocol) Server. To use these tools, connect an MCP client (like Cursor or Claude) using the SSE URL: /sse",
          sseEndpoint: "https://job-tools.onrender.com/sse",
          toolsAvailable: Object.keys((server as any).originalTools || {})
        }, null, 2));
      }

      // Mastra handles both the /sse (GET) and /message (POST) paths internally
      await server.startSSE({
        url,
        ssePath: "/sse",
        messagePath: "/message",
        req,
        res,
      });
    } catch (err: any) {
      logger.error("SSE handling error", err);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Internal Server Error");
      }
    }
  });

  httpServer.listen(PORT, () => {
    logger.info(`✅ MCP Server running over SSE!`);
    logger.info(`SSE URL: http://localhost:${PORT}/sse`);
    logger.info(`Message URL: http://localhost:${PORT}/message`);
    logger.info(`To connect your MCP client (like Cursor/Claude), set it to SSE type and point to http://localhost:${PORT}/sse`);
  });
}

if (process.env.NODE_ENV !== "test") {
  main().catch((error) => {
    console.error("Fatal error running MCP server:", error);
    process.exit(1);
  });
}
