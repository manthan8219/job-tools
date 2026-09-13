import { describe, it, expect, vi, beforeEach } from "vitest";
import { scrapeJobsTool } from "../../../src/tools/scrapers/scraperTools.js";

describe("Scraper MCP Tools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct tool definitions", () => {
    expect(scrapeJobsTool.id).toBe("scrape-jobs");
    expect(scrapeJobsTool.description).toContain("Himalayas");
    expect(scrapeJobsTool.inputSchema).toBeDefined();
  });

  it("should execute scrapeJobsTool across specific sources and return structured jobs", async () => {
    const mockHimalayas = {
      jobs: [
        {
          title: "Full Stack Software Developer",
          companyName: "Tech Corp",
          guid: "tech-corp-fullstack-dev",
          applicationLink: "https://example.com/apply",
          currency: "USD",
          salaryPeriod: "annual",
          locationRestrictions: [],
          timezoneRestrictions: [],
          categories: ["React", "Node.js"],
          employmentType: "Full Time",
        },
      ],
      totalCount: 1,
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHimalayas,
    }));

    const result = await scrapeJobsTool.execute({
      query: "Software Developer",
      sources: ["himalayas"],
      limit: 5,
    });

    expect(result.success).toBe(true);
    const data = (result as any).data;
    expect(data.jobsCount).toBe(1);
    expect(data.sourcesQueried).toEqual(["himalayas"]);
    expect(data.jobs[0].title).toBe("Full Stack Software Developer");
    expect(data.jobs[0].source).toBe("himalayas");
  });
});
