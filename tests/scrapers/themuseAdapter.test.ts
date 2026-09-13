import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TheMuseJobScraperAdapter } from "../../src/scrapers/adapters/themuseAdapter.js";

describe("TheMuseJobScraperAdapter", () => {
  let adapter: TheMuseJobScraperAdapter;

  beforeEach(() => {
    adapter = new TheMuseJobScraperAdapter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Identity ─────────────────────────────────────────────────────────────
  it("should report correct identity: isConfigured, source, name", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("themuse");
    expect(adapter.name).toBe("TheMuseJobScraperAdapter");
  });

  // ── 2. Successful fetch + field mapping + title/location filter ───────────────
  it("should return only the Remote job matching query='Engineer' and verify field mapping", async () => {
    const mockApiResponse = {
      page: 1,
      page_count: 1,
      total: 2,
      results: [
        {
          id: 101,
          name: "Senior Software Engineer",
          refs: { landing_page: "https://www.themuse.com/jobs/techcorp/senior-software-engineer" },
          company: { name: "TechCorp", id: 10 },
          locations: [{ name: "Remote" }],
          categories: [{ name: "Engineering" }],
          contents: "<p>Write great code</p>",
          publication_date: "2026-09-01T00:00:00Z",
        },
        {
          id: 102,
          name: "Sales Exec",
          refs: { landing_page: "https://www.themuse.com/jobs/salesco/sales-exec" },
          company: { name: "Sales Co", id: 20 },
          locations: [{ name: "New York" }],
          categories: [{ name: "Sales" }],
          contents: "<p>Sell stuff</p>",
          publication_date: "2026-09-01T00:00:00Z",
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

    expect(result.source).toBe("themuse");
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    expect(job.id).toBe("themuse-101");
    expect(job.title).toBe("Senior Software Engineer");
    expect(job.company).toBe("TechCorp");
    expect(job.workArrangement).toBe("remote");
    expect(job.location).toBe("Remote");
    expect(job.categories).toEqual(["Engineering"]);
    expect(job.description).toBe("<p>Write great code</p>");
    expect(job.url).toBe("https://www.themuse.com/jobs/techcorp/senior-software-engineer");
  });

  // ── 3. HTTP error → returns empty jobs without throwing ─────────────────────
  it("should return empty jobs on HTTP error without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      }),
    );

    const result = await adapter.scrape({ query: "Engineer" });

    expect(result.jobs).toHaveLength(0);
    expect(result.source).toBe("themuse");
  });
});
