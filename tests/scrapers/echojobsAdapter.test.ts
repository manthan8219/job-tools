import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EchoJobsJobScraperAdapter } from "../../src/scrapers/adapters/echojobsAdapter.js";

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

function makeApiResponse(jobs: unknown[]) {
  return { jobs };
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const JOB_BACKEND = {
  id: "echo-1",
  title: "Senior Backend Engineer",
  url: "https://echojobs.io/jobs/backend-engineer-123",
  company_name: "TechCo",
  locations: [],
  remote_type: "fully_remote",
  tags: ["Go", "AWS"],
  created_at: "2026-09-01T10:00:00Z",
};

const JOB_MARKETING = {
  id: "echo-2",
  title: "Marketing Manager",
  url: "https://echojobs.io/jobs/marketing-manager-456",
  company_name: "MarketCo",
  locations: ["New York"],
  remote_type: "on_site",
  tags: ["Marketing"],
  created_at: "2026-09-02T09:00:00Z",
};

const JOB_HYBRID = {
  id: "echo-3",
  title: "Product Designer",
  url: "https://echojobs.io/jobs/product-designer-789",
  company_name: "DesignCo",
  locations: ["San Francisco"],
  remote_type: "hybrid",
  tags: ["Figma", "UX"],
  created_at: "2026-09-03T08:00:00Z",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EchoJobsJobScraperAdapter", () => {
  let adapter: EchoJobsJobScraperAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    adapter = new EchoJobsJobScraperAdapter({
      baseUrl: "https://echojobs.io/api/jobs",
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
      expect(adapter.source).toBe("echojobs");
      expect(adapter.name).toBe("EchoJobsJobScraperAdapter");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Successful parse + field mapping + title filtering
  // -------------------------------------------------------------------------
  describe("scrape()", () => {
    it("returns only matching job and maps all fields correctly", async () => {
      const mockFetch = makeMockFetch(makeApiResponse([JOB_BACKEND, JOB_MARKETING]));
      vi.stubGlobal("fetch", mockFetch);

      const result = await adapter.scrape({ query: "Backend" });

      // Title filter: only 'Senior Backend Engineer' should match
      expect(result.jobs).toHaveLength(1);

      const job = result.jobs[0];
      expect(job.id).toBe("echojobs-echo-1");
      expect(job.title).toBe("Senior Backend Engineer");
      expect(job.company).toBe("TechCo");
      expect(job.workArrangement).toBe("remote"); // fully_remote -> 'remote'
      expect(job.categories).toEqual(["Go", "AWS"]);
      expect(job.source).toBe("echojobs");
      expect(job.url).toBe("https://echojobs.io/jobs/backend-engineer-123");
    });

    // -----------------------------------------------------------------------
    // 3. hybrid remote_type -> workArrangement='hybrid'
    // -----------------------------------------------------------------------
    it("maps hybrid remote_type to workArrangement='hybrid'", async () => {
      const mockFetch = makeMockFetch(makeApiResponse([JOB_HYBRID]));
      vi.stubGlobal("fetch", mockFetch);

      const result = await adapter.scrape({ query: "Designer" });

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].workArrangement).toBe("hybrid");
      expect(result.jobs[0].id).toBe("echojobs-echo-3");
    });

    // -----------------------------------------------------------------------
    // 4. HTTP error -> empty jobs (no throw)
    // -----------------------------------------------------------------------
    it("returns empty jobs on HTTP error", async () => {
      const mockFetch = makeMockFetch(null, false, 500);
      vi.stubGlobal("fetch", mockFetch);

      const result = await adapter.scrape({ query: "Backend" });

      expect(result.jobs).toHaveLength(0);
      expect(result.source).toBe("echojobs");
    });
  });
});
