import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JobicyJobScraperAdapter } from "../../src/scrapers/adapters/jobicyAdapter.js";

describe("JobicyJobScraperAdapter", () => {
  let adapter: JobicyJobScraperAdapter;

  beforeEach(() => {
    adapter = new JobicyJobScraperAdapter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should report isConfigured as true", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("jobicy");
    expect(adapter.name).toBe("JobicyJobScraperAdapter");
  });

  it("should successfully fetch and map Jobicy remote jobs", async () => {
    const mockApiResponse = {
      jobs: [
        {
          id: 149046,
          url: "https://jobicy.com/jobs/149046-tech-lead",
          jobTitle: "Tech Lead Feature Team",
          companyName: "Actian",
          companyLogo: "https://example.com/logo.webp",
          jobIndustry: ["Software Engineering"],
          jobType: ["Full-Time"],
          jobGeo: "Europe",
          jobLevel: "Senior",
          jobExcerpt: "Lead by doing...",
          jobDescription: "<div>Full job description</div>",
          pubDate: "2026-09-12T13:45:29+00:00",
          annualSalaryMin: "120000",
          annualSalaryMax: "150000",
          salaryCurrency: "USD",
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
      query: "Tech Lead",
      limit: 10,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("jobicy");
    expect(result.jobs).toHaveLength(1);
    const job = result.jobs[0];
    expect(job.id).toBe("jobicy-149046");
    expect(job.title).toBe("Tech Lead Feature Team");
    expect(job.company).toBe("Actian");
    expect(job.workArrangement).toBe("remote");
    expect(job.employmentType).toBe("full-time");
    expect(job.location).toBe("Europe (Remote)");
    expect(job.salaryMin).toBe(120000);
    expect(job.salaryMax).toBe(150000);
    expect(job.categories).toContain("Software Engineering");
    expect(job.description).toBe("<div>Full job description</div>");
    expect(job.excerpt).toBe("Lead by doing...");
  });

  it("should handle HTTP errors gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    }));

    const result = await adapter.scrape({ query: "Developer" });
    expect(result.jobs).toHaveLength(0);
    expect(result.error).toBeDefined();
  });
});
