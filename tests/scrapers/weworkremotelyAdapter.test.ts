import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WeWorkRemotelyJobScraperAdapter } from "../../src/scrapers/adapters/weworkremotelyAdapter.js";

const RSS_XML = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>We Work Remotely Jobs</title>
    <item>
      <title>Acme Corp: Senior Backend Engineer</title>
      <link>https://weworkremotely.com/jobs/1</link>
      <guid>wwr-job-1</guid>
      <pubDate>Mon, 01 Sep 2026 10:00:00 GMT</pubDate>
      <category>Engineering</category>
      <description>Build APIs</description>
    </item>
    <item>
      <title>Sales Inc: Account Executive</title>
      <link>https://weworkremotely.com/jobs/2</link>
      <guid>wwr-job-2</guid>
    </item>
  </channel>
</rss>`;

describe("WeWorkRemotelyJobScraperAdapter", () => {
  let adapter: WeWorkRemotelyJobScraperAdapter;

  beforeEach(() => {
    adapter = new WeWorkRemotelyJobScraperAdapter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Identity ─────────────────────────────────────────────────────────────
  it("should report correct identity: isConfigured, source, name", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("weworkremotely");
    expect(adapter.name).toBe("WeWorkRemotelyJobScraperAdapter");
  });

  // ── 2. RSS parse + title filter + field mapping ───────────────────────────────
  it("should parse RSS and return only the item whose title matches query='Backend'", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => RSS_XML,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({ query: "Backend", limit: 10 });

    expect(result.source).toBe("weworkremotely");
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    expect(job.id).toBe(`weworkremotely-${encodeURIComponent("wwr-job-1")}`);
    expect(job.title).toBe("Senior Backend Engineer");
    expect(job.company).toBe("Acme Corp");
    expect(job.workArrangement).toBe("remote");
    expect(job.employmentType).toBe("full-time");
    expect(job.location).toBe("Worldwide (Remote)");
    expect(job.url).toBe("https://weworkremotely.com/jobs/1");
  });

  // ── 3. HTTP error → adapter throws (propagated by base as result.error) ──────
  it("should propagate an error when the RSS feed returns a non-ok HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable",
      }),
    );

    const result = await adapter.scrape({ query: "Engineer" });

    // The base adapter catches the thrown error and sets result.error
    expect(result.jobs).toHaveLength(0);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("503");
  });
});
