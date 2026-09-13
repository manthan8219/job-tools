import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WttjJobScraperAdapter } from "../../src/scrapers/adapters/wttjAdapter.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENV_RESPONSE = {
  PUBLIC_ALGOLIA_APPLICATION_ID: "APPID123",
  PUBLIC_ALGOLIA_API_KEY_CLIENT: "apikey123",
};

// Two Algolia hits:
//   hit 1 – "Backend Engineer", remote='fulltime' → matches query='Backend'
//   hit 2 – "Sales Director",  remote='none'      → does NOT match
const ALGOLIA_RESPONSE = {
  hits: [
    {
      objectID: "obj-1",
      job_title: "Backend Engineer",
      organization_name: "JungleCo",
      remote: "fulltime",
      offices: [{ city: "Paris", country: "FR" }],
      published_at: "2026-09-13T08:00:00Z",
      summary: "Great backend role.",
    },
    {
      objectID: "obj-2",
      job_title: "Sales Director",
      organization_name: "SalesOrg",
      remote: "none",
      offices: [{ city: "London", country: "GB" }],
      published_at: "2026-09-12T10:00:00Z",
      summary: "Lead our sales team.",
    },
  ],
  nbHits: 2,
};

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Creates a fetch mock that returns different responses for the env endpoint
 * (first call) and the Algolia endpoint (second call).
 */
function makeSequentialMockFetch(
  envStatus: number,
  envBody: object,
  algoliaStatus: number,
  algoliaBody: object,
) {
  let callIndex = 0;
  return vi.fn().mockImplementation(async (_url: string, _init?: RequestInit) => {
    const current = callIndex++;
    if (current === 0) {
      // env endpoint
      return {
        ok: envStatus >= 200 && envStatus < 300,
        status: envStatus,
        json: async () => envBody,
      };
    }
    // Algolia endpoint
    return {
      ok: algoliaStatus >= 200 && algoliaStatus < 300,
      status: algoliaStatus,
      json: async () => algoliaBody,
    };
  });
}

function makeSingleMockFetch(status: number, body: object) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WttjJobScraperAdapter", () => {
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
      const adapter = new WttjJobScraperAdapter();
      expect(adapter.name).toBe("WttjJobScraperAdapter");
      expect(adapter.source).toBe("wttj");
      expect(adapter.isConfigured()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Two-step fetch: env → Algolia; field mapping; title filtering
  // -------------------------------------------------------------------------
  describe("scrape – happy path", () => {
    it("makes exactly 2 fetch calls (env + Algolia)", async () => {
      const mockFetch = makeSequentialMockFetch(200, ENV_RESPONSE, 200, ALGOLIA_RESPONSE);
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WttjJobScraperAdapter();
      await adapter.scrape({ query: "Backend" });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("first call is the env endpoint URL", async () => {
      const mockFetch = makeSequentialMockFetch(200, ENV_RESPONSE, 200, ALGOLIA_RESPONSE);
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WttjJobScraperAdapter();
      await adapter.scrape({ query: "Backend" });

      const [envUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(envUrl).toBe("https://www.welcometothejungle.com/api/env");
    });

    it("second call is a POST to the Algolia URL containing the appId", async () => {
      const mockFetch = makeSequentialMockFetch(200, ENV_RESPONSE, 200, ALGOLIA_RESPONSE);
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WttjJobScraperAdapter();
      await adapter.scrape({ query: "Backend" });

      const [algoliaUrl, algoliaInit] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect(algoliaUrl).toContain("APPID123");
      expect(algoliaUrl).toContain("algolia.net");
      expect(algoliaInit.method).toBe("POST");
    });

    it("title filters query='Backend' → returns only the Backend Engineer hit", async () => {
      const mockFetch = makeSequentialMockFetch(200, ENV_RESPONSE, 200, ALGOLIA_RESPONSE);
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WttjJobScraperAdapter();
      const result = await adapter.scrape({ query: "Backend" });

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe("Backend Engineer");
    });

    it("maps fields: id=`wttj-obj-1`, workArrangement='remote' for remote='fulltime'", async () => {
      const mockFetch = makeSequentialMockFetch(200, ENV_RESPONSE, 200, ALGOLIA_RESPONSE);
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WttjJobScraperAdapter();
      const result = await adapter.scrape({ query: "Backend" });

      const job = result.jobs[0];
      expect(job.id).toBe("wttj-obj-1");
      expect(job.source).toBe("wttj");
      expect(job.workArrangement).toBe("remote");
      expect(job.employmentType).toBe("full-time");
      expect(job.company).toBe("JungleCo");
      expect(job.postedAt).toBeInstanceOf(Date);
      expect(job.url).toContain("obj-1");
    });

    it("maps remote='partial' → workArrangement='hybrid'", async () => {
      const partialHit = { ...ALGOLIA_RESPONSE.hits[0], remote: "partial", job_title: "Hybrid Engineer" };
      const body = { hits: [partialHit], nbHits: 1 };

      const mockFetch = makeSequentialMockFetch(200, ENV_RESPONSE, 200, body);
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WttjJobScraperAdapter();
      const result = await adapter.scrape({});

      expect(result.jobs[0].workArrangement).toBe("hybrid");
    });

    it("maps remote='none' → workArrangement='on-site'", async () => {
      const onSiteHit = { ...ALGOLIA_RESPONSE.hits[1], remote: "none" };
      const body = { hits: [onSiteHit], nbHits: 1 };

      const mockFetch = makeSequentialMockFetch(200, ENV_RESPONSE, 200, body);
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WttjJobScraperAdapter();
      const result = await adapter.scrape({});

      expect(result.jobs[0].workArrangement).toBe("on-site");
    });
  });

  // -------------------------------------------------------------------------
  // 3. Env endpoint fails → adapter surfaces error (BaseAdapter catches throw)
  // -------------------------------------------------------------------------
  describe("scrape – env endpoint fails", () => {
    it("returns empty jobs with error when env responds HTTP 500", async () => {
      // Only one call expected; env fails immediately
      const mockFetch = makeSingleMockFetch(500, {});
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WttjJobScraperAdapter();
      const result = await adapter.scrape({ query: "Backend" });

      expect(result.jobs).toHaveLength(0);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/500/);
    });

    it("returns empty jobs with error when env has missing Algolia keys", async () => {
      // Env responds OK but returns incomplete credentials
      const mockFetch = makeSingleMockFetch(200, { PUBLIC_ALGOLIA_APPLICATION_ID: "", PUBLIC_ALGOLIA_API_KEY_CLIENT: "" });
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WttjJobScraperAdapter();
      const result = await adapter.scrape({ query: "Backend" });

      expect(result.jobs).toHaveLength(0);
      expect(result.error).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Algolia endpoint fails → adapter surfaces error
  // -------------------------------------------------------------------------
  describe("scrape – Algolia endpoint fails", () => {
    it("returns empty jobs with error when Algolia responds HTTP 403", async () => {
      const mockFetch = makeSequentialMockFetch(200, ENV_RESPONSE, 403, {});
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WttjJobScraperAdapter();
      const result = await adapter.scrape({ query: "Backend" });

      expect(result.jobs).toHaveLength(0);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/403/);
    });

    it("returns empty jobs with error when Algolia responds HTTP 500", async () => {
      const mockFetch = makeSequentialMockFetch(200, ENV_RESPONSE, 500, {});
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WttjJobScraperAdapter();
      const result = await adapter.scrape({ query: "Backend" });

      expect(result.jobs).toHaveLength(0);
      expect(result.error).toBeDefined();
    });
  });
});
