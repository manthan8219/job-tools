import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GetOnBrdJobScraperAdapter } from "../../src/scrapers/adapters/getonbrdAdapter.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockFetch(payload: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => payload,
  });
}

function makeApiResponse(items: unknown[]) {
  return { data: items };
}

// ---------------------------------------------------------------------------
// Shared fixture data
// ---------------------------------------------------------------------------

const JOB_BACKEND = {
  id: "abc123",
  attributes: {
    title: "Senior Backend Engineer",
    description: "Build distributed systems at scale.",
    remote: true,
    countries: [],
    company_name: "FallbackCo",
    company: {
      data: {
        attributes: {
          name: "Acme",
        },
      },
    },
    category_name: "Programming",
    published_at: 1725177600, // some Unix timestamp
  },
  links: {
    public_url: "https://www.getonbrd.com/jobs/backend-123",
  },
};

const JOB_SALES = {
  id: "xyz456",
  attributes: {
    title: "Sales Rep",
    description: "Sell our products.",
    remote: false,
    countries: ["United States"],
    company_name: "SalesCo",
    company: { data: { attributes: { name: "SalesCo" } } },
    category_name: "Sales",
    published_at: 1725177600,
  },
  links: {
    public_url: "https://www.getonbrd.com/jobs/sales-456",
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GetOnBrdJobScraperAdapter", () => {
  let adapter: GetOnBrdJobScraperAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    adapter = new GetOnBrdJobScraperAdapter({
      baseUrl: "https://www.getonbrd.com/api/v0/categories/programming/jobs",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Identity
  // -------------------------------------------------------------------------
  describe("adapter identity", () => {
    it("reports isConfigured=true, correct source and name", () => {
      expect(adapter.isConfigured()).toBe(true);
      expect(adapter.source).toBe("getonbrd");
      expect(adapter.name).toBe("GetOnBrdJobScraperAdapter");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Successful parse + field mapping + title filtering
  // -------------------------------------------------------------------------
  describe("scrape()", () => {
    it("returns only matching job and maps fields correctly", async () => {
      const mockFetch = makeMockFetch(makeApiResponse([JOB_BACKEND, JOB_SALES]));
      vi.stubGlobal("fetch", mockFetch);

      const result = await adapter.scrape({ query: "Backend" });

      // Title filter: only 'Senior Backend Engineer' matches
      expect(result.jobs).toHaveLength(1);

      const job = result.jobs[0];
      expect(job.id).toBe("getonbrd-abc123");
      expect(job.title).toBe("Senior Backend Engineer");
      expect(job.company).toBe("Acme"); // nested company.data.attributes.name
      expect(job.workArrangement).toBe("remote"); // remote=true
      expect(job.categories).toEqual(["Programming"]);
      expect(job.source).toBe("getonbrd");
      expect(job.url).toBe("https://www.getonbrd.com/jobs/backend-123");
    });

    // -----------------------------------------------------------------------
    // 3. Company fallback: uses company_name when nested company is absent
    // -----------------------------------------------------------------------
    it("falls back to company_name when nested company data is missing", async () => {
      const jobWithoutNestedCompany = {
        ...JOB_BACKEND,
        id: "fallback-999",
        attributes: {
          ...JOB_BACKEND.attributes,
          company_name: "DirectCo",
          company: undefined, // no nested company
        },
      };

      const mockFetch = makeMockFetch(makeApiResponse([jobWithoutNestedCompany]));
      vi.stubGlobal("fetch", mockFetch);

      const result = await adapter.scrape({ query: "Backend" });

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].company).toBe("DirectCo");
      expect(result.jobs[0].id).toBe("getonbrd-fallback-999");
    });

    // -----------------------------------------------------------------------
    // 4. HTTP error -> returns empty jobs (no throw)
    // -----------------------------------------------------------------------
    it("returns empty jobs on HTTP error", async () => {
      const mockFetch = makeMockFetch(null, false, 503);
      vi.stubGlobal("fetch", mockFetch);

      const result = await adapter.scrape({ query: "Backend" });

      expect(result.jobs).toHaveLength(0);
      expect(result.source).toBe("getonbrd");
    });
  });
});
