import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DynamiteJobsJobScraperAdapter } from "../../src/scrapers/adapters/dynamiteJobsAdapter.js";

// ---------------------------------------------------------------------------
// RSS XML fixture
// Two items: one matching 'Backend', one non-matching.
// Title format used by DynamiteJobs: "Job Title at Company Name"
// ---------------------------------------------------------------------------

const RSS_XML = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Dynamite Jobs</title>
    <item>
      <title>Senior Backend Engineer at Acme Corp</title>
      <link>https://www.dynamitejobs.com/job/backend-engineer-123</link>
      <guid>https://www.dynamitejobs.com/job/backend-engineer-123</guid>
      <pubDate>Mon, 01 Sep 2026 10:00:00 GMT</pubDate>
      <description>Build distributed backend systems.</description>
      <category>Engineering</category>
    </item>
    <item>
      <title>Content Writer at MediaHouse</title>
      <link>https://www.dynamitejobs.com/job/content-writer-456</link>
      <guid>https://www.dynamitejobs.com/job/content-writer-456</guid>
      <pubDate>Tue, 02 Sep 2026 09:00:00 GMT</pubDate>
      <description>Create compelling content.</description>
      <category>Marketing</category>
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DynamiteJobsJobScraperAdapter", () => {
  let adapter: DynamiteJobsJobScraperAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    adapter = new DynamiteJobsJobScraperAdapter({
      feedUrl: "https://www.dynamitejobs.com/feed/",
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
      expect(adapter.source).toBe("dynamitejobs");
      expect(adapter.name).toBe("DynamiteJobsJobScraperAdapter");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Successful RSS parse + title filtering + field mapping
  // -------------------------------------------------------------------------
  describe("scrape()", () => {
    it("filters by query title and maps all fields correctly", async () => {
      const mockFetch = makeMockFetch(RSS_XML);
      vi.stubGlobal("fetch", mockFetch);

      const result = await adapter.scrape({ query: "Backend" });

      // Only 'Senior Backend Engineer at Acme Corp' should match
      expect(result.jobs).toHaveLength(1);

      const job = result.jobs[0];

      // ID: dynamitejobs- + encodeURIComponent(guid)
      const expectedGuid = "https://www.dynamitejobs.com/job/backend-engineer-123";
      expect(job.id).toBe(`dynamitejobs-${encodeURIComponent(expectedGuid)}`);

      expect(job.title).toBe("Senior Backend Engineer");
      expect(job.company).toBe("Acme Corp");
      expect(job.workArrangement).toBe("remote");
      expect(job.location).toBe("Worldwide (Remote)");
      expect(job.source).toBe("dynamitejobs");
      expect(job.categories).toContain("Engineering");
    });

    // -----------------------------------------------------------------------
    // 3. HTTP error -> graceful handling (empty jobs, no throw)
    // -----------------------------------------------------------------------
    it("returns empty jobs on HTTP error without throwing", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "",
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await adapter.scrape({ query: "Backend" });
      expect(result.jobs).toHaveLength(0);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("503");
    });
  });
});
