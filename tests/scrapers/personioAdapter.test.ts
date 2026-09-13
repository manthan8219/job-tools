import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PersonioJobScraperAdapter } from "../../src/scrapers/adapters/personioAdapter.js";

const PERSONIO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<work-positions>
  <position>
    <id>1001</id>
    <name>Senior Backend Engineer</name>
    <url>https://personio.jobs.personio.de/job/1001</url>
    <office>Munich</office>
    <department>Engineering</department>
    <workplaceType>remote</workplaceType>
  </position>
  <position>
    <id>1002</id>
    <name>Sales Manager</name>
    <url>https://personio.jobs.personio.de/job/1002</url>
    <office>Berlin</office>
    <department>Sales</department>
  </position>
</work-positions>`;

describe("PersonioJobScraperAdapter", () => {
  let adapter: PersonioJobScraperAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    adapter = new PersonioJobScraperAdapter({
      companies: [{ name: "Personio", slug: "personio" }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should report isConfigured, source, and name correctly", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("personio");
    expect(adapter.name).toBe("PersonioJobScraperAdapter");
  });

  it("should parse XML and return only jobs matching the query", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => PERSONIO_XML,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({ query: "Backend", limit: 10 });

    expect(result.source).toBe("personio");
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    expect(job.id).toBe("personio-personio-1001");
    expect(job.title).toBe("Senior Backend Engineer");
    expect(job.company).toBe("Personio");
    expect(job.source).toBe("personio");
    expect(job.url).toBe("https://personio.jobs.personio.de/job/1001");
    expect(job.workArrangement).toBe("remote");
    expect(job.categories).toContain("Engineering");

    // Verify fetch used .text() — stub returns text(), adapter must call response.text()
    expect(mockFetch).toHaveBeenCalledWith(
      "https://personio.jobs.personio.de/xml",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("should return empty jobs array when the company endpoint returns an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      })
    );

    const result = await adapter.scrape({ query: "Backend" });
    expect(result.jobs).toHaveLength(0);
    expect(result.source).toBe("personio");
  });
});
