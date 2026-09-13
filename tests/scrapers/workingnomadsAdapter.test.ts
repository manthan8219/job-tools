import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WorkingNomadsJobScraperAdapter } from "../../src/scrapers/adapters/workingnomadsAdapter.js";

describe("WorkingNomadsJobScraperAdapter", () => {
  let adapter: WorkingNomadsJobScraperAdapter;

  beforeEach(() => {
    adapter = new WorkingNomadsJobScraperAdapter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Identity ─────────────────────────────────────────────────────────────
  it("should report correct identity: isConfigured, source, name", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("workingnomads");
    expect(adapter.name).toBe("WorkingNomadsJobScraperAdapter");
  });

  // ── 2. Successful fetch + field mapping + title filter ───────────────────────
  it("should return only the job matching query='Developer' and verify field mapping", async () => {
    const mockApiResponse = [
      {
        id: 42,
        title: "Frontend Developer",
        url: "https://www.workingnomads.com/jobs/42",
        company_name: "Acme",
        location: "Worldwide",
        category_name: "Development",
        tags: "JavaScript, React",
        description: "Build beautiful UIs",
        pub_date: "2026-09-01T00:00:00Z",
      },
      {
        id: 99,
        title: "Marketing Manager",
        url: "https://www.workingnomads.com/jobs/99",
        company_name: "Brand Co",
        location: "Worldwide",
        category_name: "Marketing",
        tags: "SEO, content",
        description: "Drive growth",
        pub_date: "2026-09-01T00:00:00Z",
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({ query: "Developer", limit: 10 });

    expect(result.source).toBe("workingnomads");
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    expect(job.id).toBe("workingnomads-42");
    expect(job.title).toBe("Frontend Developer");
    expect(job.company).toBe("Acme");
    expect(job.workArrangement).toBe("remote");
    expect(job.location).toBe("Worldwide");
    expect(job.categories).toContain("JavaScript");
    expect(job.categories).toContain("Development");
    expect(job.description).toBe("Build beautiful UIs");
  });

  // ── 3. Non-array response → empty jobs ──────────────────────────────────────
  it("should return empty jobs when the API response is not an array", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ error: "unexpected format" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({ query: "Developer" });

    expect(result.jobs).toHaveLength(0);
    expect(result.totalFound).toBe(0);
  });

  // ── 4. HTTP error → throws (base catches as result.error) ───────────────────
  it("should surface an error result when the API returns a non-ok HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Too Many Requests",
      }),
    );

    const result = await adapter.scrape({ query: "Developer" });

    expect(result.jobs).toHaveLength(0);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("429");
  });
});
