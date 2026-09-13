import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RemotiveJobScraperAdapter } from "../../src/scrapers/adapters/remotiveAdapter.js";

describe("RemotiveJobScraperAdapter", () => {
  let adapter: RemotiveJobScraperAdapter;

  beforeEach(() => {
    adapter = new RemotiveJobScraperAdapter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should report isConfigured as true since it requires no credentials", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("remotive");
    expect(adapter.name).toBe("RemotiveJobScraperAdapter");
  });

  it("should successfully fetch and map Remotive remote jobs", async () => {
    const mockApiResponse = {
      "job-count": 2,
      jobs: [
        {
          id: 12345,
          url: "https://remotive.com/remote-jobs/software-dev/senior-fullstack-12345",
          title: "Senior Fullstack Engineer",
          company_name: "Remotive Tech",
          category: "Software Development",
          tags: ["react", "node", "typescript"],
          job_type: "full_time",
          publication_date: "2026-09-10T12:00:00",
          candidate_required_location: "Worldwide",
          salary: "$120k - $150k",
          description: "<p>We are hiring a fullstack engineer...</p>",
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({
      query: "Fullstack",
      limit: 10,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("remotive.com/api/remote-jobs");
    expect(calledUrl).toContain("search=Fullstack");

    expect(result.source).toBe("remotive");
    expect(result.jobs).toHaveLength(1);
    const job = result.jobs[0];
    expect(job.id).toBe("remotive-12345");
    expect(job.title).toBe("Senior Fullstack Engineer");
    expect(job.company).toBe("Remotive Tech");
    expect(job.workArrangement).toBe("remote");
    expect(job.employmentType).toBe("full-time");
    expect(job.location).toBe("Worldwide");
    expect(job.categories).toEqual(["react", "node", "typescript"]);
    expect(job.salaryMin).toBe(120000);
    expect(job.salaryMax).toBe(150000);
    expect(job.description).toBe("<p>We are hiring a fullstack engineer...</p>");
  });

  it("should handle 429 or HTTP errors gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Rate limit reached",
    }));

    const result = await adapter.scrape({ query: "Developer" });
    expect(result.jobs).toHaveLength(0);
    expect(result.error).toContain("Rate limit");
  });
});
