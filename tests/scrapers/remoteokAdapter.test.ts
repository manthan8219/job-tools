import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RemoteOKJobScraperAdapter } from "../../src/scrapers/adapters/remoteokAdapter.js";

describe("RemoteOKJobScraperAdapter", () => {
  let adapter: RemoteOKJobScraperAdapter;

  beforeEach(() => {
    adapter = new RemoteOKJobScraperAdapter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should report isConfigured as true", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("remoteok");
    expect(adapter.name).toBe("RemoteOKJobScraperAdapter");
  });

  it("should successfully fetch and map RemoteOK jobs", async () => {
    const mockApiResponse = [
      { legal: "Legal notice" },
      {
        id: "rok-101",
        position: "Staff React Engineer",
        company: "Remote Global",
        tags: ["react", "javascript", "dev"],
        location: "Worldwide",
        salary_min: 140000,
        salary_max: 180000,
        url: "https://remoteok.com/remote-jobs/staff-react-101",
        date: "2026-09-10T12:00:00Z",
        description: "<p>React developer needed</p>",
      },
      {
        id: "rok-102",
        position: "Marketing Manager",
        company: "Brand Co",
        tags: ["marketing"],
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({
      query: "React",
      limit: 10,
    });

    expect(result.source).toBe("remoteok");
    expect(result.jobs).toHaveLength(1);
    const job = result.jobs[0];
    expect(job.id).toBe("remoteok-rok-101");
    expect(job.title).toBe("Staff React Engineer");
    expect(job.company).toBe("Remote Global");
    expect(job.workArrangement).toBe("remote");
    expect(job.salaryMin).toBe(140000);
    expect(job.salaryMax).toBe(180000);
    expect(job.categories).toEqual(["react", "javascript", "dev"]);
    expect(job.description).toBe("<p>React developer needed</p>");
  });

  it("should handle HTTP errors gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    }));

    const result = await adapter.scrape({ query: "Engineer" });
    expect(result.jobs).toHaveLength(0);
    expect(result.error).toBeDefined();
  });
});
