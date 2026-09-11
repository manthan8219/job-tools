import "dotenv/config";
import { MCPServer } from "@mastra/mcp";
import { createUserTool, getUserTool } from "./tools/user/userTools.js";
import { loginTool, registerTool } from "./tools/auth/authTools.js";
import { createResumeTool, searchSimilarResumesTool } from "./tools/resume/resumeTools.js";
import { convertMdToPdfTool, convertLatexToPdfTool } from "./tools/utilities/converterTools.js";
import { resumeRepository } from "./resume/repositories/resumeRepository.js";
import { logger } from "./utils/index.js";

export const server = new MCPServer({
  name: "job-applier-mcp",
  version: "0.1.0",
  tools: {
    createUser: createUserTool,
    getUser: getUserTool,
    login: loginTool,
    register: registerTool,
    createResume: createResumeTool,
    searchSimilarResumes: searchSimilarResumesTool,
    convertMdToPdf: convertMdToPdfTool,
    convertLatexToPdf: convertLatexToPdfTool,
  },
});

import http from "node:http";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function main() {
  logger.info("Starting up MCP server and checking databases...");
  
  // Programmatically create Atlas Search Indexes
  await resumeRepository.setupIndexes();

  // Create an HTTP Server for SSE
  const httpServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "", `http://localhost:${PORT}`);
      
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
