import { describe, it, expect } from "vitest";
import { MCPServer } from "@mastra/mcp";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { server } from "../src/server.js";

describe("MCP Server Base Setup", () => {
  it("should successfully instantiate an MCPServer", () => {
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(MCPServer);
  });

  it("should have correct server configuration", () => {
    const serverInfo = server.getServerInfo();
    expect(serverInfo).toBeDefined();
    expect(serverInfo.name).toBe("job-applier-mcp");
    expect(serverInfo.version_detail?.version).toBe("0.1.0");
  });

  it("should initialize with user tools registered", () => {
    const toolList = server.getToolListInfo();
    expect(toolList.tools.length).toBeGreaterThanOrEqual(10);
    expect(toolList.tools.some((t: any) => t.name === "createUser")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "getUser")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "login")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "register")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "createResume")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "getResume")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "getUserResumes")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "getLatestResume")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "searchSimilarResumes")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "convertMdToPdf")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "convertLatexToPdf")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "checkOnboardingCompleted")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "markOnboardingCompleted")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "searchCompanies")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "getCompanyDetails")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "saveJobScore")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "getJobScore")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "getUserTopScoredJobs")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "saveUserWork")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "getUserWork")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "getUserWorkList")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "getFeaturedUserWork")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "checkRepositoryScraped")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "uploadResumeFile")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "generateResumeUploadUrl")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "getResumeDownloadUrl")).toBe(true);
    expect(toolList.tools.some((t: any) => t.name === "deleteResumeFile")).toBe(true);
  });

  it("should support registering and executing a Mastra tool", async () => {
    const testTool = createTool({
      id: "ping",
      description: "Ping pong health check tool",
      inputSchema: z.object({
        message: z.string(),
      }),
      execute: async ({ message }) => {
        return { reply: `pong: ${message}` };
      },
    });

    const testServer = new MCPServer({
      name: "test-server",
      version: "1.0.0",
      tools: {
        ping: testTool,
      },
    });

    const toolInfo = testServer.getToolInfo("ping");
    expect(toolInfo).toBeDefined();
    expect(toolInfo?.name).toBe("ping");
    expect(toolInfo?.description).toBe("Ping pong health check tool");

    const executionResult = await testServer.executeTool("ping", {
      message: "hello",
    });
    expect(executionResult).toEqual({ reply: "pong: hello" });
  });
});
