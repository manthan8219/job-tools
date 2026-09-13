import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ArbeitnowJobScraperAdapter } from "../../src/scrapers/adapters/arbeitnowAdapter.js";

describe("ArbeitnowJobScraperAdapter", () => {
  let adapter: ArbeitnowJobScraperAdapter;

  beforeEach(() => {
    adapter = new ArbeitnowJobScraperAdapter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Identity ─────────────────────────────────────────────────────────────
  it("should report correct identity: isConfigured, source, name", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("arbeitnow");
    expect(adapter.name).toBe("ArbeitnowJobScraperAdapter");
  });

  // ── 2. Successful fetch + field mapping + title filter ───────────────────────
  it("should fetch 2 items and return only the one matching query by title", async () => {
    const mockApiResponse = {
      data: [
        {
          slug: "senior-backend-eng-1",
          company_name: "Acme Inc",
          title: "Senior Backend Engineer",
          description: "Build great APIs",
          remote: true,
          url: "https://www.arbeitnow.com/jobs/senior-backend-eng-1",
          tags: ["typescript", "nodejs"],
          job_types: ["full-time"],
          location: "Remote",
          created_at: 1756684800, // arbitrary unix timestamp
        },
        {
          slug: "account-manager-2",
          company_name: "Sales Co",
          title: "Account Manager",
          description: "Manage accounts",
          remote: false,
          url: "https://www.arbeitnow.com/jobs/account-manager-2",
          tags: ["sales"],
          job_types: ["full-time"],
          location: "Berlin",
          created_at: 1756684800,
        },
      ],
      links: { next: null },
      meta: { total: 2 },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({ query: "Engineer", limit: 10 });

    expect(result.source).toBe("arbeitnow");
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    expect(job.id).toBe("arbeitnow-senior-backend-eng-1");
    expect(job.title).toBe("Senior Backend Engineer");
    expect(job.company).toBe("Acme Inc");
    expect(job.workArrangement).toBe("remote");
    expect(job.employmentType).toBe("full-time");
    expect(job.categories).toEqual(["typescript", "nodejs"]);
    expect(job.description).toBe("Build great APIs");
    expect(job.url).toBe("https://www.arbeitnow.com/jobs/senior-backend-eng-1");
  });

  // ── 3. Tag-based query matching ──────────────────────────────────────────────
  it("should match a job by tag even when its title does not match the query", async () => {
    const mockApiResponse = {
      data: [
        {
          slug: "sales-rep-3",
          company_name: "Sales Corp",
          title: "Sales Rep",
          description: "Sell stuff",
          remote: false,
          url: "https://www.arbeitnow.com/jobs/sales-rep-3",
          tags: ["Backend", "Node.js"],
          job_types: [],
          location: "London",
          created_at: 1756684800,
        },
      ],
      links: { next: null },
      meta: { total: 1 },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({ query: "Backend", limit: 10 });

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].id).toBe("arbeitnow-sales-rep-3");
    expect(result.jobs[0].workArrangement).toBe("on-site");
  });

  // ── 4. HTTP 500 → returns empty jobs without throwing ────────────────────────
  it("should return empty jobs on HTTP 500 without throwing", async () => {
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
    expect(result.source).toBe("arbeitnow");
  });
});
