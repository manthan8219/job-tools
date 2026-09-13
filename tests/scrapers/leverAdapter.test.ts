import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LeverJobScraperAdapter } from "../../src/scrapers/adapters/leverAdapter.js";

describe("LeverJobScraperAdapter", () => {
  let adapter: LeverJobScraperAdapter;

  beforeEach(() => {
    adapter = new LeverJobScraperAdapter({
      defaultCompanies: ["palantir"],
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should report isConfigured as true", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("lever");
    expect(adapter.name).toBe("LeverJobScraperAdapter");
  });

  it("should successfully fetch and map Lever job postings", async () => {
    const mockLeverResponse = [
      {
        id: "lever-job-1",
        text: "Senior Backend Engineer",
        hostedUrl: "https://jobs.lever.co/palantir/lever-job-1",
        applyUrl: "https://jobs.lever.co/palantir/lever-job-1/apply",
        workplaceType: "remote",
        categories: {
          commitment: "Full-time",
          location: "New York, NY",
          team: "Engineering",
        },
        description: "<p>Build distributed platforms</p>",
        createdAt: 1710188707256,
      },
      {
        id: "lever-job-2",
        text: "Sales Representative",
        hostedUrl: "https://jobs.lever.co/palantir/lever-job-2",
        workplaceType: "on-site",
        categories: {
          commitment: "Full-time",
          location: "London, UK",
          team: "Sales",
        },
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockLeverResponse,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({
      query: "Backend",
      limit: 10,
    });

    expect(result.source).toBe("lever");
    expect(result.jobs).toHaveLength(1);
    const job = result.jobs[0];
    expect(job.id).toBe("lever-lever-job-1");
    expect(job.title).toBe("Senior Backend Engineer");
    expect(job.company).toBe("palantir");
    expect(job.location).toBe("New York, NY");
    expect(job.workArrangement).toBe("remote");
    expect(job.employmentType).toBe("full-time");
    expect(job.categories).toContain("Engineering");
    expect(job.description).toBe("<p>Build distributed platforms</p>");
    expect(job.url).toBe("https://jobs.lever.co/palantir/lever-job-1");
  });

  it("should handle failed company lookup gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "Not Found",
    }));

    const result = await adapter.scrape({ query: "Developer" });
    expect(result.jobs).toHaveLength(0);
  });
});
