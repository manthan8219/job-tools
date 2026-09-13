import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EuroRemoteJobsJobScraperAdapter } from "../../src/scrapers/adapters/euroRemoteJobsAdapter.js";

// ---------------------------------------------------------------------------
// RSS XML fixture
// Two items: one matching 'Backend', one non-matching.
// Title format: "Job Title at Company Name"
// ---------------------------------------------------------------------------

const RSS_XML = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>EuroRemoteJobs</title>
    <item>
      <title>Senior Backend Engineer at EuroTech GmbH</title>
      <link>https://euroremotejobs.com/job/backend-engineer-101</link>
      <guid>https://euroremotejobs.com/job/backend-engineer-101</guid>
      <pubDate>Mon, 01 Sep 2026 10:00:00 GMT</pubDate>
      <description>Work on European fintech infrastructure.</description>
      <category>Engineering</category>
    </item>
    <item>
      <title>UX Designer at Creative Studio</title>
      <link>https://euroremotejobs.com/job/ux-designer-202</link>
      <guid>https://euroremotejobs.com/job/ux-designer-202</guid>
      <pubDate>Tue, 02 Sep 2026 09:00:00 GMT</pubDate>
      <description>Design beautiful interfaces.</description>
      <category>Design</category>
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

describe("EuroRemoteJobsJobScraperAdapter", () => {
  let adapter: EuroRemoteJobsJobScraperAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    adapter = new EuroRemoteJobsJobScraperAdapter({
      feedUrl: "https://euroremotejobs.com/feed/",
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
      expect(adapter.source).toBe("euroremotejobs");
      expect(adapter.name).toBe("EuroRemoteJobsJobScraperAdapter");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Successful RSS parse + title filtering + field mapping
  // -------------------------------------------------------------------------
  describe("scrape()", () => {
    it("parses RSS, filters by query title, and maps all fields correctly", async () => {
      const mockFetch = makeMockFetch(RSS_XML);
      vi.stubGlobal("fetch", mockFetch);

      const result = await adapter.scrape({ query: "Backend" });

      // Only 'Senior Backend Engineer at EuroTech GmbH' should match
      expect(result.jobs).toHaveLength(1);

      const job = result.jobs[0];

      // ID: euroremotejobs- + encodeURIComponent(guid)
      const expectedGuid = "https://euroremotejobs.com/job/backend-engineer-101";
      expect(job.id).toBe(`euroremotejobs-${encodeURIComponent(expectedGuid)}`);

      expect(job.title).toBe("Senior Backend Engineer");
      expect(job.company).toBe("EuroTech GmbH");
      expect(job.source).toBe("euroremotejobs");
      expect(job.workArrangement).toBe("remote");
      expect(job.location).toBe("Europe (Remote)");
      expect(job.url).toBe("https://euroremotejobs.com/job/backend-engineer-101");
      expect(job.categories).toContain("Engineering");
    });

    // -----------------------------------------------------------------------
    // 3. HTTP error -> throws (same pattern as remoteCoAdapter)
    // -----------------------------------------------------------------------
    it("returns empty jobs and error message when RSS feed returns non-OK HTTP status", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "",
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await adapter.scrape({ query: "Backend" });
      expect(result.jobs).toHaveLength(0);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("404");
    });
  });
});
