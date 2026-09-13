import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JustJoinJobScraperAdapter } from "../../src/scrapers/adapters/justJoinAdapter.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BACKEND_OFFER = {
  slug: "backend-dev-1",
  title: "Backend Developer",
  companyName: "TechHub",
  city: "Warsaw",
  workplaceType: "remote",
  applyUrl: "https://justjoin.it/job-offer/backend-dev-1",
  publishedAt: "2026-09-13T07:00:00.000Z",
  skills: [{ name: "Go" }, { name: "PostgreSQL" }],
  employmentTypes: [
    { salary: { from: 8000, to: 12000, currency: "PLN" } },
  ],
};

const HYBRID_OFFER = {
  slug: "hybrid-dev-2",
  title: "Full Stack Engineer",
  companyName: "HybridCo",
  city: "Krakow",
  workplaceType: "hybrid",
  applyUrl: undefined,
  publishedAt: "2026-09-12T10:00:00.000Z",
  skills: [{ name: "React" }],
  employmentTypes: [{ salary: { from: 5000, to: 9000, currency: "PLN" } }],
};

const SALES_OFFER = {
  slug: "sales-rep-3",
  title: "Sales Representative",
  companyName: "BigSales",
  city: "Gdansk",
  workplaceType: "office",
  publishedAt: "2026-09-11T08:00:00.000Z",
  skills: [],
  employmentTypes: [],
};

function makeApiResponse(offers: object[], totalPages = 1) {
  return {
    data: offers,
    meta: { totalPages, totalItems: offers.length },
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

describe("JustJoinJobScraperAdapter", () => {
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
      const adapter = new JustJoinJobScraperAdapter();
      expect(adapter.name).toBe("JustJoinJobScraperAdapter");
      expect(adapter.source).toBe("justjoin");
      expect(adapter.isConfigured()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Successful scrape – field mapping, title filter, salary, categories
  // -------------------------------------------------------------------------
  describe("scrape – happy path", () => {
    it("query='Backend' returns only the Backend Developer offer", async () => {
      const mockFetch = makeMockFetch(
        200,
        makeApiResponse([BACKEND_OFFER, SALES_OFFER]),
      );
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new JustJoinJobScraperAdapter();
      const result = await adapter.scrape({ query: "Backend" });

      expect(result.jobs).toHaveLength(1);
    });

    it("maps all fields correctly for the Backend Developer offer", async () => {
      const mockFetch = makeMockFetch(
        200,
        makeApiResponse([BACKEND_OFFER, SALES_OFFER]),
      );
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new JustJoinJobScraperAdapter();
      const result = await adapter.scrape({ query: "Backend" });

      const job = result.jobs[0];

      // ID pattern: `justjoin-${item.slug}`
      expect(job.id).toBe("justjoin-backend-dev-1");

      expect(job.title).toBe("Backend Developer");
      expect(job.company).toBe("TechHub");
      expect(job.source).toBe("justjoin");
      expect(job.workArrangement).toBe("remote");
      expect(job.employmentType).toBe("full-time");

      // Salary from employmentTypes[0].salary
      expect(job.salaryMin).toBe(8000);
      expect(job.salaryMax).toBe(12000);
      expect(job.salaryCurrency).toBe("PLN");

      // Skills become categories
      expect(job.categories).toEqual(["Go", "PostgreSQL"]);

      expect(job.postedAt).toBeInstanceOf(Date);
    });

    it("returns no jobs when query does not match", async () => {
      const mockFetch = makeMockFetch(200, makeApiResponse([BACKEND_OFFER, SALES_OFFER]));
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new JustJoinJobScraperAdapter();
      const result = await adapter.scrape({ query: "DataScientist_NOMATCH_XYZ" });

      expect(result.jobs).toHaveLength(0);
    });

    it("returns all jobs when no query is provided", async () => {
      const mockFetch = makeMockFetch(200, makeApiResponse([BACKEND_OFFER, SALES_OFFER]));
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new JustJoinJobScraperAdapter();
      const result = await adapter.scrape({});

      expect(result.jobs).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // 3. workArrangement mapping
  // -------------------------------------------------------------------------
  describe("workArrangement mapping", () => {
    it("maps workplaceType='hybrid' to workArrangement='hybrid'", async () => {
      const mockFetch = makeMockFetch(200, makeApiResponse([HYBRID_OFFER]));
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new JustJoinJobScraperAdapter();
      const result = await adapter.scrape({});

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].workArrangement).toBe("hybrid");
    });

    it("maps workplaceType='office' to workArrangement='on-site'", async () => {
      const mockFetch = makeMockFetch(200, makeApiResponse([SALES_OFFER]));
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new JustJoinJobScraperAdapter();
      const result = await adapter.scrape({});

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].workArrangement).toBe("on-site");
    });

    it("maps workplaceType='remote' to workArrangement='remote'", async () => {
      const mockFetch = makeMockFetch(200, makeApiResponse([BACKEND_OFFER]));
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new JustJoinJobScraperAdapter();
      const result = await adapter.scrape({});

      expect(result.jobs[0].workArrangement).toBe("remote");
    });
  });

  // -------------------------------------------------------------------------
  // 4. HTTP error – graceful handling
  // -------------------------------------------------------------------------
  describe("scrape – HTTP error", () => {
    it("returns empty jobs on HTTP 500", async () => {
      const mockFetch = makeMockFetch(500, {});
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new JustJoinJobScraperAdapter();
      const result = await adapter.scrape({ query: "Backend" });

      expect(result.jobs).toHaveLength(0);
      expect(result.totalFound).toBe(0);
      expect(result.source).toBe("justjoin");
    });

    it("returns empty jobs on HTTP 401", async () => {
      const mockFetch = makeMockFetch(401, {});
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new JustJoinJobScraperAdapter();
      const result = await adapter.scrape({ query: "Backend" });

      expect(result.jobs).toHaveLength(0);
    });
  });
});
