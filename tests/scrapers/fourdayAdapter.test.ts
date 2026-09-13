import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FourDayWeekJobScraperAdapter } from "../../src/scrapers/adapters/fourdayAdapter.js";

describe("FourDayWeekJobScraperAdapter", () => {
  let adapter: FourDayWeekJobScraperAdapter;

  beforeEach(() => {
    adapter = new FourDayWeekJobScraperAdapter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Identity ─────────────────────────────────────────────────────────────
  it("should report correct identity: isConfigured, source, name", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("fourday");
    expect(adapter.name).toBe("FourDayWeekJobScraperAdapter");
  });

  // ── 2. Successful fetch + field mapping + title filter ───────────────────────
  it("should return only the job matching query='Engineer' and verify field mapping", async () => {
    const mockApiResponse = {
      jobs: [
        {
          title: "Backend Engineer",
          slug: "backend-eng-1",
          company: { name: "RemoteCo" },
          locations: [{ city: "London", country: "UK" }],
          work_arrangement: "remote",
          is_expired: false,
        },
        {
          title: "Sales Rep",
          slug: "sales-rep-2",
          company: { name: "Sales Corp" },
          locations: [{ city: "Berlin", country: "Germany" }],
          work_arrangement: "on-site",
          is_expired: false,
        },
      ],
      has_more: false,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({ query: "Engineer", limit: 10 });

    expect(result.source).toBe("fourday");
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    expect(job.id).toBe("fourday-backend-eng-1");
    expect(job.title).toBe("Backend Engineer");
    expect(job.company).toBe("RemoteCo");
    expect(job.workArrangement).toBe("remote");
    expect(job.categories).toEqual(["4-day week"]);
    expect(job.url).toBe("https://4dayweek.io/job/backend-eng-1");
  });

  // ── 3. Expired job → excluded even when title matches query ─────────────────
  it("should exclude expired jobs even when the title matches the query", async () => {
    const mockApiResponse = {
      jobs: [
        {
          title: "Backend Engineer",
          slug: "backend-eng-expired",
          company: { name: "OldCo" },
          locations: [],
          work_arrangement: "remote",
          is_expired: true,
        },
      ],
      has_more: false,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({ query: "Engineer", limit: 10 });

    expect(result.jobs).toHaveLength(0);
  });

  // ── 4. HTTP error → returns empty jobs without throwing ─────────────────────
  it("should return empty jobs on HTTP error without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable",
      }),
    );

    const result = await adapter.scrape({ query: "Engineer" });

    expect(result.jobs).toHaveLength(0);
    expect(result.source).toBe("fourday");
  });
});
