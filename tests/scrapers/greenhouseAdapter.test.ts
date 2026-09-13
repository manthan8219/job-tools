import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GreenhouseJobScraperAdapter } from "../../src/scrapers/adapters/greenhouseAdapter.js";

describe("GreenhouseJobScraperAdapter", () => {
  let adapter: GreenhouseJobScraperAdapter;

  beforeEach(() => {
    adapter = new GreenhouseJobScraperAdapter({
      defaultCompanies: ["gitlab"],
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should report isConfigured as true", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("greenhouse");
    expect(adapter.name).toBe("GreenhouseJobScraperAdapter");
  });

  it("should successfully fetch and map jobs from Greenhouse public board", async () => {
    const mockApiResponse = {
      jobs: [
        {
          id: 8556658002,
          title: "Senior AI Software Engineer",
          absolute_url: "https://job-boards.greenhouse.io/gitlab/jobs/8556658002",
          location: { name: "Remote, US" },
          departments: [{ id: 1, name: "Engineering" }],
          content: "&lt;p&gt;GitLab is hiring a Senior AI Engineer&lt;/p&gt;",
          updated_at: "2026-09-08T14:32:00-04:00",
        },
        {
          id: 8556658003,
          title: "Sales Director",
          absolute_url: "https://job-boards.greenhouse.io/gitlab/jobs/8556658003",
          location: { name: "San Francisco, CA" },
          departments: [{ id: 2, name: "Sales" }],
          content: "&lt;p&gt;Sales role&lt;/p&gt;",
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
      query: "AI Engineer",
      limit: 10,
    });

    expect(result.source).toBe("greenhouse");
    expect(result.jobs).toHaveLength(1);
    const job = result.jobs[0];
    expect(job.id).toBe("greenhouse-8556658002");
    expect(job.title).toBe("Senior AI Software Engineer");
    expect(job.company).toBe("gitlab");
    expect(job.location).toBe("Remote, US");
    expect(job.workArrangement).toBe("remote");
    expect(job.categories).toContain("Engineering");
    expect(job.description).toBe("<p>GitLab is hiring a Senior AI Engineer</p>");
    expect(job.url).toBe("https://job-boards.greenhouse.io/gitlab/jobs/8556658002");
  });

  it("should handle failed company lookups gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "Not Found",
    }));

    const result = await adapter.scrape({ query: "Developer" });
    expect(result.jobs).toHaveLength(0);
  });
});
