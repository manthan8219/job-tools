import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NoFluffJobsJobScraperAdapter } from "../../src/scrapers/adapters/noFluffJobsAdapter.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BACKEND_URL = "/job/senior-backend-developer-acme";
const SALES_URL = "/job/sales-rep-bigcorp";

const BACKEND_POSTING = {
  id: "abc123",
  url: BACKEND_URL,
  title: "Senior Backend Developer",
  name: "Acme Corp",
  location: {
    places: [{ city: "Warsaw", country: "PL" }],
    fullyRemote: true,
  },
  salary: { from: 8000, to: 15000, currency: "PLN" },
  posted: 1726204800000, // a fixed timestamp
  tags: [{ value: "Node.js" }, { value: "PostgreSQL" }],
};

const SALES_POSTING = {
  id: "def456",
  url: SALES_URL,
  title: "Sales Representative",
  name: "BigCorp",
  location: { places: [{ city: "London", country: "GB" }], fullyRemote: false },
  posted: 1726118400000,
  tags: [{ value: "CRM" }],
};

function makeApiResponse(postings: typeof BACKEND_POSTING[]) {
  return {
    postings,
    totalCount: postings.length,
    totalPages: 1,
  };
}

function makeMockFetch(status: number, body: object) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NoFluffJobsJobScraperAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Adapter identity
  // -------------------------------------------------------------------------
  describe("adapter identity", () => {
    it("reports correct name, source, and isConfigured", () => {
      const adapter = new NoFluffJobsJobScraperAdapter();
      expect(adapter.name).toBe("NoFluffJobsJobScraperAdapter");
      expect(adapter.source).toBe("nofluffjobs");
      expect(adapter.isConfigured()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Successful scrape – POST body, field mapping, salary, categories
  // -------------------------------------------------------------------------
  describe("scrape – happy path", () => {
    it("sends a POST request with correct body shape", async () => {
      const mockFetch = makeMockFetch(200, makeApiResponse([BACKEND_POSTING, SALES_POSTING]));
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new NoFluffJobsJobScraperAdapter();
      await adapter.scrape({ query: "Backend" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe("POST");

      const sentBody = JSON.parse(init.body as string);
      expect(sentBody).toMatchObject({
        criteriaSearch: expect.any(Object),
        page: 1,
        pageSize: 50,
      });
    });

    it("title filters: query='Backend' returns only Senior Backend Developer", async () => {
      const mockFetch = makeMockFetch(200, makeApiResponse([BACKEND_POSTING, SALES_POSTING]));
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new NoFluffJobsJobScraperAdapter();
      const result = await adapter.scrape({ query: "Backend" });

      expect(result.jobs).toHaveLength(1);
      const job = result.jobs[0];
      expect(job.title).toBe("Senior Backend Developer");
    });

    it("maps fields correctly including salary and categories", async () => {
      const mockFetch = makeMockFetch(200, makeApiResponse([BACKEND_POSTING, SALES_POSTING]));
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new NoFluffJobsJobScraperAdapter();
      const result = await adapter.scrape({ query: "Backend" });

      const job = result.jobs[0];

      // ID: `nofluffjobs-${encodeURIComponent(item.url)}`
      const expectedId = `nofluffjobs-${encodeURIComponent(BACKEND_URL)}`;
      expect(job.id).toBe(expectedId);

      expect(job.source).toBe("nofluffjobs");
      expect(job.company).toBe("Acme Corp");
      expect(job.workArrangement).toBe("remote"); // fullyRemote=true
      expect(job.employmentType).toBe("full-time");

      // Salary
      expect(job.salaryMin).toBe(8000);
      expect(job.salaryMax).toBe(15000);
      expect(job.salaryCurrency).toBe("PLN");

      // Categories from tags
      expect(job.categories).toEqual(["Node.js", "PostgreSQL"]);

      // URL should be absolute
      expect(job.url).toMatch(/^https?:\/\//);
      expect(job.postedAt).toBeInstanceOf(Date);
    });

    it("returns no jobs when query does not match any posting", async () => {
      const mockFetch = makeMockFetch(200, makeApiResponse([BACKEND_POSTING, SALES_POSTING]));
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new NoFluffJobsJobScraperAdapter();
      const result = await adapter.scrape({ query: "DataScientist_NOMATCH_XYZ" });

      expect(result.jobs).toHaveLength(0);
    });

    it("marks non-remote jobs as on-site", async () => {
      const mockFetch = makeMockFetch(200, makeApiResponse([SALES_POSTING]));
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new NoFluffJobsJobScraperAdapter();
      const result = await adapter.scrape({}); // no filter

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].workArrangement).toBe("on-site");
    });
  });

  // -------------------------------------------------------------------------
  // 3. HTTP error – graceful handling (returns empty, does not throw)
  // -------------------------------------------------------------------------
  describe("scrape – HTTP error", () => {
    it("returns empty jobs array on HTTP 500", async () => {
      const mockFetch = makeMockFetch(500, {});
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new NoFluffJobsJobScraperAdapter();
      const result = await adapter.scrape({ query: "Backend" });

      expect(result.jobs).toHaveLength(0);
      expect(result.totalFound).toBe(0);
      // The adapter breaks out of the page loop on non-ok; result is empty but no throw
      expect(result.source).toBe("nofluffjobs");
    });

    it("returns empty jobs array on HTTP 403", async () => {
      const mockFetch = makeMockFetch(403, {});
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new NoFluffJobsJobScraperAdapter();
      const result = await adapter.scrape({ query: "Backend" });

      expect(result.jobs).toHaveLength(0);
    });
  });
});
