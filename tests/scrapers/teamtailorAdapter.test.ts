import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TeamtailorJobScraperAdapter } from "../../src/scrapers/adapters/teamtailorAdapter.js";

// RSS feed with two items: one Engineer (matches), one Designer (no match)
const TEAMTAILOR_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Pleo Jobs</title>
    <link>https://pleo.teamtailor.com/jobs</link>
    <description>Pleo open positions</description>
    <item>
      <title>Senior Software Engineer</title>
      <link>https://pleo.teamtailor.com/jobs/123-senior-software-engineer</link>
      <description>Join our engineering team to build great products.</description>
      <guid>https://pleo.teamtailor.com/jobs/123-senior-software-engineer</guid>
      <pubDate>Mon, 08 Sep 2026 09:00:00 +0000</pubDate>
      <category>Engineering</category>
    </item>
    <item>
      <title>Product Designer</title>
      <link>https://pleo.teamtailor.com/jobs/124-product-designer</link>
      <description>Shape the visual identity of Pleo.</description>
      <guid>https://pleo.teamtailor.com/jobs/124-product-designer</guid>
      <pubDate>Tue, 09 Sep 2026 09:00:00 +0000</pubDate>
      <category>Design</category>
    </item>
  </channel>
</rss>`;

describe("TeamtailorJobScraperAdapter", () => {
  let adapter: TeamtailorJobScraperAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    adapter = new TeamtailorJobScraperAdapter({
      companies: [{ name: "Pleo", slug: "pleo" }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should report isConfigured, source, and name correctly", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("teamtailor");
    expect(adapter.name).toBe("TeamtailorJobScraperAdapter");
  });

  it("should parse RSS feed and return only jobs matching the query", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => TEAMTAILOR_RSS,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({ query: "Engineer", limit: 10 });

    expect(result.source).toBe("teamtailor");
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    const expectedGuid = "https://pleo.teamtailor.com/jobs/123-senior-software-engineer";
    expect(job.id).toBe(`teamtailor-pleo-${encodeURIComponent(expectedGuid)}`);
    expect(job.title).toBe("Senior Software Engineer");
    expect(job.company).toBe("Pleo");
    expect(job.source).toBe("teamtailor");
    expect(job.url).toBe("https://pleo.teamtailor.com/jobs/123-senior-software-engineer");
    expect(job.categories).toContain("Engineering");
    expect(job.workArrangement).toBe("on-site");
    expect(job.employmentType).toBe("full-time");

    // Verify fetch was called with the correct Teamtailor RSS URL
    expect(mockFetch).toHaveBeenCalledWith(
      "https://pleo.teamtailor.com/jobs.rss",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("should return empty jobs array when the company RSS endpoint returns an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "Forbidden",
      })
    );

    const result = await adapter.scrape({ query: "Engineer" });
    expect(result.jobs).toHaveLength(0);
    expect(result.source).toBe("teamtailor");
  });
});
