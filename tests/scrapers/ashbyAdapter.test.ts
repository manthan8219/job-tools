import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AshbyJobScraperAdapter } from "../../src/scrapers/adapters/ashbyAdapter.js";

describe("AshbyJobScraperAdapter", () => {
  let adapter: AshbyJobScraperAdapter;

  beforeEach(() => {
    adapter = new AshbyJobScraperAdapter({
      defaultCompanies: ["ramp"],
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should report isConfigured as true", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("ashby");
    expect(adapter.name).toBe("AshbyJobScraperAdapter");
  });

  it("should successfully fetch and map jobs across target companies", async () => {
    const mockRampResponse = {
      jobs: [
        {
          id: "ramp-eng-1",
          title: "Backend Software Engineer",
          location: "New York, NY",
          isRemote: true,
          team: "Engineering",
          department: "Core Platform",
          compensationTierSummary: "$150,000 - $200,000 USD",
          descriptionHtml: "<p>Build core financial infrastructure</p>",
          applyUrl: "https://jobs.ashbyhq.com/ramp/ramp-eng-1/application",
          publishedAt: "2026-09-01T10:00:00.000Z",
        },
        {
          id: "ramp-sales-1",
          title: "Account Executive",
          location: "New York, NY",
          isRemote: false,
          team: "Sales",
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockRampResponse,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({
      query: "Backend",
      limit: 10,
    });

    expect(result.source).toBe("ashby");
    // Filtered by query "Backend"
    expect(result.jobs).toHaveLength(1);
    const job = result.jobs[0];
    expect(job.id).toBe("ashby-ramp-eng-1");
    expect(job.title).toBe("Backend Software Engineer");
    expect(job.company).toBe("ramp");
    expect(job.workArrangement).toBe("remote");
    expect(job.salaryMin).toBe(150000);
    expect(job.salaryMax).toBe(200000);
    expect(job.categories).toContain("Engineering");
    expect(job.categories).toContain("Core Platform");
    expect(job.description).toBe("<p>Build core financial infrastructure</p>");
  });

  it("should handle HTTP 404 or failed company lookups gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "Not found",
    }));

    const result = await adapter.scrape({ query: "Engineer" });
    expect(result.jobs).toHaveLength(0);
  });
});
