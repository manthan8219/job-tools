import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GreenhouseJobScraperAdapter } from "../../src/scrapers/adapters/greenhouseAdapter.js";

describe("GreenhouseJobScraperAdapter", () => {
  let adapter: GreenhouseJobScraperAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    adapter = new GreenhouseJobScraperAdapter({
      defaultCompanies: [{ name: "Stripe", board: "stripe" }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should report isConfigured, source, and name correctly", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("greenhouse");
    expect(adapter.name).toBe("GreenhouseJobScraperAdapter");
  });

  it("should fetch and map jobs from the Greenhouse board API", async () => {
    const mockApiResponse = {
      jobs: [
        {
          id: 7001234001,
          title: "Senior Software Engineer",
          absolute_url: "https://job-boards.greenhouse.io/stripe/jobs/7001234001",
          location: { name: "Remote, US" },
          departments: [{ id: 10, name: "Engineering" }],
          offices: [{ id: 20, name: "San Francisco" }],
          content: "&lt;p&gt;Stripe is hiring a Senior Software Engineer&lt;/p&gt;",
          updated_at: "2026-09-10T12:00:00-04:00",
        },
        {
          id: 7001234002,
          title: "Recruiter",
          absolute_url: "https://job-boards.greenhouse.io/stripe/jobs/7001234002",
          location: { name: "New York, NY" },
          departments: [{ id: 30, name: "People Operations" }],
          content: "&lt;p&gt;HR role&lt;/p&gt;",
          updated_at: "2026-09-11T09:00:00-04:00",
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({ query: "Engineer", limit: 10 });

    expect(result.source).toBe("greenhouse");
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    expect(job.id).toBe("greenhouse-7001234001");
    expect(job.title).toBe("Senior Software Engineer");
    expect(job.company).toBe("Stripe");
    expect(job.source).toBe("greenhouse");
    expect(job.location).toBe("Remote, US");
    expect(job.workArrangement).toBe("remote");
    expect(job.categories).toContain("Engineering");
    expect(job.description).toBe("<p>Stripe is hiring a Senior Software Engineer</p>");
    expect(job.url).toBe("https://job-boards.greenhouse.io/stripe/jobs/7001234001");

    // Verify the correct Greenhouse boards API URL was requested
    expect(mockFetch).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("should return empty jobs array when the company board returns an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Not Found",
      })
    );

    const result = await adapter.scrape({ query: "Engineer" });
    expect(result.jobs).toHaveLength(0);
    expect(result.source).toBe("greenhouse");
  });
});
