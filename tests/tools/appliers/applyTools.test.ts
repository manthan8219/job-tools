import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { applyToJobTool, detectJobAtsTool } from "../../../src/tools/appliers/applyTools.js";

describe("Apply MCP Tools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("detectJobAtsTool", () => {
    it("detects Lever ATS from job URL", async () => {
      const res = await (detectJobAtsTool.execute as any)({
        jobUrl: "https://jobs.lever.co/palantir/test-job-id",
      });

      expect(res.success).toBe(true);
      expect(res.data.provider).toBe("lever");
      expect(res.data.isApiSupported).toBe(true);
      expect(res.data.board).toBe("palantir");
    });

    it("detects unknown platform for regular company URLs", async () => {
      const res = await (detectJobAtsTool.execute as any)({
        jobUrl: "https://example.com/careers/lead-engineer",
      });

      expect(res.success).toBe(true);
      expect(res.data.provider).toBe("unknown");
      expect(res.data.isApiSupported).toBe(false);
    });
  });

  describe("applyToJobTool", () => {
    it("submits application through detected adapter", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 201,
        ok: true,
        json: async () => ({ candidate: { id: "c_123" } }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const res = await (applyToJobTool.execute as any)({
        jobUrl: "https://miro.recruitee.com/o/fullstack-developer",
        firstName: "Grace",
        lastName: "Hopper",
        email: "grace@navy.mil",
        phone: "+18001234567",
        coverLetter: "Invented compilers.",
        resumeBase64: Buffer.from("simulated pdf").toString("base64"),
        resumeFilename: "grace_resume.pdf",
      });

      expect(res.success).toBe(true);
      expect(res.data.status).toBe("applied");
      expect(res.data.provider).toBe("recruitee");
    });

    it("returns skipped status when URL has no direct API support", async () => {
      const res = await (applyToJobTool.execute as any)({
        jobUrl: "https://example.com/unsupported-portal/job-1",
        firstName: "Grace",
        lastName: "Hopper",
        email: "grace@navy.mil",
      });

      expect(res.success).toBe(false);
      expect(res.data.status).toBe("skipped");
      expect(res.data.reason).toContain("does not support unauthenticated direct API application");
    });
  });
});
