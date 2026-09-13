import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RecruiteeJobScraperAdapter } from "../../src/scrapers/adapters/recruiteeAdapter.js";

describe("RecruiteeJobScraperAdapter", () => {
  let adapter: RecruiteeJobScraperAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    adapter = new RecruiteeJobScraperAdapter({
      companies: [{ name: "Miro", slug: "miro" }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should report isConfigured, source, and name correctly", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("recruitee");
    expect(adapter.name).toBe("RecruiteeJobScraperAdapter");
  });

  it("should fetch jobs and return only those matching the query", async () => {
    const mockApiResponse = {
      offers: [
        {
          id: 42001,
          title: "Senior Software Engineer",
          careers_url: "https://miro.recruitee.com/o/senior-software-engineer",
          city: "Amsterdam",
          country: "Netherlands",
          remote: false,
          department: "Engineering",
          published_at: "2026-09-01T10:00:00Z",
        },
        {
          id: 42002,
          title: "Marketing Manager",
          careers_url: "https://miro.recruitee.com/o/marketing-manager",
          city: "Berlin",
          country: "Germany",
          remote: false,
          department: "Marketing",
          published_at: "2026-09-02T10:00:00Z",
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

    expect(result.source).toBe("recruitee");
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    expect(job.id).toBe("recruitee-42001");
    expect(job.title).toBe("Senior Software Engineer");
    expect(job.company).toBe("Miro");
    expect(job.source).toBe("recruitee");
    expect(job.url).toBe("https://miro.recruitee.com/o/senior-software-engineer");
    expect(job.categories).toContain("Engineering");
    expect(job.workArrangement).toBe("on-site");

    // Verify fetch was called with the correct Recruitee URL
    expect(mockFetch).toHaveBeenCalledWith(
      "https://miro.recruitee.com/api/offers/",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("should return empty jobs array when the company endpoint returns an HTTP error", async () => {
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
    expect(result.source).toBe("recruitee");
  });
});
