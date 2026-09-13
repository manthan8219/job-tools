import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NoDeskJobScraperAdapter } from "../../src/scrapers/adapters/noDeskAdapter.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENGINEER_LINK = "https://nodesk.co/remote-jobs/engineer-at-Acme";
const SALES_LINK = "https://nodesk.co/remote-jobs/sales-rep-at-BigCorp";

/**
 * Minimal RSS XML with two <item> elements.
 * Item 1: "Software Engineer at Acme" – should match query='Engineer'
 * Item 2: "Sales Representative at BigCorp" – should NOT match
 */
const RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>NoDesk Remote Jobs</title>
    <link>https://nodesk.co/remote-jobs/</link>
    <description>Remote jobs feed</description>
    <item>
      <title>Software Engineer at Acme</title>
      <link>${ENGINEER_LINK}</link>
      <guid isPermaLink="true">${ENGINEER_LINK}</guid>
      <pubDate>Sat, 13 Sep 2026 07:00:00 +0000</pubDate>
      <description>We are looking for a remote Software Engineer.</description>
      <category>Engineering</category>
    </item>
    <item>
      <title>Sales Representative at BigCorp</title>
      <link>${SALES_LINK}</link>
      <guid isPermaLink="true">${SALES_LINK}</guid>
      <pubDate>Sat, 13 Sep 2026 06:00:00 +0000</pubDate>
      <description>We are looking for a remote Sales Rep.</description>
      <category>Sales</category>
    </item>
  </channel>
</rss>`;

function makeMockFetch(status: number, xml: string) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => xml,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NoDeskJobScraperAdapter", () => {
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
    it("should report correct name, source, and isConfigured", () => {
      const adapter = new NoDeskJobScraperAdapter();
      expect(adapter.name).toBe("NoDeskJobScraperAdapter");
      expect(adapter.source).toBe("nodesk");
      expect(adapter.isConfigured()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Successful parse + title filtering + field mapping
  // -------------------------------------------------------------------------
  describe("scrape – happy path", () => {
    it("returns only jobs matching the query and maps fields correctly", async () => {
      const mockFetch = makeMockFetch(200, RSS_XML);
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new NoDeskJobScraperAdapter();
      const result = await adapter.scrape({ query: "Engineer" });

      // Only the engineer posting should survive title filtering
      expect(result.jobs).toHaveLength(1);
      expect(result.source).toBe("nodesk");

      const job = result.jobs[0];

      // Title / company split on " at "
      expect(job.title).toBe("Software Engineer");
      expect(job.company).toBe("Acme");

      // ID must be `nodesk-${encodeURIComponent(guid)}`
      const expectedId = `nodesk-${encodeURIComponent(ENGINEER_LINK)}`;
      expect(job.id).toBe(expectedId);

      expect(job.source).toBe("nodesk");
      expect(job.workArrangement).toBe("remote");
      expect(job.employmentType).toBe("full-time");
      expect(job.url).toBe(ENGINEER_LINK);
      expect(job.location).toBe("Worldwide (Remote)");
      expect(job.categories).toContain("Engineering");
      expect(job.postedAt).toBeInstanceOf(Date);
    });

    it("fetch is called exactly once with the RSS feed URL", async () => {
      const mockFetch = makeMockFetch(200, RSS_XML);
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new NoDeskJobScraperAdapter();
      await adapter.scrape({ query: "Engineer" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(/nodesk\.co/);
    });

    it("returns no jobs when query does not match any item", async () => {
      const mockFetch = makeMockFetch(200, RSS_XML);
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new NoDeskJobScraperAdapter();
      const result = await adapter.scrape({ query: "DataScientist_XYZ_NOMATCH" });

      expect(result.jobs).toHaveLength(0);
    });

    it("returns all jobs when no query is provided", async () => {
      const mockFetch = makeMockFetch(200, RSS_XML);
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new NoDeskJobScraperAdapter();
      const result = await adapter.scrape({});

      expect(result.jobs).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // 3. HTTP error – graceful handling
  // -------------------------------------------------------------------------
  describe("scrape – HTTP error", () => {
    it("returns empty jobs and an error message on HTTP 500", async () => {
      const mockFetch = makeMockFetch(500, "");
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new NoDeskJobScraperAdapter();
      const result = await adapter.scrape({ query: "Engineer" });

      expect(result.jobs).toHaveLength(0);
      expect(result.totalFound).toBe(0);
      // BaseAdapter catches the throw and surfaces it as result.error
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/500/);
    });

    it("returns empty jobs on HTTP 403", async () => {
      const mockFetch = makeMockFetch(403, "");
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new NoDeskJobScraperAdapter();
      const result = await adapter.scrape({ query: "Engineer" });

      expect(result.jobs).toHaveLength(0);
      expect(result.error).toBeDefined();
    });
  });
});
