import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RemoteCoJobScraperAdapter } from "../../src/scrapers/adapters/remoteCoAdapter.js";

// ---------------------------------------------------------------------------
// RSS XML fixture
// ---------------------------------------------------------------------------

const RSS_XML = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Remote.co Jobs</title>
    <item>
      <title>Senior Backend Engineer at Acme Corp</title>
      <link>https://remote.co/job/backend-123</link>
      <guid>remoteco-job-123</guid>
      <pubDate>Mon, 01 Sep 2026 10:00:00 GMT</pubDate>
      <description>Build distributed systems</description>
    </item>
    <item>
      <title>Account Executive at Sales Inc</title>
      <link>https://remote.co/job/sales-456</link>
      <guid>remoteco-job-456</guid>
    </item>
  </channel>
</rss>`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockFetch(xmlText: string, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    text: async () => xmlText,
  });
}

function makeErrorFetch(status = 503) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: async () => "",
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RemoteCoJobScraperAdapter", () => {
  let adapter: RemoteCoJobScraperAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    adapter = new RemoteCoJobScraperAdapter({
      feedUrl: "https://remote.co/remote-jobs/feed/",
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
      expect(adapter.source).toBe("remoteco");
      expect(adapter.name).toBe("RemoteCoJobScraperAdapter");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Successful RSS parse + field mapping + title filtering
  // -------------------------------------------------------------------------
  describe("scrape()", () => {
    it("parses RSS, filters by title, and maps all fields correctly", async () => {
      const mockFetch = makeMockFetch(RSS_XML);
      vi.stubGlobal("fetch", mockFetch);

      const result = await adapter.scrape({ query: "Backend" });

      // Only 'Senior Backend Engineer at Acme Corp' should match
      expect(result.jobs).toHaveLength(1);

      const job = result.jobs[0];

      // ID: remoteco- + encodeURIComponent(guid)
      expect(job.id).toBe(`remoteco-${encodeURIComponent("remoteco-job-123")}`);
      expect(job.title).toBe("Senior Backend Engineer");
      expect(job.company).toBe("Acme Corp");
      expect(job.workArrangement).toBe("remote");
      expect(job.location).toBe("Worldwide (Remote)");
      expect(job.url).toBe("https://remote.co/job/backend-123");
      expect(job.source).toBe("remoteco");
    });

    // -----------------------------------------------------------------------
    // 3. HTTP error -> throws
    // -----------------------------------------------------------------------
    it("returns empty jobs and error message when RSS feed returns non-OK HTTP status", async () => {
      const mockFetch = makeErrorFetch(503);
      vi.stubGlobal("fetch", mockFetch);

      const result = await adapter.scrape({ query: "Backend" });
      expect(result.jobs).toHaveLength(0);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("503");
    });
  });
});
